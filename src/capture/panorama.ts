// Panorama photos (iPhone Camera "Pano") and wide photos are one very wide image. The model and
// the photo screens work best with normal-shaped frames, so a wide upload is cut
// into overlapping 4:3 slices from left to right — like turning slowly and taking
// several photos. Pure maths, checked by scripts/check-logic.mjs.

export interface Crop {
  originX: number;
  originY: number;
  width: number;
  height: number;
}

// Wider than 2:1 counts as a panorama. Between 1.4:1 and 2:1 (e.g. 16:9) is a wide
// photo: the portrait photo cards would crop away most of the room, so it is cut in
// two overlapping halves. A normal 4:3 landscape photo stays whole.
export const PANORAMA_RATIO = 2;
export const WIDE_RATIO = 1.4;
const SLICE_ASPECT = 4 / 3; // each slice is a standard landscape photo shape
const OVERLAP = 0.25; // each slice shares a quarter with the next, so nothing falls between
export const MAX_SLICES = 6;

export function isPanorama(width: number, height: number): boolean {
  return width > 0 && height > 0 && width / height > PANORAMA_RATIO;
}

// Should this photo be cut into several frames?
export function needsSplit(width: number, height: number): boolean {
  return width > 0 && height > 0 && width / height > WIDE_RATIO;
}

// The crops for one panorama, left to right. A normal photo gives a single
// full-size crop, so callers can treat every photo the same way.
export function panoramaSlices(width: number, height: number): Crop[] {
  const W = Math.floor(width);
  const H = Math.floor(height);
  if (!needsSplit(W, H)) return [{ originX: 0, originY: 0, width: W, height: H }];
  if (!isPanorama(W, H)) {
    // Wide photo: two halves sharing a quarter of each, edge to edge.
    const half = Math.ceil(W / (2 - OVERLAP));
    return [
      { originX: 0, originY: 0, width: half, height: H },
      { originX: W - half, originY: 0, width: half, height: H },
    ];
  }

  let sliceW = Math.min(W, Math.round(H * SLICE_ASPECT));
  const step = sliceW * (1 - OVERLAP);
  const count = Math.min(MAX_SLICES, Math.max(2, Math.ceil((W - sliceW) / step) + 1));
  // A very long panorama hits the slice limit: widen the slices so they still overlap.
  sliceW = Math.max(sliceW, Math.ceil(W / (count - (count - 1) * OVERLAP)));
  // Spread the slices evenly so the first starts at the left edge and the last ends at the right.
  const gap = count > 1 ? (W - sliceW) / (count - 1) : 0;
  return Array.from({ length: count }, (_, i) => ({
    originX: Math.round(i * gap),
    originY: 0,
    width: sliceW,
    height: H,
  }));
}
