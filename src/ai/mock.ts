// Built-in mock assessment (PRD §11: "canned fallback result"). Produces a
// schema-valid Assessment (PRD §7.2) that reflects the REAL context the user
// entered — pet, questionnaire, and tags — and, for the seeded demo room, pins
// every object finding onto the actual drawing via DEMO_OBJECTS coordinates.

import type { Assessment, Hazard, Session, Severity } from '../types';
import { DEMO_OBJECTS, isDemoUri, sceneToFrame } from '../demo/room';

let counter = 0;
function hid(): string {
  counter += 1;
  return `hz_${counter}`;
}

function loc(objKey: keyof typeof DEMO_OBJECTS) {
  const o = DEMO_OBJECTS[objKey];
  const p = sceneToFrame(o.sx, o.sy, o.frame);
  return { frame_index: o.frame, x: round2(p.x), y: round2(p.y) };
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

export function generateMockAssessment(session: Session): Assessment {
  counter = 0;
  const { mode, pet, questionnaire: q, tags, capture } = session;
  const demo = capture.frames.length > 0 && capture.frames.some((f) => isDemoUri(f.uri));
  const petLabel = pet ? `${pet.breed || pet.species}`.trim() : 'the pet';
  const cat = isCat(pet?.species);
  const dog = isDog(pet?.species);
  const highRise = q.dwelling === 'apartment' && (q.floor_level ?? 0) >= 3;

  const hazards: Hazard[] = [];

  if (demo) {
    // ---- Object hazards pinned to the seeded demo room ----
    hazards.push({
      id: hid(),
      category: 'G',
      title: 'Unscreened window',
      scope: 'object',
      location: loc('window'),
      risk_to: 'animal',
      severity: highRise ? 'high' : 'medium',
      evidence: 'A large window with an open, unscreened upper pane on the left wall.',
      why_it_matters: highRise
        ? `On floor ${q.floor_level}, an openable unscreened window is a fatal fall risk${cat ? ' — cats are especially prone to high-rise falls' : ''}.`
        : `An openable unscreened window is an escape and fall route for ${petLabel}.`,
      recommendation: 'Fit a lockable window restrictor or a sturdy insect/pet screen before the window is opened.',
    });

    hazards.push({
      id: hid(),
      category: 'A',
      title: 'Low houseplant',
      scope: 'object',
      location: loc('plant'),
      risk_to: 'animal',
      severity: cat ? 'high' : 'medium',
      evidence: 'A leafy potted plant on a low stool beside the window, within easy reach.',
      why_it_matters: cat
        ? 'Many common houseplants (e.g. lilies, pothos) are toxic to cats, who nibble greenery.'
        : `If it is a toxic species, ${petLabel} chewing the leaves could be poisoned.`,
      recommendation: 'Identify the plant; if toxic, move it to a high shelf pets cannot reach or swap it for a pet-safe plant.',
    });

    hazards.push({
      id: hid(),
      category: 'B',
      title: 'Exposed cord tangle',
      scope: 'object',
      location: loc('cords'),
      risk_to: 'both',
      severity: 'high',
      evidence: 'A tangle of power cords draping from the TV console to a floor power strip.',
      why_it_matters: `Dangling cords invite chewing (electrocution) and entanglement${dog ? ', and a bored dog may target them' : ''}.`,
      recommendation: 'Bundle cords into a cable sleeve and clip them up off the floor, out of reach.',
    });

    hazards.push({
      id: hid(),
      category: 'G',
      title: 'Balcony door',
      scope: 'object',
      location: loc('balconyDoor'),
      risk_to: 'animal',
      severity: highRise ? 'high' : 'medium',
      evidence: 'A sliding glass door to a balcony, with railings visible behind the glass.',
      why_it_matters: `If left ajar, ${petLabel} can slip onto the balcony; wide railing gaps at height are a fall risk.`,
      recommendation: 'Keep the door on a locked vent position and mesh the balcony railings, or make the balcony off-limits.',
    });

    hazards.push({
      id: hid(),
      category: 'C',
      title: 'Cleaning products on floor',
      scope: 'object',
      location: loc('cleaners'),
      risk_to: 'animal',
      severity: 'high',
      evidence: 'Several cleaning bottles on the floor by an open low cabinet.',
      why_it_matters: 'Household cleaners are poisonous if licked, chewed, or knocked over.',
      recommendation: 'Move all chemicals into a high or child-locked cupboard.',
    });

    // Fragile vase — fold in the user tag if they flagged it, else report plainly.
    const vaseRe = /vase|fragile|antique/i;
    const vaseTag = tags.find((t) => vaseRe.test(t.label + ' ' + t.note));
    hazards.push({
      id: hid(),
      category: 'D',
      title: vaseTag ? `Flagged: ${vaseTag.label}` : 'Fragile vase at pet height',
      scope: 'object',
      location: loc('vase'),
      risk_to: 'both',
      severity: 'medium',
      evidence: vaseTag
        ? `You flagged this as "${vaseTag.label}${vaseTag.note ? ' — ' + vaseTag.note : ''}". It sits on a low, open bookshelf shelf.`
        : 'A vase on a low, open bookshelf shelf, within tail/paw reach.',
      why_it_matters: `${petLabel} could knock it off — broken glass injures paws and a valuable item is lost.`,
      recommendation: 'Relocate it above pet height or secure it with museum putty.',
    });

    // Any OTHER user-tagged object is high-priority context — always address it,
    // pinned where the user placed the tag (PRD F4.3).
    tags
      .filter((t) => t !== vaseTag)
      .forEach((t) => {
        hazards.push({
          id: hid(),
          category: inferCategory(t.label + ' ' + t.note),
          title: `Flagged: ${t.label}`,
          scope: 'object',
          location: { frame_index: t.frame, x: round2(t.x ?? 0.5), y: round2(t.y ?? 0.5) },
          risk_to: 'both',
          severity: /open|toxic|chemical|sharp|hot|fall/i.test(t.note) ? 'high' : 'medium',
          evidence: `You flagged "${t.label}"${t.note ? ` — "${t.note}"` : ''}.`,
          why_it_matters: `You marked this as needing attention around ${petLabel}; user-flagged items are treated as top priority.`,
          recommendation: 'Secure, relocate, or make this item/zone off-limits before adopting.',
        });
      });
  } else {
    // ---- Real photos captured, but running in mock mode: lean on the REAL
    // context the user entered (tags + questionnaire), which we CAN trust. ----
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
  }

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
    space_summary: demo
      ? 'A rented apartment living room: a large window and a balcony door on one side, a bookshelf, a TV console, a low cabinet and a sofa, over hard tile flooring.'
      : 'A single room captured across several overlapping frames. (Running in demo mode — enable the real model for photo-based hazard detection.)',
    confidence: demo ? 'medium' : 'low',
    hazards,
    improvements,
    suitability,
    recommended_pets,
    notes: demo
      ? 'This is an approximate, 2D assessment for demonstration. A fuller LiDAR/3D scan would confirm window screening, railing gap widths, and exact floor materials. Not a substitute for a vet or shelter assessment.'
      : 'Demo mode returns a sample assessment based on your questionnaire and tags rather than the photos. Add a Gemini API key (see src/ai/config.ts) for real photo analysis.',
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
  q: Session['questionnaire']
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

function recommendPets(q: Session['questionnaire']): Assessment['recommended_pets'] {
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
