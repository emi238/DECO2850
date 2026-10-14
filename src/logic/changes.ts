// "What's new since your last run": compares two runs of the same space. Pure logic
// (no React Native), checked by scripts/check-logic.mjs.
//
// After every analysis the app saves a RunSnapshot of what the user saw (verdict,
// the five row labels, flagged items, suggested setup). On Re-run, the new snapshot
// is compared with the saved one, so changes caused by edited questionnaire answers
// or tags show up as well as changes in what the AI found.

export interface RunSnapshot {
  verdict: string | null; // verdict title, e.g. "Good fit with a few changes"
  rows: { heading: string; label: string }[]; // e.g. { heading: 'Safety', label: 'Move 2 things' }
  flagged: { key: string; title: string; level: string }[]; // level = the chip word shown on the risk card
  setup: { key: string; title: string }[]; // Suggested setup items
}

export interface RunChanges {
  at: string; // ISO time of the re-run
  verdict?: { from: string; to: string };
  rows: { heading: string; from: string; to: string }[];
  added: string[]; // newly flagged items
  removed: string[]; // no longer flagged
  changed: { title: string; from: string; to: string }[]; // same item, different level
  setupAdded: string[];
  setupRemoved: string[];
}

export function hasChanges(c: RunChanges): boolean {
  return !!(c.verdict || c.rows.length || c.added.length || c.removed.length || c.changed.length || c.setupAdded.length || c.setupRemoved.length);
}

export function diffRuns(before: RunSnapshot, after: RunSnapshot, at: string): RunChanges {
  const was = new Map(before.flagged.map((f) => [f.key, f]));
  const now = new Map(after.flagged.map((f) => [f.key, f]));
  const changed: RunChanges['changed'] = [];
  for (const f of after.flagged) {
    const prev = was.get(f.key);
    if (prev && prev.level !== f.level) changed.push({ title: f.title, from: prev.level, to: f.level });
  }
  const setupWas = new Set(before.setup.map((s) => s.key));
  const setupNow = new Set(after.setup.map((s) => s.key));
  const rowsWas = new Map(before.rows.map((r) => [r.heading, r.label]));
  return {
    at,
    verdict:
      before.verdict && after.verdict && before.verdict !== after.verdict ? { from: before.verdict, to: after.verdict } : undefined,
    rows: after.rows
      .filter((r) => rowsWas.has(r.heading) && rowsWas.get(r.heading) !== r.label)
      .map((r) => ({ heading: r.heading, from: rowsWas.get(r.heading)!, to: r.label })),
    added: after.flagged.filter((f) => !was.has(f.key)).map((f) => f.title),
    removed: before.flagged.filter((f) => !now.has(f.key)).map((f) => f.title),
    changed,
    setupAdded: after.setup.filter((s) => !setupWas.has(s.key)).map((s) => s.title),
    setupRemoved: before.setup.filter((s) => !setupNow.has(s.key)).map((s) => s.title),
  };
}
