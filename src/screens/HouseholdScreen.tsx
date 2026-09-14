// Household questionnaire — shown once at first login ("Getting Started") and
// reachable later from Home ("Has your living situation changed?") and the Space
// Saved screen. Dogs-only. Feeds the evaluation (outdoor access, neighbours…).

import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AvatarButton, PrimaryButton } from '../components/kit';
import { HouseholdForm } from '../components/HouseholdForm';
import { BackArrowIcon } from '../components/icons';
import { colors, fonts } from '../theme';
import { IMAGES } from '../assets';
import { useSession } from '../store/session';
import type { Questionnaire } from '../types';
import type { ScreenProps } from '../navigation';

export default function HouseholdScreen({ navigation, route }: ScreenProps<'Household'>) {
  const onboarding = !!route.params?.onboarding;
  const saved = useSession((s) => s.household);
  const setHousehold = useSession((s) => s.setHousehold);
  const setOnboarded = useSession((s) => s.setOnboarded);

  const [q, setQ] = useState<Questionnaire>({ ...saved });

  const save = () => {
    setHousehold(q);
    if (onboarding) {
      setOnboarded(true);
      navigation.reset({ index: 0, routes: [{ name: 'Home' }] });
    } else {
      navigation.goBack();
    }
  };

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.top}>
        <View style={styles.topRow}>
          {onboarding ? (
            <Image source={IMAGES.paw} style={styles.paw} resizeMode="contain" />
          ) : (
            <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={styles.backRow}>
              <Image source={IMAGES.paw} style={styles.paw} resizeMode="contain" />
              <BackArrowIcon />
            </Pressable>
          )}
          <AvatarButton onPress={onboarding ? undefined : () => navigation.navigate('Profile')} />
        </View>
      </SafeAreaView>

      <View style={styles.panel}>
        <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
          <Text style={styles.h1}>{onboarding ? 'Getting Started' : 'Has anything changed?'}</Text>
          <Text style={styles.sub}>
            {onboarding
              ? 'Let us know what your current situation is to welcome a new friend!'
              : 'Update your household situation, every space analysis uses these answers.'}
          </Text>
          <View style={{ marginTop: 26 }}>
            <HouseholdForm value={q} onChange={(p) => setQ((prev) => ({ ...prev, ...p }))} />
          </View>
        </ScrollView>

        <SafeAreaView edges={['bottom']} style={styles.bottom}>
          <PrimaryButton label={onboarding ? 'Looks good!' : 'Save'} onPress={save} />
          <Text style={styles.foot}>
            {onboarding ? 'You can change your household situation in your\nprofile.' : ' '}
          </Text>
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
