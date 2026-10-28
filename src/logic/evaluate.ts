// Suitability evaluation for the screens (logic v2, CHANGE PRD 15 Oct 2026).
// The rules themselves live in suitability.ts; this file resolves the dog and
// writes the words the user sees: the verdict, a chip and a first-person line per
// sub-score, "What to change", and profile nudges. No number is ever shown.

import type { ImageSourcePropType } from 'react-native';
import type { Assessment, DogSpot, Hazard, OffLimitSuggestion, Pet, Questionnaire, RoomAssessment, SafetyAddition, Space, Tag } from '../types';
import type { RunSnapshot } from './changes';
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
  roomChips: string[]; // openness, retreat spot and clear path, as plain words (empty if unknown)
  verdictLabel: string; // small plain label above the headline (app voice)
  verdictTitle: string; // the headline, spoken by the dog
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
  // The built-in sample assessment can't see the photos, and neither could the model
  // when it reported the photos as blank, dark or not a room.
  const photosChecked = space.resultSource !== 'mock' && space.result?.photo_check?.usable !== false;
  const s = scoreSuitability(
    {
      name: dog.name,
      size: dog.size,
      energy: dog.energy,
      noise: dog.noise,
      temperament: dog.breed?.temperament,
      group: dog.breed?.group,
      goodWithChildren: dog.breed?.goodWithChildren,
      goodWithOtherDogs: dog.breed?.goodWithOtherDogs,
      trainability: dog.breed?.trainability,
    },
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
  // "Still checking": a middling result held back only by missing information.
  const stillChecking = verdict === 'adequate' && unknown.length > 0 && !gates.length;

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
      safety: !photosChecked ? 'Not checked yet' : { poor: 'A few fixes first', adequate: counted ? `Move ${thingCount(counted)}` : 'A little work', good: 'All good' }[bands.safety],
      energy: s.energy.undecided ? 'Tell us more' : { poor: 'Needs a bigger plan', adequate: 'Needs a plan', good: 'Well matched' }[bands.energy],
      room: !room ? 'Not checked yet' : { poor: 'A bit snug', adequate: 'Enough room', good: 'Plenty of room' }[bands.room],
      household: { poor: 'Needs a plan', adequate: 'A little care', good: 'Fits right in' }[bands.household],
      noise: { poor: 'Needs a plan', adequate: 'Some barking', good: 'All good' }[bands.noise],
    },
    lines: {
      safety: photosChecked
        ? safetyLine(bands.safety, counted, gates)
        : "I couldn't see the room this time, so I don't know what's in reach yet.",
      energy: energyLine(bands.energy, s.energy),
      room: roomLine(bands.room, room),
      household: householdLine(s.household.concerns),
      noise: NOISE_LINE[bands.noise],
    },
    roomChips: room && photosChecked ? [OPENNESS_WORD[room.openness], RETREAT_WORD[room.retreat_spot], PATH_WORD[room.clear_path]] : [],
    // The dog speaks the headline; a small plain label above it keeps the result clear.
    verdictLabel: stillChecking
      ? 'STILL CHECKING'
      : { poor: 'NOT QUITE READY YET', adequate: 'NEARLY READY', good: `READY FOR A ${dog.name.toUpperCase()}` }[verdict],
    verdictTitle: stillChecking
      ? 'Help me see a bit more'
      : currentOwner
        ? { poor: "Let's make our home even better", adequate: 'A few tweaks for me?', good: 'I love it here!' }[verdict]
        : { poor: "Let's get it ready together", adequate: 'Almost ready for me!', good: "I'd love it here!" }[verdict],
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
  escape: 'secure the spot where a dog could get out or fall',
  toxic: 'move the toxic item somewhere locked or up high',
  energy: 'plan daily exercise and company for an energetic dog',
};

const UNKNOWN_TEXT: Record<Unknown, string> = {
  photos: 'retake the photos so we can see the room',
  room: 're-run the analysis so we can check the layout',
  routine: 'answer a few routine questions in your profile',
};

function joinAnd(items: string[]): string {
  return items.length > 1 ? `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}` : items[0];
}

// One plain sentence under the verdict.
function verdictLine(v: Band, dogName: string, gates: Gate[], changes: number, unknown: Unknown[]): string {
  if (v === 'good') return changes ? `Your space suits a ${dogName} well. A few small extras are below if you'd like them.` : `Your space already suits a ${dogName} well.`;
  const todo = joinAnd(unknown.map((u) => UNKNOWN_TEXT[u]));
  if (gates.length) {
    return v === 'adequate'
      ? `It can work. Start with this: ${GATE_TEXT[gates[0]]}.`
      : `There's some work to do first. Start with this: ${GATE_TEXT[gates[0]]}.`;
  }
  if (v === 'adequate') return unknown.length ? `We need a little more to be sure: ${todo}.` : "It can work with a few changes. They're listed below, most important first.";
  return unknown.length ? `A few changes would help. To be sure, ${todo}.` : 'A few bigger changes would make this work. Start with the first one below.';
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
  if (mood === 'happy') return "I'd love it here!";
  if (mood === 'neutral') return bands.safety === 'good' ? 'I could get comfy here!' : 'Almost ready for me!';
  if (bands.energy === 'poor') return "I'd love more time with you!";
  return bands.room === 'poor' ? 'A bit more room for me?' : "Let's get it ready together";
}

function safetyLine(b: Band, counted: number, gates: Gate[]): string {
  if (b === 'good') return 'Nothing here I can get into. I feel safe!';
  if (gates.includes('escape')) return 'I might find a way out or take a tumble here. Could we make that spot safe first?';
  if (gates.includes('toxic')) return "Something here could make me sick. Could it go somewhere I can't reach?";
  const what = counted <= 1 ? 'one thing' : counted === 2 ? 'a couple of things' : 'a few things';
  return b === 'poor'
    ? `There ${counted <= 1 ? 'is' : 'are'} ${what} I could get into. Let's move them first.`
    : `Almost there, just ${what} to move up out of my reach.`;
}

const DRIVER_TEXT: Record<EnergyResult['drivers'][number], string> = {
  alone: 'long days alone would get lonely',
  exercise: 'a few more walks and play',
  activity: 'a more active routine together',
  outdoor: "lots of walks, since there's no yard",
};

function energyLine(b: Band, e: EnergyResult): string {
  if (b === 'good') return 'My exercise needs fit your days nicely.';
  if (e.undecided) return "Tell me a bit about your routine so I know we'll keep up.";
  const why = e.drivers.slice(0, 2).map((d) => DRIVER_TEXT[d]);
  if (!why.length) {
    return b === 'poor' ? "I'd need more walks, play and company than this routine has right now." : 'Doable, with daily walks and play built in.';
  }
  const list = why.join(', and ');
  return b === 'poor' ? `I'd need more from our days: ${list}.` : `We'd just need a plan: ${list}.`;
}

const OPENNESS_WORD = { open: 'Open layout', moderate: 'Some open floor', cramped: 'Cramped layout' } as const;
const RETREAT_WORD = { present: 'Has a dog spot', possible: 'Room for a dog bed', absent: 'No spot for a dog bed' } as const;
const PATH_WORD = { good: 'Clear path', partial: 'Some squeezing past', poor: 'Hard to get through' } as const;

function roomLine(b: Band, room: RoomAssessment | undefined): string {
  if (!room) return "We couldn't see enough of the room to judge the space.";
  if (b === 'good') {
    return room.retreat_spot === 'present'
      ? 'Plenty of room to stretch out, and a spot of my own.'
      : 'Plenty of room to stretch out, just add a bed in a quiet corner.';
  }
  if (b === 'adequate') {
    if (room.openness === 'cramped') return 'A bit tight for me, clearing some floor would help me move.';
    if (room.clear_path === 'poor') return "There's room, but I'd have to squeeze past furniture to get around.";
    if (room.retreat_spot === 'absent') return "There's room, but nowhere quiet for my bed.";
    return 'Enough room to settle, a little more open floor would help me move.';
  }
  if (room.openness !== 'cramped' && room.clear_path === 'poor') return "I'd keep bumping into furniture. A clearer path would help me get around.";
  return "It's a bit snug for me right now. Clearing some floor would open it right up.";
}

const CONCERN_TEXT: Record<string, string> = {
  kids_bouncy_no_retreat: "I can be bouncy around little ones, and I'd need a quiet spot to take a break.",
  kids_bouncy: 'I can be bouncy around little ones, so keep an eye on us at first.',
  kids_no_retreat: "I'd love a quiet spot to rest away from little ones.",
  other_dogs: "I'd need slow, gentle introductions to your other dog.",
  first_dog_energy: "I've got lots of energy, so a training class would help us both.",
  first_dog_stubborn: 'I can be a bit stubborn. Patient training will win me over.',
  busy_sensitive: "I'd need a calm corner to recharge in a busy home.",
  size_bigger: "I'm bigger than the size of dog you said you'd like.",
  size_smaller: "I'm smaller than the size of dog you said you'd like.",
};

const PET_NOUN: Record<string, string> = { cat: 'cat', bird: 'bird', small_animal: 'small pets' };

function concernText(c: Concern): string {
  if (c.id === 'pet_chase') {
    const nouns = (c.pets ?? []).map((p) => PET_NOUN[p] ?? 'pets');
    const list = nouns.length > 1 ? `${nouns.slice(0, -1).join(', ')} and ${nouns[nouns.length - 1]}` : nouns[0] ?? 'pets';
    return `I might want to chase your ${list}, so let's meet slowly.`;
  }
  return CONCERN_TEXT[c.id];
}

function householdLine(concerns: Concern[]): string {
  if (!concerns.length) return "I'd fit right in with everyone at home.";
  return concerns.slice(0, 2).map(concernText).join(' ');
}

const NOISE_LINE: Record<Band, string> = {
  good: "Your neighbours won't hear much from me.",
  adequate: 'I might bark now and then, but it should be fine.',
  poor: 'I can be chatty, and your neighbours are close. Calm training will help keep the peace.',
};

// ---- Shared by the report and "What's new" ----

// The report rows, in order (most heavily weighted first).
export const REPORT_ROWS: { key: SubScore; heading: string }[] = [
  { key: 'safety', heading: 'Staying safe' },
  { key: 'energy', heading: 'Exercise & company' },
  { key: 'room', heading: 'Room to move' },
  { key: 'household', heading: 'Fitting in at home' },
  { key: 'noise', heading: 'Neighbours' },
];

// The chip on each risk card.
export const SEVERITY_WORD: Record<Hazard['severity'], string> = { high: 'Do first', medium: 'Worth doing', low: 'Nice extra' };
export const TAG_WORD = 'Protect this';

// Items the user tagged (Valuable / Fragile) are things to protect, not hazards.
// New results mark them source "user_tag"; for results saved before logic v2, fall
// back on the old "Flagged: …" title or the tag's name in the title.
export function isTagEntry(h: Hazard, tags: Tag[]): boolean {
  if (h.source) return h.source === 'user_tag';
  if (h.title.startsWith('Flagged:')) return true;
  const title = h.title.toLowerCase();
  return tags.some((t) => !!t.label.trim() && title.includes(t.label.trim().toLowerCase()));
}

// What the user sees after a run, saved so the next Re-run can say what changed.
export function runSnapshot(space: Space, household: Questionnaire): RunSnapshot {
  const e = evaluate(space, household);
  return {
    verdict: e?.verdictTitle ?? null,
    rows: e ? REPORT_ROWS.map((r) => ({ heading: r.heading, label: e.labels[r.key] })) : [],
    flagged: (space.result?.hazards ?? []).map((h) => {
      if (isTagEntry(h, space.tags)) {
        // Same identity for a tag in old ("Flagged: Vase") and new ("Vase") results.
        const name = h.title.replace(/^Flagged:\s*/, '').trim();
        return { key: `tag:${name.toLowerCase()}`, title: name, level: TAG_WORD };
      }
      return { key: h.object_key ?? h.title.trim().toLowerCase(), title: h.title.trim(), level: SEVERITY_WORD[h.severity] };
    }),
    setup: (e?.setup ?? []).map((s) => ({ key: `${s.kind}:${s.title.toLowerCase()}`, title: s.title })),
  };
}

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
