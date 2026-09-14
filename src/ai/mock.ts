// Built-in mock assessment (PRD §11: "canned fallback result"). Produces a
// schema-valid Assessment (PRD §7.2) that reflects the REAL context the user
// entered — pet, questionnaire, and tags. Located findings come from the user's
// own tags (the mock can't see the photos).

import type { Assessment, Hazard, Space, Severity } from '../types';

let counter = 0;
function hid(): string {
  counter += 1;
  return `hz_${counter}`;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// Best-guess category for a user-tagged object from its words (PRD checklist A–N).
function inferCategory(text: string): Hazard['category'] {
  const t = text.toLowerCase();
  if (/plant|lily|pothos|palm|flower|fern/.test(t)) return 'A';
  if (/cord|cable|wire|charger|plug/.test(t)) return 'B';
  if (/chemical|cleaner|bleach|deterg|medic|pill|spray/.test(t)) return 'C';
  if (/window|balcon|door|rail|screen|gap|fence/.test(t)) return 'G';
  if (/pool|water/.test(t)) return 'L';
  if (/stair|step/.test(t)) return 'F';
  if (/glass|vase|sharp|fragile|ceramic|knife/.test(t)) return 'D';
  return 'D';
}

function isCat(species?: string): boolean {
  return (species ?? '').toLowerCase().includes('cat');
}
function isDog(species?: string): boolean {
  return (species ?? '').toLowerCase().includes('dog');
}

export function generateMockAssessment(session: Space): Assessment {
  counter = 0;
  const { mode, pet, questionnaire: q, tags } = session;
  const petLabel = pet ? `${pet.breed || pet.species}`.trim() : 'the pet';
  const cat = isCat(pet?.species);
  const dog = isDog(pet?.species);
  const highRise = q.dwelling === 'apartment' && (q.floor_level ?? 0) >= 3;

  const hazards: Hazard[] = [];

  // ---- Mock mode can't see the photos: lean on the REAL context the user
  // entered (tags + questionnaire), which we CAN trust. ----
  tags.forEach((t) => {
    hazards.push({
      id: hid(),
      category: inferCategory(t.label + ' ' + t.note),
      title: `Flagged: ${t.label}`,
      scope: 'object',
      location: {
        frame_index: t.frame,
        x: round2(t.x ?? 0.5),
        y: round2(t.y ?? 0.5),
      },
      risk_to: 'both',
      severity: /fragile|valuable|antique|open|toxic|chemical/i.test(t.note) ? 'high' : 'medium',
      evidence: `You flagged "${t.label}"${t.note ? ` — "${t.note}"` : ''}.`,
      why_it_matters: `You marked this as needing attention around ${petLabel}.`,
      recommendation: 'Secure, relocate, or make this item/zone off-limits before adopting.',
    });
  });

  // ---- Space-level findings (no single pin -> shown in the top banner) ----
  if (cat) {
    hazards.push(spaceHazard('H', 'No vertical space for a cat', 'medium', 'animal',
      'No cat tree, shelves, or perches are visible in the sweep.',
      'Cats need vertical territory to feel secure and exercise.',
      'Add a tall cat tree or wall shelves near the window (with the screen fitted).'));
  }
  if (highRise) {
    hazards.push(spaceHazard('G', `${q.floor_level}th-floor apartment`, cat ? 'high' : 'medium', 'animal',
      `The household is on floor ${q.floor_level} of an apartment.`,
      `Any open window, balcony, or gap becomes a high fall risk at this height${cat ? ', particularly for cats' : ''}.`,
      'Screen every window and the balcony before letting the pet roam freely.'));
  }
  if (dog) {
    hazards.push(spaceHazard('I', 'Floor space vs an active dog', q.activity_level === 'high' ? 'medium' : 'low', 'animal',
      `An apartment living room with ${q.activity_level} household activity.`,
      `${petLabel} will need daily outdoor exercise as indoor floor space is limited.`,
      'Plan two walks a day plus indoor enrichment (puzzle feeders, chew toys).'));
    hazards.push(spaceHazard('E', 'Slippery hard floor', 'low', 'animal',
      'The floor reads as hard tile with little grip.',
      'Hard, slippery floors can strain joints for larger or older dogs.',
      'Lay a few non-slip rugs or runners in the dog\'s main path.'));
  }
  if (q.infant_present || q.off_limit_zones.length > 0) {
    const zones = q.off_limit_zones.length ? q.off_limit_zones.join(', ') : 'the nursery';
    hazards.push(spaceHazard('J', 'Off-limit zones to separate', 'medium', 'both',
      `You listed off-limit/sensitive zones: ${zones}${q.infant_present ? ', and an infant is present' : ''}.`,
      'Pets and sensitive zones (or infants) need reliable separation.',
      `Fit a baby gate or keep ${zones} behind a closed door the pet cannot open.`));
  }
  if (q.existing_pets.length > 0) {
    const others = q.existing_pets.map((p) => `${p.breed || ''} ${p.species}`.trim()).join(', ');
    hazards.push(spaceHazard('M', 'Existing pets — introductions', 'medium', 'animal',
      `The home already has: ${others}.`,
      'A new arrival needs a careful, gradual introduction to avoid territory stress.',
      'Introduce scent-first over days, with separate safe spaces and supervised meetings.'));
  }

  // ---- Improvements (prioritised) ----
  const improvements = buildImprovements(hazards);

  // ---- Suitability vs recommended pets ----
  let suitability: Assessment['suitability'] = null;
  let recommended_pets: Assessment['recommended_pets'] = [];

  if (mode === 'pet_in_mind') {
    suitability = computeSuitability(hazards, petLabel, q);
  } else {
    recommended_pets = recommendPets(q);
  }

  return {
    mode: mode ?? 'pet_in_mind',
    space_summary:
      'A single room captured across several overlapping frames. (Sample assessment — enable the real model for photo-based hazard detection.)',
    confidence: 'low',
    hazards,
    improvements,
    suitability,
    recommended_pets,
    notes:
      'This sample assessment is based on your household answers and tags rather than the photos. Add a Gemini API key (see src/ai/config.ts) for real photo analysis.',
  };
}

function spaceHazard(
  category: Hazard['category'],
  title: string,
  severity: Severity,
  risk_to: Hazard['risk_to'],
  evidence: string,
  why: string,
  rec: string
): Hazard {
  return {
    id: hid(),
    category,
    title,
    scope: 'space',
    location: null,
    risk_to,
    severity,
    evidence,
    why_it_matters: why,
    recommendation: rec,
  };
}

function buildImprovements(hazards: Hazard[]): string[] {
  const order: Record<Severity, number> = { high: 0, medium: 1, low: 2 };
  return [...hazards]
    .sort((a, b) => order[a.severity] - order[b.severity])
    .slice(0, 6)
    .map((h) => h.recommendation);
}

function computeSuitability(
  hazards: Hazard[],
  petLabel: string,
  q: Space['questionnaire']
): NonNullable<Assessment['suitability']> {
  const highs = hazards.filter((h) => h.severity === 'high').length;
  const meds = hazards.filter((h) => h.severity === 'medium').length;
  let score = 100 - highs * 16 - meds * 7;
  score = Math.max(12, Math.min(94, score));
  const verdict =
    score >= 75 ? 'well_suited' : score >= 45 ? 'suitable_with_changes' : 'poorly_suited';
  const rationale =
    verdict === 'well_suited'
      ? `The space suits ${petLabel} well; only minor tweaks are needed.`
      : verdict === 'suitable_with_changes'
      ? `The space can suit ${petLabel} once the ${highs} higher-risk items (window/balcony screening, cords, chemicals) are fixed.`
      : `As-is this space is a poor fit for ${petLabel}: too many high-severity hazards need resolving first.`;
  return { verdict, score_0_100: score, rationale };
}

function recommendPets(q: Space['questionnaire']): Assessment['recommended_pets'] {
  const apartment = q.dwelling === 'apartment';
  const list: Assessment['recommended_pets'] = [];
  list.push({
    species: 'Cat',
    breed: 'Domestic Shorthair (indoor)',
    why: 'Adapts well to apartment living and needs no yard; content indoors with enrichment.',
    caveats: 'Screen the window and balcony first — essential at this floor level — and add vertical territory.',
  });
  list.push({
    species: 'Dog',
    breed: 'French Bulldog',
    why: 'Small, low-endurance and famously apartment-friendly; happy with short daily walks.',
    caveats: 'Heat-sensitive; keep the room cool and never leave near the open balcony.',
  });
  list.push({
    species: 'Rabbit',
    breed: 'Mini Lop (house rabbit)',
    why: 'Quiet, litter-trainable and thrives indoors in a rented apartment.',
    caveats: 'A determined chewer — the exposed cords must be fully protected before adopting.',
  });
  return apartment ? list : list.slice(0, 3);
}
