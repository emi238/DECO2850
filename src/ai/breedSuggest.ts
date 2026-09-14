// "Explore breeds for my space" suggestions (spec §5.1a), in two steps:
//
//  1. LOGIC — every breed in the catalogue (3 built-ins + The Dog API) is scored
//     against this space with the spec §4 rules (rankBreeds). The best 30 become
//     the shortlist, so the model can only pick real breeds with known traits.
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
import { generateText, extractJson } from './gemini';

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
- "household": dwelling type, rental, how close the neighbours are, outdoor access, existing dogs.
- "room": a summary of the captured room, the number of physical hazards found, the number of valuables the user tagged, and the estimated open floor space.
- "candidates": a shortlist of real breeds. Each has name, size (small <12kg, medium 12-25kg, large >25kg), energy (low/moderate/high), noise (quiet/moderate/vocal), temperament, breed group, and "rule_fit" — how PawSpace's space rules rate it for this room (space, safety, noise: poor/adequate/good).

How to choose:
- ONLY choose breeds from "candidates". Copy each name exactly.
- Favour breeds whose rule_fit is good or adequate. Weigh: floor space vs size and energy; outdoor access vs energy (no outdoor space + high energy is a poor match); neighbour closeness vs noise (attached walls + vocal is a poor match); rentals favour smaller, quieter dogs; tagged valuables and hazards favour calmer, less destructive dogs; existing dogs favour sociable breeds.
- Offer variety (different sizes and temperaments) when several breeds fit similarly.
- Return up to ${PICKS} breeds, best match first.

Tone and rules:
- Plain, warm, non-judgemental English. NEVER use numbers, scores, percentages or rankings in the text.
- "reason": one sentence (max 18 words) on why it suits this specific home.
- "watch_out": one sentence (max 14 words) on the main thing to plan for.
- Do not claim certainty about an individual dog; breed only explains part of behaviour.

Return ONLY JSON in exactly this shape:
{ "suggestions": [ { "name": "Breed Name", "fit": "good" | "could_work" | "tricky", "reason": "…", "watch_out": "…" } ] }`;

const RANK: Record<Band, number> = { poor: 0, adequate: 1, good: 2 };

function fitFromTone(tone: Band): Fit {
  return tone === 'good' ? 'good' : tone === 'adequate' ? 'could_work' : 'tricky';
}

// Rule-based wording, used on its own when AI is unavailable.
function ruleSuggestion(space: Space, household: Questionnaire, b: BreedProfile): BreedSuggestion {
  const e = evaluate(space, household, { name: b.name, size: b.size, energy: b.energy, noise: b.noise, happy: b.happy, cutout: b.cutout, breed: b })!;
  const spaceTxt = { good: 'Enough floor space for its size and energy', adequate: 'A bit snug, but workable', poor: 'Likely cramped for this breed' }[e.space];
  const noiseTxt = { good: 'no noise concerns', adequate: 'some barking to manage', poor: 'may be loud for close neighbours' }[e.noise];
  const watch =
    e.safety !== 'good'
      ? 'Move flagged hazards and valuables out of reach first.'
      : household.outdoor_access === 'none' && b.energy !== 'low'
      ? 'Plan daily walks, there is no outdoor space.'
      : 'Give it a quiet corner of its own.';
  return { breed: b, fit: fitFromTone(e.tone), reason: `${spaceTxt}, ${noiseTxt}.`, watchOut: watch };
}

function shortlist(space: Space, household: Questionnaire, breeds: BreedProfile[]) {
  return rankBreeds(space, household, breeds).slice(0, SHORTLIST);
}

function contextFor(space: Space, household: Questionnaire, list: ReturnType<typeof shortlist>) {
  const hazards = (space.result?.hazards ?? []).filter((h) => h.scope === 'object').length;
  return {
    household: {
      dwelling: household.dwelling,
      rental: household.rental,
      neighbours: household.neighbours,
      outdoor_access: household.outdoor_access,
      existing_dogs: household.existing_pets.map((p) => p.breed || 'dog'),
    },
    room: {
      name: space.label || space.name,
      summary: space.result?.space_summary ?? '',
      physical_hazards_found: hazards,
      valuables_tagged: space.tags.length,
      open_floor: list[0]?.evaluation.space ?? 'adequate',
    },
    candidates: list.map(({ breed: b, evaluation: e }) => ({
      name: b.name,
      size: b.size,
      energy: b.energy,
      noise: b.noise,
      temperament: b.temperament ?? '',
      group: b.group ?? '',
      rule_fit: { space: e.space, safety: e.safety, noise: e.noise },
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

export async function suggestBreeds(
  space: Space,
  household: Questionnaire,
  breeds: BreedProfile[]
): Promise<SuggestionResult> {
  const key = JSON.stringify([space.id, space.result?.space_summary, space.tags.length, household, breeds.length]);
  const hit = cache.get(key);
  if (hit) return hit;

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
  } catch {
    return { ...rules, note: 'The AI couldn’t be reached, so these suggestions come from PawSpace’s space rules.' };
  } finally {
    clearTimeout(timer);
  }
}

// Exported for tests / the rule-only path.
export { RANK };
