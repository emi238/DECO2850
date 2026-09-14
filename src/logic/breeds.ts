// Breed profiles (spec §4.6). Every breed uses the same three fields (size,
// energy, noise) so the evaluation in evaluate.ts can run against any of them.
//
// The catalogue = the three hand-checked spec breeds below (with their cartoon
// avatar art) + every breed from The Dog API when a key is set (dogApi.ts).

import { useEffect, useState } from 'react';
import type { ImageSourcePropType } from 'react-native';
import { IMAGES } from '../assets';
import type { ApiBreed } from './dogApi';
import { loadApiBreeds } from './dogApi';

export type SizeClass = 'small' | 'medium' | 'large';
export type Energy = 'low' | 'moderate' | 'high';
export type Noise = 'quiet' | 'moderate' | 'vocal';

export interface BreedProfile {
  id: string;
  name: string;
  weightKg: number | null;
  size: SizeClass;
  energy: Energy;
  noise: Noise;
  happy: ImageSourcePropType; // peeking avatar image
  sitting: ImageSourcePropType; // full-body image (breed cards)
  cutout: boolean; // true = transparent cartoon art; false = a regular photo
  source: 'builtin' | 'api';
  // Facts from The Dog API (empty for built-ins until the API is loaded).
  temperament?: string;
  lifeSpan?: string;
  bredFor?: string;
  group?: string;
  description?: string;
  traitsEstimated?: boolean;
}

export const BREEDS: BreedProfile[] = [
  {
    id: 'french_bulldog',
    name: 'French Bulldog',
    weightKg: 11,
    size: 'small',
    energy: 'low',
    noise: 'moderate',
    happy: IMAGES.frenchieHappy,
    sitting: IMAGES.frenchieSitting,
    cutout: true,
    source: 'builtin',
  },
  {
    id: 'border_collie',
    name: 'Border Collie',
    weightKg: 18,
    size: 'medium',
    energy: 'high',
    noise: 'vocal',
    happy: IMAGES.collieHappy,
    sitting: IMAGES.collieSitting,
    cutout: true,
    source: 'builtin',
  },
  {
    id: 'labrador_retriever',
    name: 'Labrador Retriever',
    weightKg: 29,
    size: 'large',
    energy: 'moderate',
    noise: 'quiet',
    happy: IMAGES.labHappy,
    sitting: IMAGES.labSitting,
    cutout: true,
    source: 'builtin',
  },
];

// Spec §1.2 fallback: "Not sure / mixed breed" → size (and energy) entered by hand.
export const MIXED_ID = 'mixed';

export const ENERGY_OPTIONS: { value: Energy; label: string }[] = [
  { value: 'low', label: 'Low, happy to mostly relax' },
  { value: 'moderate', label: 'Moderate, regular play and movement' },
  { value: 'high', label: 'High, needs to run or climb often' },
];

export const SIZE_OPTIONS: { value: SizeClass; label: string }[] = [
  { value: 'small', label: 'Small, under 12kg' },
  { value: 'medium', label: 'Medium, 12-25kg' },
  { value: 'large', label: 'Large, over 25kg' },
];

const norm = (s: string) => s.trim().toLowerCase();

function fromApi(b: ApiBreed): BreedProfile {
  const img = b.imageUrl ? { uri: b.imageUrl } : IMAGES.paw;
  return {
    id: b.id,
    name: b.name,
    weightKg: b.weightKg,
    size: b.size,
    energy: b.energy,
    noise: b.noise,
    happy: img,
    sitting: img,
    cutout: false,
    source: 'api',
    temperament: b.temperament,
    lifeSpan: b.lifeSpan,
    bredFor: b.bredFor,
    group: b.group,
    description: b.description,
    traitsEstimated: b.traitsEstimated,
  };
}

// Built-ins keep their spec traits and cartoon art, but pick up the API's facts.
function merge(api: ApiBreed[]): BreedProfile[] {
  const byName = new Map(api.map((b) => [norm(b.name), b]));
  const builtins = BREEDS.map((b) => {
    const a = byName.get(norm(b.name));
    return a ? { ...b, temperament: a.temperament, lifeSpan: a.lifeSpan, bredFor: a.bredFor, group: a.group, description: a.description } : b;
  });
  const builtinNames = new Set(BREEDS.map((b) => norm(b.name)));
  const rest = api.filter((b) => !builtinNames.has(norm(b.name))).map(fromApi);
  return [...builtins, ...rest];
}

let catalogue: BreedProfile[] = BREEDS;

export function findBreed(nameOrId?: string | null): BreedProfile | undefined {
  if (!nameOrId) return undefined;
  const k = norm(nameOrId);
  return catalogue.find((b) => b.id === k || norm(b.name) === k);
}

// The full catalogue as a hook: starts with the built-ins, then adds the API
// breeds once loaded (instantly from cache after the first time).
export function useBreedCatalogue(): { breeds: BreedProfile[]; loading: boolean } {
  const [breeds, setBreeds] = useState<BreedProfile[]>(catalogue);
  const [loading, setLoading] = useState(catalogue === BREEDS);
  useEffect(() => {
    let alive = true;
    loadApiBreeds().then((api) => {
      if (api.length) catalogue = merge(api);
      if (alive) {
        setBreeds(catalogue);
        setLoading(false);
      }
    });
    return () => {
      alive = false;
    };
  }, []);
  return { breeds, loading };
}
