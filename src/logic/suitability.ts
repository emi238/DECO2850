// Suitability rules, logic v2 (CHANGE PRD 15 Oct 2026 §2, §5). Pure logic: no
// React Native imports, so it can be checked on its own (scripts/check-logic.mjs).
//
// Five internal sub-scores, each a band (poor / adequate / good), blended with the
// PRD §2.1 weights into the verdict, then capped by the §2.2 hard gates. Every
// number here is internal: the user only ever sees words (evaluate.ts writes them).
//
//   Safety (35%)           photo hazards, weighted by type × severity × size × confidence
//   Energy & management    breed energy vs owner activity, exercise, outdoor space, time alone
//   fit (25%)
//   Room to move (15%)     photo: openness + retreat spot + clear path (+ floor area if confident)
//   Household fit (15%)    children, other pets, experience, home atmosphere vs the breed
//   Noise fit (10%)        breed noise vs how close the neighbours are (spec §4.4 table)
//
// Photo-derived weight = Safety + Room to move = 50%.

import type { Assessment, Confidence, Hazard, HazardType, OtherPet, Questionnaire, RoomAssessment, Severity } from '../types';
import type { Energy, Noise, SizeClass } from './breeds';
import { typeFromCategory } from '../ai/normalise';

export type Band = 'poor' | 'adequate' | 'good';
export type SubScore = 'safety' | 'energy' | 'room' | 'household' | 'noise';
export type Bands = Record<SubScore, Band>;

// ---- Weights and thresholds (all internal). Calibrate on real test rooms. ----

export const WEIGHTS: Record<SubScore, number> = { safety: 0.35, energy: 0.25, room: 0.15, household: 0.15, noise: 0.1 };
export const BAND_VALUE: Record<Band, number> = { good: 1, adequate: 0.5, poor: 0 };
// Blend → verdict: at least 0.8 is good, at least 0.45 is adequate, below is poor.
// Every sub-score adequate (0.5) is adequate; it takes poor sub-scores to reach poor.
export const VERDICT_GOOD_AT = 0.8;
export const VERDICT_ADEQUATE_AT = 0.45;

// §2.3 Safety load = Σ type_weight × severity_weight × size_scale × confidence_factor
export const TYPE_WEIGHT: Record<HazardType, number> = {
  escape_fall: 3,
  toxic_ingestible: 2.5,
  electrical_thermal: 2,
  floor_stairs: 1.5,
  fragile_valuable: 1,
  clutter: 0.5,
  other: 0, // not a physical danger
};
export const SEVERITY_WEIGHT: Record<Severity, number> = { high: 3, medium: 2, low: 1 };
export const CONFIDENCE_FACTOR: Record<Confidence, number> = { high: 1, medium: 0.8, low: 0.5 };
export const SIZE_SCALE = 1.3;
// Load 0 is good, under this is adequate, at or above it is poor. A typical room
// with a few fixable things (a low cord, a medium plant and a medium balcony door,
// 13 to 14) stays adequate; two high escape routes (18) or four or more medium
// hazards are poor. Single serious risks are caught by the hard gates instead.
export const SAFETY_POOR_LOAD = 15;

// ---- Inputs ----

export interface DogInput {
  name: string;
  size: SizeClass;
  energy: Energy;
  noise: Noise;
  temperament?: string; // from the breed catalogue, when known
  group?: string;
  // 1–5 trait scores from API Ninjas (null/undefined when the breed came from The Dog
  // API or the built-ins). API Ninjas has no temperament text, so these stand in for it.
  goodWithChildren?: number | null;
  goodWithOtherDogs?: number | null;
  trainability?: number | null;
}

// ---- Safety ----

export interface Counted {
  key: string; // object_key
  title: string;
  type: HazardType;
  severity: Severity;
  confidence: Confidence;
  points: number;
}

export function isUserTag(h: Hazard): boolean {
  // "Flagged:" = tag entries in results saved before logic v2.
  return h.source === 'user_tag' || h.title.startsWith('Flagged:');
}

export function hazardType(h: Hazard): HazardType {
  return h.hazard_type ?? typeFromCategory(h.category);
}

function sizeScale(size: SizeClass, type: HazardType, smallDogRisk: boolean): number {
  if (size === 'large' && (type === 'fragile_valuable' || type === 'floor_stairs' || type === 'escape_fall')) return SIZE_SCALE;
  if (size === 'small' && smallDogRisk) return SIZE_SCALE; // squeeze gaps, small swallowable objects
  return 1;
}

function points(type: HazardType, severity: Severity, confidence: Confidence, size: SizeClass, smallDogRisk: boolean) {
  return TYPE_WEIGHT[type] * SEVERITY_WEIGHT[severity] * sizeScale(size, type, smallDogRisk) * CONFIDENCE_FACTOR[confidence];
}

// Every photo finding with a physical type counts; user tags never do ("protect
// this", not a danger). Escape routes always count: any the model didn't also list
// as a hazard are added here. Missing confidence (older results) counts as low.
export function safetyLoad(result: Assessment | null, size: SizeClass): { load: number; counted: Counted[] } {
  const counted: Counted[] = [];
  for (const h of result?.hazards ?? []) {
    if (isUserTag(h)) continue;
    const type = hazardType(h);
    if (TYPE_WEIGHT[type] === 0) continue;
    const confidence = h.confidence ?? 'low';
    counted.push({
      key: h.object_key ?? h.title.toLowerCase(),
      title: h.title,
      type,
      severity: h.severity,
      confidence,
      points: points(type, h.severity, confidence, size, !!h.small_dog_risk),
    });
  }
  const keys = new Set(counted.map((c) => c.key));
  for (const r of result?.escape_routes ?? []) {
    if (keys.has(r.object_key)) continue;
    const type: HazardType = r.type === 'stairs' ? 'floor_stairs' : 'escape_fall';
    counted.push({
      key: r.object_key,
      title: r.detail || r.type,
      type,
      severity: r.severity,
      confidence: r.confidence,
      points: points(type, r.severity, r.confidence, size, r.small_dog_risk),
    });
  }
  return { load: counted.reduce((sum, c) => sum + c.points, 0), counted };
}

export function safetyBand(load: number): Band {
  return load <= 0 ? 'good' : load < SAFETY_POOR_LOAD ? 'adequate' : 'poor';
}

// ---- Energy & management fit (the spine) ----

const ACTIVITY: Record<NonNullable<Questionnaire['owner_activity']>, number> = { sedentary: 0, moderate: 1, active: 2 };
const EXERCISE: Record<NonNullable<Questionnaire['exercise_time']>, number> = { under_30: 0, '30_60': 1, over_60: 2 };
const OUTDOOR_BASE: Record<Questionnaire['outdoor_access'], number> = {
  none: 0,
  balcony: 0, // no room to run
  'shared yard': 0.5,
  'private yard': 1,
  pool: 1, // a pool comes with outdoor space
};
const OUTDOOR_USE: Record<NonNullable<Questionnaire['outdoor_use']>, number> = { most_days: 1, sometimes: 0.5, rarely: 0 };
const ALONE_COST: Record<NonNullable<Questionnaire['hours_alone']>, number> = { under_4: 0, '4_to_8': 0.5, over_8: 1.5 };
const ALONE_PLAN_RELIEF = 1; // a walker or daycare breaks up the day

// Provision needed for each energy level: good at or above `good`, adequate at or above `adequate`.
// Spec §4.9 (fix carried over from the AR-implementation branch, 2e3a106): only a
// High-energy dog is penalised for having no (usable) outdoor space, so outdoor space
// counts towards provision for High-energy dogs only. A Moderate-energy dog such as
// the §4.9 Labrador is judged on activity, exercise and time alone.
const ENERGY_NEEDS: Record<Energy, { good: number; adequate: number }> = {
  low: { good: 1, adequate: -0.5 },
  moderate: { good: 2, adequate: 1 }, // a fairly active owner with 30–60 min a day is a good match
  high: { good: 4, adequate: 2.5 },
};

export interface EnergyResult {
  band: Band;
  undecided: boolean; // unanswered questions could swing it either way, so it's "adequate" by default
  provision: { worst: number; best: number }; // equal when every answer is known
  unknown: string[]; // core questions not answered yet
  drivers: ('exercise' | 'alone' | 'outdoor' | 'activity')[]; // what's holding the match back
}

function provision(q: Questionnaire, fill: 'min' | 'max', energy: Energy): number {
  const lo = fill === 'min';
  const activity = q.owner_activity ? ACTIVITY[q.owner_activity] : lo ? 0 : 2;
  const exercise = q.exercise_time ? EXERCISE[q.exercise_time] : lo ? 0 : 2;
  const use = q.outdoor_access === 'none' ? 0 : q.outdoor_use ? OUTDOOR_USE[q.outdoor_use] : lo ? 0 : 1;
  const outdoor = energy === 'high' ? OUTDOOR_BASE[q.outdoor_access] * use : 0; // §4.9
  const alone = q.hours_alone ? ALONE_COST[q.hours_alone] : lo ? ALONE_COST.over_8 : 0;
  const relief = q.alone_plan === 'walker' || q.alone_plan === 'daycare' ? ALONE_PLAN_RELIEF : q.alone_plan || lo ? 0 : ALONE_PLAN_RELIEF;
  return activity + exercise + outdoor - Math.max(0, alone - relief);
}

function energyBandFor(energy: Energy, p: number): Band {
  const need = ENERGY_NEEDS[energy];
  return p >= need.good ? 'good' : p >= need.adequate ? 'adequate' : 'poor';
}

export function energyFit(energy: Energy, q: Questionnaire): EnergyResult {
  const worst = provision(q, 'min', energy);
  const best = provision(q, 'max', energy);
  const lo = energyBandFor(energy, worst);
  const hi = energyBandFor(energy, best);
  // Unanswered questions are tried at both extremes: if the band is the same
  // either way, the answers we have are decisive; if not, call it adequate.
  const band: Band = lo === hi ? lo : 'adequate';

  const unknown: string[] = [];
  if (!q.owner_activity) unknown.push('owner_activity');
  if (!q.exercise_time) unknown.push('exercise_time');
  if (!q.hours_alone) unknown.push('hours_alone');
  if (q.hours_alone && q.hours_alone !== 'under_4' && !q.alone_plan) unknown.push('alone_plan');
  if (q.outdoor_access !== 'none' && !q.outdoor_use) unknown.push('outdoor_use');

  const drivers: EnergyResult['drivers'] = [];
  if (band !== 'good') {
    if (q.hours_alone === 'over_8' && q.alone_plan !== 'walker' && q.alone_plan !== 'daycare') drivers.push('alone');
    if (q.exercise_time === 'under_30' || (energy === 'high' && q.exercise_time === '30_60')) drivers.push('exercise');
    if (q.owner_activity === 'sedentary') drivers.push('activity');
    if ((q.outdoor_access === 'none' || q.outdoor_use === 'rarely') && energy === 'high') drivers.push('outdoor'); // §4.9
  }
  return { band, undecided: lo !== hi, provision: { worst, best }, unknown, drivers };
}

// ---- Room to move & space quality ----

export function effectiveClass(size: SizeClass, energy: Energy): SizeClass {
  if (energy !== 'high') return size;
  return size === 'small' ? 'medium' : 'large';
}

const downgrade = (b: Band): Band => (b === 'good' ? 'adequate' : 'poor');

export const SMALL_ROOM_M2 = 10; // only used with medium/high confidence, large (effective) dogs

// No room_assessment (older results, or the sample assessment that can't see the
// photos) → adequate: we don't know, so we don't claim good or poor.
export function roomFit(room: RoomAssessment | undefined, size: SizeClass, energy: Energy): Band {
  if (!room) return 'adequate';
  const eff = effectiveClass(size, energy);
  let band: Band =
    room.openness === 'open'
      ? 'good'
      : room.openness === 'moderate'
        ? eff === 'large' ? 'adequate' : 'good'
        : eff === 'large' ? 'poor' : 'adequate'; // cramped flags mainly for big or high-energy dogs
  if (room.retreat_spot === 'absent') band = downgrade(band);
  // Having to squeeze past furniture matters for big (or big-and-bouncy) dogs; a
  // cramped room already counts as poor for them, so this only adds where it isn't.
  if (room.clear_path === 'poor' && eff === 'large' && room.openness !== 'cramped') band = downgrade(band);
  const area = room.floor_area_m2;
  if (area.value != null && area.confidence !== 'low' && eff === 'large' && area.value < SMALL_ROOM_M2) {
    band = downgrade(band);
  }
  return band;
}

// ---- Household fit ----

export interface Concern {
  id: string;
  strength: 'mild' | 'strong';
  pets?: OtherPet[]; // for pet_chase: which pets the dog might chase
}

const GENTLE = /gentle|patient|tolerant|even[- ]tempered|good with (children|kids)/i;
const CHASER_GROUP = /hound|terrier/i;
const CHASER_TEMPERAMENT = /prey|hunt|chase/i;
const DOMINANT = /aggressive|dominant|territorial/i;
const STUBBORN = /stubborn|independent|strong[- ]willed|dominant/i;
const SENSITIVE = /shy|sensitive|timid|nervous|reserved|aloof/i;

// Pets other than dogs: the user's answer; when unanswered, a cat seen in the photos counts.
export function otherPets(q: Questionnaire, result: Assessment | null): OtherPet[] {
  if (q.has_other_pets !== undefined) return q.has_other_pets ? q.other_pets ?? [] : [];
  return result?.detected_signals?.existing_pets === 'cat' ? ['cat'] : [];
}

// Pets a dog with a chase or prey drive might go after (fish and reptiles live in tanks).
export const CHASEABLE: OtherPet[] = ['cat', 'bird', 'small_animal'];

export function householdFit(dog: DogInput, q: Questionnaire, result: Assessment | null): { band: Band; concerns: Concern[] } {
  const concerns: Concern[] = [];
  const t = dog.temperament ?? '';
  // Temperament words (The Dog API) or 1–5 scores (API Ninjas), whichever we have.
  const low = (n?: number | null) => n != null && n <= 2;
  const gentleWithKids = GENTLE.test(t) || (dog.goodWithChildren != null && dog.goodWithChildren >= 4);

  if (q.children_at_home === 'young') {
    const bigOrBouncy = ((dog.size === 'large' || dog.energy === 'high') && !gentleWithKids) || low(dog.goodWithChildren);
    const noRetreat = result?.room_assessment?.retreat_spot === 'absent';
    if (bigOrBouncy && noRetreat) concerns.push({ id: 'kids_bouncy_no_retreat', strength: 'strong' });
    else {
      if (bigOrBouncy) concerns.push({ id: 'kids_bouncy', strength: 'mild' });
      if (noRetreat) concerns.push({ id: 'kids_no_retreat', strength: 'mild' });
    }
  }
  const chaseable = otherPets(q, result).filter((p) => CHASEABLE.includes(p));
  if (chaseable.length && (CHASER_GROUP.test(dog.group ?? '') || CHASER_TEMPERAMENT.test(t))) {
    concerns.push({ id: 'pet_chase', strength: 'mild', pets: chaseable });
  }
  const dogs = q.existing_pets.filter((p) => /dog/i.test(p.species));
  if (dogs.length > 0 && (DOMINANT.test(t) || low(dog.goodWithOtherDogs))) concerns.push({ id: 'other_dogs', strength: 'mild' });
  if (q.experience === 'none') {
    if (dog.energy === 'high') concerns.push({ id: 'first_dog_energy', strength: 'mild' });
    if (STUBBORN.test(t) || low(dog.trainability)) concerns.push({ id: 'first_dog_stubborn', strength: 'mild' });
  }
  if (q.household_atmosphere === 'busy' && SENSITIVE.test(t)) concerns.push({ id: 'busy_sensitive', strength: 'mild' });

  const strong = concerns.some((c) => c.strength === 'strong');
  const band: Band = strong || concerns.length >= 2 ? 'poor' : concerns.length === 1 ? 'adequate' : 'good';
  return { band, concerns };
}

// ---- Noise fit (spec §4.4 table, unchanged) ----

const NOISE: Record<Noise, Record<Questionnaire['neighbours'], Band>> = {
  quiet: { attached: 'good', close_separate: 'good', not_close: 'good' },
  moderate: { attached: 'adequate', close_separate: 'good', not_close: 'good' },
  vocal: { attached: 'poor', close_separate: 'adequate', not_close: 'good' },
};

export function noiseFit(noise: Noise, q: Questionnaire): Band {
  return NOISE[noise][q.neighbours];
}

// ---- Hard gates (§2.2): a good average must never hide a serious issue ----

export type Gate = 'escape' | 'toxic' | 'energy';

export function hardGates(dog: DogInput, q: Questionnaire, result: Assessment | null): Gate[] {
  const gates: Gate[] = [];
  const findings = (result?.hazards ?? []).filter((h) => !isUserTag(h));
  const highEscape =
    findings.some((h) => hazardType(h) === 'escape_fall' && h.severity === 'high') ||
    (result?.escape_routes ?? []).some((r) => r.severity === 'high');
  if (highEscape) gates.push('escape');
  // Toxic plants (A) or chemicals/medicines (C), not swallowable objects, with no easy fix.
  const stuckToxic = findings.some(
    (h) => hazardType(h) === 'toxic_ingestible' && (h.category === 'A' || h.category === 'C') && h.easy_fix === false
  );
  if (stuckToxic) gates.push('toxic');
  const noOutdoor = q.outdoor_access === 'none' || q.outdoor_use === 'rarely';
  if (dog.energy === 'high' && q.hours_alone === 'over_8' && noOutdoor && q.owner_activity === 'sedentary') {
    gates.push('energy');
  }
  return gates;
}

// ---- Cross-check: what the photos suggest vs the answers (§5) ----

export interface Nudge {
  id: 'cat' | 'dog' | 'pets' | 'children' | 'dwelling' | 'outdoor' | 'answer_more';
  text: string;
}

export function crossCheck(q: Questionnaire, result: Assessment | null, energyUnknown: string[]): Nudge[] {
  const nudges: Nudge[] = [];
  const s = result?.detected_signals;
  const dogs = q.existing_pets.filter((p) => /dog/i.test(p.species)).length;
  if (s) {
    if (s.existing_pets === 'cat' && !(q.other_pets ?? []).includes('cat'))
      nudges.push({ id: 'cat', text: 'We spotted signs of a cat in your photos. Add it to your profile?' });
    if (s.existing_pets === 'dog' && dogs === 0)
      nudges.push({ id: 'dog', text: 'We spotted signs of a dog in your photos. Add it to your profile?' });
    if (s.existing_pets === 'multiple' && dogs === 0 && q.has_other_pets !== true)
      nudges.push({ id: 'pets', text: 'We spotted signs of pets in your photos. Add them to your profile?' });
    if (s.children === 'yes' && q.children_at_home !== 'young' && q.children_at_home !== 'older')
      nudges.push({ id: 'children', text: 'We spotted signs of children in your photos. Update your profile?' });
    if (s.dwelling_cue !== 'unknown' && s.dwelling_cue !== q.dwelling)
      nudges.push({
        id: 'dwelling',
        text: `Your photos look like a ${s.dwelling_cue}, but your profile says ${q.dwelling === 'apartment' ? 'an apartment' : 'a house'}. Update your profile?`,
      });
    const yardAnswer = q.outdoor_access === 'shared yard' || q.outdoor_access === 'private yard' || q.outdoor_access === 'pool';
    if ((s.outdoor_access_cue === 'yard' && !yardAnswer) || (s.outdoor_access_cue === 'balcony' && q.outdoor_access === 'none'))
      nudges.push({
        id: 'outdoor',
        text: `We spotted a ${s.outdoor_access_cue} in your photos, but your profile says ${q.outdoor_access === 'none' ? 'no outdoor space' : `a ${q.outdoor_access}`}. Update your profile?`,
      });
  }
  if (energyUnknown.length)
    nudges.push({
      id: 'answer_more',
      text: 'Answer the new questions in your profile (activity, exercise, time alone) for a more accurate result.',
    });
  return nudges;
}

// ---- Putting it together ----

// What we couldn't check. Unknown sub-scores count as "adequate" in the blend, and
// the verdict can't be "good" while anything is unknown: we don't claim a good fit
// we haven't checked. Likewise a "poor" sub-score or a hard gate rules out "good".
//   photos:  the result is the built-in sample, which can't see the photos
//   room:    a photo result without a room assessment (saved before logic v2)
//   routine: the routine questions are unanswered and could swing the energy fit
export type Unknown = 'photos' | 'room' | 'routine';

export interface ScoreOptions {
  photosChecked?: boolean; // false for the built-in sample assessment (default true)
}

export interface SuitabilityResult {
  bands: Bands;
  blend: number; // internal only, never shown
  verdict: Band; // after the hard gates and the unknowns cap
  gates: Gate[];
  unknown: Unknown[];
  safety: { load: number; counted: Counted[] };
  energy: EnergyResult;
  household: { concerns: Concern[] };
  nudges: Nudge[];
}

export function verdictFromBlend(blend: number): Band {
  const e = 1e-9; // weights are decimals; don't let rounding flip a boundary
  return blend >= VERDICT_GOOD_AT - e ? 'good' : blend >= VERDICT_ADEQUATE_AT - e ? 'adequate' : 'poor';
}

export function scoreSuitability(
  dog: DogInput,
  q: Questionnaire,
  result: Assessment | null,
  opts: ScoreOptions = {}
): SuitabilityResult {
  // Without a photo analysis, ignore the result's findings entirely (the sample
  // can't see the room, so any finding in it isn't evidence about this room).
  const photosChecked = opts.photosChecked !== false;
  const seen = photosChecked ? result : null;

  const safety = safetyLoad(seen, dog.size);
  const energy = energyFit(dog.energy, q);
  const household = householdFit(dog, q, seen);
  const bands: Bands = {
    safety: photosChecked ? safetyBand(safety.load) : 'adequate', // unknown, not "safe"
    energy: energy.band,
    room: roomFit(seen?.room_assessment, dog.size, dog.energy),
    household: household.band,
    noise: noiseFit(dog.noise, q),
  };
  const unknown: Unknown[] = [];
  if (!photosChecked) unknown.push('photos');
  else if (!result?.room_assessment) unknown.push('room');
  if (energy.undecided) unknown.push('routine');

  const blend = (Object.keys(WEIGHTS) as SubScore[]).reduce((sum, k) => sum + WEIGHTS[k] * BAND_VALUE[bands[k]], 0);
  const gates = hardGates(dog, q, seen);
  let verdict = verdictFromBlend(blend);
  const anyPoor = (Object.values(bands) as Band[]).includes('poor');
  if ((gates.length || unknown.length || anyPoor) && verdict === 'good') verdict = 'adequate'; // cap at "needs changes"
  return {
    bands,
    blend,
    verdict,
    gates,
    unknown,
    safety,
    energy,
    household: { concerns: household.concerns },
    nudges: crossCheck(q, seen, energy.unknown),
  };
}
