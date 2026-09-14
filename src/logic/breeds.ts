// Breed profiles (spec §4.6). Every breed uses the same three fields so the
// evaluation in evaluate.ts can run against any of them. Add more rows here as
// the catalogue grows.

import { IMAGES } from '../assets';

export type SizeClass = 'small' | 'medium' | 'large';
export type Energy = 'low' | 'moderate' | 'high';
export type Noise = 'quiet' | 'moderate' | 'vocal';

export interface BreedProfile {
  id: string;
  name: string;
  weightKg: number;
  size: SizeClass;
  energy: Energy;
  noise: Noise;
  happy: number; // peeking avatar image
  sitting: number; // full-body image (breed cards)
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

export function findBreed(nameOrId?: string | null): BreedProfile | undefined {
  if (!nameOrId) return undefined;
  const k = nameOrId.trim().toLowerCase();
  return BREEDS.find((b) => b.id === k || b.name.toLowerCase() === k);
}
