// Turns an AI Assessment into a simple parametric 3D room scene (PRD §3, the
// later-stage 3D view). This is a GENERATED room — a faithful stand-in for the
// RoomPlan / 3D-scan output described in the PRD, not a photoreal reconstruction
// (that needs LiDAR + native code). Object-scope hazards become highlighted
// objects with a tappable risk marker; space-scope hazards stay in the banner.

import type { Assessment, Hazard, Severity } from '../types';
import { CATEGORY_LABELS } from '../ai/categories';
import { FRAME_COUNT } from '../demo/room';

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface Furniture {
  name: string;
  kind: 'window' | 'door' | 'shelf' | 'tv' | 'cabinet' | 'sofa' | 'plant';
  pos: [number, number, number];
  size: [number, number, number];
  color: string;
  highlight: boolean;
}

export interface Marker {
  id: string;
  number: number;
  severity: Severity;
  pos: [number, number, number];
  title: string;
  category: string;
  categoryLabel: string;
  risk_to: string;
  why: string;
  fix: string;
}

export interface Scene3D {
  room: { W: number; D: number; H: number };
  furniture: Furniture[];
  markers: Marker[];
  verdict: string | null;
  score: number | null;
  summary: string;
  recommended: { species: string; breed: string }[];
}

const ROOM = { W: 8, D: 6, H: 3 };
const BACK = -ROOM.D / 2; // z of the back wall

// Fixed furniture layout (left → right), matching the demo room story.
const FURNITURE: Furniture[] = [
  { name: 'Window', kind: 'window', pos: [-3.0, 1.4, BACK + 0.06], size: [1.7, 1.6, 0.12], color: '#bfe0f5', highlight: false },
  { name: 'Plant', kind: 'plant', pos: [-2.05, 0.32, BACK + 0.5], size: [0.42, 0.6, 0.42], color: '#5aa06a', highlight: false },
  { name: 'Bookshelf', kind: 'shelf', pos: [-0.9, 1.0, BACK + 0.28], size: [1.1, 2.0, 0.42], color: '#8c6a48', highlight: false },
  { name: 'TV console', kind: 'tv', pos: [0.5, 0.36, BACK + 0.28], size: [1.7, 0.72, 0.42], color: '#3a3f47', highlight: false },
  { name: 'Balcony door', kind: 'door', pos: [1.9, 1.2, BACK + 0.06], size: [1.4, 2.4, 0.1], color: '#a9d3ec', highlight: false },
  { name: 'Cabinet', kind: 'cabinet', pos: [3.1, 0.36, BACK + 0.3], size: [1.2, 0.72, 0.46], color: '#e0dacb', highlight: false },
  { name: 'Sofa', kind: 'sofa', pos: [2.2, 0.42, 1.5], size: [2.1, 0.85, 0.95], color: '#8a94a3', highlight: false },
];

// Where the risk marker floats for a hazard mapped to a given furniture kind.
function markerPosFor(kind: Furniture['kind'], f: Furniture): [number, number, number] {
  const [x, y, z] = f.pos;
  const frontZ = z + f.size[2] / 2 + 0.22;
  switch (kind) {
    case 'plant':
      return [x, 0.62, frontZ];
    case 'tv':
      return [x, 0.22, z + f.size[2] / 2 + 0.55]; // cords on the floor in front
    case 'cabinet':
      return [x, 0.22, z + f.size[2] / 2 + 0.45];
    case 'shelf':
      return [x, 1.05, frontZ];
    case 'window':
      return [x, 1.35, frontZ];
    case 'door':
      return [x, 1.2, frontZ];
    case 'sofa':
      return [x, 0.9, z - f.size[2] / 2 - 0.2];
  }
}

// Choose the furniture a hazard belongs to, from its category + title.
function kindForHazard(h: Hazard): Furniture['kind'] | null {
  const t = (h.title + ' ' + h.category).toLowerCase();
  switch (h.category) {
    case 'A':
      return 'plant';
    case 'B':
      return 'tv';
    case 'C':
      return 'cabinet';
    case 'D':
      return 'shelf';
    case 'G':
      return /balcon|door/.test(t) ? 'door' : 'window';
    default:
      return null;
  }
}

export function buildScene(result: Assessment): Scene3D {
  const furniture: Furniture[] = FURNITURE.map((f) => ({ ...f }));
  const byKind = new Map<string, Furniture>(furniture.map((f) => [f.kind, f]));

  const objectHazards = result.hazards.filter((h) => h.scope === 'object');
  const markers: Marker[] = objectHazards.map((h, i) => {
    const kind = kindForHazard(h);
    let pos: [number, number, number];
    if (kind && byKind.has(kind)) {
      const f = byKind.get(kind)!;
      f.highlight = true;
      pos = markerPosFor(kind, f);
    } else {
      // Fallback: place along the back wall from the frame index + x/y.
      const fi = h.location?.frame_index ?? 0;
      const u = (fi + (h.location?.x ?? 0.5)) / Math.max(1, FRAME_COUNT);
      const yy = h.location?.y ?? 0.5;
      pos = [-3.4 + u * 6.8, 0.3 + (1 - yy) * 2.2, BACK + 0.5];
    }
    return {
      id: h.id,
      number: i + 1,
      severity: h.severity,
      pos,
      title: h.title,
      category: h.category,
      categoryLabel: CATEGORY_LABELS[h.category],
      risk_to: h.risk_to,
      why: h.why_it_matters,
      fix: h.recommendation,
    };
  });

  return {
    room: ROOM,
    furniture,
    markers,
    verdict: result.suitability?.verdict ?? null,
    score: result.suitability?.score_0_100 ?? null,
    summary: result.space_summary,
    recommended: result.recommended_pets.map((p) => ({ species: p.species, breed: p.breed })),
  };
}
