// The Dog API (https://thedogapi.com) — the full breed catalogue with photos,
// temperament, life span and what each breed was bred for.
//
// The API needs a free key. Put it in ".env.local" (never committed):
//     EXPO_PUBLIC_DOG_API_KEY=your-key-here
// then restart the dev server. Without a key the app just uses the three
// built-in breeds in breeds.ts.
//
// The breed list is fetched once, then cached on the device for a week so the
// app doesn't call the API on every launch.

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Energy, Noise, SizeClass } from './breeds';

const env = process.env as Record<string, string | undefined>;
const API_KEY = env.EXPO_PUBLIC_DOG_API_KEY ?? '';
const BASE = 'https://api.thedogapi.com/v1';
const CDN = 'https://cdn2.thedogapi.com/images';
const CACHE_KEY = 'pawspace-dogapi-breeds-v1';
const CACHE_MS = 7 * 24 * 60 * 60 * 1000;

export function dogApiEnabled(): boolean {
  return API_KEY.trim().length > 0;
}

// A breed from the API, already translated into the fields the evaluation uses.
export interface ApiBreed {
  id: string; // "api:<id>"
  name: string;
  weightKg: number | null;
  size: SizeClass;
  energy: Energy;
  noise: Noise;
  imageUrl: string | null;
  temperament: string;
  lifeSpan: string;
  bredFor: string;
  group: string;
  origin: string;
  description: string;
  traitsEstimated: boolean; // energy/noise guessed from temperament & group
}

// ---- parsing (tolerant: the free and paid plans return different fields) ----

function midpoint(range: unknown): number | null {
  if (typeof range !== 'string' && typeof range !== 'number') return null;
  const nums = String(range).match(/\d+(\.\d+)?/g)?.map(Number) ?? [];
  if (!nums.length) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function score(v: unknown): number | null {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? parseFloat(v) : NaN;
  return Number.isFinite(n) && n > 0 ? n : null;
}

const count = (text: string, words: RegExp) => (text.toLowerCase().match(words) ?? []).length;

export function parseBreed(raw: any): ApiBreed | null {
  if (!raw || raw.id == null || !raw.name) return null;
  const temperament = String(raw.temperament ?? '');
  const group = String(raw.breed_group ?? '');
  const bredFor = raw.bred_for ? String(raw.bred_for) : '';
  const text = `${temperament} ${bredFor} ${raw.description ?? ''}`;

  // Weight → size class (spec §4.2: small <12kg, medium 12–25kg, large >25kg).
  const kg =
    midpoint(raw.weight?.metric) ??
    (() => {
      const m = midpoint(raw.male_weight_kg);
      const f = midpoint(raw.female_weight_kg);
      return m != null && f != null ? (m + f) / 2 : m ?? f;
    })();
  const size: SizeClass = kg == null ? 'medium' : kg < 12 ? 'small' : kg <= 25 ? 'medium' : 'large';

  // Energy: use the API's 1–5 score when present, else infer.
  let estimated = false;
  let energy: Energy;
  const e = score(raw.energy_level);
  const exerciseMin = midpoint(raw.daily_exercise_time_minutes);
  if (e != null) energy = e <= 2 ? 'low' : e >= 4 ? 'high' : 'moderate';
  else if (exerciseMin != null) energy = exerciseMin < 45 ? 'low' : exerciseMin >= 90 ? 'high' : 'moderate';
  else {
    // Weigh temperament words against each other (plus the breed group) rather
    // than letting a single word like "active" decide.
    estimated = true;
    const hi = count(text, /energetic|tireless|athletic|agile|hard-working|driven|lively|high-energy|spirited|vigorous|boisterous|energy/g);
    const lo = count(text, /calm|laid-back|easygoing|easy-going|docile|relaxed|lazy|placid|mellow|dignified|lap/g);
    const g = /herding|sporting|terrier/i.test(group) ? 1 : /toy|companion|non-sporting|guardian/i.test(group) ? -1 : 0;
    const sizeNudge = kg != null && kg > 45 ? -1 : 0; // giant breeds tend to be lower energy indoors
    const t = hi - lo + g + sizeNudge;
    energy = t >= 2 ? 'high' : t <= -1 ? 'low' : 'moderate';
  }

  // Noise: use barking/vocalisation score when present, else infer.
  let noise: Noise;
  const b = score(raw.barking_score) ?? score(raw.vocalisation);
  if (b != null) noise = b <= 2 ? 'quiet' : b >= 4 ? 'vocal' : 'moderate';
  else {
    estimated = true;
    const loud = count(text, /vocal|noisy|bark|yappy|howl|talkative|watchdog|watchful|vigilant/g);
    const quiet = count(text, /quiet|calm|reserved|gentle|placid|laid-back|easygoing|dignified|docile/g);
    // Hounds bay, terriers and toy breeds tend to bark at everything.
    const g = /hound/i.test(group) ? 2 : /terrier|toy/i.test(group) ? 1 : 0;
    const t = loud - quiet + g;
    noise = t >= 1 ? 'vocal' : t <= -1 ? 'quiet' : 'moderate';
  }

  const imageUrl: string | null =
    raw.image?.url ?? (raw.reference_image_id ? `${CDN}/${raw.reference_image_id}.jpg` : null);

  return {
    id: `api:${raw.id}`,
    name: String(raw.name),
    weightKg: kg == null ? null : Math.round(kg),
    size,
    energy,
    noise,
    imageUrl,
    temperament,
    lifeSpan: String(raw.life_span ?? ''),
    bredFor,
    group,
    origin: String(raw.origin ?? ''),
    description: String(raw.description ?? ''),
    traitsEstimated: estimated,
  };
}

// ---- fetching + cache ----

let memory: ApiBreed[] | null = null;
let inflight: Promise<ApiBreed[]> | null = null;

export async function loadApiBreeds(): Promise<ApiBreed[]> {
  if (memory) return memory;
  if (!dogApiEnabled()) return [];
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
      const res = await fetch(`${BASE}/breeds?limit=1000`, { headers: { 'x-api-key': API_KEY } });
      if (!res.ok) throw new Error(`Dog API ${res.status}`);
      const json = await res.json();
      const breeds = (Array.isArray(json) ? json : [])
        .map(parseBreed)
        .filter((b): b is ApiBreed => !!b)
        // The API has the odd duplicate name; keep the first.
        .filter((b, i, all) => all.findIndex((x) => x.name.toLowerCase() === b.name.toLowerCase()) === i)
        .sort((a, b) => a.name.localeCompare(b.name));
      memory = breeds;
      AsyncStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), breeds })).catch(() => {});
      return breeds;
    } catch {
      return []; // Offline / bad key: fall back to the built-in breeds.
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}
