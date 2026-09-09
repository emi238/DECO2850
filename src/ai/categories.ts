// Human labels for the A–N assessment checklist (PRD §7.2 / §12).

import type { HazardCategory } from '../types';

export const CATEGORY_LABELS: Record<HazardCategory, string> = {
  A: 'Toxic plant',
  B: 'Electrical cords',
  C: 'Chemicals',
  D: 'Sharp / fragile',
  E: 'Thermal / surface',
  F: 'Floors & stairs',
  G: 'Escape & fall',
  H: 'Vertical space',
  I: 'Floor space',
  J: 'Off-limit zone',
  K: 'Outside stressors',
  L: 'Amenities',
  M: 'Occupants',
  N: 'Behavioural fit',
};
