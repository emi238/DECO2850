// Recommendations + shopping list (spec §6.3 / §8), from ar-immersive-scan 51d2e26,
// adapted to logic v2. Pure logic (type-only imports), checked by
// scripts/check-logic.mjs. Turns the evaluation and the room assessment into two
// lists the owner acts on:
//   • recommendations — what to change to make the space suit THIS dog
//   • shopping        — what to buy to do it (gates to close areas off, etc.)
// Items that close an area off carry `offLimits`, so choosing one can drop an
// off-limits tag on the map.

import type { Assessment, DogSpot, Hazard, HazardCategory, OffLimitSuggestion, SafetyAddition, Severity } from '../types';
import type { Evaluation } from './evaluate';

export interface Recommendation {
  id: string;
  title: string;
  detail: string;
  severity: Severity;
  area: string;
  offLimits?: boolean; // this recommendation is to close an area off
  hazardId?: string; // the finding it came from
}

export interface ShoppingItem {
  id: string;
  item: string;
  why: string;
  area?: string;
  offLimits?: boolean; // buying this closes an area off → offer an off-limits tag
}

export interface RecommendationSet {
  recommendations: Recommendation[];
  shopping: ShoppingItem[];
}

const RANK: Record<Severity, number> = { high: 0, medium: 1, low: 2 };

// A friendly "area" name per checklist letter, and the product that addresses it.
// `offLimits` marks categories where the fix is to physically close it off.
const PLAN: Record<HazardCategory, { area: string; item?: string; offLimits?: boolean }> = {
  A: { area: 'Plants', item: 'Wall-mounted or hanging planter' },
  B: { area: 'Cords & cables', item: 'Cable covers or cord concealer' },
  C: { area: 'Cleaning & chemicals', item: 'Lockable storage box' },
  D: { area: 'Sharp or fragile items', item: 'Corner guards and a closed display cabinet' },
  E: { area: 'Hot surfaces', item: 'Stove knob covers or a heater guard' },
  F: { area: 'Stairs', item: 'Stair safety gate', offLimits: true },
  G: { area: 'Balcony or windows', item: 'Pet safety gate or balcony net', offLimits: true },
  H: { area: 'Climbable furniture', item: 'Window guards' },
  I: { area: 'Open floor', item: 'Storage baskets to clear the floor' },
  J: { area: 'Off-limits zone', item: 'Freestanding pet gate', offLimits: true },
  K: { area: 'Windows to the street', item: 'Frosted window film' },
  L: { area: 'Pool or water', item: 'Pool safety fence', offLimits: true },
  M: { area: 'Shared living space' },
  N: { area: 'Enrichment', item: 'Chew toys and enrichment set' },
};

function planFor(h: Hazard) {
  if (h.source === 'user_tag') return { area: 'Your valuables', item: 'A closed cabinet or high shelf' };
  // Checklist E covers both heat and slippery floors; v2's hazard type tells them apart.
  if (h.category === 'E' && h.hazard_type === 'floor_stairs') return { area: 'Slippery floors', item: 'Non-slip rugs or runners' };
  return PLAN[h.category];
}

const ADDITION_ITEM: Record<SafetyAddition['type'], { item: string; offLimits?: boolean }> = {
  gate: { item: 'Pet safety gate', offLimits: true },
  railing: { item: 'Railing guard panels' },
  netting: { item: 'Balcony safety net' },
  window_guard: { item: 'Window guards or locks' },
  pen: { item: 'Dog playpen' },
  cord_cover: { item: 'Cable covers or cord concealer' },
  non_slip_mat: { item: 'Non-slip rugs or runners' },
  other: { item: '' }, // uses the suggestion's own detail
};

const SPOT_ITEM: Partial<Record<DogSpot['purpose'], string>> = {
  bed: 'Dog bed',
  crate: 'Dog crate',
  food_water: 'Non-slip bowl mat',
};

const ZONE_NAME: Record<OffLimitSuggestion['zone'], string> = {
  kitchen: 'the kitchen',
  balcony: 'the balcony',
  nursery: 'the nursery',
  office: 'the office',
  stairs: 'the stairs',
  other: 'this area',
};

export function buildRecommendations(evaluation: Evaluation | null, result: Assessment | null): RecommendationSet {
  const recommendations: Recommendation[] = [];
  const shopping: ShoppingItem[] = [];
  const seenProduct = new Set<string>();

  const addShopping = (item: string, why: string, area?: string, offLimits?: boolean) => {
    const key = item.trim().toLowerCase();
    if (!key || seenProduct.has(key)) return;
    seenProduct.add(key);
    shopping.push({ id: `buy-${key.replace(/[^a-z0-9]+/g, '-')}`, item: item.trim(), why, area, offLimits });
  };

  // ---- 1. Each pinned finding (dangers and the owner's valuables) → a recommendation
  for (const h of (result?.hazards ?? []).filter((x) => x.scope === 'object' && x.hazard_type !== 'other')) {
    const plan = planFor(h);
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

  // ---- 2. Areas to keep the dog out of, things to add, and spots for the dog ----
  (result?.off_limit_suggestions ?? []).forEach((o, i) => {
    recommendations.push({
      id: `zone-${i}`,
      title: `Keep the dog out of ${ZONE_NAME[o.zone]}`,
      detail: o.reason,
      severity: 'medium',
      area: ZONE_NAME[o.zone].replace(/^the /, '').replace(/^\w/, (c) => c.toUpperCase()),
      offLimits: true,
    });
  });
  for (const a of result?.safety_additions ?? []) {
    const plan = ADDITION_ITEM[a.type];
    addShopping(plan.item || a.detail, a.reason, undefined, plan.offLimits);
  }
  for (const d of result?.dog_spots ?? []) {
    const item = SPOT_ITEM[d.purpose];
    if (item) addShopping(item, d.reason);
  }

  // ---- 3. From the evaluation (room, routine, neighbours) ----
  if (evaluation) {
    const dog = evaluation.dog.name;
    const { bands, score } = evaluation;
    const room = result?.room_assessment;
    const roomKnown = !!room && !score.unknown.includes('photos') && !score.unknown.includes('room');

    if (roomKnown && bands.room !== 'good') {
      const tight = bands.room === 'poor';
      recommendations.push({
        id: 'dog-space',
        title: tight ? 'Clear some floor to play on' : 'A little more open floor',
        detail: `${dog} is a ${evaluation.effective} dog for space purposes${
          evaluation.dog.energy === 'high' ? ' with high energy' : ''
        }. Clearing a walkway and a clutter-free zone gives room to move and settle.`,
        severity: tight ? 'high' : 'low',
        area: 'Open floor',
      });
      addShopping('Storage baskets to clear the floor', `More open floor for ${dog}`, 'Open floor');
    }

    if (roomKnown && room.retreat_spot !== 'present') {
      recommendations.push({
        id: 'dog-zone',
        title: 'Make a cosy corner for a bed',
        detail: `${dog} needs one quiet corner away from foot traffic to call their own.`,
        severity: 'low',
        area: 'Resting corner',
      });
      addShopping('Dog bed', `A defined resting corner for ${dog}`, 'Resting corner');
    }

    if (bands.energy !== 'good' && !score.energy.undecided) {
      recommendations.push({
        id: 'dog-exercise',
        title: 'Plan daily walks and play',
        detail: `${dog} would be happiest with daily walks, play and company. Puzzle toys help on busy days.`,
        severity: bands.energy === 'poor' ? 'high' : 'medium',
        area: 'Enrichment',
      });
      addShopping('Puzzle feeder and indoor agility set', `Burns energy indoors for ${dog}`, 'Enrichment');
    }

    if (bands.noise === 'poor') {
      recommendations.push({
        id: 'dog-noise',
        title: 'Soften sound near shared walls',
        detail: `${dog} can be vocal and the neighbours are close. Soft furnishings and calm training near shared walls help keep the peace.`,
        severity: 'medium',
        area: 'Shared walls',
      });
      addShopping('Acoustic foam panels', 'Dampens barking near shared walls', 'Shared walls');
    }
  }

  recommendations.sort((a, b) => RANK[a.severity] - RANK[b.severity]);
  // Items that close an area off come first: they're the most actionable buys.
  shopping.sort((a, b) => Number(!!b.offLimits) - Number(!!a.offLimits));

  return { recommendations, shopping };
}

// ---------------------------------------------------------------------------
// One ordered to-do list for the results screens (Results guide step 2, B1).
// Built from the same data as above; every item appears once, numbered 1..n in
// list order (spots and protect items aren't numbered). Pure logic.

export type TodoGroup = 'do_first' | 'worth_doing' | 'nice_extra' | 'spot' | 'protect';
export type TodoNeed = 'safety' | 'energy' | 'room' | 'household' | 'noise' | 'setup';

export interface TodoItem {
  id: string;
  group: TodoGroup;
  need: TodoNeed;
  title: string;
  whatToDo: string; // app voice
  why?: string; // why it matters (dog voice when the model wrote it that way)
  frame_index?: number; // photo it's on; undefined = no photo
  x?: number;
  y?: number;
  product?: string; // a general shopping idea, if any
  offLimits?: boolean;
  tagged?: boolean; // the owner's own valuable / fragile item
  number?: number;
}

export const TODO_GROUPS: TodoGroup[] = ['do_first', 'worth_doing', 'nice_extra', 'spot', 'protect'];
const SEV_GROUP: Record<Severity, TodoGroup> = { high: 'do_first', medium: 'worth_doing', low: 'nice_extra' };

export function buildTodo(evaluation: Evaluation | null, result: Assessment | null): TodoItem[] {
  const items: TodoItem[] = [];
  const gateFirst: TodoItem[] = [];
  const gates = evaluation?.gates ?? [];

  for (const h of (result?.hazards ?? []).filter((x) => x.scope === 'object' && x.hazard_type !== 'other')) {
    const loc = h.location;
    const where = loc ? { frame_index: loc.frame_index, x: loc.x, y: loc.y } : {};
    const tagged = h.source === 'user_tag';
    const item: TodoItem = {
      id: `hz-${h.id}`,
      group: tagged ? 'protect' : SEV_GROUP[h.severity],
      need: tagged ? 'setup' : h.hazard_type === 'clutter' ? 'room' : 'safety',
      title: h.title,
      whatToDo: h.recommendation || h.why_it_matters,
      why: h.why_it_matters || undefined,
      ...where,
      product: planFor(h).item,
      tagged,
    };
    const isGate =
      !tagged &&
      ((gates.includes('escape') && h.hazard_type === 'escape_fall') || (gates.includes('toxic') && h.hazard_type === 'toxic_ingestible' && !h.easy_fix));
    if (isGate) gateFirst.push({ ...item, group: 'do_first' });
    else items.push(item);
  }

  if (evaluation) {
    const { bands, score } = evaluation;
    const room = result?.room_assessment;
    const roomKnown = !!room && !score.unknown.includes('photos') && !score.unknown.includes('room');
    const spot = (result?.dog_spots ?? []).find((d) => d.purpose === 'bed');
    if (bands.energy !== 'good' && !score.energy.undecided) {
      items.push({
        id: 'dog-exercise',
        group: bands.energy === 'poor' || gates.includes('energy') ? 'do_first' : 'worth_doing',
        need: 'energy',
        title: 'Plan daily walks and play',
        whatToDo: `${evaluation.dog.name} would be happiest with daily walks, play and company. Puzzle toys help on busy days.`,
        product: 'Puzzle feeder',
      });
    }
    if (bands.noise === 'poor') {
      items.push({
        id: 'dog-noise',
        group: 'worth_doing',
        need: 'noise',
        title: 'Soften sound near shared walls',
        whatToDo: 'Soft furnishings and calm training near shared walls help keep the peace.',
        product: 'Acoustic foam panels',
      });
    }
    if (roomKnown && bands.room !== 'good') {
      items.push({
        id: 'dog-space',
        group: bands.room === 'poor' ? 'worth_doing' : 'nice_extra',
        need: 'room',
        title: bands.room === 'poor' ? 'Clear some floor to play on' : 'A little more open floor',
        whatToDo: 'Clear a walkway and a clutter-free patch of floor so there’s room to move and settle.',
        product: 'Storage basket',
      });
    }
    if (roomKnown && room!.retreat_spot !== 'present' && !spot) {
      items.push({
        id: 'dog-zone',
        group: 'nice_extra',
        need: 'room',
        title: 'Make a cosy corner for a bed',
        whatToDo: 'One quiet corner away from foot traffic gives a dog a place of their own.',
        product: 'Dog bed',
      });
    }
  }

  (result?.off_limit_suggestions ?? []).forEach((o, i) =>
    items.push({
      id: `zone-${i}`,
      group: 'worth_doing',
      need: 'setup',
      title: `Keep the dog out of ${ZONE_NAME[o.zone]}`,
      whatToDo: o.reason,
      frame_index: o.frame_index,
      x: o.x,
      y: o.y,
      product: 'Pet safety gate',
      offLimits: true,
    })
  );
  (result?.safety_additions ?? []).forEach((a, i) =>
    items.push({
      id: `add-${i}`,
      group: 'worth_doing',
      need: 'setup',
      title: a.detail.replace(/^\w/, (c) => c.toUpperCase()),
      whatToDo: a.reason,
      frame_index: a.frame_index,
      x: a.x,
      y: a.y,
      product: ADDITION_ITEM[a.type].item || undefined,
      offLimits: ADDITION_ITEM[a.type].offLimits,
    })
  );
  (result?.dog_spots ?? []).forEach((d, i) =>
    items.push({
      id: `spot-${i}`,
      group: 'spot',
      need: 'setup',
      title: SPOT_TITLE[d.purpose],
      whatToDo: d.reason,
      frame_index: d.frame_index,
      x: d.x,
      y: d.y,
      product: SPOT_ITEM[d.purpose],
    })
  );

  const ordered = [...gateFirst, ...TODO_GROUPS.flatMap((g) => items.filter((it) => it.group === g))];
  let n = 0;
  return ordered.map((it) => (it.group === 'spot' || it.group === 'protect' ? it : { ...it, number: ++n }));
}

const SPOT_TITLE: Record<DogSpot['purpose'], string> = {
  bed: 'Dog bed spot',
  crate: 'Crate spot',
  food_water: 'Food and water spot',
  play: 'Play area',
};

// Shopping ideas, one per product, each tied to the first item that needs it.
export function todoShopping(items: TodoItem[]): { product: string; forTitle: string; itemId: string }[] {
  const seen = new Set<string>();
  const out: { product: string; forTitle: string; itemId: string }[] = [];
  for (const it of items) {
    const key = it.product?.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push({ product: it.product!, forTitle: it.title, itemId: it.id });
  }
  return out;
}

// "{n} things to sort" counts only the to-dos (not spots or things to protect).
export function todoCount(items: TodoItem[]): number {
  return items.filter((it) => it.group === 'do_first' || it.group === 'worth_doing' || it.group === 'nice_extra').length;
}
