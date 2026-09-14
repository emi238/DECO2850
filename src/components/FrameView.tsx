// Renders a single captured frame (a photo) at a given size, cropped to fill.

import React, { useEffect, useState } from 'react';
import { Image, View, StyleSheet } from 'react-native';
import type { Frame } from '../types';
import { colors } from '../theme';

export function FrameView({
  frame,
  width,
  height,
  radius = 0,
}: {
  frame: Frame;
  width: number;
  height: number;
  radius?: number;
}) {
  return (
    <View style={[styles.wrap, { width, height, borderRadius: radius }]}>
      <Image source={{ uri: frame.uri }} style={{ width, height }} resizeMode="cover" />
    </View>
  );
}

// Natural pixel size of a frame's image (null while it is still loading).
export function useFrameImageSize(frame: Frame | undefined): { w: number; h: number } | null {
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const uri = frame?.uri;
  useEffect(() => {
    if (!uri) return setSize(null);
    let alive = true;
    Image.getSize(uri, (w, h) => alive && setSize({ w, h }), () => alive && setSize(null));
    return () => {
      alive = false;
    };
  }, [uri]);
  return size;
}

// Frames are drawn "cover" (cropped to fill). These convert between a point in
// the drawn box and a 0–1 position on the underlying image, so a pin placed on
// one screen lands on the same object on another screen with a different crop.
function coverBox(img: { w: number; h: number } | null, W: number, H: number) {
  if (!img) return { dw: W, dh: H, ox: 0, oy: 0 };
  const scale = Math.max(W / img.w, H / img.h);
  const dw = img.w * scale;
  const dh = img.h * scale;
  return { dw, dh, ox: (dw - W) / 2, oy: (dh - H) / 2 };
}

export function viewToImage(img: { w: number; h: number } | null, W: number, H: number, vx: number, vy: number) {
  const b = coverBox(img, W, H);
  return { x: clamp01((vx + b.ox) / b.dw), y: clamp01((vy + b.oy) / b.dh) };
}

export function imageToView(img: { w: number; h: number } | null, W: number, H: number, nx: number, ny: number) {
  const b = coverBox(img, W, H);
  return { x: nx * b.dw - b.ox, y: ny * b.dh - b.oy };
}

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

const styles = StyleSheet.create({
  wrap: {
    overflow: 'hidden',
    backgroundColor: colors.bgElevated,
  },
});
