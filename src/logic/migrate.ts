// Converts household answers saved by older versions of the app. Pure logic, checked
// by scripts/check-logic.mjs; used when saved data loads (store/session.ts).

import type { Questionnaire } from '../types';

type Saved = Omit<Questionnaire, 'experience'> & { has_cat?: boolean; experience?: Questionnaire['experience'] | 'experienced' };

export function migrateHousehold(saved: Saved): Questionnaire {
  const { has_cat, experience, ...rest } = saved;
  // Dogs only: drop any non-dog existing pets saved before the app went dogs-only.
  const q: Questionnaire = { ...rest, existing_pets: (rest.existing_pets ?? []).filter((e) => /dog/i.test(e.species)) };
  // "Do you have a cat?" (has_cat) became "Do you have any other pets?" (15 Oct 2026).
  if (has_cat !== undefined && q.has_other_pets === undefined) {
    q.has_other_pets = has_cat;
    q.other_pets = has_cat ? ['cat'] : [];
  }
  // "Have you owned a dog before?" became Yes / No (15 Oct 2026): "Lots" counts as yes.
  if (experience !== undefined) q.experience = experience === 'experienced' ? 'some' : experience;
  return q;
}
