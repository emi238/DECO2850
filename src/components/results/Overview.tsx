// Results overview (Results guide step 2, Part A; Figma "01 · Results flow" →
// "Results / Overview"). Dark photo header with the dog and the headline bubble,
// then a cream sheet: verdict line → Start here → How I'd feel here (5 needs) →
// nudges → disclaimer. Wording comes from evaluate.ts (step 1). No scores.

import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PackIcon } from '../icons';
import { PawTile } from '../kit';
import type { PackIconName } from '../packIcons';
import { colors, fonts } from '../../theme';
import { REPORT_ROWS, type Evaluation } from '../../logic/evaluate';
import type { Band, SubScore } from '../../logic/suitability';
import type { Frame } from '../../types';

export type Tone = 'good' | 'work' | 'plan' | 'unknown';
export const TONE: Record<Tone, { fg: string; tint: string }> = {
  good: { fg: colors.stateGood, tint: colors.stateGoodTint },
  work: { fg: colors.stateWork, tint: colors.stateWorkTint },
  plan: { fg: colors.statePlan, tint: colors.statePlanTint },
  unknown: { fg: colors.stateUnknown, tint: colors.stateUnknownTint },
};
const BAND_TONE: Record<Band, Tone> = { good: 'good', adequate: 'work', poor: 'plan' };
const TONE_MARK: Record<Tone, string> = { good: '✓', work: '◐', plan: '○', unknown: '?' };
export const NEED_ICON: Record<SubScore, PackIconName> = {
  safety: 'shield-tick',
  energy: 'activity',
  room: 'maximize-02',
  household: 'home-02',
  noise: 'volume-max',
};

export interface StartHere {
  tone: Tone;
  label: string; // DO FIRST / START HERE / ALL SET / HELP ME SEE
  heading: string;
  body: string;
  primary: { label: string; onPress: () => void };
  secondary?: { label: string; onPress: () => void };
}

const HEADER_H = 340;

export function ResultsOverview({
  evaluation: e,
  title,
  photo,
  startHere,
  needUnknown,
  onBack,
  onBreed,
  onNeed,
  onProfile,
  aboveStart,
}: {
  evaluation: Evaluation;
  title: string;
  photo?: Frame;
  startHere: StartHere;
  needUnknown: Partial<Record<SubScore, boolean>>; // "Not checked yet" / "Tell us more"
  onBack: () => void;
  onBreed: () => void;
  onNeed: (need: SubScore) => void;
  onProfile: () => void;
  aboveStart?: React.ReactNode; // notices that sit above Start here (e.g. Since last time)
}) {
  const insets = useSafeAreaInsets();
  const tone = TONE[e.verdictTone];
  const sh = TONE[startHere.tone];

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
      {/* ---- dark photo header ---- */}
      <View style={[styles.header, { height: HEADER_H + insets.top }]}>
        {photo ? <Image source={{ uri: photo.uri }} style={StyleSheet.absoluteFill} resizeMode="cover" /> : null}
        <View style={[StyleSheet.absoluteFill, { backgroundColor: photo ? 'rgba(0,0,0,0.72)' : colors.text }]} />
        <View style={{ paddingTop: insets.top + 6, paddingHorizontal: 22 }}>
          <View style={styles.topRow}>
            <PawTile size={40} />
            <Pressable style={styles.breedPill} onPress={onBreed} accessibilityLabel="Change breed">
              <Text style={styles.breedTxt} numberOfLines={1}>{e.dog.name}</Text>
              <PackIcon name="edit-02" size={16} />
            </Pressable>
          </View>
          <Pressable onPress={onBack} hitSlop={12} style={{ marginTop: 14, alignSelf: 'flex-start' }} accessibilityLabel="Back">
            <PackIcon name="arrow-left" size={24} color="#fff" />
          </Pressable>
          <Text style={styles.space} numberOfLines={1}>{title}</Text>
          <Text style={styles.spaceSub}>How a {e.dog.name} would feel in this room</Text>
        </View>

        {/* Headline bubble: tail (4px corner) points at the dog on the right. */}
        <View style={[styles.bubble, { backgroundColor: tone.tint }]}>
          <View style={[styles.bubbleLabel, { backgroundColor: tone.fg }]}>
            <Text style={[styles.label, { color: tone.tint }]}>{e.verdictLabel}</Text>
          </View>
          <Text style={styles.bubbleTitle}>{e.verdictTitle}</Text>
        </View>
        <Image
          source={e.dog.happy}
          style={e.dog.cutout ? styles.dog : styles.dogPhoto}
          resizeMode={e.dog.cutout ? 'contain' : 'cover'}
        />
      </View>

      {/* ---- cream sheet ---- */}
      <View style={styles.sheet}>
        <Text style={styles.verdictLine}>{e.verdictLine}</Text>

        {aboveStart}

        <View style={[styles.start, { backgroundColor: sh.tint }]}>
          <Text style={[styles.label, { color: sh.fg }]}>{startHere.label}</Text>
          <Text style={styles.startHeading}>{startHere.heading}</Text>
          {!!startHere.body && <Text style={styles.startBody}>{startHere.body}</Text>}
          <View style={styles.startBtns}>
            <Pressable style={styles.btnPrimary} onPress={startHere.primary.onPress}>
              <Text style={styles.btnTxt}>{startHere.primary.label}</Text>
            </Pressable>
            {startHere.secondary && (
              <Pressable style={styles.btnSecondary} onPress={startHere.secondary.onPress}>
                <Text style={styles.btnTxt}>{startHere.secondary.label}</Text>
              </Pressable>
            )}
          </View>
        </View>

        <Text style={styles.sectionTitle}>How I’d feel here</Text>
        {REPORT_ROWS.map((r) => {
          const t: Tone = needUnknown[r.key] ? 'unknown' : BAND_TONE[e.bands[r.key]];
          const c = TONE[t];
          return (
            <Pressable key={r.key} style={styles.need} onPress={() => onNeed(r.key)}>
              <View style={styles.needHead}>
                <View style={[styles.needIcon, { backgroundColor: c.tint }]}>
                  <PackIcon name={NEED_ICON[r.key]} size={20} />
                </View>
                <Text style={styles.needTitle}>{r.heading}</Text>
                <View style={[styles.chip, { backgroundColor: c.tint }]}>
                  <Text style={[styles.chipTxt, { color: c.fg }]} numberOfLines={1}>
                    {TONE_MARK[t]}  {e.labels[r.key]}
                  </Text>
                </View>
                <PackIcon name="chevron-right" size={20} color={colors.textFaint} />
              </View>
              <Text style={styles.needLine}>“{e.lines[r.key]}”</Text>
              {r.key === 'room' && e.roomChips.length > 0 && (
                <View style={styles.roomChips}>
                  {e.roomChips.map((rc) => (
                    <View key={rc} style={styles.roomChip}>
                      <Text style={styles.roomChipTxt}>{rc}</Text>
                    </View>
                  ))}
                </View>
              )}
            </Pressable>
          );
        })}

        {e.nudges.length > 0 && (
          <View style={styles.nudge}>
            {e.nudges.map((n) => (
              <Text key={n.id} style={styles.nudgeTxt}>{n.text}</Text>
            ))}
            <Pressable onPress={onProfile} style={styles.nudgeLink} hitSlop={8}>
              <Text style={styles.nudgeLinkTxt}>Update profile</Text>
              <PackIcon name="chevron-right" size={14} color={colors.orangeDeep} />
            </Pressable>
          </View>
        )}

        <Text style={styles.disclaimer}>
          Every dog is different, and breed is only part of the story. We spot what we can from your photos, so give the
          room a once-over yourself too.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.cream },
  header: { backgroundColor: colors.text, overflow: 'visible' },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  breedPill: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.orange, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8, maxWidth: 220 },
  breedTxt: { fontFamily: fonts.medium, fontSize: 12, lineHeight: 16, color: colors.text },
  space: { fontFamily: fonts.bold, fontSize: 20, lineHeight: 26, color: '#fff', marginTop: 12 },
  spaceSub: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.cream },
  bubble: {
    position: 'absolute', left: 18, bottom: 54, width: 206, paddingTop: 14, paddingHorizontal: 16, paddingBottom: 16,
    borderRadius: 20, borderBottomRightRadius: 4, gap: 8,
    shadowColor: colors.text, shadowOpacity: 0.12, shadowRadius: 18, shadowOffset: { width: 0, height: 6 },
  },
  bubbleLabel: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4 },
  label: { fontFamily: fonts.semibold, fontSize: 11, lineHeight: 14, letterSpacing: 0.9, textTransform: 'uppercase' },
  bubbleTitle: { fontFamily: fonts.bold, fontSize: 20, lineHeight: 26, color: colors.text },
  dog: { position: 'absolute', right: 6, bottom: -36, width: 150, height: 182, zIndex: 3 },
  dogPhoto: { position: 'absolute', right: 22, bottom: 8, width: 110, height: 110, borderRadius: 55, borderWidth: 3, borderColor: '#fff', zIndex: 3 },
  sheet: { backgroundColor: colors.cream, borderTopLeftRadius: 28, borderTopRightRadius: 28, marginTop: -28, paddingHorizontal: 24, paddingTop: 24, gap: 14 },
  verdictLine: { fontFamily: fonts.medium, fontSize: 15, lineHeight: 21, color: colors.text, paddingRight: 120 },
  start: { borderRadius: 20, paddingVertical: 18, paddingHorizontal: 16, gap: 6 },
  startHeading: { fontFamily: fonts.bold, fontSize: 20, lineHeight: 26, color: colors.text },
  startBody: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.textMuted },
  startBtns: { flexDirection: 'row', gap: 10, marginTop: 8 },
  btnPrimary: { backgroundColor: colors.orange, borderRadius: 999, paddingVertical: 11, paddingHorizontal: 18 },
  btnSecondary: { backgroundColor: '#fff', borderRadius: 999, paddingVertical: 11, paddingHorizontal: 18, borderWidth: 1, borderColor: 'rgba(36,30,24,0.18)' },
  btnTxt: { fontFamily: fonts.medium, fontSize: 15, lineHeight: 21, color: colors.text },
  sectionTitle: { fontFamily: fonts.bold, fontSize: 20, lineHeight: 26, color: colors.text, marginTop: 10 },
  need: { backgroundColor: '#fff', borderRadius: 18, borderWidth: 1, borderColor: 'rgba(36,30,24,0.10)', padding: 16, gap: 10 },
  needHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  needIcon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  needTitle: { flex: 1, fontFamily: fonts.semibold, fontSize: 17, lineHeight: 22, color: colors.text },
  chip: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, maxWidth: 150 },
  chipTxt: { fontFamily: fonts.medium, fontSize: 12, lineHeight: 16 },
  needLine: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 21, color: colors.textMuted },
  roomChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  roomChip: { backgroundColor: colors.track, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  roomChipTxt: { fontFamily: fonts.medium, fontSize: 12, lineHeight: 16, color: colors.textMuted },
  nudge: { backgroundColor: '#fff', borderRadius: 18, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.orange, padding: 16, gap: 6 },
  nudgeTxt: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.text },
  nudgeLink: { flexDirection: 'row', alignItems: 'center', gap: 2, alignSelf: 'flex-start' },
  nudgeLinkTxt: { fontFamily: fonts.medium, fontSize: 12, lineHeight: 16, color: colors.orangeDeep },
  disclaimer: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.textFaint },
});
