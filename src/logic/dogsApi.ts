// API Ninjas — Dogs dataset (https://api-ninjas.com/api/dogs). Unlike The Dog API
// (dogApi.ts), every breed here carries *real numeric* trait scores (energy,
// barking, shedding, trainability, …, each 1–5), so the spec §4 logic runs on
// measured values instead of words guessed from a temperament sentence. This is
// the preferred breed source when its key is set.
//
// Needs a free key. Put it in ".env.local" (never committed):
//     EXPO_PUBLIC_NINJA_API_KEY=your-key-here
// then restart the dev server. Without a key the app falls back to The Dog API
// (if that key is set) and then to the three built-in breeds in breeds.ts.
//
// The endpoint has no "list all" call: every request needs a filter and returns
// at most 20 breeds. So we page the whole dataset once behind a catch-all filter
// (min_weight=1 lb, which every breed clears), then cache it on the device for a
// week — matching dogApi.ts.

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ApiBreed } from './dogApi';
import type { Energy, Noise, SizeClass } from './breeds';

const env = process.env as Record<string, string | undefined>;
const API_KEY = env.EXPO_PUBLIC_NINJA_API_KEY ?? '';
const BASE = 'https://api.api-ninjas.com/v1/dogs';
const CACHE_KEY = 'pawspace-ninja-breeds-v1';
const CACHE_MS = 7 * 24 * 60 * 60 * 1000;
const PAGE = 20; // API max page size
const MAX_PAGES = 25; // safety cap (~500 breeds) so a broken response can't loop forever

export function ninjaApiEnabled(): boolean {
  return API_KEY.trim().length > 0;
}

const LB_TO_KG = 0.453592;
const IN_TO_CM = 2.54;

// Average whatever weight/height fields the row provides (male/female min/max).
function avg(...vals: unknown[]): number | null {
  const nums = vals.map(Number).filter((n) => Number.isFinite(n) && n > 0);
  if (!nums.length) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

// A 1–5 score, or null if the field is missing/zero.
function band(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) && n >= 1 ? Math.round(n) : null;
}

export function parseNinja(raw: any): ApiBreed | null {
  if (!raw || !raw.name) return null;

  // Weight (pounds) → kg → size class (spec §4.2: <12kg small, 12–25 medium, >25 large).
  const lb = avg(raw.min_weight_male, raw.max_weight_male, raw.min_weight_female, raw.max_weight_female);
  const kg = lb == null ? null : lb * LB_TO_KG;
  const size: SizeClass = kg == null ? 'medium' : kg < 12 ? 'small' : kg <= 25 ? 'medium' : 'large';

  // Energy 1–5 → low/moderate/high (spec §4.6). Real dataset value, not a guess.
  const e = band(raw.energy);
  const energy: Energy = e == null ? 'moderate' : e <= 2 ? 'low' : e >= 4 ? 'high' : 'moderate';

  // Barking 1–5 → quiet/moderate/vocal (spec §4.4 noise tendency).
  const bk = band(raw.barking);
  const noise: Noise = bk == null ? 'moderate' : bk <= 2 ? 'quiet' : bk >= 4 ? 'vocal' : 'moderate';

  const heightIn = avg(raw.min_height_male, raw.max_height_male, raw.min_height_female, raw.max_height_female);
  const num = (v: unknown): number | null => (Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : null);
  const minLife = num(raw.min_life_expectancy);
  const maxLife = num(raw.max_life_expectancy);
  const lifeSpan = minLife && maxLife ? `${minLife}–${maxLife} years` : minLife ? `${minLife} years` : '';

  return {
    id: `ninja:${String(raw.name).toLowerCase().replace(/\s+/g, '_')}`,
    name: String(raw.name),
    weightKg: kg == null ? null : Math.round(kg),
    size,
    energy,
    noise,
    imageUrl: raw.image_link ? String(raw.image_link) : null,
    temperament: '', // API Ninjas has no temperament sentence; we show the numeric traits instead.
    lifeSpan,
    bredFor: '',
    group: '',
    origin: '',
    description: '',
    traitsEstimated: false, // energy & barking come straight from the dataset
    provider: 'api-ninjas',
    heightCm: heightIn == null ? null : Math.round(heightIn * IN_TO_CM),
    shedding: band(raw.shedding),
    trainability: band(raw.trainability),
    goodWithChildren: band(raw.good_with_children),
    goodWithOtherDogs: band(raw.good_with_other_dogs),
  };
}

// ---- fetching + cache ----

let memory: ApiBreed[] | null = null;
let inflight: Promise<ApiBreed[]> | null = null;

async function fetchAll(): Promise<ApiBreed[]> {
  const seen = new Set<string>();
  const out: ApiBreed[] = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const res = await fetch(`${BASE}?min_weight=1&offset=${page * PAGE}`, { headers: { 'X-Api-Key': API_KEY } });
    if (!res.ok) throw new Error(`API Ninjas ${res.status}`);
    const json = await res.json();
    const rows: any[] = Array.isArray(json) ? json : [];
    for (const row of rows) {
      const b = parseNinja(row);
      if (b && !seen.has(b.name.toLowerCase())) {
        seen.add(b.name.toLowerCase());
        out.push(b);
      }
    }
    if (rows.length < PAGE) break; // last page
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

export async function loadNinjaBreeds(): Promise<ApiBreed[]> {
  if (memory) return memory;
  if (!ninjaApiEnabled()) return [];
  if (inflight) return inflight;

  inflight = (async () => {
    try {
      const cached = await AsyncStorage.getItem(CACHE_KEY);
      if (cached) {
        const { at, breeds } = JSON.parse(cached) as { at: number; breeds: ApiBreed[] };
        if (Date.now() - at < CACHE_MS && breeds.length) return (memory = breeds);
      }
    } catch {
      // Ignore a corrupt cache and refetch.
    }
    try {
      const breeds = await fetchAll();
      if (!breeds.length) return [];
      memory = breeds;
      AsyncStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), breeds })).catch(() => {});
      return breeds;
    } catch {
      return []; // Offline / bad key: caller falls back to The Dog API, then built-ins.
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}
