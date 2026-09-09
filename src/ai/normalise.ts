// Defensive normalisation of model JSON into a safe Assessment (PRD §11:
// "variable AI output -> defensive parsing"). Guarantees arrays exist, clamps
// coordinates to [0,1], and — per the risk note — falls back to the centre of
// the named frame when a coordinate is missing or out of range.

import type {
  Assessment,
  Hazard,
  HazardCategory,
  Session,
  Severity,
} from '../types';

const CATS = 'ABCDEFGHIJKLMN'.split('');
const SEVS: Severity[] = ['low', 'medium', 'high'];

function clamp01(n: any, fallback: number): number {
  const v = typeof n === 'number' ? n : parseFloat(n);
  if (!isFinite(v)) return fallback;
  return Math.max(0, Math.min(1, v));
}

function asSeverity(s: any): Severity {
  return SEVS.includes(s) ? s : 'medium';
}

function asCategory(c: any): HazardCategory {
  return CATS.includes(c) ? (c as HazardCategory) : 'I';
}

function normaliseHazard(h: any, frameCount: number, i: number): Hazard {
  const scope: 'object' | 'space' = h?.scope === 'space' ? 'space' : 'object';
  let location: Hazard['location'] = null;

  if (scope === 'object') {
    const rawFrame = Number(h?.location?.frame_index);
    const frame_index =
      Number.isInteger(rawFrame) && rawFrame >= 0 && rawFrame < Math.max(1, frameCount)
        ? rawFrame
        : 0;
    // Missing/out-of-range coords -> centre of the frame (PRD risk mitigation).
    const x = clamp01(h?.location?.x, 0.5);
    const y = clamp01(h?.location?.y, 0.5);
    location = { frame_index, x, y };
    const bb = h?.location?.bbox;
    if (Array.isArray(bb) && bb.length === 4) {
      location.bbox = [clamp01(bb[0], 0), clamp01(bb[1], 0), clamp01(bb[2], 0), clamp01(bb[3], 0)];
    }
  }

  return {
    id: typeof h?.id === 'string' && h.id ? h.id : `hz_${i + 1}`,
    category: asCategory(h?.category),
    title: str(h?.title, 'Finding'),
    scope,
    location,
    risk_to: ['animal', 'home', 'both'].includes(h?.risk_to) ? h.risk_to : 'animal',
    severity: asSeverity(h?.severity),
    evidence: str(h?.evidence, ''),
    why_it_matters: str(h?.why_it_matters, ''),
    recommendation: str(h?.recommendation, ''),
  };
}

function str(v: any, fallback: string): string {
  return typeof v === 'string' ? v : fallback;
}

export function normaliseAssessment(raw: any, session: Session): Assessment {
  const frameCount = session.capture.frames.length;
  const mode: Assessment['mode'] =
    raw?.mode === 'explore' || raw?.mode === 'pet_in_mind'
      ? raw.mode
      : session.mode ?? 'pet_in_mind';

  const hazards: Hazard[] = Array.isArray(raw?.hazards)
    ? raw.hazards.map((h: any, i: number) => normaliseHazard(h, frameCount, i))
    : [];

  const improvements: string[] = Array.isArray(raw?.improvements)
    ? raw.improvements.filter((s: any) => typeof s === 'string')
    : [];

  let suitability: Assessment['suitability'] = null;
  if (mode === 'pet_in_mind' && raw?.suitability) {
    const s = raw.suitability;
    suitability = {
      verdict: ['well_suited', 'suitable_with_changes', 'poorly_suited'].includes(s?.verdict)
        ? s.verdict
        : 'suitable_with_changes',
      score_0_100: clampScore(s?.score_0_100),
      rationale: str(s?.rationale, ''),
    };
  }

  let recommended_pets: Assessment['recommended_pets'] = [];
  if (mode === 'explore' && Array.isArray(raw?.recommended_pets)) {
    recommended_pets = raw.recommended_pets.slice(0, 3).map((p: any) => ({
      species: str(p?.species, 'Pet'),
      breed: str(p?.breed, ''),
      why: str(p?.why, ''),
      caveats: str(p?.caveats, ''),
    }));
  }

  return {
    mode,
    space_summary: str(raw?.space_summary, 'A room captured across several frames.'),
    confidence: ['low', 'medium', 'high'].includes(raw?.confidence) ? raw.confidence : 'medium',
    hazards,
    improvements,
    suitability,
    recommended_pets,
    notes: str(raw?.notes, ''),
  };
}

function clampScore(n: any): number {
  const v = typeof n === 'number' ? n : parseInt(n, 10);
  if (!isFinite(v)) return 50;
  return Math.max(0, Math.min(100, Math.round(v)));
}
