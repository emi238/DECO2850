// Decode a YOLOv8 detection tensor into boxes. This is plain, testable logic —
// the camera/native side (LiveScanNative) feeds it the model's raw output array.
//
// YOLOv8 typically outputs [1, 84, 8400]: 8400 candidate boxes, each with 4 box
// values (cx, cy, w, h) + 80 class scores, laid out "class-major" (all cx, then
// all cy, …). Coordinates are in input-image pixels (e.g. 0–640), so we divide by
// `inputSize` to get normalised [0,1] boxes. Exported models vary — if detections
// come out wrong on-device, the layout/inputSize/normalisation is what to check.

import type { Detection } from './coco';
import { COCO_CLASSES } from './coco';

export interface DecodeOpts {
  numClasses?: number; // default 80 (COCO)
  numBoxes?: number; // default 8400
  inputSize?: number; // pixel size the model was fed (default 640); 1 if already normalised
  confThreshold?: number; // default 0.4
  iouThreshold?: number; // default 0.45
  layout?: 'class-major' | 'box-major';
}

function iou(a: Detection, b: Detection): number {
  const ax2 = a.x + a.w;
  const ay2 = a.y + a.h;
  const bx2 = b.x + b.w;
  const by2 = b.y + b.h;
  const ix = Math.max(0, Math.min(ax2, bx2) - Math.max(a.x, b.x));
  const iy = Math.max(0, Math.min(ay2, by2) - Math.max(a.y, b.y));
  const inter = ix * iy;
  const union = a.w * a.h + b.w * b.h - inter;
  return union <= 0 ? 0 : inter / union;
}

// Greedy non-max suppression (per class) — drops overlapping duplicate boxes.
export function nms(dets: Detection[], iouThreshold: number): Detection[] {
  const kept: Detection[] = [];
  const byConf = [...dets].sort((a, b) => b.confidence - a.confidence);
  for (const d of byConf) {
    if (kept.some((k) => k.classId === d.classId && iou(k, d) > iouThreshold)) continue;
    kept.push(d);
  }
  return kept;
}

export function decodeYolo(data: ArrayLike<number>, opts: DecodeOpts = {}): Detection[] {
  const numClasses = opts.numClasses ?? 80;
  const numBoxes = opts.numBoxes ?? 8400;
  const inputSize = opts.inputSize ?? 640;
  const conf = opts.confThreshold ?? 0.4;
  const iouT = opts.iouThreshold ?? 0.45;
  const layout = opts.layout ?? 'class-major';
  const stride = 4 + numClasses;

  // Accessor for value [attribute a, box b] regardless of memory layout.
  const at = layout === 'class-major'
    ? (a: number, b: number) => data[a * numBoxes + b]
    : (a: number, b: number) => data[b * stride + a];

  const dets: Detection[] = [];
  for (let b = 0; b < numBoxes; b++) {
    // Best class for this box.
    let bestC = -1;
    let bestS = 0;
    for (let c = 0; c < numClasses; c++) {
      const s = at(4 + c, b);
      if (s > bestS) {
        bestS = s;
        bestC = c;
      }
    }
    if (bestC < 0 || bestS < conf) continue;

    const cx = at(0, b) / inputSize;
    const cy = at(1, b) / inputSize;
    const w = at(2, b) / inputSize;
    const h = at(3, b) / inputSize;
    dets.push({
      classId: bestC,
      label: COCO_CLASSES[bestC] ?? String(bestC),
      confidence: bestS,
      x: cx - w / 2,
      y: cy - h / 2,
      w,
      h,
    });
  }
  return nms(dets, iouT);
}
