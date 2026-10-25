// Runs the demo scenarios (demo/scenarios.json) through the app's REAL breed
// logic and AI prompt, outside the app. Run with:  node scripts/demo-scenarios.mjs
//
// For each household it does what "Explore breeds for my space" does on the
// phone: rank the whole breed catalogue with the rules (suitability.ts), send
// the top 30 to Gemini with the household answers, and keep its picks. If a
// demo photo exists (demo/images/<id>.jpg|png), it also runs the room check for
// the top pick, like tapping that breed in the app.
//
// Uses .env.local (Gemini key, API Ninjas key). One breed request per scenario,
// plus one room request per scenario that has a photo. Results go to demo/results/.

import ts from 'typescript';
import Module, { createRequire } from 'node:module';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

// ---- 1. Keys from .env.local (same names the app uses) ----
for (const line of readFileSync(join(root, '.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^\s*(EXPO_PUBLIC_[A-Z_]+)\s*=\s*"?([^"\r]*)"?\s*$/);
  if (m) process.env[m[1]] = m[2];
}

// ---- 2. Transpile the app's logic + AI files into a temp folder ----
const out = mkdtempSync(join(tmpdir(), 'pawspace-demo-'));
const files = ['src/types.ts', ...['src/ai', 'src/logic'].flatMap((d) => readdirSync(join(root, d)).filter((f) => f.endsWith('.ts')).map((f) => `${d}/${f}`))];
for (const file of files) {
  let { outputText } = ts.transpileModule(readFileSync(join(root, file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  });
  // The catalogue loader is private to breeds.ts; expose it for this script only.
  if (file === 'src/logic/breeds.ts') {
    outputText += '\nexports.__load = loadCatalogueBreeds; exports.__merge = merge; exports.__set = (c) => { catalogue = c; };\n';
  }
  const dest = join(out, file.replace(/\.ts$/, '.js'));
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, outputText);
}

// Phone-only pieces get small stand-ins: images, device storage, React Native.
const cacheFile = join(root, 'demo/.cache.json');
const store = existsSync(cacheFile) ? JSON.parse(readFileSync(cacheFile, 'utf8')) : {};
const stubs = {
  '../assets': { IMAGES: new Proxy({}, { get: () => 0 }) },
  'react-native': {},
  '@react-native-async-storage/async-storage': {
    __esModule: true,
    default: {
      getItem: async (k) => store[k] ?? null,
      setItem: async (k, v) => {
        store[k] = v;
        writeFileSync(cacheFile, JSON.stringify(store));
      },
      removeItem: async (k) => delete store[k],
    },
  },
};
// The temp folder has no node_modules, so send 'react' to the project's copy.
const reactPath = createRequire(join(root, 'package.json')).resolve('react');
const origLoad = Module._load;
Module._load = function (request, ...rest) {
  if (request in stubs) return stubs[request];
  return origLoad.call(this, request === 'react' ? reactPath : request, ...rest);
};
globalThis.__DEV__ = false;

const require = createRequire(import.meta.url);
const breeds = require(join(out, 'src/logic/breeds.js'));
const { suggestBreeds } = require(join(out, 'src/ai/breedSuggest.js'));
const { runAssessment } = require(join(out, 'src/ai/assess.js'));
const { evaluate, rankBreeds } = require(join(out, 'src/logic/evaluate.js'));

// ---- 3. Scenarios ----
const scenarios = JSON.parse(readFileSync(join(root, 'demo/scenarios.json'), 'utf8'));
const shortlistOnly = process.argv.includes('--shortlist'); // rules only, no AI calls
const only = process.argv.slice(2).find((a) => !a.startsWith('--')); // optional: one scenario id
const base = {
  floor_level: null, adults: 1, children: 0, children_ages: '', infant_present: false,
  off_limit_zones: [], activity_level: 'medium', wants_apartment_friendly: false,
};

const api = await breeds.__load();
const catalogue = api.length ? breeds.__merge(api) : breeds.BREEDS;
breeds.__set(catalogue);
console.log(`Catalogue: ${catalogue.length} breeds (${api.length ? api[0].provider ?? 'API' : 'built-ins only'})\n`);

mkdirSync(join(root, 'demo/results'), { recursive: true });

function photoFor(id) {
  for (const ext of ['jpg', 'jpeg', 'png']) {
    const p = join(root, 'demo/images', `${id}.${ext}`);
    if (existsSync(p)) return { uri: `file://${p}`, base64: readFileSync(p).toString('base64'), mime: ext === 'png' ? 'image/png' : 'image/jpeg' };
  }
  return null;
}

for (const sc of scenarios.filter((s) => !only || s.id === only)) {
  const q = { ...base, ...sc.household };
  const frame = photoFor(sc.id);
  const space = {
    id: `demo-${sc.id}`, name: sc.title, created_at: new Date().toISOString(),
    capture: { frames: frame ? [frame] : [], panorama: null },
    mode: 'pet_in_mind', pet: null, questionnaire: q, tags: [], result: null,
  };

  console.log(`=== ${sc.title} (aim: ${sc.aim})`);
  if (shortlistOnly) {
    // The 30 breeds the rules hand to the AI (shedding 1-5, 5 = most; null = unknown).
    rankBreeds(space, q, catalogue).slice(0, 30).forEach(({ breed: b, evaluation: e }, i) =>
      console.log(`  ${String(i + 1).padStart(2)}. ${b.name} [${b.size}, ${b.energy}, ${b.noise}, shedding ${b.shedding ?? '?'}] ${e.verdict}`)
    );
    console.log('');
    continue;
  }
  const res = await suggestBreeds(space, q, catalogue);
  console.log(`Source: ${res.source === 'ai' ? 'Gemini' : 'rules only'}${res.note ? ` (${res.note})` : ''}`);
  for (const s of res.suggestions) {
    console.log(`  ${s.breed.name} [${s.breed.size}, ${s.breed.energy} energy, ${s.breed.noise}] ${s.fit}`);
    console.log(`     ${s.reason}  Watch out: ${s.watchOut}`);
  }
  const record = {
    scenario: sc,
    source: res.source,
    note: res.note ?? null,
    suggestions: res.suggestions.map((s) => ({ name: s.breed.name, size: s.breed.size, energy: s.breed.energy, noise: s.breed.noise, fit: s.fit, reason: s.reason, watch_out: s.watchOut })),
  };

  // Room check for the top pick, if there's a demo photo (like picking it in the app).
  const top = res.suggestions[0]?.breed;
  if (frame && top) {
    space.pet = { species: 'Dog', breed: top.name, size: top.size, energy: top.energy, noise: top.noise };
    const a = await runAssessment(space);
    space.result = a.assessment;
    space.resultSource = a.source;
    const e = evaluate(space, q);
    console.log(`  Room check with ${top.name}: ${a.source === 'ai' ? 'Gemini' : `sample (${a.fallbackReason})`} → ${e.verdictTitle}`);
    record.room_check = {
      breed: top.name, source: a.source, fallback: a.fallbackReason ?? null,
      verdict: e.verdictTitle, line: e.verdictLine, bands: e.bands, labels: e.labels,
      photo_check: a.assessment.photo_check ?? null,
      summary: a.assessment.space_summary,
      hazards: a.assessment.hazards.map((h) => `${h.title} (${h.severity})`),
      what_to_change: e.changes,
    };
  }
  writeFileSync(join(root, 'demo/results', `${sc.id}.json`), JSON.stringify(record, null, 2));
  console.log('');
}
