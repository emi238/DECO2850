// Suitability evaluation (spec §4). Turns measured/declared parameters into the
// three internal bands (Space Adequacy, Safety, Noise Fit), the not-ready-yet
// advisory, and the qualitative avatar + report copy. No number is ever shown.

import type { ImageSourcePropType } from 'react-native';
import type { Assessment, Pet, Questionnaire, Space, SpaceMetrics } from '../types';
import { findBreed, type BreedProfile, type Energy, type Noise, type SizeClass } from './breeds';
import { IMAGES } from '../assets';

export type Band = 'poor' | 'adequate' | 'good';

const RANK: Record<Band, number> = { poor: 0, adequate: 1, good: 2 };
const worse = (a: Band, b: Band): Band => (RANK[a] <= RANK[b] ? a : b);
const downgrade = (b: Band): Band => (b === 'good' ? 'adequate' : 'poor');

// §4.2 size-class thresholds: Poor under `poor`, Good at `good`+ (and zone), m² zone.
const THRESHOLDS: Record<SizeClass, { poor: number; good: number; zone: number }> = {
  small: { poor: 0.25, good: 0.4, zone: 0.5 },
  medium: { poor: 0.35, good: 0.55, zone: 1.0 },
  large: { poor: 0.45, good: 0.65, zone: 1.5 },
};

// §4.4 noise lookup [tendency][neighbours].
const NOISE: Record<Noise, Record<Questionnaire['neighbours'], Band>> = {
  quiet: { attached: 'good', close_separate: 'good', not_close: 'good' },
  moderate: { attached: 'adequate', close_separate: 'good', not_close: 'good' },
  vocal: { attached: 'poor', close_separate: 'adequate', not_close: 'good' },
};

// The profile actually evaluated: a catalogue breed, or a mixed breed built
// from the size/energy the user entered. User-picked energy overrides the breed's.
export interface ResolvedDog {
  name: string;
  size: SizeClass;
  energy: Energy;
  noise: Noise;
  happy: ImageSourcePropType;
  cutout: boolean; // cartoon art that can "peek" vs. a regular photo
  breed?: BreedProfile;
}

export function resolveDog(pet: Pet | null): ResolvedDog | null {
  if (!pet || !pet.breed) return null;
  const breed = findBreed(pet.breed);
  if (breed) {
    // The user can override size and energy for their own dog (spec §1.2/§1.3);
    // fall back to the breed's typical value when they haven't.
    return { name: breed.name, size: pet.size ?? breed.size, energy: pet.energy ?? breed.energy, noise: breed.noise, happy: breed.happy, cutout: breed.cutout, breed };
  }
  // Not in the loaded catalogue (mixed breed, or an API breed before the list
  // has loaded): use the traits saved on the pet when it was chosen.
  return {
    name: pet.breed,
    size: pet.size ?? 'medium',
    energy: pet.energy ?? 'moderate',
    noise: pet.noise ?? 'moderate',
    happy: pet.imageUrl ? { uri: pet.imageUrl } : IMAGES.labHappy,
    cutout: !pet.imageUrl,
  };
}

export function effectiveClass(size: SizeClass, energy: Energy): SizeClass {
  if (energy !== 'high') return size;
  return size === 'small' ? 'medium' : 'large';
}

// Room measurements. There is no LiDAR scan in this prototype, so these are
// estimates: every room uses the same default until real measurements exist.
export function estimateMetrics(space: Space): SpaceMetrics {
  if (space.metrics) return space.metrics;
  return { floor_m2: 16, furniture_m2: 8, fixed_m2: 4, personal_zone_m2: 0, estimated: true };
}

// "Hazard flags" per §4.3 = physical hazards the assessment located (cords,
// sharp/fragile, floors, plants, chemicals, escape routes) — not user tags.
const PHYSICAL = new Set(['A', 'B', 'C', 'D', 'E', 'F', 'G']);
export function hazardCount(result: Assessment | null): number {
  return (result?.hazards ?? []).filter(
    (h) => h.scope === 'object' && PHYSICAL.has(h.category) && !h.title.startsWith('Flagged:')
  ).length;
}

export interface Evaluation {
  dog: ResolvedDog;
  effective: SizeClass;
  space: Band;
  spaceReason: 'ofr' | 'zone' | 'outdoor' | 'none';
  safety: Band;
  noise: Band;
  tone: Band; // worse of space + safety
  advisory: boolean; // §4.5 not-ready-yet (prospective owners only)
  currentOwner: boolean;
  mood: 'sad' | 'neutral' | 'happy';
  speech: string;
  lines: { space: string; safety: string; noise: string; advisory?: string };
  labels: { space: string; safety: string; noise: string; tone: string };
}

export function evaluate(space: Space, household: Questionnaire, dogOverride?: ResolvedDog): Evaluation | null {
  const dog = dogOverride ?? resolveDog(space.pet);
  if (!dog) return null;

  const m = estimateMetrics(space);
  const eff = effectiveClass(dog.size, dog.energy);
  const t = THRESHOLDS[eff];

  // ---- §4.2 Space Adequacy ----
  const ofr = m.floor_m2 > 0 ? (m.floor_m2 - m.furniture_m2) / m.floor_m2 : 0;
  const hasZone = m.personal_zone_m2 >= t.zone;
  let spaceBand: Band;
  let spaceReason: Evaluation['spaceReason'] = 'none';
  if (ofr < t.poor) {
    spaceBand = 'poor';
    spaceReason = 'ofr';
  } else if (ofr >= t.good && hasZone) {
    spaceBand = 'good';
  } else {
    spaceBand = 'adequate';
    spaceReason = ofr >= t.good ? 'zone' : 'ofr';
  }
  // §4.2 no-outdoor downgrade — only for High-energy dogs. (A Moderate-energy dog
  // like the Labrador in §4.9 is NOT downgraded for lacking outdoor space, so its
  // decluttered room reads Adequate as that worked example expects.)
  if (household.outdoor_access === 'none' && dog.energy === 'high' && spaceBand !== 'good') {
    if (spaceBand === 'adequate') spaceReason = 'outdoor';
    spaceBand = downgrade(spaceBand);
  }

  // ---- §4.3 Safety ----
  const hz = hazardCount(space.result);
  const hazardBand: Band = hz >= 3 ? 'poor' : hz >= 1 ? 'adequate' : 'good';
  const atRisk = space.tags.length; // tagged valuables/fragile items
  const valuablesBand: Band = atRisk >= 4 ? 'poor' : atRisk >= 1 ? 'adequate' : 'good';
  const safety = worse(hazardBand, valuablesBand);

  // ---- §4.4 Noise Fit ----
  const noise = NOISE[dog.noise][household.neighbours];

  const tone = worse(spaceBand, safety);

  // ---- §4.5 advisory: prospective only, space-only, decluttered still short ----
  const currentOwner = household.existing_pets.some((p) => /dog/i.test(p.species));
  const declutteredOfr = m.floor_m2 > 0 ? (m.floor_m2 - m.fixed_m2) / m.floor_m2 : 0;
  const advisory = !currentOwner && spaceBand === 'poor' && declutteredOfr < t.poor;

  const mood: Evaluation['mood'] = advisory || tone === 'poor' ? 'sad' : tone === 'adequate' ? 'neutral' : 'happy';

  return {
    dog,
    effective: eff,
    space: spaceBand,
    spaceReason,
    safety,
    noise,
    tone,
    advisory,
    currentOwner,
    mood,
    speech: speechFor(mood, advisory, spaceBand),
    lines: {
      space: spaceLine(spaceBand, spaceReason, currentOwner),
      safety: safetyLine(safety, hz, atRisk),
      noise: NOISE_LINE[noise],
      advisory: advisory
        ? `I'd feel boxed in everywhere here, even with everything cleared out. This layout doesn't really suit a ${dog.name}'s energy level right now, that could change with more room or less clutter.`
        : undefined,
    },
    labels: {
      space: { poor: 'Cramped', adequate: 'Snug', good: 'Spacious' }[spaceBand],
      safety: { poor: 'Hazardous', adequate: 'Mostly safe', good: 'Safe' }[safety],
      noise: { poor: 'Poor', adequate: 'Adequate', good: 'Good' }[noise],
      tone: { poor: 'Needs work', adequate: 'Getting there', good: 'Great fit' }[tone],
    },
  };
}

function speechFor(mood: Evaluation['mood'], advisory: boolean, space: Band): string {
  if (advisory) return "I'd feel cramped here right now…";
  if (mood === 'happy') return 'I can run around here, yay!';
  if (mood === 'neutral') return space === 'good' ? 'Almost there, just tidy a few things!' : 'I could get comfy here!';
  return space === 'poor' ? 'I need space to run!' : 'A few things here worry me…';
}

function spaceLine(b: Band, reason: Evaluation['spaceReason'], owner: boolean): string {
  if (b === 'good') return 'Plenty of room to stretch out and play, right where it is.';
  if (b === 'adequate') {
    if (reason === 'zone') return 'Plenty of space, just needs a spot of my own.';
    if (reason === 'outdoor') return "There's room to settle, but with no outdoor space I'll need regular walks.";
    return 'Enough room to settle, a little more open floor would help me move.';
  }
  return owner
    ? "I'd love more room to stretch, here's what might help: clear a path or two."
    : 'This room feels tight for me right now, moving a few things could open it right up.';
}

function safetyLine(b: Band, hazards: number, valuables: number): string {
  if (b === 'good') return 'Nothing risky within my reach, nice and safe.';
  const bits = [];
  if (hazards) bits.push(hazards === 1 ? 'a hazard' : `${hazards >= 3 ? 'several' : 'a couple of'} hazards`);
  if (valuables) bits.push(valuables === 1 ? 'something precious' : 'some precious things');
  const what = bits.join(' and ');
  return b === 'poor'
    ? `Quite hazardous for me: ${what} within paw and mouth reach.`
    : `Mostly safe, just ${what} to move out of my reach.`;
}

const NOISE_LINE: Record<Band, string> = {
  good: "Barking shouldn't be a problem for the neighbours here.",
  adequate: 'Should be fine with the neighbours, most of the time.',
  poor: 'I might be a bit loud for close neighbours, consider a quieter breed for this building.',
};

// §5.1a ranked breed suggestions for "Explore breeds for my space".
export function rankBreeds(space: Space, household: Questionnaire, breeds: BreedProfile[]) {
  return breeds.map((b) => {
    const e = evaluate(space, household, { name: b.name, size: b.size, energy: b.energy, noise: b.noise, happy: b.happy, cutout: b.cutout, breed: b })!;
    const score = RANK[e.tone] * 10 + RANK[e.noise] * 3 + RANK[e.space] - (e.advisory ? 20 : 0);
    const fit = { good: 'Good fit', adequate: 'Could work', poor: 'Tricky fit' }[e.tone];
    const spaceTxt = { good: 'enough floor space', adequate: 'a bit snug', poor: 'cramped for this breed' }[e.space];
    const noiseTxt = { good: 'no noise concerns', adequate: 'some barking to manage', poor: 'may be loud for neighbours' }[e.noise];
    return { breed: b, evaluation: e, score, summary: `${fit}, ${spaceTxt}, ${noiseTxt}` };
  }).sort((a, b) => b.score - a.score);
}
