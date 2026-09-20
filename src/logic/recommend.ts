// Recommendations + shopping list (spec §6.3 / §8). Turns the dog's suitability
// evaluation (breed, size, energy, noise + the Space/Safety/Noise bands) and the
// detected hazards into two lists the owner acts on:
//   • recommendations — what to change to make the space suit THIS dog
//   • shopping        — what to buy to do it (gates to fence areas off, etc.)
// Items that fence/close an area off carry `offLimits`, so selecting one can drop
// an off-limits tag on the map.

import type { Assessment, Hazard, HazardCategory, Severity } from '../types';
import { CATEGORY_LABELS } from '../ai/categories';
import type { Evaluation } from './evaluate';

export interface Recommendation {
  id: string;
  title: string;
  detail: string;
  severity: Severity;
  area: string;
  offLimits?: boolean; // this recommendation is to fence/close an area off
  hazardId?: string; // the detected hazard it came from (for tagging)
}

export interface ShoppingItem {
  id: string;
  item: string;
  why: string;
  area?: string;
  offLimits?: boolean; // buying this fences an area off → offer an off-limits tag
}

export interface RecommendationSet {
  recommendations: Recommendation[];
  shopping: ShoppingItem[];
}

const RANK: Record<Severity, number> = { high: 0, medium: 1, low: 2 };

// A friendly "area" name per hazard category, and the product that addresses it.
// `offLimits` marks categories where the fix is to physically fence/close it off.
const PLAN: Partial<Record<HazardCategory, { area: string; item?: string; offLimits?: boolean }>> = {
  A: { area: 'Plants', item: 'Wall-mounted / hanging planter' },
  B: { area: 'Cords & cables', item: 'Cable covers / cord concealer' },
  C: { area: 'Cleaning & chemicals', item: 'Lockable storage box' },
  D: { area: 'Sharp / fragile items', item: 'Corner guards + a closed display cabinet' },
  E: { area: 'Stove / hot surfaces', item: 'Stove knob covers' },
  F: { area: 'Stairs', item: 'Stair safety gate', offLimits: true },
  G: { area: 'Balcony / windows', item: 'Pet safety gate or balcony net', offLimits: true },
  H: { area: 'High shelves', item: 'Anti-tip furniture straps' },
  I: { area: 'Open floor', item: 'Storage baskets to clear the floor' },
  J: { area: 'Off-limit zone', item: 'Freestanding pet gate', offLimits: true },
  K: { area: 'Windows to the street', item: 'Frosted window film' },
  L: { area: 'Pool / water', item: 'Pool safety fence', offLimits: true },
  M: { area: 'Shared living space', item: undefined },
  N: { area: 'Enrichment', item: 'Chew toys & enrichment set' },
};

export function buildRecommendations(evaluation: Evaluation | null, result: Assessment | null): RecommendationSet {
  const recommendations: Recommendation[] = [];
  const shopping: ShoppingItem[] = [];
  const seenProduct = new Set<string>();

  const addShopping = (item: string, why: string, area?: string, offLimits?: boolean) => {
    const key = item.toLowerCase();
    if (seenProduct.has(key)) return;
    seenProduct.add(key);
    shopping.push({ id: `buy-${key.replace(/[^a-z0-9]+/g, '-')}`, item, why, area, offLimits });
  };

  // ---- 1. From detected hazards (each located object hazard → a recommendation)
  const hazards = (result?.hazards ?? []).filter((h) => h.scope === 'object');
  for (const h of hazards) {
    const plan = PLAN[h.category] ?? { area: CATEGORY_LABELS[h.category] };
    recommendations.push({
      id: `hz-${h.id}`,
      title: h.title,
      detail: h.recommendation || h.why_it_matters,
      severity: h.severity,
      area: plan.area,
      offLimits: plan.offLimits,
      hazardId: h.id,
    });
    if (plan.item) addShopping(plan.item, `Addresses “${h.title}”`, plan.area, plan.offLimits);
  }

  // ---- 2. From the dog's suitability evaluation (space / noise / enrichment) ----
  if (evaluation) {
    const dog = evaluation.dog.name;

    if (evaluation.space === 'poor' || evaluation.space === 'adequate') {
      const tight = evaluation.space === 'poor';
      recommendations.push({
        id: 'dog-space',
        title: tight ? `Open up more floor for ${dog}` : `A little more open floor for ${dog}`,
        detail: `${dog} is a ${evaluation.effective} dog for space purposes${
          evaluation.dog.energy === 'high' ? ' with high energy' : ''
        }. Clearing a walkway and a clutter-free zone gives room to move and settle.`,
        severity: tight ? 'high' : 'low',
        area: 'Open floor',
      });
      addShopping('Storage baskets to clear the floor', `More open floor for ${dog}`, 'Open floor');
    }

    // Adequate-only-because-no-personal-zone → suggest a defined resting spot.
    if (evaluation.spaceReason === 'zone') {
      recommendations.push({
        id: 'dog-zone',
        title: `Give ${dog} a spot of their own`,
        detail: `There's plenty of room — ${dog} just needs one quiet corner away from foot traffic to call their own.`,
        severity: 'low',
        area: 'Resting corner',
      });
      addShopping('Dog bed', `A defined resting corner for ${dog}`, 'Resting corner');
    }

    // No outdoor access + energetic dog (the §4.2 downgrade reason).
    if (evaluation.spaceReason === 'outdoor' || (evaluation.dog.energy === 'high' && evaluation.space !== 'good')) {
      recommendations.push({
        id: 'dog-exercise',
        title: `Plan daily activity for ${dog}`,
        detail: `With little outdoor space, ${dog}'s energy needs an outlet indoors — regular walks plus enrichment keep them settled.`,
        severity: 'medium',
        area: 'Enrichment',
      });
      addShopping('Puzzle feeder & indoor agility set', `Burns energy indoors for ${dog}`, 'Enrichment');
    }

    // Poor noise fit (vocal breed + close neighbours).
    if (evaluation.noise === 'poor') {
      recommendations.push({
        id: 'dog-noise',
        title: 'Soften sound near shared walls',
        detail: `${dog} can be vocal and the neighbours are close. Soft furnishings and calm-training near shared walls help keep the peace.`,
        severity: 'medium',
        area: 'Shared walls',
      });
      addShopping('Acoustic foam panels', 'Dampens barking near shared walls', 'Shared walls');
    }
  }

  recommendations.sort((a, b) => RANK[a.severity] - RANK[b.severity]);
  // Off-limits / fence-off products first — they're the most actionable buys.
  shopping.sort((a, b) => Number(!!b.offLimits) - Number(!!a.offLimits));

  return { recommendations, shopping };
}
