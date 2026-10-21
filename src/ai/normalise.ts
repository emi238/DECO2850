// Defensive normalisation of model JSON into a safe Assessment (logic v2,
// CHANGE PRD 15 Oct 2026 §6). The Gemini responseSchema should already enforce
// the shape; this is the second line of defence, and it also:
//  - drops findings with values outside the allowed lists (instead of guessing),
//  - fills every new field with a safe default (confidence defaults to "low"),
//  - clamps coordinates to [0,1] and pins a missing location at the centre of frame 0,
//  - forces escape/fall findings to be pinnable objects (W7),
//  - merges the same physical object reported twice (W8/W9, by object_key),
//  - turns the user's tags into "protect this" entries pinned at the tag's own x,y (W5).

import type {
  Assessment,
  Confidence,
  DetectedSignals,
  DogSpot,
  EscapeRoute,
  Hazard,
  HazardCategory,
  HazardType,
  OffLimitSuggestion,
  RoomAssessment,
  SafetyAddition,
  Severity,
  Space,
  Tag,
} from '../types';
import {
  CATEGORIES,
  CLEAR_PATH,
  CONFIDENCES,
  DOG_SPOT_PURPOSES,
  ESCAPE_TYPES,
  FLOOR_TYPES,
  HAZARD_TYPES,
  MAX_DOG_SPOTS,
  MAX_OFF_LIMITS,
  MAX_SAFETY_ADDITIONS,
  OFF_LIMIT_ZONES,
  OPENNESS,
  RETREAT,
  RISK_TO,
  SAFETY_ADDITION_TYPES,
  SEVERITIES,
  SIGNAL_CHILDREN,
  SIGNAL_DWELLING,
  SIGNAL_OUTDOOR,
  SIGNAL_PETS,
} from './schema';

const RANK3: Record<string, number> = { low: 0, medium: 1, high: 2 };

function pick<T extends string>(allowed: readonly T[], v: unknown, fallback: T): T {
  return allowed.includes(v as T) ? (v as T) : fallback;
}

function isOneOf<T extends string>(allowed: readonly T[], v: unknown): v is T {
  return allowed.includes(v as T);
}

function clamp01(n: any, fallback: number): number {
  const v = typeof n === 'number' ? n : parseFloat(n);
  if (!isFinite(v)) return fallback;
  return Math.max(0, Math.min(1, v));
}

function frameIndex(raw: any, frameCount: number): number {
  const n = Number(raw);
  return Number.isInteger(n) && n >= 0 && n < Math.max(1, frameCount) ? n : 0;
}

function str(v: any, fallback: string): string {
  return typeof v === 'string' ? v : fallback;
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// When the model leaves hazard_type out, fall back on the checklist letter.
export function typeFromCategory(c: HazardCategory): HazardType {
  switch (c) {
    case 'A':
    case 'C':
      return 'toxic_ingestible';
    case 'B':
    case 'E':
      return 'electrical_thermal';
    case 'D':
      return 'fragile_valuable';
    case 'F':
      return 'floor_stairs';
    case 'G':
    case 'H':
    case 'L':
      return 'escape_fall';
    case 'N':
      return 'clutter';
    default:
      return 'other'; // I, J, K, M: not a physical danger
  }
}

// Returns null for a finding that can't be trusted (unknown checklist letter).
function normaliseHazard(h: any, frameCount: number): Hazard | null {
  if (!isOneOf(CATEGORIES, h?.category)) return null;
  const category = h.category as HazardCategory;
  const hazard_type = pick(HAZARD_TYPES, h?.hazard_type, typeFromCategory(category));
  let scope: Hazard['scope'] = h?.scope === 'space' ? 'space' : 'object';
  let confidence: Confidence = pick(CONFIDENCES, h?.confidence, 'low');

  // W7: escape and fall findings must be pinnable. If the model filed one as a
  // whole-room finding, pin it at the centre of frame 0 and mark it low confidence.
  // Floors and stairs too (a slippery floor covers the room, so the model tends to
  // call it whole-room); their fallback pin goes low in the photo, where the floor is.
  const floorFallback = hazard_type === 'floor_stairs' && scope === 'space';
  if ((hazard_type === 'escape_fall' || hazard_type === 'floor_stairs') && scope === 'space') {
    scope = 'object';
    confidence = 'low';
  }

  let location: Hazard['location'] = null;
  if (scope === 'object') {
    const raw = h?.location;
    const hasPoint = raw && isFinite(parseFloat(raw.x)) && isFinite(parseFloat(raw.y));
    if (!hasPoint) confidence = 'low'; // we don't know where it is
    location = {
      frame_index: frameIndex(raw?.frame_index, frameCount),
      x: clamp01(raw?.x, 0.5),
      y: clamp01(raw?.y, floorFallback ? 0.85 : 0.5),
    };
    const bb = raw?.bbox;
    if (Array.isArray(bb) && bb.length === 4) {
      location.bbox = [clamp01(bb[0], 0), clamp01(bb[1], 0), clamp01(bb[2], 0), clamp01(bb[3], 0)];
    }
  }

  const title = str(h?.title, '').trim() || 'Finding';
  return {
    id: '', // assigned once the list is final
    category,
    title,
    scope,
    location,
    risk_to: pick(RISK_TO, h?.risk_to, 'animal'),
    severity: pick(SEVERITIES, h?.severity, 'medium'),
    evidence: str(h?.evidence, ''),
    why_it_matters: str(h?.why_it_matters, ''),
    recommendation: str(h?.recommendation, ''),
    object_key: slug(str(h?.object_key, '')) || slug(title) || 'finding',
    source: h?.source === 'user_tag' ? 'user_tag' : 'photo',
    confidence,
    hazard_type,
    small_dog_risk: h?.small_dog_risk === true,
    easy_fix: h?.easy_fix !== false, // only an explicit false counts as "no easy fix"
    tag_id: str(h?.tag_id, ''),
  };
}

// The better of two reports of the same object: higher severity, then higher confidence.
function stronger(a: { severity: Severity; confidence?: Confidence }, b: { severity: Severity; confidence?: Confidence }) {
  const s = RANK3[b.severity] - RANK3[a.severity];
  if (s !== 0) return s > 0 ? b : a;
  return RANK3[b.confidence ?? 'low'] > RANK3[a.confidence ?? 'low'] ? b : a;
}

function dedupeByKey<T extends { object_key?: string; severity: Severity; confidence?: Confidence }>(items: T[]): T[] {
  const byKey = new Map<string, T>();
  for (const it of items) {
    const key = it.object_key ?? '';
    const prev = byKey.get(key);
    byKey.set(key, prev ? (stronger(prev, it) as T) : it);
  }
  return [...byKey.values()];
}

// A user tag's entry, built by the app when the model left it out.
function tagEntry(t: Tag): Hazard {
  const note = t.note ? t.note.toLowerCase() : 'important';
  return {
    id: '',
    category: 'D',
    title: t.label,
    scope: 'object',
    location: { frame_index: t.frame, x: clamp01(t.x, 0.5), y: clamp01(t.y, 0.5) },
    risk_to: 'home',
    severity: 'medium',
    evidence: `You tagged "${t.label}" as ${note}.`,
    why_it_matters: `You tagged this as ${note}, so keep it out of the dog's reach.`,
    recommendation: 'Move it somewhere the dog can’t reach, or keep the dog out of this spot.',
    object_key: `tag-${slug(t.id) || slug(t.label)}`,
    source: 'user_tag',
    confidence: 'high',
    hazard_type: 'fragile_valuable',
    small_dog_risk: false,
    easy_fix: true,
    tag_id: t.id,
  };
}

const NEAR_TAG = 0.12; // a photo finding this close to a tag, on the same photo, is the tagged item

// W5: tags are "protect this" entries, pinned where the user put them; the model's
// own report of a tagged item is folded into the tag's entry; every tag appears once.
function applyTags(hazards: Hazard[], tags: Tag[]): Hazard[] {
  const byId = new Map(tags.map((t) => [t.id, t]));
  const byLabel = new Map(tags.map((t) => [t.label.trim().toLowerCase(), t]));
  const answered = new Map<string, Hazard>(); // tag id -> its entry
  const rest: Hazard[] = [];

  for (const h of hazards) {
    if (h.source !== 'user_tag') {
      rest.push(h);
      continue;
    }
    const tag = byId.get(h.tag_id ?? '') ?? byLabel.get(h.title.trim().toLowerCase());
    if (!tag) {
      rest.push({ ...h, source: 'photo', tag_id: '' }); // claims a tag we don't have
      continue;
    }
    if (answered.has(tag.id)) continue; // one entry per tag
    answered.set(tag.id, {
      ...h,
      scope: 'object',
      location: { frame_index: tag.frame, x: clamp01(tag.x, 0.5), y: clamp01(tag.y, 0.5) },
      risk_to: 'home',
      hazard_type: 'fragile_valuable',
      source: 'user_tag',
      tag_id: tag.id,
      confidence: 'high', // the user placed it
    });
  }

  for (const t of tags) if (!answered.has(t.id)) answered.set(t.id, tagEntry(t));
  const tagEntries = [...answered.values()];
  const tagKeys = new Set(tagEntries.map((e) => e.object_key));

  // Merge repeats of the same photo object, then drop photo findings that are
  // really the tagged item: same object_key, or a fragile/valuable finding right
  // next to the tag on the same photo.
  const photo = dedupeByKey(rest).filter((h) => {
    if (tagKeys.has(h.object_key)) return false;
    if (h.hazard_type !== 'fragile_valuable' || !h.location) return true;
    return !tags.some(
      (t) =>
        t.frame === h.location!.frame_index &&
        Math.hypot(clamp01(t.x, 0.5) - h.location!.x, clamp01(t.y, 0.5) - h.location!.y) <= NEAR_TAG
    );
  });
  return [...photo, ...tagEntries];
}

function normaliseEscapeRoute(r: any, i: number, frameCount: number): EscapeRoute | null {
  if (!isOneOf(ESCAPE_TYPES, r?.type)) return null;
  return {
    object_key: slug(str(r?.object_key, '')) || `${r.type}-${i + 1}`,
    type: r.type,
    detail: str(r?.detail, ''),
    frame_index: frameIndex(r?.frame_index, frameCount),
    x: clamp01(r?.x, 0.5),
    y: clamp01(r?.y, 0.5),
    severity: pick(SEVERITIES, r?.severity, 'medium'),
    confidence: pick(CONFIDENCES, r?.confidence, 'low'),
    small_dog_risk: r?.small_dog_risk === true,
  };
}

// A suggestion's spot on the map: kept only when the model gave both x and y.
function spot(o: any, frameCount: number): { frame_index: number; x?: number; y?: number } {
  const hasPoint = isFinite(parseFloat(o?.x)) && isFinite(parseFloat(o?.y));
  return {
    frame_index: frameIndex(o?.frame_index, frameCount),
    ...(hasPoint ? { x: clamp01(o.x, 0.5), y: clamp01(o.y, 0.5) } : {}),
  };
}

const hasText = (v: unknown): v is string => typeof v === 'string' && !!v.trim();

// Suggested setup: entries need an allowed kind and a reason; unknown kinds are dropped.
function normaliseSetup(raw: any, frameCount: number) {
  const items = (v: unknown): any[] => (Array.isArray(v) ? v : []);
  const off_limit_suggestions: OffLimitSuggestion[] = items(raw?.off_limit_suggestions)
    .filter((o) => isOneOf(OFF_LIMIT_ZONES, o?.zone) && hasText(o?.reason))
    .slice(0, MAX_OFF_LIMITS)
    .map((o) => ({ zone: o.zone, reason: o.reason.trim(), ...spot(o, frameCount) }));
  const dog_spots: DogSpot[] = items(raw?.dog_spots)
    .filter((o) => isOneOf(DOG_SPOT_PURPOSES, o?.purpose) && hasText(o?.reason))
    .slice(0, MAX_DOG_SPOTS)
    .map((o) => ({ purpose: o.purpose, reason: o.reason.trim(), ...spot(o, frameCount) }));
  const safety_additions: SafetyAddition[] = items(raw?.safety_additions)
    .filter((o) => isOneOf(SAFETY_ADDITION_TYPES, o?.type) && hasText(o?.reason))
    .slice(0, MAX_SAFETY_ADDITIONS)
    .map((o) => ({ type: o.type, detail: str(o?.detail, '').trim(), reason: o.reason.trim(), ...spot(o, frameCount) }));
  return { off_limit_suggestions, dog_spots, safety_additions };
}

function normaliseRoom(r: any): RoomAssessment {
  const v = Number(r?.floor_area_m2?.value);
  return {
    openness: pick(OPENNESS, r?.openness, 'moderate'),
    retreat_spot: pick(RETREAT, r?.retreat_spot, 'possible'),
    clear_path: pick(CLEAR_PATH, r?.clear_path, 'partial'),
    floor_type: pick(FLOOR_TYPES, r?.floor_type, 'unknown'),
    floor_area_m2: {
      value: r?.floor_area_m2?.value != null && isFinite(v) && v > 0 ? Math.round(v * 10) / 10 : null,
      confidence: pick(CONFIDENCES, r?.floor_area_m2?.confidence, 'low'),
    },
  };
}

function normaliseSignals(s: any): DetectedSignals {
  return {
    existing_pets: pick(SIGNAL_PETS, s?.existing_pets, 'unknown'),
    children: pick(SIGNAL_CHILDREN, s?.children, 'unknown'),
    dwelling_cue: pick(SIGNAL_DWELLING, s?.dwelling_cue, 'unknown'),
    outdoor_access_cue: pick(SIGNAL_OUTDOOR, s?.outdoor_access_cue, 'unknown'),
  };
}

export function normaliseAssessment(raw: any, session: Space): Assessment {
  const frameCount = session.capture.frames.length;

  const parsed: Hazard[] = Array.isArray(raw?.hazards)
    ? raw.hazards.map((h: any) => normaliseHazard(h, frameCount)).filter((h: Hazard | null): h is Hazard => !!h)
    : [];
  // Off-limits areas are not things to protect, so they don't become tag entries.
  const protectTags = session.tags.filter((t) => !t.offLimits);
  const hazards = applyTags(parsed, protectTags).map((h, i) => ({ ...h, id: `hz_${i + 1}` }));

  const escape_routes: EscapeRoute[] = Array.isArray(raw?.escape_routes)
    ? dedupeByKey(
        raw.escape_routes
          .map((r: any, i: number) => normaliseEscapeRoute(r, i, frameCount))
          .filter((r: EscapeRoute | null): r is EscapeRoute => !!r)
      )
    : [];

  const setup = normaliseSetup(raw, frameCount);

  const improvements: string[] = Array.isArray(raw?.improvements)
    ? raw.improvements.filter((s: any) => typeof s === 'string' && s.trim()).slice(0, 5)
    : [];

  return {
    mode: 'pet_in_mind',
    space_summary: str(raw?.space_summary, 'A room captured across several frames.'),
    confidence: pick(CONFIDENCES, raw?.confidence, 'low'),
    hazards,
    improvements,
    suitability: null, // the rules own the verdict (W2)
    recommended_pets: [],
    notes: str(raw?.notes, ''),
    room_assessment: normaliseRoom(raw?.room_assessment),
    escape_routes,
    ...setup,
    detected_signals: normaliseSignals(raw?.detected_signals),
  };
}
