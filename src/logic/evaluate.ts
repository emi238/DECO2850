// Suitability evaluation for the screens (logic v2, CHANGE PRD 15 Oct 2026).
// The rules themselves live in suitability.ts; this file resolves the dog and
// writes the words the user sees: the verdict, a chip and a first-person line per
// sub-score, "What to change", and profile nudges. No number is ever shown.

import type { ImageSourcePropType } from 'react-native';
import type { Assessment, DogSpot, OffLimitSuggestion, Pet, Questionnaire, RoomAssessment, SafetyAddition, Space } from '../types';
import { findBreed, type BreedProfile, type Energy, type Noise, type SizeClass } from './breeds';
import { IMAGES } from '../assets';
import {
  effectiveClass,
  scoreSuitability,
  type Band,
  type Bands,
  type Concern,
  type EnergyResult,
  type Gate,
  type Nudge,
  type SubScore,
  type SuitabilityResult,
  type Unknown,
} from './suitability';

export type { Band, Nudge, SubScore } from './suitability';

const RANK: Record<Band, number> = { poor: 0, adequate: 1, good: 2 };

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
    return { name: breed.name, size: breed.size, energy: pet.energy ?? breed.energy, noise: breed.noise, happy: breed.happy, cutout: breed.cutout, breed };
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

export interface Evaluation {
  dog: ResolvedDog;
  effective: SizeClass;
  bands: Bands; // safety, energy, room, household, noise
  verdict: Band; // after the hard gates and caps
  gates: Gate[];
  currentOwner: boolean;
  mood: 'sad' | 'neutral' | 'happy';
  speech: string;
  labels: Record<SubScore, string>; // the chip on each report row
  lines: Record<SubScore, string>; // the dog's first-person line
  roomChips: string[]; // openness + retreat spot, as plain words (empty if unknown)
  verdictTitle: string;
  verdictLine: string;
  changes: string[]; // "What to change"
  setup: SetupItem[]; // "Suggested setup": keep-out areas, dog spots, safety additions
  nudges: Nudge[]; // "add it to your profile?" prompts
  score: SuitabilityResult; // internal detail (ranking, checks); never shown
}

export function evaluate(space: Space, household: Questionnaire, dogOverride?: ResolvedDog): Evaluation | null {
  const dog = dogOverride ?? resolveDog(space.pet);
  if (!dog) return null;

  const result = space.result;
  // The built-in sample assessment can't see the photos.
  const photosChecked = space.resultSource !== 'mock';
  const s = scoreSuitability(
    { name: dog.name, size: dog.size, energy: dog.energy, noise: dog.noise, temperament: dog.breed?.temperament, group: dog.breed?.group },
    household,
    result,
    { photosChecked }
  );
  const { bands, verdict, gates, unknown } = s;
  const counted = s.safety.counted.length;

  const currentOwner = household.existing_pets.some((p) => /dog/i.test(p.species));
  const mood: Evaluation['mood'] = verdict === 'poor' ? 'sad' : verdict === 'adequate' ? 'neutral' : 'happy';
  const room = result?.room_assessment;
  const changes = whatToChange(space, s);

  return {
    dog,
    effective: effectiveClass(dog.size, dog.energy),
    bands,
    verdict,
    gates,
    currentOwner,
    mood,
    speech: speechFor(mood, bands),
    labels: {
      safety: !photosChecked ? 'Not checked' : { poor: 'Not safe yet', adequate: counted ? `Move ${thingCount(counted)}` : 'Mostly safe', good: 'Safe' }[bands.safety],
      energy: s.energy.undecided ? 'Not enough info' : { poor: 'Hard to keep up', adequate: 'Needs a plan', good: 'Well matched' }[bands.energy],
      room: !room ? 'Not checked' : { poor: 'Too tight', adequate: 'Enough room', good: 'Plenty of room' }[bands.room],
      household: { poor: 'Tricky fit', adequate: 'Some care needed', good: 'Suits your home' }[bands.household],
      noise: { poor: 'Likely issue', adequate: 'Some barking', good: 'No problem' }[bands.noise],
    },
    lines: {
      safety: photosChecked
        ? safetyLine(bands.safety, counted, gates)
        : "We couldn't check the photos this time, so we don't know what's within my reach yet.",
      energy: energyLine(bands.energy, s.energy),
      room: roomLine(bands.room, room),
      household: householdLine(s.household.concerns),
      noise: NOISE_LINE[bands.noise],
    },
    roomChips: room && photosChecked ? [OPENNESS_WORD[room.openness], RETREAT_WORD[room.retreat_spot]] : [],
    verdictTitle:
      verdict === 'adequate' && unknown.length && !gates.length
        ? 'Could be a good fit'
        : { poor: 'Not a good fit yet', adequate: 'Good fit with a few changes', good: 'Good fit' }[verdict],
    verdictLine: verdictLine(verdict, dog.name, gates, changes.length, unknown),
    changes,
    setup: suggestedSetup(result),
    nudges: s.nudges,
    score: s,
  };
}

function thingCount(n: number): string {
  return n === 1 ? '1 thing' : `${n} things`;
}

const GATE_TEXT: Record<Gate, string> = {
  escape: 'make the escape or fall risk safe',
  toxic: 'move or lock away the toxic item',
  energy: 'plan more exercise and company for a high-energy dog',
};

const UNKNOWN_TEXT: Record<Unknown, string> = {
  photos: 'capture the room again so we can check the photos',
  room: "re-run the analysis so we can check the room's layout",
  routine: 'answer the routine questions in your profile',
};

function joinAnd(items: string[]): string {
  return items.length > 1 ? `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}` : items[0];
}

// One plain sentence under the verdict.
function verdictLine(v: Band, dogName: string, gates: Gate[], changes: number, unknown: Unknown[]): string {
  if (v === 'good') return changes ? `This room suits a ${dogName} well. A few small changes are listed below.` : `This room suits a ${dogName} well.`;
  const todo = joinAnd(unknown.map((u) => UNKNOWN_TEXT[u]));
  if (gates.length) {
    return v === 'adequate'
      ? `It can work, but first: ${GATE_TEXT[gates[0]]}.`
      : `Not yet. First: ${GATE_TEXT[gates[0]]}, then see the changes below.`;
  }
  if (v === 'adequate') return unknown.length ? `To be sure, ${todo}.` : 'It can work with a few changes, listed below.';
  return unknown.length ? `Not yet, see the changes below. To be sure, ${todo}.` : 'Not yet, the main changes are listed below.';
}

const ZONE_WORD: Record<string, string> = {
  kitchen: 'the kitchen',
  balcony: 'the balcony',
  nursery: 'the nursery',
  office: 'the office',
  stairs: 'the stairs',
  other: 'this area',
};

// ---- Suggested setup: where to keep the dog out, where its things could go, and
// what to add for safety. Each item keeps its photo position for the map.

export interface SetupItem {
  key: string;
  kind: 'keep_out' | 'dog_spot' | 'add';
  title: string; // "Keep out of the kitchen", "Dog bed", "Add a gate"
  pin: string; // short label on the map: "Keep out", "Dog bed", "Gate"
  detail: string; // what exactly and why
  frame_index: number;
  x?: number;
  y?: number;
}

const SPOT_WORD: Record<DogSpot['purpose'], string> = {
  bed: 'Dog bed',
  crate: 'Crate',
  food_water: 'Food and water',
  play: 'Play area',
};

const ADD_WORD: Record<SafetyAddition['type'], { title: string; pin: string }> = {
  gate: { title: 'Add a gate', pin: 'Gate' },
  railing: { title: 'Add a railing', pin: 'Railing' },
  netting: { title: 'Add netting', pin: 'Netting' },
  window_guard: { title: 'Add a window guard', pin: 'Window guard' },
  pen: { title: 'Add a playpen', pin: 'Playpen' },
  cord_cover: { title: 'Cover the cords', pin: 'Cord cover' },
  non_slip_mat: { title: 'Add non-slip mats', pin: 'Non-slip mat' },
  other: { title: 'Add for safety', pin: 'Add' },
};

function suggestedSetup(result: Assessment | null): SetupItem[] {
  const keepOut = (o: OffLimitSuggestion, i: number): SetupItem => ({
    key: `keep_out_${i}`,
    kind: 'keep_out',
    title: `Keep out of ${ZONE_WORD[o.zone] ?? 'this area'}`,
    pin: 'Keep out',
    detail: sentence(o.reason),
    frame_index: o.frame_index,
    x: o.x,
    y: o.y,
  });
  const dogSpot = (d: DogSpot, i: number): SetupItem => ({
    key: `dog_spot_${i}`,
    kind: 'dog_spot',
    title: SPOT_WORD[d.purpose],
    pin: SPOT_WORD[d.purpose],
    detail: sentence(d.reason),
    frame_index: d.frame_index,
    x: d.x,
    y: d.y,
  });
  const add = (a: SafetyAddition, i: number): SetupItem => ({
    key: `add_${i}`,
    kind: 'add',
    title: ADD_WORD[a.type].title,
    pin: ADD_WORD[a.type].pin,
    detail: [a.detail, a.reason].filter((t) => t.trim()).map(sentence).join(' '),
    frame_index: a.frame_index,
    x: a.x,
    y: a.y,
  });
  return [
    ...(result?.off_limit_suggestions ?? []).map(keepOut),
    ...(result?.dog_spots ?? []).map(dogSpot),
    ...(result?.safety_additions ?? []).map(add),
  ];
}

const sentence = (t: string) => {
  const s = t.trim();
  return /[.!?]$/.test(s) ? s : `${s}.`;
};

// "What to change" = the model's improvements (off-limit areas are in the Suggested
// setup instead). When there are none (older results), fall back on the counted
// hazards' fixes.
function whatToChange(space: Space, s: SuitabilityResult): string[] {
  const out: string[] = [];
  if (s.gates.includes('energy')) out.push('Plan daily exercise, and a dog walker or daycare for long days alone.');
  for (const i of (space.result?.improvements ?? []).slice(0, 3)) out.push(sentence(i));
  if (!out.length) {
    const byKey = new Map(s.safety.counted.map((c) => [c.key, c]));
    const fixes = (space.result?.hazards ?? [])
      .filter((h) => byKey.has(h.object_key ?? h.title.toLowerCase()) && h.recommendation)
      .sort((a, b) => byKey.get(b.object_key ?? b.title.toLowerCase())!.points - byKey.get(a.object_key ?? a.title.toLowerCase())!.points)
      .slice(0, 3)
      .map((h) => sentence(h.recommendation));
    out.push(...fixes);
  }
  return out;
}

// Kept short: the speech bubble fits about 28 characters on one line.
function speechFor(mood: Evaluation['mood'], bands: Bands): string {
  if (mood === 'happy') return 'I can run around here, yay!';
  if (mood === 'neutral') return bands.safety === 'good' ? 'I could get comfy here!' : 'Tidy a few things for me!';
  if (bands.energy === 'poor') return "I'd need more of your time!";
  return bands.room === 'poor' ? 'I need space to run!' : 'A few things here worry me…';
}

function safetyLine(b: Band, counted: number, gates: Gate[]): string {
  if (b === 'good') return 'Nothing risky within my reach, nice and safe.';
  if (gates.includes('escape')) return 'There’s a way I could get out or fall here, please make that safe first.';
  if (gates.includes('toxic')) return 'Something toxic is within my reach and isn’t easy to move, please lock it away first.';
  const what = counted <= 1 ? 'a hazard' : counted === 2 ? 'a couple of hazards' : 'several hazards';
  return b === 'poor'
    ? `Quite hazardous for me: ${what} within paw and mouth reach.`
    : `Mostly safe, just ${what} to move out of my reach.`;
}

const DRIVER_TEXT: Record<EnergyResult['drivers'][number], string> = {
  alone: 'long days on my own would be hard',
  exercise: "I'd need more walks and play than planned",
  activity: "I'd need a more active routine",
  outdoor: "with no outdoor space I'd need lots of walks",
};

function energyLine(b: Band, e: EnergyResult): string {
  if (b === 'good') return 'My exercise needs fit your routine nicely.';
  if (e.undecided) return 'Tell us more about your routine in your profile so we can check my exercise needs.';
  const why = e.drivers.slice(0, 2).map((d) => DRIVER_TEXT[d]);
  if (!why.length) {
    return b === 'poor' ? "I'd need more exercise and company than this routine gives." : 'Doable, with daily walks and play built into your routine.';
  }
  const list = why.join(', and ');
  return b === 'poor' ? `I'd struggle here: ${list}.` : `We'd need a plan: ${list}.`;
}

const OPENNESS_WORD = { open: 'Open layout', moderate: 'Some open floor', cramped: 'Cramped layout' } as const;
const RETREAT_WORD = { present: 'Has a dog spot', possible: 'Room for a dog bed', absent: 'No spot for a dog bed' } as const;

function roomLine(b: Band, room: RoomAssessment | undefined): string {
  if (!room) return "We couldn't see enough of the room to judge the space.";
  if (b === 'good') {
    return room.retreat_spot === 'present'
      ? 'Plenty of room to stretch out, and a spot of my own.'
      : 'Plenty of room to stretch out, just add a bed in a quiet corner.';
  }
  if (b === 'adequate') {
    if (room.openness === 'cramped') return 'A bit tight for me, clearing some floor would help me move.';
    if (room.retreat_spot === 'absent') return "There's room, but nowhere quiet for my bed.";
    return 'Enough room to settle, a little more open floor would help me move.';
  }
  return 'This room feels tight for me right now, moving a few things could open it right up.';
}

const CONCERN_TEXT: Record<string, string> = {
  kids_bouncy_no_retreat: "I could be too boisterous for little ones, and there's nowhere for me to take a break.",
  kids_bouncy: "I could be a bit boisterous around little ones, so I'd need supervising.",
  kids_no_retreat: "I'd need a quiet spot to get away from little ones.",
  cat_chase: 'I might want to chase your cat, so introductions need care.',
  other_dogs: 'I might not get along easily with your other dog at first.',
  first_dog_energy: "I'm a lot of work for a first dog.",
  first_dog_stubborn: 'I can be stubborn, which is hard for a first dog.',
  busy_sensitive: 'A busy home could stress me out.',
};

function householdLine(concerns: Concern[]): string {
  if (!concerns.length) return "I'd fit right in with your household.";
  return concerns
    .slice(0, 2)
    .map((c) => CONCERN_TEXT[c.id])
    .join(' ');
}

const NOISE_LINE: Record<Band, string> = {
  good: "Barking shouldn't be a problem for the neighbours here.",
  adequate: 'Should be fine with the neighbours, most of the time.',
  poor: 'I might be a bit loud for close neighbours, consider a quieter breed for this building.',
};

// §5.1a ranked breed suggestions for "Explore breeds for my space": the same
// rules run for every catalogue breed against this room and household.
export function rankBreeds(space: Space, household: Questionnaire, breeds: BreedProfile[]) {
  return breeds
    .map((b) => {
      const e = evaluate(space, household, { name: b.name, size: b.size, energy: b.energy, noise: b.noise, happy: b.happy, cutout: b.cutout, breed: b })!;
      const score = RANK[e.verdict] * 10 + e.score.blend * 5; // internal ordering only
      return { breed: b, evaluation: e, score };
    })
    .sort((a, b) => b.score - a.score);
}
