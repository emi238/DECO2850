// R4 / R4b · What changed (Results guide step 4). Shown straight after a re-check:
// what got better as a short celebration, then on to the updated results. Uses the
// saved RunChanges (src/logic/changes.ts); no logic changes.

import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PackIcon } from '../components/icons';
import { useResults, TodoRow, resultStyles as R } from '../components/results/todo';
import { TONE } from '../components/results/Overview';
import { readChanges, verdictWords } from '../components/results/Recheck';
import { hasChanges } from '../logic/changes';
import { todoCount } from '../logic/recommend';
import { colors, fonts } from '../theme';
import type { ScreenProps } from '../navigation';

const plural = (n: number, one: string) => (n === 1 ? `1 ${one}` : `${n} ${one}s`);

export default function WhatChangedScreen({ navigation }: ScreenProps<'WhatChanged'>) {
  const { space, evaluation: e, items } = useResults();
  const insets = useSafeAreaInsets();
  if (!space || !e) return null;
  const c = space.lastChanges;
  const changed = !!c && hasChanges(c);
  const frames = space.capture.frames;
  const read = c ? readChanges(c) : null;

  const tone = changed ? TONE.good : TONE[e.verdictTone];
  const title = changed ? read!.title : 'Nothing’s changed yet';
  const now = verdictWords(read?.verdictTo) ?? e.verdictLabel.toLowerCase();
  const fewer = c ? c.removed.length - c.added.length : 0;
  const lead = !changed
    ? 'Your room looks the same as last time, and that’s okay!'
    : read!.verdictMove > 0
      ? `Now ${now}!${fewer > 0 ? ` ${plural(fewer, 'fewer thing')} to sort.` : ''}`
      : read!.verdictMove < 0
        ? 'A few new things came up. Let’s sort them together.'
        : fewer > 0
          ? `Still ${now}, with ${plural(fewer, 'fewer thing')} to sort. Nice work!`
          : `Still ${now}. Here’s what’s different.`;
  const newItems = c ? items.filter((i) => c.added.includes(i.title)) : [];
  const still = items.filter((i) => !c?.added.includes(i.title) && (i.group === 'do_first' || i.group === 'worth_doing' || i.group === 'nice_extra'));
  const toResults = () => navigation.goBack();
  const toList = () => navigation.replace('Todo');

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 16) + 16 }}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        {frames[0] && <Image source={{ uri: frames[0].uri }} style={StyleSheet.absoluteFill} resizeMode="cover" />}
        <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.72)' }]} />
        <Pressable onPress={toResults} hitSlop={12} style={styles.backRow}>
          <PackIcon name="arrow-left" size={22} color="#fff" />
          <Text style={styles.headerTxt} numberOfLines={1}>
            {space.label || space.name} · re-checked just now
          </Text>
        </Pressable>
        <View style={[styles.bubble, { backgroundColor: tone.tint }]}>
          <View style={[styles.labelPill, { backgroundColor: tone.fg }]}>
            <Text style={[styles.label, { color: tone.tint }]}>SINCE LAST TIME</Text>
          </View>
          <Text style={R.title}>{title}</Text>
        </View>
        <Image source={e.dog.happy} style={e.dog.cutout ? styles.dog : styles.dogPhoto} resizeMode={e.dog.cutout ? 'contain' : 'cover'} />
      </View>

      <View style={styles.sheet}>
        <Text style={[styles.lead, { paddingRight: 110 }]}>{lead}</Text>

        {!changed && (
          <>
            <Text style={R.body}>Move a few things from your list, then retake your photos to see your progress. Small changes count.</Text>
            <View style={styles.card}>
              <Text style={R.heading}>Still to do · {todoCount(items)}</Text>
              {still.slice(0, 3).map((i) => (
                <Text key={i.id} style={R.small}>• {i.title}</Text>
              ))}
              {still.length > 3 && <Text style={styles.faint}>and {still.length - 3} more</Text>}
            </View>
            <Pressable style={R.btnPrimary} onPress={toList}>
              <Text style={R.btnTxt}>Open my to-do list</Text>
            </Pressable>
            <Pressable style={R.btnSecondary} onPress={toResults}>
              <Text style={R.btnTxt}>Back to my results</Text>
            </Pressable>
          </>
        )}

        {changed && (
          <>
            {c!.removed.length > 0 && (
              <View style={styles.card}>
                <Text style={R.heading}>
                  Sorted 🎉 <Text style={styles.faint}> {c!.removed.length}</Text>
                </Text>
                {c!.removed.slice(0, 5).map((t) => (
                  <View key={t} style={styles.sortedRow}>
                    <View style={styles.tick}>
                      <PackIcon name="check" size={16} color={colors.stateGood} />
                    </View>
                    <Text style={[R.btnTxt, { flex: 1 }]}>{t}</Text>
                  </View>
                ))}
                {c!.removed.length > 5 && <Text style={styles.faint}>and {c!.removed.length - 5} more</Text>}
              </View>
            )}

            {read!.better.length > 0 && (
              <View style={styles.card}>
                <Text style={R.heading}>
                  Got better <Text style={styles.faint}> {read!.better.length}</Text>
                </Text>
                {read!.better.map((r) => (
                  <ChipChange key={r.heading} heading={r.heading} from={r.from} to={r.to} toneTo="good" />
                ))}
              </View>
            )}

            {read!.look.length > 0 && (
              <View style={styles.card}>
                <Text style={R.heading}>Needs a look</Text>
                {read!.look.map((r) => (
                  <ChipChange key={r.heading} heading={r.heading} from={r.from} to={r.to} toneTo="work" />
                ))}
              </View>
            )}

            {newItems.length > 0 && (
              <View style={{ gap: 10 }}>
                <Text style={R.heading}>
                  New to sort <Text style={styles.faint}> {newItems.length}</Text>
                </Text>
                {newItems.map((i) => (
                  <TodoRow key={i.id} item={i} frames={frames} onPress={() => navigation.navigate('ItemDetail', { id: i.id })} />
                ))}
              </View>
            )}

            {still.length > 0 && (
              <Text style={R.small}>Still to do from last time: {still.slice(0, 3).map((i) => i.title).join(', ')}{still.length > 3 ? `, and ${still.length - 3} more` : ''}.</Text>
            )}

            <Pressable style={R.btnPrimary} onPress={toResults}>
              <Text style={R.btnTxt}>See my updated results</Text>
            </Pressable>
            <Pressable style={R.btnSecondary} onPress={toList}>
              <Text style={R.btnTxt}>Open my to-do list</Text>
            </Pressable>
          </>
        )}
      </View>
    </ScrollView>
  );
}

function ChipChange({ heading, from, to, toneTo }: { heading: string; from: string; to: string; toneTo: 'good' | 'work' }) {
  return (
    <View style={styles.changeRow}>
      <Text style={[R.btnTxt, { flex: 1 }]}>{heading}</Text>
      <View style={[styles.chip, { backgroundColor: TONE.work.tint }]}>
        <Text style={[styles.chipTxt, { color: TONE.work.fg }]}>{from}</Text>
      </View>
      <PackIcon name="chevron-right" size={14} color={colors.textFaint} />
      <View style={[styles.chip, { backgroundColor: TONE[toneTo].tint }]}>
        <Text style={[styles.chipTxt, { color: TONE[toneTo].fg }]}>{toneTo === 'good' ? '✓  ' : ''}{to}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.cream },
  header: { height: 300, paddingHorizontal: 22, backgroundColor: colors.text },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerTxt: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 18, color: colors.cream, flex: 1 },
  bubble: {
    position: 'absolute', left: 18, bottom: 54, width: 206, paddingTop: 14, paddingHorizontal: 16, paddingBottom: 16,
    borderRadius: 20, borderBottomRightRadius: 4, gap: 8,
  },
  labelPill: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4 },
  label: { fontFamily: fonts.semibold, fontSize: 11, lineHeight: 14, letterSpacing: 0.9 },
  dog: { position: 'absolute', right: 6, bottom: -36, width: 150, height: 182, zIndex: 3 },
  dogPhoto: { position: 'absolute', right: 22, bottom: 8, width: 110, height: 110, borderRadius: 55, borderWidth: 3, borderColor: '#fff', zIndex: 3 },
  sheet: { backgroundColor: colors.cream, borderTopLeftRadius: 28, borderTopRightRadius: 28, marginTop: -28, paddingHorizontal: 24, paddingTop: 24, gap: 14 },
  lead: { fontFamily: fonts.medium, fontSize: 15, lineHeight: 21, color: colors.text },
  card: { backgroundColor: '#fff', borderRadius: 18, borderWidth: 1, borderColor: 'rgba(36,30,24,0.10)', padding: 16, gap: 10 },
  faint: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.textFaint },
  sortedRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  tick: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.stateGoodTint, alignItems: 'center', justifyContent: 'center' },
  changeRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  chip: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 },
  chipTxt: { fontFamily: fonts.medium, fontSize: 12, lineHeight: 16 },
});
