// Re-run progress pieces (Results guide step 4; Figma "03 · Re-run progress"):
// the "Made some changes?" sheet (R2), the Since last time card (R5), and the
// helpers that read a re-run's changes as progress.

import React from 'react';
import { View, Text, StyleSheet, Pressable, Modal } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PackIcon } from '../icons';
import type { PackIconName } from '../packIcons';
import { colors, fonts } from '../../theme';
import { REPORT_ROWS } from '../../logic/evaluate';
import type { RunChanges } from '../../logic/changes';
import { resultStyles as R } from './todo';

// ---- reading the changes ----

// How good each need's chip word is (higher = better). Saved runs keep the words
// they showed, so older wording is listed too. Unknown words can't be compared.
const ROW_RANK: Record<string, number> = {
  'All good': 2, 'Well matched': 2, 'Plenty of room': 2, 'Fits right in': 2, Safe: 2, 'Suits your home': 2, 'No problem': 2,
  'A little work': 1, 'Needs a plan': 1, 'Enough room': 1, 'A little care': 1, 'Some barking': 1, 'Mostly safe': 1, 'Some care needed': 1,
  'A few fixes first': 0, 'Needs a bigger plan': 0, 'A bit snug': 0, 'Not safe yet': 0, 'Hard to keep up': 0, 'Too tight': 0, 'Tricky fit': 0, 'Likely issue': 0,
};
const rank = (heading: string, label: string): number | null => {
  if (/^Move \d+ thing/.test(label)) return 1;
  // "Needs a plan" is the middle state for Exercise but the lowest for the others.
  if (label === 'Needs a plan' && !/Exercise/.test(heading)) return 0;
  return label in ROW_RANK ? ROW_RANK[label] : null;
};
const VERDICT_RANK: Record<string, number> = {
  "I'd love it here!": 3, 'I love it here!': 3, 'Good fit': 3,
  'Almost ready for me!': 2, 'A few tweaks for me?': 2, 'Good fit with a few changes': 2,
  'Help me see a bit more': 1.5, 'Could be a good fit': 1.5,
  "Let's get it ready together": 1, "Let's make our home even better": 1, 'Not a good fit yet': 1,
};
const VERDICT_WORDS: Record<number, string> = { 3: 'ready', 2: 'nearly ready', 1.5: 'still checking', 1: 'not quite ready yet' };

export function readChanges(c: RunChanges) {
  const better = c.rows.filter((r) => (rank(r.heading, r.to) ?? -1) > (rank(r.heading, r.from) ?? 99));
  const look = c.rows.filter((r) => (rank(r.heading, r.to) ?? 99) < (rank(r.heading, r.from) ?? -1));
  const vFrom = c.verdict ? VERDICT_RANK[c.verdict.from] : undefined;
  const vTo = c.verdict ? VERDICT_RANK[c.verdict.to] : undefined;
  const verdictMove = vFrom != null && vTo != null ? Math.sign(vTo - vFrom) : 0;
  const safetyBetter = better.some((r) => /Safe/.test(r.heading));
  const title =
    verdictMove > 0
      ? 'I love the changes!'
      : safetyBetter
        ? 'You made it safer for me!'
        : c.removed.length
          ? 'That’s better already!'
          : (c.setupAdded.length || c.setupRemoved.length) && !c.added.length && !c.rows.length
            ? 'Ooh, new ideas for me!'
            : 'Let’s take another look together';
  return { better, look, verdictMove, verdictTo: vTo, title };
}

export function verdictWords(rank?: number): string | null {
  return rank != null ? VERDICT_WORDS[rank] ?? null : null;
}

// One line for the Since last time card: "3 sorted · 1 new · Staying safe is all good now".
export function sinceLine(c: RunChanges): string {
  const { better } = readChanges(c);
  const parts: string[] = [];
  if (c.removed.length) parts.push(`${c.removed.length} sorted`);
  if (c.added.length) parts.push(`${c.added.length} new`);
  const best = better[0];
  if (best) parts.push(`${best.heading} is ${best.to.charAt(0).toLowerCase()}${best.to.slice(1)} now`);
  return parts.join(' · ') || 'A few things changed';
}

export const HEADINGS = REPORT_ROWS.map((r) => r.heading);

// ---- R5 · Since last time card ----

export function SinceCard({ changes, onSee }: { changes: RunChanges; onSee: () => void }) {
  return (
    <View style={styles.since}>
      <Text style={[styles.label, { color: colors.stateGood }]}>SINCE LAST TIME</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Text style={[styles.sinceTxt, { flex: 1 }]}>{sinceLine(changes)}</Text>
        <Pressable onPress={onSee} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={styles.sinceLink}>See what changed</Text>
          <PackIcon name="chevron-right" size={14} color={colors.stateGood} />
        </Pressable>
      </View>
    </View>
  );
}

// ---- R2 · Made some changes? ----

function Option({ icon, title, body, primary, onPress }: { icon: PackIconName; title: string; body: string; primary?: boolean; onPress: () => void }) {
  return (
    <Pressable style={[styles.option, primary ? { backgroundColor: colors.peach } : styles.optionWhite]} onPress={onPress}>
      <View style={[styles.optionIcon, { backgroundColor: primary ? colors.orange : colors.track }]}>
        <PackIcon name={icon} size={20} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={R.btnTxt}>{title}</Text>
        <Text style={R.small}>{body}</Text>
      </View>
      <PackIcon name="chevron-right" size={20} color={colors.textFaint} />
    </Pressable>
  );
}

export function RecheckSheet({
  visible,
  canReuse,
  onRetake,
  onReuse,
  onClose,
}: {
  visible: boolean;
  canReuse: boolean; // the photos are still available to check again
  onRetake: () => void;
  onReuse: () => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.dim} onPress={onClose} />
      <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]}>
        <Text style={R.title}>Made some changes?</Text>
        <Text style={R.body}>Check the room again and I’ll show you what got better. Your last result is saved so we can compare.</Text>
        <Option icon="camera-01" primary title="Retake my photos" body="Best after moving things, tidying or adding a gate." onPress={onRetake} />
        {canReuse && (
          <Option icon="refresh-cw-01" title="Re-check with my latest answers" body="Uses the same photos. Best after editing your profile or tags." onPress={onReuse} />
        )}
        <Pressable style={[R.btnSecondary, { marginTop: 4 }]} onPress={onClose}>
          <Text style={R.btnTxt}>Not now</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

// The Re-check pill for the header (refresh icon + "Re-check").
export function RecheckPill({ onPress }: { onPress: () => void }) {
  return (
    <Pressable style={styles.pill} onPress={onPress} accessibilityLabel="Re-check the room">
      <PackIcon name="refresh-cw-01" size={16} />
      <Text style={styles.pillTxt}>Re-check</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  label: { fontFamily: fonts.semibold, fontSize: 11, lineHeight: 14, letterSpacing: 0.9 },
  since: { backgroundColor: colors.stateGoodTint, borderRadius: 18, padding: 16, gap: 6 },
  sinceTxt: { fontFamily: fonts.medium, fontSize: 15, lineHeight: 21, color: colors.text },
  sinceLink: { fontFamily: fonts.medium, fontSize: 12, lineHeight: 16, color: colors.stateGood },
  dim: { flex: 1, backgroundColor: 'rgba(36,30,24,0.45)' },
  sheet: { backgroundColor: colors.cream, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, gap: 14 },
  option: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 18, padding: 16 },
  optionWhite: { backgroundColor: '#fff', borderWidth: 1, borderColor: 'rgba(36,30,24,0.10)' },
  optionIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#fff', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: 'rgba(36,30,24,0.12)' },
  pillTxt: { fontFamily: fonts.medium, fontSize: 12, lineHeight: 16, color: colors.text },
});
