// Household questionnaire, all on one screen: reached from Home ("Has your living
// situation changed?"), Profile and the Space Saved screen. First-time users answer
// it step by step in OnboardingScreen instead. Feeds the evaluation (outdoor access,
// neighbours…).

import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AvatarButton, PrimaryButton } from '../components/kit';
import { HouseholdForm, stillToAnswer, type RequiredQuestion } from '../components/HouseholdForm';
import { BackArrowIcon } from '../components/icons';
import { colors, fonts } from '../theme';
import { IMAGES } from '../assets';
import { useSession } from '../store/session';
import type { Questionnaire } from '../types';
import type { ScreenProps } from '../navigation';

export default function HouseholdScreen({ navigation }: ScreenProps<'Household'>) {
  const saved = useSession((s) => s.household);
  const setHousehold = useSession((s) => s.setHousehold);

  const [q, setQ] = useState<Questionnaire>({ ...saved });
  // Saved answers are filled in; only a follow-up that newly applies starts blank.
  const [unanswered, setUnanswered] = useState<Set<RequiredQuestion>>(() => new Set());
  const update = (p: Partial<Questionnaire>) => {
    setQ((prev) => ({ ...prev, ...p }));
    setUnanswered((prev) => {
      const next = new Set(prev);
      Object.keys(p).forEach((k) => next.delete(k as RequiredQuestion));
      return next;
    });
  };
  // Follow-ups (e.g. "Will the dog get to use it?") only count once they apply.
  const complete = stillToAnswer(q, unanswered).length === 0;

  const save = () => {
    if (!complete) return;
    setHousehold(q);
    navigation.goBack();
  };

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.top}>
        <View style={styles.topRow}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={styles.backRow}>
            <Image source={IMAGES.paw} style={styles.paw} resizeMode="contain" />
            <BackArrowIcon />
          </Pressable>
          <AvatarButton onPress={() => navigation.navigate('Profile')} />
        </View>
      </SafeAreaView>

      <View style={styles.panel}>
        <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
          <Text style={styles.h1}>Has anything changed?</Text>
          <Text style={styles.sub}>Update your household situation, every space analysis uses these answers.</Text>
          <View style={{ marginTop: 26 }}>
            <HouseholdForm value={q} onChange={update} blank={unanswered} />
          </View>
        </ScrollView>

        <SafeAreaView edges={['bottom']} style={styles.bottom}>
          <PrimaryButton label="Save" onPress={save} disabled={!complete} />
          <Text style={styles.foot}>{complete ? ' ' : 'Answer each question to continue.'}</Text>
        </SafeAreaView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.orange },
  top: { paddingHorizontal: 25, paddingBottom: 14 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  paw: { width: 36, height: 36, tintColor: colors.orangeDeep },
  panel: { flex: 1, backgroundColor: colors.bg, borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  body: { paddingHorizontal: 32, paddingTop: 30, paddingBottom: 20 },
  h1: { fontFamily: fonts.bold, color: colors.text, fontSize: 20 },
  sub: { fontFamily: fonts.regular, color: colors.text, fontSize: 15, lineHeight: 21, marginTop: 2 },
  bottom: { paddingHorizontal: 34, paddingTop: 6 },
  foot: { fontFamily: fonts.regular, color: colors.text, fontSize: 12, textAlign: 'center', marginTop: 10, lineHeight: 17, marginBottom: 6 },
});
