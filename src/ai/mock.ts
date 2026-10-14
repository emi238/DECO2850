// Built-in sample assessment (PRD §11: "canned fallback result"), used when real
// AI is off or fails, so a demo never dead-ends. Dogs only, logic v2 shape.
//
// The sample can't see the photos, so it only uses what the user actually told
// us: their tags and household answers. It builds a model-style reply and runs it
// through the same normaliser as the real model, so tags become "protect this"
// entries pinned where the user put them. It reports no photo hazards and no room
// assessment, so the rules treat the room as unknown rather than guessing.

import type { Assessment, Space } from '../types';
import { normaliseAssessment } from './normalise';

type RawFinding = {
  object_key: string;
  title: string;
  category: string;
  hazard_type: 'other';
  scope: 'space';
  severity: 'low' | 'medium';
  evidence: string;
  why_it_matters: string;
  recommendation: string;
};

// A household note: not a physical danger, so it never counts towards Safety.
function note(key: string, title: string, category: string, severity: 'low' | 'medium', why: string, rec: string): RawFinding {
  return {
    object_key: key,
    title,
    category,
    hazard_type: 'other',
    scope: 'space',
    severity,
    evidence: 'From your household answers (this sample can’t see the photos).',
    why_it_matters: why,
    recommendation: rec,
  };
}

export function generateMockAssessment(session: Space): Assessment {
  const { pet, questionnaire: q, tags } = session;
  const dogName = pet?.breed || 'the dog';

  const findings: RawFinding[] = [
    note('daily-exercise', 'Daily exercise needs', 'I', 'low',
      `${dogName} will need daily walks as well as indoor space.`,
      'Plan daily walks plus indoor play, such as puzzle feeders and chew toys.'),
  ];
  if (q.children_at_home === 'young') {
    findings.push(note('young-children', 'Young children at home', 'M', 'medium',
      'Dogs and small children need supervision and a way to get space from each other.',
      'Give the dog a quiet retreat and use a baby gate to keep play areas separate.'));
  }
  const dogs = q.existing_pets.filter((p) => /dog/i.test(p.species));
  if (dogs.length > 0 || q.has_cat) {
    const others = [...dogs.map((p) => p.breed || 'dog'), ...(q.has_cat ? ['a cat'] : [])].join(', ');
    findings.push(note('introductions', 'Introducing your pets', 'M', 'medium',
      `The home already has ${others}, so a new dog needs a careful introduction.`,
      'Introduce them slowly, scent first, with separate safe spaces and supervised meetings.'));
  }

  const improvements = [
    ...tags.map((t) => `Move the ${t.label.toLowerCase()} somewhere the dog can’t reach.`),
    ...findings.map((f) => f.recommendation),
  ];
  if (q.hours_alone === 'over_8' && q.alone_plan !== 'walker' && q.alone_plan !== 'daycare') {
    improvements.push('A dog walker or daycare would help on long days alone.');
  }

  // General setup suggestions from the answers only: no positions, because the
  // sample hasn't seen the room.
  const dog_spots = [
    { purpose: 'bed', reason: 'Put the bed in a quiet corner away from doors, foot traffic and heaters.' },
  ];
  const safety_additions: { type: string; detail: string; reason: string }[] = [];
  if (q.children_at_home === 'young') {
    safety_additions.push({ type: 'gate', detail: 'A baby gate between the children’s play area and the dog’s space.', reason: 'Keeps the dog and small children apart when you can’t supervise.' });
  }
  if (q.hours_alone === '4_to_8' || q.hours_alone === 'over_8') {
    safety_additions.push({ type: 'pen', detail: 'A playpen or crate area cleared of cords, shoes and plants.', reason: 'Gives the dog a safe zone while you’re out.' });
  }
  if (q.outdoor_access === 'balcony') {
    safety_additions.push({ type: 'netting', detail: 'Netting or clear panels if the balcony railing has gaps.', reason: 'Stops the dog squeezing through or falling.' });
  }

  const assessment = normaliseAssessment(
    {
      space_summary:
        'A single room captured across several frames. (Sample assessment: turn on the real model for photo-based hazard detection.)',
      confidence: 'low',
      hazards: findings,
      escape_routes: [],
      off_limit_suggestions: [],
      dog_spots,
      safety_additions,
      detected_signals: { existing_pets: 'unknown', children: 'unknown', dwelling_cue: 'unknown', outdoor_access_cue: 'unknown' },
      improvements,
      notes:
        'This sample assessment is based on your household answers and tags rather than the photos. Add a Gemini API key (see src/ai/config.ts) for real photo analysis.',
    },
    session
  );
  // The sample hasn't looked at the room, so it makes no claim about its space.
  return { ...assessment, room_assessment: undefined };
}
