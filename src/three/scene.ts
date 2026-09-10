// Turns an AI Assessment into a simple parametric 3D room scene (PRD §3, the
// later-stage 3D view). This is a GENERATED room — a faithful stand-in for the
// RoomPlan / 3D-scan output described in the PRD, not a photoreal reconstruction
// (that needs LiDAR + native code).
//
// The room is generated FROM THE FINDINGS of THIS assessment: each object-scope
// hazard becomes one highlighted prop placed where the model located it in the
// photos (frame index + x/y), so a different room produces a different scene.
// Space-scope findings have no location and stay in the banner.

import type { Assessment, Hazard, HazardCategory, Severity } from '../types';
import { CATEGORY_LABELS } from '../ai/categories';

export interface Furniture {
  name: string;
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

// Per-category look. `mount`: 'wall' = flat panel on the back wall (windows,
// doors); 'floor' = box on the floor (plants, cords, chemicals); 'mid' = a box
// at the finding's own height (fragile items on shelves, etc.).
const STYLE: Record<HazardCategory, { color: string; size: [number, number, number]; mount: 'wall' | 'floor' | 'mid' }> = {
  A: { color: '#5aa06a', size: [0.5, 0.7, 0.5], mount: 'floor' }, // plant
  B: { color: '#3a3f47', size: [0.7, 0.35, 0.5], mount: 'floor' }, // cords
  C: { color: '#c9a24a', size: [0.5, 0.5, 0.5], mount: 'floor' }, // chemicals
  D: { color: '#c0a58a', size: [0.5, 0.55, 0.45], mount: 'mid' }, // sharp/fragile
  E: { color: '#9aa3ad', size: [0.9, 0.3, 0.6], mount: 'floor' }, // thermal/surface
  F: { color: '#8a94a3', size: [0.9, 0.5, 0.7], mount: 'floor' }, // floors/stairs
  G: { color: '#aad3ec', size: [1.5, 1.6, 0.1], mount: 'wall' }, // escape/fall (window/door)
  H: { color: '#8c6a48', size: [0.5, 1.6, 0.4], mount: 'mid' }, // vertical space
  I: { color: '#9aa3ad', size: [1.0, 0.5, 0.8], mount: 'floor' }, // floor space
  J: { color: '#b06a8a', size: [0.7, 1.4, 0.3], mount: 'mid' }, // off-limit zone
  K: { color: '#7d8aa0', size: [1.2, 1.2, 0.1], mount: 'wall' }, // outside stressors
  L: { color: '#4aa3c0', size: [1.0, 0.4, 0.8], mount: 'floor' }, // amenities (pool)
  M: { color: '#8a94a3', size: [1.6, 0.8, 0.9], mount: 'floor' }, // occupants
  N: { color: '#8a7ac0', size: [0.6, 0.9, 0.5], mount: 'mid' }, // behavioural
};

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

export function buildScene(result: Assessment, frameCount: number): Scene3D {
  const nFrames = Math.max(1, frameCount);
  const furniture: Furniture[] = [];
  const markers: Marker[] = [];

  const objectHazards = result.hazards.filter((h) => h.scope === 'object' && h.location);

  objectHazards.forEach((h, i) => {
    const loc = h.location!;
    const st = STYLE[h.category] ?? STYLE.I;

    // Horizontal position: sweep runs left→right, so (frame + x) maps across the room.
    const u = clamp01((loc.frame_index + clamp01(loc.x)) / nFrames);
    const worldX = -3.4 + u * 6.8;
    const yy = clamp01(loc.y);

    let center: [number, number, number];
    if (st.mount === 'wall') {
      center = [worldX, (1 - yy) * 1.7 + 0.9, BACK + st.size[2] / 2 + 0.02];
    } else if (st.mount === 'floor') {
      center = [worldX, st.size[1] / 2 + 0.02, BACK + 0.7];
    } else {
      center = [worldX, (1 - yy) * 1.5 + 0.55, BACK + 0.5];
    }

    furniture.push({
      name: h.title,
      pos: center,
      size: st.size,
      color: st.color,
      highlight: true,
    });

    const topY = center[1] + st.size[1] / 2 + 0.28;
    markers.push({
      id: h.id,
      number: i + 1,
      severity: h.severity,
      pos: [center[0], topY, center[2] + 0.12],
      title: h.title,
      category: h.category,
      categoryLabel: CATEGORY_LABELS[h.category],
      risk_to: h.risk_to,
      why: h.why_it_matters,
      fix: h.recommendation,
    });
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
