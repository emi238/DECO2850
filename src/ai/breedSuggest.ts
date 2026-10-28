// "Explore breeds for my space" suggestions (spec §5.1a), in two steps:
//
//  1. LOGIC — every breed in the catalogue (3 built-ins + The Dog API) is scored
//     against this space with the logic v2 rules (suitability.ts, via rankBreeds).
//     The best 30 become the shortlist, so the model can only pick real breeds
//     with known traits.
//  2. AI — Gemini reads the household answers, the room assessment and the
//     shortlist, then picks up to 8 breeds with a plain-English reason and a
//     watch-out for each. Its picks are checked against the shortlist.
//
// If real AI is off, or the call fails, the logic ranking is used on its own, so
// the screen never dead-ends. No numeric scores are ever shown to the user.

import type { Questionnaire, Space } from '../types';
import type { BreedProfile } from '../logic/breeds';
import { evaluate, rankBreeds, type Band } from '../logic/evaluate';
import { AI_CONFIG, realAiEnabled } from './config';
import { generateText, extractJson, householdContext } from './gemini';

export type Fit = 'good' | 'could_work' | 'tricky';

export interface BreedSuggestion {
  breed: BreedProfile;
  fit: Fit;
  reason: string; // why it suits this home
  watchOut: string; // the main thing to plan for
}

export interface SuggestionResult {
  suggestions: BreedSuggestion[];
  source: 'ai' | 'rules';
  note?: string; // shown when AI was wanted but we fell back
}

const SHORTLIST = 30;
const PICKS = 8;

export const BREED_SUGGEST_PROMPT = `You are PawSpace's dog-breed matchmaker. A person is checking whether their home suits a dog. Recommend dog breeds that would genuinely suit THIS home and household.

You receive JSON with:
- "household": the owner's own answers, treat them as facts ("not_answered" = unknown): dwelling, rental, neighbours (attached / close_separate / not_close), outdoor_access and outdoor_use (most_days / sometimes / rarely), children_at_home (none / young = under 5 / older = 5+), hours_alone (a typical day: under_4 / 4_to_8 / over_8), alone_plan (none / walker / daycare), owner_activity (sedentary / moderate / active), exercise_time (under_30 / 30_60 / over_60 minutes a day), experience (none = first dog / some = has owned a dog before), household_atmosphere (calm / mixed / busy), allergies (true / false), existing_pets (dogs, and other: cat / bird / small_animal / fish / reptile / other), size_preference (small / medium / large / any = the size of dog they would like).
- "room": a summary of the captured room, how many physical hazards were found, how many items the user tagged to protect, and how open the floor is and whether there is a spot for a dog bed.
- "candidates": a shortlist of real breeds. Each has name, size (small <12kg, medium 12-25kg, large >25kg), energy (low/moderate/high), noise (quiet/moderate/vocal), temperament, breed group, 1–5 scores where known (good_with_children, good_with_other_dogs, trainability, shedding; 5 = most, null = unknown), and "rule_fit": how PawSpace's rules rate it for this home (energy, safety, room, household, noise and overall: poor/adequate/good).
- When temperament or group is empty, use the 1–5 scores instead: good_with_children 4–5 counts as gentle and patient with children, good_with_other_dogs 4–5 as sociable with dogs, trainability 4–5 as eager to please (easier for a first dog), and shedding 1–2 as low shedding.

How to choose:
- ONLY choose breeds from "candidates". Copy each name exactly.
- Favour breeds whose rule_fit overall is good, then adequate. Weigh: energy vs owner_activity, exercise_time and outdoor space the dog will actually use (a high energy dog needs an active owner and over an hour a day); floor space vs size and energy; neighbour closeness vs noise (attached walls + vocal is a poor match); rentals favour smaller, quieter dogs; tagged items and hazards favour calmer, less destructive dogs; existing dogs favour sociable breeds.
- Size: if size_preference is small, medium or large, most picks should be that size; include another size only when it is a clearly better fit, and say so in "watch_out". With "any" or not_answered, offer a mix of sizes.
- Experience: for a first dog (experience none), favour easy-going, eager-to-please breeds and avoid stubborn, independent or very high energy ones.
- Home atmosphere: a busy home suits confident, easy-going breeds; avoid shy or sensitive ones.
- Allergies: if allergies is true, favour breeds known to shed little (for example poodles, bichons, schnauzers) when they are in the candidates, and mention grooming in "watch_out".
- A cat, bird or small animal at home (existing_pets.other): avoid breeds with a strong chase or prey drive (many hounds and terriers) and mention slow introductions or keeping them apart in "watch_out".
- Children: with young children, favour breeds whose temperament is gentle, patient or tolerant, and avoid very boisterous or easily-startled ones; mention supervision in "watch_out". Older children suit most friendly, playful breeds.
- Time alone: with 4 to 8 hours alone, favour moderate or low energy breeds that are described as independent or calm. With over 8 hours alone, strongly favour low energy, independent, quieter breeds, avoid high energy or very people-focused breeds, and unless alone_plan is walker or daycare say in "watch_out" that one would help. Long hours alone plus attached walls makes a vocal breed a poor match.
- Offer variety (different sizes and temperaments) when several breeds fit similarly.
- Return up to ${PICKS} breeds, best match first.

Tone and rules:
- Plain, warm, non-judgemental English. NEVER use numbers, scores, percentages or rankings in the text.
- "reason": one sentence (max 18 words) in the dog's own voice ("I…") on why it would love this home, such as "I'm happy with short walks and a cosy corner."
- "watch_out": one sentence (max 14 words), a friendly plan in the dog's own voice, such as "Keep me cool in summer." (the app adds "To plan for:").
- Do not claim certainty about an individual dog; breed only explains part of behaviour.

Return ONLY JSON in exactly this shape:
{ "suggestions": [ { "name": "Breed Name", "fit": "good" | "could_work" | "tricky", "reason": "…", "watch_out": "…" } ] }`;

const RANK: Record<Band, number> = { poor: 0, adequate: 1, good: 2 };

function fitFromVerdict(v: Band): Fit {
  return v === 'good' ? 'good' : v === 'adequate' ? 'could_work' : 'tricky';
}

// Rule-based wording, used on its own when AI is unavailable.
function ruleSuggestion(space: Space, household: Questionnaire, b: BreedProfile): BreedSuggestion {
  const e = evaluate(space, household, { name: b.name, size: b.size, energy: b.energy, noise: b.noise, happy: b.happy, cutout: b.cutout, breed: b })!;
  const energyTxt = { good: 'My exercise needs fit your days', adequate: "I'd be happy with a daily walk-and-play plan", poor: "I'd need more walks and play than your days have now" }[e.bands.energy];
  const noiseTxt = { good: "and I'm pretty quiet", adequate: 'and I might bark now and then', poor: "and I can be chatty for close neighbours" }[e.bands.noise];
  const concerns = e.score.household.concerns.map((c) => c.id);
  const withPlan = household.alone_plan === 'walker' || household.alone_plan === 'daycare';
  const watch =
    household.hours_alone === 'over_8' && !withPlan
      ? 'Long days alone get lonely, so a walker helps.'
      : concerns.some((c) => c.startsWith('kids'))
      ? 'Little ones and I need supervising at first.'
      : concerns.includes('pet_chase')
      ? "I might chase your other pets, so let's meet slowly."
      : concerns.some((c) => c.startsWith('first_dog'))
      ? 'A training class would help us both.'
      : e.bands.safety !== 'good'
      ? 'Move the things on your list up out of my reach.'
      : household.outdoor_access === 'none' && b.energy !== 'low'
      ? "There's no yard, so I'd need daily walks."
      : "I'd love a quiet corner of my own.";
  return { breed: b, fit: fitFromVerdict(e.verdict), reason: `${energyTxt}, ${noiseTxt}.`, watchOut: watch };
}

function shortlist(space: Space, household: Questionnaire, breeds: BreedProfile[]) {
  return rankBreeds(space, household, breeds).slice(0, SHORTLIST);
}

function contextFor(space: Space, household: Questionnaire, list: ReturnType<typeof shortlist>) {
  const room = space.result?.room_assessment;
  return {
    household: householdContext(household),
    room: {
      name: space.label || space.name,
      summary: space.result?.space_summary ?? '',
      physical_hazards_found: list[0]?.evaluation.score.safety.counted.length ?? 0,
      items_tagged_to_protect: space.tags.length,
      openness: room?.openness ?? 'unknown',
      retreat_spot: room?.retreat_spot ?? 'unknown',
    },
    candidates: list.map(({ breed: b, evaluation: e }) => ({
      name: b.name,
      size: b.size,
      energy: b.energy,
      noise: b.noise,
      temperament: b.temperament ?? '',
      group: b.group ?? '',
      // 1–5 scores from API Ninjas (null when the breed came from another source).
      good_with_children: b.goodWithChildren ?? null,
      good_with_other_dogs: b.goodWithOtherDogs ?? null,
      trainability: b.trainability ?? null,
      shedding: b.shedding ?? null,
      rule_fit: { ...e.bands, overall: e.verdict },
    })),
  };
}

// Turn the model's JSON into suggestions, keeping only names from the shortlist.
export function parseSuggestions(raw: any, list: BreedProfile[]): Omit<BreedSuggestion, never>[] {
  const byName = new Map(list.map((b) => [b.name.trim().toLowerCase(), b]));
  const seen = new Set<string>();
  const out: BreedSuggestion[] = [];
  for (const s of Array.isArray(raw?.suggestions) ? raw.suggestions : []) {
    const b = byName.get(String(s?.name ?? '').trim().toLowerCase());
    if (!b || seen.has(b.id)) continue;
    seen.add(b.id);
    const fit: Fit = s.fit === 'good' || s.fit === 'tricky' ? s.fit : 'could_work';
    const clean = (t: unknown) => String(t ?? '').replace(/\d+\s*%?/g, '').trim(); // no numbers on screen
    out.push({ breed: b, fit, reason: clean(s.reason), watchOut: clean(s.watch_out) });
    if (out.length >= PICKS) break;
  }
  return out;
}

// Cache per space + household + catalogue size so flipping tabs doesn't re-call the model.
const cache = new Map<string, SuggestionResult>();
// After a failure, reuse the rules answer for a short while instead of asking again
// on every tab switch (each ask tries up to three models).
const failed = new Map<string, { result: SuggestionResult; until: number }>();
const RETRY_AFTER_MS = 2 * 60 * 1000;

export async function suggestBreeds(
  space: Space,
  household: Questionnaire,
  breeds: BreedProfile[]
): Promise<SuggestionResult> {
  const key = JSON.stringify([space.id, space.result?.space_summary, space.tags.length, household, breeds.length]);
  const hit = cache.get(key);
  if (hit) return hit;
  const recent = failed.get(key);
  if (recent && Date.now() < recent.until) return recent.result;

  const list = shortlist(space, household, breeds);
  const rules: SuggestionResult = {
    suggestions: list.slice(0, PICKS).map(({ breed }) => ruleSuggestion(space, household, breed)),
    source: 'rules',
  };

  if (!realAiEnabled()) {
    cache.set(key, rules);
    return rules;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AI_CONFIG.TIMEOUT_MS);
  try {
    const body = {
      contents: [
        {
          role: 'user',
          parts: [{ text: BREED_SUGGEST_PROMPT }, { text: 'CONTEXT:\n' + JSON.stringify(contextFor(space, household, list)) }],
        },
      ],
      generationConfig: { responseMimeType: 'application/json', temperature: 0.5 },
    };
    const text = await generateText(body, controller.signal);
    const picks = parseSuggestions(extractJson(text), list.map((r) => r.breed));
    if (picks.length < 3) throw new Error('Too few valid picks');
    const result: SuggestionResult = { suggestions: picks, source: 'ai' };
    cache.set(key, result);
    return result;
  } catch (e) {
    if (typeof __DEV__ !== 'undefined' && __DEV__) console.warn('[breedSuggest] AI failed, using rules:', e instanceof Error ? e.message : e);
    const busy = e instanceof Error && /Gemini HTTP (429|500|503)\b/.test(e.message);
    const result: SuggestionResult = {
      ...rules,
      note: busy
        ? 'Google’s AI is busy right now, so these suggestions come from PawSpace’s space rules. Try again in a few minutes.'
        : 'The AI couldn’t be reached, so these suggestions come from PawSpace’s space rules.',
    };
    failed.set(key, { result, until: Date.now() + RETRY_AFTER_MS });
    return result;
  } finally {
    clearTimeout(timer);
  }
}

// Exported for tests / the rule-only path.
export { RANK };
