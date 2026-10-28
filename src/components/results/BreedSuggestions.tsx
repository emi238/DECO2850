// B2 · Dogs who'd love it here, and B3 · Meet the breed (Results guide step 5).
// Suggestions grouped by fit; tapping one opens a preview, and only "See how I'd
// feel in your room" picks it (so a tap never re-runs the analysis by accident).

import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Image, Modal } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { PackIcon } from '../icons';
import { colors, fonts } from '../../theme';
import { TONE, type Tone } from './Overview';
import { resultStyles as R } from './todo';
import type { BreedProfile } from '../../logic/breeds';
import type { BreedSuggestion, Fit } from '../../ai/breedSuggest';

const GROUPS: { fit: Fit; heading: string; chip: string; tone: Tone }[] = [
  { fit: 'good', heading: 'Great match', chip: 'GREAT MATCH', tone: 'good' },
  { fit: 'could_work', heading: 'Could work', chip: 'COULD WORK', tone: 'work' },
  { fit: 'tricky', heading: 'Needs more planning', chip: 'NEEDS MORE PLANNING', tone: 'plan' },
];
const groupOf = (fit: Fit) => GROUPS.find((g) => g.fit === fit)!;

const SIZE_WORD = { small: 'Small', medium: 'Medium', large: 'Large' } as const;
const ENERGY_WORD = { low: 'Low energy', moderate: 'Moderate energy', high: 'High energy' } as const;
const NOISE_WORD = { quiet: 'Quiet-ish', moderate: 'Chatty', vocal: 'Vocal' } as const;

function FitChip({ fit }: { fit: Fit }) {
  const g = groupOf(fit);
  return (
    <View style={[styles.chip, { backgroundColor: TONE[g.tone].tint }]}>
      <Text style={[styles.label, { color: TONE[g.tone].fg }]}>{g.chip}</Text>
    </View>
  );
}

function Photo({ breed, size }: { breed: BreedProfile; size: number }) {
  return (
    <View style={{ width: size, height: size, borderRadius: 14, overflow: 'hidden', backgroundColor: colors.peach }}>
      <Image source={breed.sitting} style={{ width: size, height: size }} resizeMode={breed.cutout ? 'contain' : 'cover'} />
    </View>
  );
}

const quoted = (s: string) => (s ? `“${s.replace(/^[“"]|[”"]$/g, '')}”` : '');

export function BreedSuggestions({
  spaceName,
  loading,
  source,
  note,
  suggestions,
  onBack,
  onSearch,
  onChoose,
}: {
  spaceName: string;
  loading: boolean;
  source?: 'ai' | 'rules';
  note?: string;
  suggestions: BreedSuggestion[];
  onBack: () => void;
  onSearch: () => void;
  onChoose: (b: BreedProfile) => void;
}) {
  const [preview, setPreview] = useState<BreedSuggestion | null>(null);
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
          <View style={styles.topBar}>
            <Pressable onPress={onBack} hitSlop={12} accessibilityLabel="Back">
              <PackIcon name="arrow-left" size={24} />
            </Pressable>
            <View style={{ flex: 1 }}>
              <Text style={R.title}>Dogs who’d love it here</Text>
              <Text style={R.small} numberOfLines={1}>{spaceName} · based on your answers</Text>
            </View>
          </View>
          <Text style={R.small}>
            Tap a dog to meet them and see how they’d feel in your room. Every dog is different, and breed is only part of the
            story.{source === 'rules' ? ' Ranked from your answers.' : ''}
          </Text>
          {!!note && source === 'rules' && <Text style={R.small}>{note}</Text>}

          {loading ? (
            <View style={styles.loading}>
              <Image source={require('../../../assets/images/loading-dog.png')} style={{ width: 80, height: 80 }} resizeMode="contain" />
              <Text style={R.body}>Finding dogs who’d love your room…</Text>
            </View>
          ) : (
            GROUPS.map((g) => {
              const rows = suggestions.filter((s) => s.fit === g.fit);
              if (!rows.length) return null;
              return (
                <View key={g.fit} style={{ gap: 10 }}>
                  <Text style={R.heading}>
                    {g.heading}
                    <Text style={styles.count}>   {rows.length}</Text>
                  </Text>
                  {rows.map((s) => (
                    <Pressable key={s.breed.id} style={styles.card} onPress={() => setPreview(s)}>
                      <Photo breed={s.breed} size={72} />
                      <View style={{ flex: 1, gap: 4 }}>
                        <FitChip fit={s.fit} />
                        <Text style={R.btnTxt}>{s.breed.name}</Text>
                        <Text style={styles.reason}>{quoted(s.reason)}</Text>
                        {!!s.watchOut && <Text style={R.small}>To plan for: {s.watchOut}</Text>}
                      </View>
                    </Pressable>
                  ))}
                </View>
              );
            })
          )}

          <Pressable onPress={onSearch} hitSlop={8} style={styles.link}>
            <Text style={styles.linkTxt}>Have a breed in mind? Search breeds</Text>
            <PackIcon name="chevron-right" size={14} color={colors.orangeDeep} />
          </Pressable>
        </ScrollView>
      </SafeAreaView>

      <Modal visible={!!preview} transparent animationType="slide" onRequestClose={() => setPreview(null)}>
        <Pressable style={styles.dim} onPress={() => setPreview(null)} />
        {preview && (
          <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]}>
            <View style={{ flexDirection: 'row', gap: 16, alignItems: 'center' }}>
              <Photo breed={preview.breed} size={96} />
              <View style={{ flex: 1, gap: 6 }}>
                <FitChip fit={preview.fit} />
                <Text style={R.title}>{preview.breed.name}</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                  {[SIZE_WORD[preview.breed.size], ENERGY_WORD[preview.breed.energy], NOISE_WORD[preview.breed.noise]].map((w) => (
                    <View key={w} style={styles.fact}>
                      <Text style={styles.factTxt}>{w}</Text>
                    </View>
                  ))}
                </View>
              </View>
            </View>
            <View style={styles.why}>
              <Text style={styles.whyLabel}>Why I’d love it here</Text>
              <Text style={styles.whyTxt}>{quoted(preview.reason)}</Text>
            </View>
            {!!preview.watchOut && (
              <View style={{ gap: 4 }}>
                <Text style={R.heading}>To plan for</Text>
                <Text style={R.body}>{preview.watchOut}</Text>
              </View>
            )}
            <Text style={styles.faint}>Breed is only part of the story. Meet the dog you’re adopting, and ask the shelter about them.</Text>
            <Pressable
              style={R.btnPrimary}
              onPress={() => {
                const b = preview.breed;
                setPreview(null);
                onChoose(b);
              }}
            >
              <Text style={R.btnTxt}>See how I’d feel in your room</Text>
            </Pressable>
            <Pressable style={R.btnSecondary} onPress={() => setPreview(null)}>
              <Text style={R.btnTxt}>Back to suggestions</Text>
            </Pressable>
          </View>
        )}
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.cream },
  body: { padding: 24, gap: 18, paddingBottom: 40 },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  loading: { alignItems: 'center', gap: 10, paddingVertical: 40 },
  count: { fontFamily: fonts.regular, fontSize: 13, color: colors.textFaint },
  card: { flexDirection: 'row', gap: 14, backgroundColor: '#fff', borderRadius: 18, borderWidth: 1, borderColor: 'rgba(36,30,24,0.10)', paddingVertical: 12, paddingHorizontal: 14 },
  chip: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  label: { fontFamily: fonts.semibold, fontSize: 11, lineHeight: 14, letterSpacing: 0.9 },
  reason: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.text },
  link: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  linkTxt: { fontFamily: fonts.medium, fontSize: 12, lineHeight: 16, color: colors.orangeDeep },
  dim: { flex: 1, backgroundColor: 'rgba(36,30,24,0.45)' },
  sheet: { backgroundColor: colors.cream, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, gap: 14 },
  fact: { backgroundColor: colors.track, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  factTxt: { fontFamily: fonts.medium, fontSize: 12, lineHeight: 16, color: colors.textMuted },
  why: { backgroundColor: '#fff', borderRadius: 18, borderWidth: 1, borderColor: 'rgba(36,30,24,0.10)', padding: 16, gap: 6 },
  whyLabel: { fontFamily: fonts.medium, fontSize: 12, lineHeight: 16, color: colors.textMuted },
  whyTxt: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 21, color: colors.text },
  faint: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.textFaint },
});
