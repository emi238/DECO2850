// Checks the suitability logic v2 against the acceptance criteria in the
// CHANGE PRD (15 Oct 2026 §9). Run with:  npm run check:logic
//
// It transpiles the pure logic files (no React Native) with the project's own
// TypeScript into a temp folder and runs them in Node. No test framework needed.

import ts from 'typescript';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = mkdtempSync(join(tmpdir(), 'pawspace-logic-'));
for (const file of ['src/ai/schema.ts', 'src/ai/normalise.ts', 'src/ai/prompt.ts', 'src/ai/config.ts', 'src/ai/gemini.ts', 'src/logic/suitability.ts', 'src/logic/changes.ts', 'src/logic/migrate.ts']) {
  const { outputText } = ts.transpileModule(readFileSync(join(root, file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  });
  const dest = join(out, file.replace(/\.ts$/, '.js'));
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, outputText);
}
const require = createRequire(import.meta.url);
const S = require(join(out, 'src/logic/suitability.js'));
const { normaliseAssessment } = require(join(out, 'src/ai/normalise.js'));
const { SYSTEM_PROMPT } = require(join(out, 'src/ai/prompt.js'));
const { ROOM_RESPONSE_SCHEMA } = require(join(out, 'src/ai/schema.js'));
const { callGemini } = require(join(out, 'src/ai/gemini.js'));
const { diffRuns, hasChanges } = require(join(out, 'src/logic/changes.js'));
const { migrateHousehold } = require(join(out, 'src/logic/migrate.js'));

// ---- fixtures ----

const household = (over = {}) => ({
  dwelling: 'house', rental: false, neighbours: 'not_close', floor_level: null, outdoor_access: 'private yard',
  adults: 1, children: 0, children_ages: '', infant_present: false, existing_pets: [], off_limit_zones: [],
  activity_level: 'medium', wants_apartment_friendly: false,
  outdoor_use: 'most_days', children_at_home: 'none', hours_alone: 'under_4', alone_plan: 'none',
  owner_activity: 'active', exercise_time: '30_60', experience: 'some', household_atmosphere: 'calm',
  allergies: false, has_other_pets: false, other_pets: [],
  ...over,
});
const collie = { name: 'Border Collie', size: 'medium', energy: 'high', noise: 'vocal' };
const lab = { name: 'Labrador Retriever', size: 'large', energy: 'moderate', noise: 'quiet', temperament: 'Kind, Outgoing, Gentle' };
const frenchie = { name: 'French Bulldog', size: 'small', energy: 'low', noise: 'moderate' };
const room = (over = {}) => ({
  openness: 'open', retreat_spot: 'present', clear_path: 'good', floor_type: 'soft',
  floor_area_m2: { value: null, confidence: 'low' }, ...over,
});
const result = (hazards = [], over = {}) => ({
  mode: 'pet_in_mind', space_summary: '', confidence: 'high', hazards, improvements: [], suitability: null,
  recommended_pets: [], notes: '', room_assessment: room(), escape_routes: [], off_limit_suggestions: [],
  detected_signals: { existing_pets: 'none', children: 'no', dwelling_cue: 'unknown', outdoor_access_cue: 'unknown' },
  ...over,
});
const hz = (over = {}) => ({
  id: 'h', category: 'B', title: 'Cord', scope: 'object', location: { frame_index: 0, x: 0.5, y: 0.5 },
  risk_to: 'animal', severity: 'low', evidence: '', why_it_matters: '', recommendation: '', object_key: 'cord',
  source: 'photo', confidence: 'high', hazard_type: 'electrical_thermal', small_dog_risk: false, easy_fix: true,
  tag_id: '', ...over,
});
const space = (tags = [], frames = 3) => ({ capture: { frames: Array.from({ length: frames }, () => ({ uri: '' })) }, tags });

// ---- runner ----

let passed = 0;
const failures = [];
function check(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    failures.push(name);
    console.log(`  ✗ ${name}\n      ${e.message.split('\n')[0]}`);
  }
}

console.log('\nWeights');
check('photo-derived sub-scores (Safety + Room to move) are 50% of the verdict', () => {
  assert.equal(Math.round((S.WEIGHTS.safety + S.WEIGHTS.room) * 100), 50);
  assert.equal(Math.round(Object.values(S.WEIGHTS).reduce((a, b) => a + b, 0) * 100), 100);
});

console.log('\nSafety load (type × severity × size × confidence)');
check('low-confidence findings count at half weight', () => {
  const high = S.safetyLoad(result([hz({ severity: 'medium', confidence: 'high' })]), 'medium').load;
  const low = S.safetyLoad(result([hz({ severity: 'medium', confidence: 'low' })]), 'medium').load;
  assert.equal(high, 4);
  assert.equal(low, 2);
});
check('three low-severity cords do not force "poor" (Safety stays adequate, verdict stays good)', () => {
  const r = result([hz({ object_key: 'a' }), hz({ object_key: 'b' }), hz({ object_key: 'c' })]);
  const s = S.scoreSuitability(collie, household(), r);
  assert.equal(s.safety.load, 6);
  assert.equal(s.bands.safety, 'adequate');
  assert.notEqual(s.verdict, 'poor');
});
check('size scale: a large dog ×1.3 on escape/fall; a small dog ×1.3 only on squeeze gaps / small objects', () => {
  const esc = [hz({ hazard_type: 'escape_fall', category: 'G', severity: 'high' })];
  assert.equal(S.safetyLoad(result(esc), 'medium').load, 9);
  assert.equal(Math.round(S.safetyLoad(result(esc), 'large').load * 10) / 10, 11.7);
  const sock = [hz({ hazard_type: 'toxic_ingestible', category: 'C', severity: 'medium', small_dog_risk: true })];
  assert.equal(S.safetyLoad(result(sock), 'small').load, 2.5 * 2 * 1.3);
  assert.equal(S.safetyLoad(result(sock), 'medium').load, 5);
});
check('user-tagged items are excluded from the Safety load', () => {
  const s = S.scoreSuitability(collie, household(), result([hz({ source: 'user_tag', hazard_type: 'fragile_valuable', severity: 'high' })]));
  assert.equal(s.safety.load, 0);
  assert.equal(s.bands.safety, 'good');
});
check('escape routes always count, without double-counting their hazards entry', () => {
  const route = { object_key: 'balcony-door', type: 'balcony', detail: 'Balcony door', frame_index: 0, x: 0.5, y: 0.5, severity: 'medium', confidence: 'high', small_dog_risk: false };
  const only = S.safetyLoad(result([], { escape_routes: [route] }), 'medium').load;
  const both = S.safetyLoad(result([hz({ object_key: 'balcony-door', hazard_type: 'escape_fall', category: 'G', severity: 'medium' })], { escape_routes: [route] }), 'medium').load;
  assert.equal(only, 6);
  assert.equal(both, 6);
});

console.log('\nHard gates');
check('one high escape/fall finding caps the verdict even with otherwise-good scores', () => {
  const s = S.scoreSuitability(collie, household(), result([hz({ hazard_type: 'escape_fall', category: 'G', severity: 'high' })]));
  assert.ok(s.blend >= S.VERDICT_GOOD_AT, `blend ${s.blend} alone would be good`);
  assert.deepEqual(s.gates, ['escape']);
  assert.equal(s.verdict, 'adequate');
});
check('accessible toxic/chemical with no easy fix caps; with an easy fix it does not', () => {
  const stuck = S.scoreSuitability(collie, household(), result([hz({ hazard_type: 'toxic_ingestible', category: 'C', severity: 'low', easy_fix: false })]));
  const easy = S.scoreSuitability(collie, household(), result([hz({ hazard_type: 'toxic_ingestible', category: 'C', severity: 'low', easy_fix: true })]));
  assert.ok(stuck.gates.includes('toxic'));
  assert.equal(stuck.verdict, 'adequate');
  assert.ok(!easy.gates.includes('toxic'));
});
check('severe energy mismatch (high energy + over 8h alone + no outdoor + sedentary) caps', () => {
  const s = S.scoreSuitability(collie, household({ owner_activity: 'sedentary', hours_alone: 'over_8', outdoor_access: 'none' }), result());
  assert.ok(s.gates.includes('energy'));
  assert.notEqual(s.verdict, 'good');
});

console.log('\nThe answers move the verdict (regression)');
check('changing owner_activity changes the verdict', () => {
  const active = S.scoreSuitability(collie, household({ owner_activity: 'active' }), result());
  const sedentary = S.scoreSuitability(collie, household({ owner_activity: 'sedentary' }), result());
  assert.equal(active.verdict, 'good');
  assert.notEqual(sedentary.verdict, active.verdict);
});
check('changing hours_alone changes the verdict', () => {
  const home = S.scoreSuitability(collie, household({ owner_activity: 'moderate', hours_alone: 'under_4' }), result());
  const away = S.scoreSuitability(collie, household({ owner_activity: 'moderate', hours_alone: 'over_8' }), result());
  assert.equal(home.verdict, 'good');
  assert.notEqual(away.verdict, home.verdict);
});
check('a walker or daycare softens long hours alone', () => {
  const none = S.energyFit('high', household({ owner_activity: 'moderate', hours_alone: 'over_8', alone_plan: 'none' }));
  const walker = S.energyFit('high', household({ owner_activity: 'moderate', hours_alone: 'over_8', alone_plan: 'walker' }));
  assert.ok(walker.provision.worst > none.provision.worst);
});
check('young children move the verdict (big/bouncy dog, no retreat spot)', () => {
  const r = result([], { room_assessment: room({ retreat_spot: 'absent' }) });
  const none = S.scoreSuitability(collie, household({ children_at_home: 'none' }), r);
  const young = S.scoreSuitability(collie, household({ children_at_home: 'young' }), r);
  assert.equal(young.bands.household, 'poor');
  assert.notEqual(young.verdict, none.verdict);
});
check('a gentle large dog with young children is only a mild concern at most', () => {
  const s = S.scoreSuitability(lab, household({ children_at_home: 'young' }), result());
  assert.equal(s.bands.household, 'good');
});
check('unanswered routine questions: energy is "adequate" (not guessed) and the user is nudged', () => {
  const s = S.scoreSuitability(collie, household({ owner_activity: undefined, exercise_time: undefined, hours_alone: undefined }), result());
  assert.equal(s.bands.energy, 'adequate');
  assert.ok(s.nudges.some((n) => n.id === 'answer_more'));
});
check('decisive answers still decide when one is unanswered', () => {
  const e = S.energyFit('high', household({ owner_activity: 'sedentary', hours_alone: 'over_8', exercise_time: undefined, outdoor_access: 'none' }));
  assert.equal(e.band, 'poor');
});

console.log('\nCalibration');
check('a typical room with a few fixable things stays "adequate" Safety, even for a large dog', () => {
  const r = result([
    hz({ object_key: 'cord', severity: 'low' }),
    hz({ object_key: 'plant', category: 'A', hazard_type: 'toxic_ingestible', severity: 'medium', confidence: 'medium' }),
    hz({ object_key: 'balcony-door', category: 'G', hazard_type: 'escape_fall', severity: 'medium' }),
  ]);
  const s = S.scoreSuitability(lab, household(), r);
  assert.ok(s.safety.load < S.SAFETY_POOR_LOAD, `load ${s.safety.load}`);
  assert.equal(s.bands.safety, 'adequate');
});
check('two high escape routes make Safety "poor"', () => {
  const r = result([
    hz({ object_key: 'balcony', category: 'G', hazard_type: 'escape_fall', severity: 'high' }),
    hz({ object_key: 'window', category: 'G', hazard_type: 'escape_fall', severity: 'high' }),
  ]);
  assert.equal(S.scoreSuitability(collie, household(), r).bands.safety, 'poor');
});
check('every sub-score "adequate" gives "Good fit with a few changes", not "poor"', () => {
  assert.equal(S.verdictFromBlend(0.5), 'adequate');
});
check('a "poor" sub-score never sits under a "Good fit"', () => {
  const r = result([], { room_assessment: room({ openness: 'cramped' }) });
  const s = S.scoreSuitability(lab, household(), r); // room poor for a large dog, everything else good
  assert.equal(s.bands.room, 'poor');
  assert.ok(s.blend >= S.VERDICT_GOOD_AT, `blend ${s.blend} alone would be good`);
  assert.equal(s.verdict, 'adequate');
});

console.log('\nUnknowns are never reported as good');
check('unanswered routine questions or no room assessment can’t produce "Good fit"', () => {
  const routine = S.scoreSuitability(lab, household({ owner_activity: undefined, exercise_time: undefined, hours_alone: undefined }), result());
  assert.equal(routine.verdict, 'adequate');
  assert.deepEqual(routine.unknown, ['routine']);
  const noRoom = S.scoreSuitability(lab, household(), result([], { room_assessment: undefined }));
  assert.equal(noRoom.verdict, 'adequate');
  assert.deepEqual(noRoom.unknown, ['room']);
  assert.equal(S.scoreSuitability(lab, household(), result()).verdict, 'good'); // same dog, everything known
});
check('sample assessment (photos not checked): Safety is unknown, its findings are ignored, no "Good fit"', () => {
  const r = result([hz({ hazard_type: 'escape_fall', category: 'G', severity: 'high' })]);
  const s = S.scoreSuitability(lab, household(), r, { photosChecked: false });
  assert.equal(s.bands.safety, 'adequate'); // not "good" (we didn't look), not driven by unseen findings
  assert.equal(s.safety.load, 0);
  assert.ok(!s.gates.includes('escape'));
  assert.ok(s.unknown.includes('photos'));
  assert.notEqual(s.verdict, 'good');
});

console.log('\nRoom to move');
check('cramped flags mainly for big or high-energy dogs', () => {
  assert.equal(S.roomFit(room({ openness: 'cramped' }), 'small', 'low'), 'adequate');
  assert.equal(S.roomFit(room({ openness: 'cramped' }), 'large', 'moderate'), 'poor');
  assert.equal(S.roomFit(room({ openness: 'cramped' }), 'medium', 'high'), 'poor'); // high energy = one size up
});
check('a hard-to-get-through path lowers Room for a large dog, not a small one', () => {
  const blocked = room({ openness: 'open', clear_path: 'poor' });
  assert.equal(S.roomFit(blocked, 'large', 'moderate'), 'adequate');
  assert.equal(S.roomFit(blocked, 'small', 'low'), 'good');
  assert.equal(S.roomFit(room({ openness: 'cramped', clear_path: 'poor' }), 'large', 'moderate'), 'poor'); // not counted twice
  assert.equal(S.roomFit(room({ openness: 'open', clear_path: 'partial' }), 'large', 'moderate'), 'good');
});
check('floor area is used only with medium/high confidence', () => {
  const small = (confidence) => room({ openness: 'moderate', floor_area_m2: { value: 8, confidence } });
  assert.equal(S.roomFit(small('low'), 'large', 'moderate'), 'adequate');
  assert.equal(S.roomFit(small('medium'), 'large', 'moderate'), 'poor');
});
check('no room assessment (sample / old results) is "adequate", not a guess', () => {
  assert.equal(S.roomFit(undefined, 'large', 'high'), 'adequate');
});

console.log('\nCross-check (photos vs answers)');
check('a cat seen in the photos fills an unanswered "other pets" and nudges', () => {
  const r = result([], { detected_signals: { existing_pets: 'cat', children: 'no', dwelling_cue: 'unknown', outdoor_access_cue: 'unknown' } });
  const q = household({ has_other_pets: undefined, other_pets: undefined });
  assert.deepEqual(S.otherPets(q, r), ['cat']);
  assert.ok(S.scoreSuitability(frenchie, q, r).nudges.some((n) => n.id === 'cat'));
});
check("the user's answer wins over the photos (nudge only, no override)", () => {
  const r = result([], { detected_signals: { existing_pets: 'cat', children: 'yes', dwelling_cue: 'apartment', outdoor_access_cue: 'unknown' } });
  const q = household({ has_other_pets: false, other_pets: [] });
  assert.deepEqual(S.otherPets(q, r), []);
  const ids = S.scoreSuitability(frenchie, q, r).nudges.map((n) => n.id);
  assert.ok(ids.includes('cat') && ids.includes('children') && ids.includes('dwelling'));
});

console.log('\nOther pets');
{
  const beagle = { name: 'Beagle', size: 'medium', energy: 'moderate', noise: 'vocal', group: 'Hound', temperament: 'Amiable, Even Tempered, Determined' };
  check('a chase-prone breed with a cat, bird or small animal is a household concern naming them', () => {
    const s = S.scoreSuitability(beagle, household({ has_other_pets: true, other_pets: ['bird', 'small_animal', 'fish'] }), result());
    const c = s.household.concerns.find((x) => x.id === 'pet_chase');
    assert.ok(c, 'pet_chase concern');
    assert.deepEqual(c.pets, ['bird', 'small_animal']); // fish live in a tank: not a chase concern
    assert.equal(s.bands.household, 'adequate');
  });
  check('fish or reptiles only, or a breed without a chase drive: no chase concern', () => {
    assert.equal(S.scoreSuitability(beagle, household({ has_other_pets: true, other_pets: ['fish', 'reptile'] }), result()).bands.household, 'good');
    assert.equal(S.scoreSuitability(lab, household({ has_other_pets: true, other_pets: ['cat'] }), result()).bands.household, 'good');
  });
  check('saved "Do you have a cat?" answers convert to the new question', () => {
    const base = household({ has_other_pets: undefined, other_pets: undefined });
    const yes = migrateHousehold({ ...base, has_cat: true });
    assert.deepEqual([yes.has_other_pets, yes.other_pets, 'has_cat' in yes], [true, ['cat'], false]);
    const no = migrateHousehold({ ...base, has_cat: false });
    assert.deepEqual([no.has_other_pets, no.other_pets], [false, []]);
    const never = migrateHousehold(base);
    assert.equal(never.has_other_pets, undefined); // still unanswered
  });
  check('"No other pets" means none, even if the old cat answer is gone', () => {
    assert.deepEqual(S.otherPets(household({ has_other_pets: false, other_pets: [] }), result()), []);
    assert.deepEqual(S.otherPets(household({ has_other_pets: true, other_pets: ['cat', 'reptile'] }), result()), ['cat', 'reptile']);
  });
}

console.log('\nNormaliser');
check('the same object across overlapping frames is counted once (dedup)', () => {
  const a = normaliseAssessment(
    { hazards: [hz({ object_key: 'TV cord', location: { frame_index: 0, x: 0.2, y: 0.8 } }), hz({ object_key: 'tv-cord', severity: 'medium', location: { frame_index: 2, x: 0.7, y: 0.8 } })] },
    space()
  );
  const cords = a.hazards.filter((h) => h.object_key === 'tv-cord');
  assert.equal(cords.length, 1);
  assert.equal(cords[0].severity, 'medium'); // keeps the stronger report
});
check('a tagged vase → source user_tag, pinned at the tag’s x,y, excluded from Safety', () => {
  const tags = [{ id: 't1', label: 'Vase', note: 'Fragile', frame: 1, x: 0.3, y: 0.6 }];
  const a = normaliseAssessment(
    { hazards: [hz({ object_key: 'vase', title: 'Vase', source: 'user_tag', tag_id: 't1', hazard_type: 'fragile_valuable', category: 'D', risk_to: 'animal', location: { frame_index: 0, x: 0.9, y: 0.1 } })] },
    space(tags)
  );
  const v = a.hazards.find((h) => h.tag_id === 't1');
  assert.equal(v.source, 'user_tag');
  assert.equal(v.risk_to, 'home');
  assert.deepEqual([v.location.frame_index, v.location.x, v.location.y], [1, 0.3, 0.6]);
  assert.equal(S.safetyLoad(a, 'medium').load, 0);
});
check('a tag the model left out still appears once, and a photo report of the tagged item is folded in', () => {
  const tags = [{ id: 't1', label: 'Vase', note: 'Valuable', frame: 0, x: 0.4, y: 0.4 }];
  const a = normaliseAssessment(
    { hazards: [hz({ object_key: 'glass-vase', title: 'Glass vase', hazard_type: 'fragile_valuable', category: 'D', location: { frame_index: 0, x: 0.45, y: 0.42 } })] },
    space(tags)
  );
  assert.equal(a.hazards.length, 1);
  assert.equal(a.hazards[0].source, 'user_tag');
});
check('every finding carries object_key, confidence and (if scope object) a location', () => {
  const a = normaliseAssessment(
    { hazards: [{ category: 'B', title: 'Charger cable', scope: 'object', severity: 'low' }, { category: 'K', title: 'Busy road outside', scope: 'space', severity: 'low' }] },
    space()
  );
  for (const h of a.hazards) {
    assert.ok(h.object_key && h.confidence, `${h.title} missing key/confidence`);
    if (h.scope === 'object') assert.ok(h.location);
  }
  assert.equal(a.hazards[0].confidence, 'low'); // no location given → low
});
check('escape/fall findings are forced to pinnable objects (W7)', () => {
  const a = normaliseAssessment({ hazards: [hz({ hazard_type: 'escape_fall', category: 'G', scope: 'space', location: null, severity: 'high' })] }, space());
  assert.equal(a.hazards[0].scope, 'object');
  assert.ok(a.hazards[0].location);
  assert.equal(a.hazards[0].confidence, 'low');
});
check('unknown values are dropped or defaulted, never silently mapped to "I"', () => {
  const a = normaliseAssessment(
    { hazards: [hz({ category: 'Z' })], room_assessment: { openness: 'huge' }, escape_routes: [{ type: 'trapdoor' }], detected_signals: { existing_pets: 'parrot' } },
    space()
  );
  assert.equal(a.hazards.length, 0);
  assert.equal(a.room_assessment.openness, 'moderate');
  assert.equal(a.room_assessment.retreat_spot, 'possible');
  assert.equal(a.room_assessment.floor_area_m2.value, null);
  assert.equal(a.escape_routes.length, 0);
  assert.equal(a.detected_signals.existing_pets, 'unknown');
  assert.equal(a.confidence, 'low');
  assert.equal(a.suitability, null);
});

console.log('\nSuggested setup');
check('keep-out areas, dog spots and safety additions are kept with their spot on the photo', () => {
  const a = normaliseAssessment(
    {
      off_limit_suggestions: [{ zone: 'kitchen', reason: 'Food and bins are within reach.', frame_index: 1, x: 0.2, y: 0.7 }],
      dog_spots: [{ purpose: 'bed', reason: 'Quiet corner away from the door.', frame_index: 2, x: 1.4, y: 0.8 }],
      safety_additions: [{ type: 'railing', detail: 'Clear panels along the balcony railing.', reason: 'The gaps are wide enough to slip through.', frame_index: 0, x: 0.6, y: 0.5 }],
    },
    space()
  );
  assert.deepEqual([a.off_limit_suggestions[0].frame_index, a.off_limit_suggestions[0].x], [1, 0.2]);
  assert.equal(a.dog_spots[0].x, 1); // clamped to the photo
  assert.equal(a.safety_additions[0].type, 'railing');
});
check('suggestions without a position are kept (listed, not pinned); unknown kinds and empty reasons are dropped', () => {
  const a = normaliseAssessment(
    {
      dog_spots: [{ purpose: 'bed', reason: 'Somewhere quiet.' }, { purpose: 'sofa', reason: 'x' }, { purpose: 'crate', reason: '  ' }],
      safety_additions: [{ type: 'moat', reason: 'x' }, { type: 'gate', detail: '', reason: 'Keeps the dog out of the kitchen.' }],
      off_limit_suggestions: [{ zone: 'garage', reason: 'x' }],
    },
    space()
  );
  assert.equal(a.dog_spots.length, 1);
  assert.equal(a.dog_spots[0].x, undefined);
  assert.equal(a.safety_additions.length, 1);
  assert.equal(a.off_limit_suggestions.length, 0);
});
check('at most 3 keep-out areas, 3 dog spots and 5 safety additions', () => {
  const many = (n, make) => Array.from({ length: n }, (_, i) => make(i));
  const a = normaliseAssessment(
    {
      off_limit_suggestions: many(6, () => ({ zone: 'other', reason: 'r' })),
      dog_spots: many(6, () => ({ purpose: 'play', reason: 'r' })),
      safety_additions: many(9, () => ({ type: 'gate', reason: 'r' })),
    },
    space()
  );
  assert.deepEqual([a.off_limit_suggestions.length, a.dog_spots.length, a.safety_additions.length], [3, 3, 5]);
});
check('suggestions never change the verdict', () => {
  const plain = S.scoreSuitability(lab, household(), result());
  const withSetup = S.scoreSuitability(lab, household(), result([], {
    dog_spots: [{ purpose: 'bed', reason: 'r', frame_index: 0 }],
    safety_additions: [{ type: 'gate', detail: '', reason: 'r', frame_index: 0 }],
  }));
  assert.equal(withSetup.blend, plain.blend);
  assert.equal(withSetup.verdict, plain.verdict);
});

console.log("\nWhat's new after a Re-run");
{
  const before = {
    verdict: 'Good fit with a few changes',
    rows: [{ heading: 'Safety', label: 'Move 2 things' }, { heading: 'Neighbours', label: 'No problem' }],
    flagged: [
      { key: 'tv-cord', title: 'Cord behind the TV', level: 'Minor' },
      { key: 'pothos', title: 'Pothos on low shelf', level: 'Worth fixing' },
      { key: 'tag:vase', title: 'Vase', level: 'Be careful' },
    ],
    setup: [{ key: 'dog_spot:dog bed', title: 'Dog bed' }],
  };
  check('reports verdict, row, added, removed, changed and setup differences', () => {
    const after = {
      verdict: 'Not a good fit yet',
      rows: [{ heading: 'Safety', label: 'Not safe yet' }, { heading: 'Neighbours', label: 'No problem' }],
      flagged: [
        { key: 'tv-cord', title: 'Cord behind the TV', level: 'Worth fixing' },
        { key: 'tag:vase', title: 'Vase', level: 'Be careful' },
        { key: 'balcony-door', title: 'Open balcony door', level: 'Needs attention' },
      ],
      setup: [{ key: 'dog_spot:dog bed', title: 'Dog bed' }, { key: 'add:add a railing', title: 'Add a railing' }],
    };
    const c = diffRuns(before, after, '2026-10-15T03:00:00Z');
    assert.deepEqual(c.verdict, { from: 'Good fit with a few changes', to: 'Not a good fit yet' });
    assert.deepEqual(c.rows, [{ heading: 'Safety', from: 'Move 2 things', to: 'Not safe yet' }]);
    assert.deepEqual(c.added, ['Open balcony door']);
    assert.deepEqual(c.removed, ['Pothos on low shelf']);
    assert.deepEqual(c.changed, [{ title: 'Cord behind the TV', from: 'Minor', to: 'Worth fixing' }]);
    assert.deepEqual(c.setupAdded, ['Add a railing']);
    assert.deepEqual(c.setupRemoved, []);
    assert.ok(hasChanges(c));
  });
  check('the same object with a reworded title is not reported as removed + added', () => {
    const after = { ...before, flagged: before.flagged.map((f) => (f.key === 'tv-cord' ? { ...f, title: 'TV power cable' } : f)) };
    const c = diffRuns(before, after, 'x');
    assert.deepEqual([c.added, c.removed, c.changed], [[], [], []]);
  });
  check('an identical run reports no changes', () => {
    assert.equal(hasChanges(diffRuns(before, structuredClone(before), 'x')), false);
  });
}

console.log('\nPrompt and schema');
check('room prompt has no cat-assessment content and asks for no score or verdict', () => {
  for (const bad of [/for cats/i, /vertical territory/i, /CRITICAL/, /recommended_pets/, /score_0_100/, /"suitability"/, /explore/i]) {
    assert.ok(!bad.test(SYSTEM_PROMPT), `prompt contains ${bad}`);
  }
  assert.match(SYSTEM_PROMPT, /for DOGS/);
});
check('response schema: no score/verdict fields; every finding requires object_key, confidence, location', () => {
  const json = JSON.stringify(ROOM_RESPONSE_SCHEMA);
  for (const bad of ['score_0_100', 'suitability', 'recommended_pets']) assert.ok(!json.includes(bad), bad);
  const item = ROOM_RESPONSE_SCHEMA.properties.hazards.items;
  for (const k of ['object_key', 'confidence', 'location', 'source', 'hazard_type']) assert.ok(item.required.includes(k), k);
  for (const k of ['off_limit_suggestions', 'dog_spots', 'safety_additions']) {
    const req = ROOM_RESPONSE_SCHEMA.properties[k].items.required;
    assert.ok(req.includes('x') && req.includes('y') && req.includes('reason'), `${k} needs x, y, reason`);
  }
});

console.log('\nGemini request (fake API, no network)');
{
  const name = 'if the API rejects the schema (HTTP 400), the room call retries once without it';
  const realFetch = globalThis.fetch;
  const sent = [];
  globalThis.fetch = async (_url, init) => {
    const body = JSON.parse(init.body);
    sent.push(!!body.generationConfig.responseSchema);
    if (body.generationConfig.responseSchema) return new Response('{"error":{"code":400}}', { status: 400 });
    const reply = { hazards: [hz({ object_key: 'cord' })], room_assessment: room(), improvements: ['Tidy the cord.'] };
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(reply) }] } }] }), { status: 200 });
  };
  try {
    const session = { ...space([], 1), capture: { frames: [{ uri: '', base64: 'AAAA', mime: 'image/jpeg' }] }, pet: null, mode: 'pet_in_mind', questionnaire: household() };
    const a = await callGemini(session, null, new AbortController().signal);
    assert.deepEqual(sent, [true, false]);
    assert.equal(a.hazards[0].object_key, 'cord');
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    failures.push(name);
    console.log(`  ✗ ${name}\n      ${String(e.message).split('\n')[0]}`);
  } finally {
    globalThis.fetch = realFetch;
  }
}

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) process.exit(1);
