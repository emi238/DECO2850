// Build a room from the photo library instead of the live camera: pick photos,
// or pick a video and sample frames out of it. Everything is resized and encoded
// to small JPEGs (with base64) so it feeds straight into the real-AI path.

import * as ImagePicker from 'expo-image-picker';
import * as VideoThumbnails from 'expo-video-thumbnails';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import type { Frame } from '../types';
import { needsSplit, panoramaSlices } from './panorama';

const MAX_FRAMES = 10;
const TARGET_WIDTH = 1024;
const VIDEO_SAMPLES = 8;

// Result shape lets the caller tell "cancelled" from "no permission".
export type PickResult =
  | { status: 'ok'; frames: Frame[] }
  | { status: 'cancelled' }
  | { status: 'denied' }
  | { status: 'empty' };

// Resize an image and return a Frame with small JPEG base64 (kept light for the model).
async function toFrame(uri: string): Promise<Frame> {
  try {
    const r = await manipulateAsync(uri, [{ resize: { width: TARGET_WIDTH } }], {
      base64: true,
      compress: 0.6,
      format: SaveFormat.JPEG,
    });
    return { uri: r.uri, base64: r.base64 ?? undefined, mime: 'image/jpeg' };
  } catch {
    return { uri, mime: 'image/jpeg' };
  }
}

// A wide photo or panorama becomes several overlapping frames (see panorama.ts); a
// normal photo stays one frame.
async function toFrames(asset: ImagePicker.ImagePickerAsset): Promise<Frame[]> {
  if (!needsSplit(asset.width, asset.height)) return [await toFrame(asset.uri)];
  const out: Frame[] = [];
  for (const crop of panoramaSlices(asset.width, asset.height)) {
    try {
      const r = await manipulateAsync(asset.uri, [{ crop }, { resize: { width: TARGET_WIDTH } }], {
        base64: true,
        compress: 0.6,
        format: SaveFormat.JPEG,
      });
      out.push({ uri: r.uri, base64: r.base64 ?? undefined, mime: 'image/jpeg' });
    } catch {
      // Skip a slice that couldn't be cut; the others still cover the room.
    }
  }
  return out.length ? out : [await toFrame(asset.uri)];
}

async function ensurePermission(): Promise<boolean> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  return perm.granted;
}

export async function pickPhotos(): Promise<PickResult> {
  if (!(await ensurePermission())) return { status: 'denied' };
  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: true,
    selectionLimit: MAX_FRAMES,
    quality: 0.7,
    orderedSelection: true,
  });
  if (res.canceled) return { status: 'cancelled' };
  if (!res.assets?.length) return { status: 'empty' };
  const perAsset = await Promise.all(res.assets.slice(0, MAX_FRAMES).map(toFrames));
  const frames = perAsset.flat().slice(0, MAX_FRAMES);
  return { status: 'ok', frames };
}

export async function pickVideoFrames(): Promise<PickResult> {
  if (!(await ensurePermission())) return { status: 'denied' };
  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['videos'],
    allowsMultipleSelection: false,
    quality: 1,
  });
  if (res.canceled) return { status: 'cancelled' };
  const video = res.assets?.[0];
  if (!video) return { status: 'empty' };

  const durationMs = video.duration ?? 0;
  const times: number[] = [];
  for (let i = 0; i < VIDEO_SAMPLES; i++) {
    // Evenly spaced samples, skipping the very start/end of the clip.
    times.push(durationMs > 0 ? Math.floor(((i + 0.5) / VIDEO_SAMPLES) * durationMs) : i * 700);
  }

  const thumbUris: string[] = [];
  for (const t of times) {
    try {
      const th = await VideoThumbnails.getThumbnailAsync(video.uri, { time: t, quality: 0.7 });
      thumbUris.push(th.uri);
    } catch {
      // Skip a frame that couldn't be extracted.
    }
  }
  if (!thumbUris.length) return { status: 'empty' };
  const frames = await Promise.all(thumbUris.map(toFrame));
  return { status: 'ok', frames };
}
