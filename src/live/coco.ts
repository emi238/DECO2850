// COCO-80 → PawSpace hazard mapping. A YOLO model trained on the COCO dataset
// outputs one of these 80 everyday-object classes per detection; this maps the
// home-relevant ones onto our A–N hazard categories (src/ai/categories.ts) so the
// live detector feeds the SAME evaluate.ts / recommend.ts logic the rest of the
// app uses. Classes not in the map are ignored (not pet-relevant).

import type { HazardCategory, Severity } from '../types';

// The 80 COCO class names, in the standard index order YOLO emits.
export const COCO_CLASSES = [
  'person', 'bicycle', 'car', 'motorcycle', 'airplane', 'bus', 'train', 'truck', 'boat', 'traffic light',
  'fire hydrant', 'stop sign', 'parking meter', 'bench', 'bird', 'cat', 'dog', 'horse', 'sheep', 'cow',
  'elephant', 'bear', 'zebra', 'giraffe', 'backpack', 'umbrella', 'handbag', 'tie', 'suitcase', 'frisbee',
  'skis', 'snowboard', 'sports ball', 'kite', 'baseball bat', 'baseball glove', 'skateboard', 'surfboard',
  'tennis racket', 'bottle', 'wine glass', 'cup', 'fork', 'knife', 'spoon', 'bowl', 'banana', 'apple',
  'sandwich', 'orange', 'broccoli', 'carrot', 'hot dog', 'pizza', 'donut', 'cake', 'chair', 'couch',
  'potted plant', 'bed', 'dining table', 'toilet', 'tv', 'laptop', 'mouse', 'remote', 'keyboard', 'cell phone',
  'microwave', 'oven', 'toaster', 'sink', 'refrigerator', 'book', 'clock', 'vase', 'scissors', 'teddy bear',
  'hair drier', 'toothbrush',
] as const;

interface Mapped {
  category: HazardCategory;
  severity: Severity;
  why: string;
  fix: string;
}

// Home objects a dog can reach or be affected by → a hazard category + copy.
const MAP: Record<string, Mapped> = {
  'potted plant': { category: 'A', severity: 'medium', why: 'Many houseplants are toxic if a dog chews the leaves or digs the soil.', fix: 'Move the plant out of reach or swap it for a pet-safe species.' },
  knife: { category: 'D', severity: 'high', why: 'A sharp blade within reach can injure a curious dog.', fix: 'Store knives in a closed drawer or block.' },
  scissors: { category: 'D', severity: 'high', why: 'Sharp points at floor or counter height are a cut risk.', fix: 'Keep scissors in a closed drawer.' },
  fork: { category: 'D', severity: 'low', why: 'Small sharp utensils can be swallowed or cause cuts.', fix: 'Clear utensils from reachable surfaces.' },
  'wine glass': { category: 'D', severity: 'medium', why: 'Fragile glass can shatter and cut paws if knocked over.', fix: 'Move glassware to a closed cabinet.' },
  vase: { category: 'D', severity: 'medium', why: 'A vase is easily knocked over and shatters into sharp pieces.', fix: 'Place vases well out of a wagging tail’s reach.' },
  bottle: { category: 'C', severity: 'medium', why: 'Bottles may hold cleaning fluids or chemicals harmful if chewed.', fix: 'Store bottles in a latched cupboard.' },
  cup: { category: 'D', severity: 'low', why: 'Cups near the edge can fall and break.', fix: 'Keep cups back from counter edges.' },
  bowl: { category: 'D', severity: 'low', why: 'Fragile bowls can be knocked down and broken.', fix: 'Set bowls back from the edge.' },
  oven: { category: 'E', severity: 'medium', why: 'A hot oven door or stovetop can burn a dog.', fix: 'Use a stove guard and keep the dog out while cooking.' },
  toaster: { category: 'E', severity: 'low', why: 'Toasters get hot and have a dangling cord.', fix: 'Push the toaster back and tuck the cord away.' },
  microwave: { category: 'E', severity: 'low', why: 'Warm surfaces and a cord within reach.', fix: 'Keep the cord tucked and the unit back from the edge.' },
  tv: { category: 'H', severity: 'high', why: 'A TV can tip onto a dog that bumps the stand.', fix: 'Anti-tip strap the TV and the stand to the wall.' },
  refrigerator: { category: 'H', severity: 'low', why: 'Tall appliance; watch for magnets/items that fall.', fix: 'Keep small fridge magnets out of reach.' },
  toilet: { category: 'L', severity: 'low', why: 'Open toilets tempt drinking and can hold cleaner residue.', fix: 'Keep the lid down or the door closed.' },
  sink: { category: 'L', severity: 'low', why: 'Standing water and under-sink chemicals are a draw.', fix: 'Latch the under-sink cupboard.' },
  laptop: { category: 'D', severity: 'medium', why: 'Charging cables and a laptop are tempting to chew.', fix: 'Route cables through a cover and store the laptop up high.' },
  remote: { category: 'D', severity: 'low', why: 'Small remotes are a choking/chewing hazard.', fix: 'Keep remotes off the floor and sofa edge.' },
  'cell phone': { category: 'D', severity: 'low', why: 'Phones and their cables are chewable.', fix: 'Keep phones and chargers out of reach.' },
  keyboard: { category: 'D', severity: 'low', why: 'Keys and cables can be chewed and swallowed.', fix: 'Store peripherals off the floor.' },
  book: { category: 'I', severity: 'low', why: 'Clutter on the floor eats into the dog’s open space.', fix: 'Clear floor clutter to open the room up.' },
  couch: { category: 'I', severity: 'low', why: 'Large furniture reduces the open floor a dog needs.', fix: 'Leave a clear path and a clutter-free corner.' },
  chair: { category: 'I', severity: 'low', why: 'Furniture reduces usable floor space.', fix: 'Keep walkways clear.' },
  bed: { category: 'I', severity: 'low', why: 'Large footprint reduces open floor.', fix: 'Keep a clear route around it.' },
  'dining table': { category: 'I', severity: 'low', why: 'Table and chairs take floor space.', fix: 'Tuck chairs in to free up the floor.' },
  person: { category: 'M', severity: 'low', why: 'Busy foot traffic can crowd a nervous dog.', fix: 'Give the dog a quiet corner away from through-traffic.' },
  dog: { category: 'M', severity: 'low', why: 'Another dog in the space affects sociability and space.', fix: 'Plan separate feeding/resting spots.' },
  cat: { category: 'M', severity: 'low', why: 'A resident cat needs its own escape routes and high spots.', fix: 'Give the cat vertical escape space.' },
};

export interface Detection {
  classId: number;
  label: string;
  confidence: number;
  // Normalised bbox [0,1] in the camera frame.
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface MappedDetection extends Detection {
  category: HazardCategory;
  severity: Severity;
  why: string;
  fix: string;
  isHazard: boolean;
}

export function mapDetection(d: Detection): MappedDetection {
  const m = MAP[d.label];
  return {
    ...d,
    category: m?.category ?? 'I',
    severity: m?.severity ?? 'low',
    why: m?.why ?? '',
    fix: m?.fix ?? '',
    isHazard: !!m,
  };
}
