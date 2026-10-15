// First-time onboarding: the household questionnaire as a short step-by-step flow,
// one or two related questions per screen (a follow-up such as "Will the dog get to
// use it?" appears on the same screen when it applies). Shown after sign-up / first
// login, before Home. Every answer feeds the suitability logic (docs/LOGIC.md §4).
// Later edits happen in Profile, which shows the whole form at once.

import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PrimaryButton } from '../components/kit';
import { HouseholdForm, REQUIRED_QUESTIONS, stillToAnswer, type FormQuestion, type RequiredQuestion } from '../components/HouseholdForm';
import { colors, fonts } from '../theme';
import { IMAGES } from '../assets';
import { useSession } from '../store/session';
import type { Questionnaire } from '../types';
import type { ScreenProps } from '../navigation';

interface Step {
  title: string;
  why: string; // one line on why we ask (what it changes in the analysis)
  questions: FormQuestion[]; // follow-ups listed too; they only show when they apply
}

const STEPS: Step[] = [
  {
    title: 'Your home',
    why: 'Bigger and smaller dogs suit different homes, and rentals often have pet rules.',
    questions: ['dwelling', 'rental'],
  },
  {
    title: 'Your neighbours',
    why: 'A vocal breed next to shared walls is the main cause of barking complaints.',
    questions: ['neighbours'],
  },
  {
    title: 'Outdoor space',
    why: 'High-energy dogs need somewhere to run, if they really get to use it.',
    questions: ['outdoor_access', 'outdoor_use'],
  },
  {
    title: 'Who lives with you',
    why: 'Young children and some dogs need extra care and a quiet spot to retreat to.',
    questions: ['children_at_home'],
  },
  {
    title: 'A typical day',
    why: 'Dogs left alone a long time get bored, and bored dogs chew and try to get out.',
    questions: ['hours_alone', 'alone_plan'],
  },
  {
    title: 'Your routine',
    why: 'This is the biggest factor in whether a dog’s energy matches your life.',
    questions: ['owner_activity', 'exercise_time'],
  },
  {
    title: 'Dog experience',
    why: 'Some breeds are a lot to take on as a first dog.',
    questions: ['experience', 'existing_dogs'],
  },
  {
    title: 'Life at home',
    why: 'Sensitive dogs find busy homes stressful, and allergies narrow the choice of breed.',
    questions: ['household_atmosphere', 'allergies'],
  },
  {
    title: 'Other pets',
    why: 'Some breeds love to chase cats, birds and small pets.',
    questions: ['has_other_pets', 'other_pets'],
  },
];

export default function OnboardingScreen({ navigation }: ScreenProps<'Onboarding'>) {
  const saved = useSession((s) => s.household);
  const setHousehold = useSession((s) => s.setHousehold);
  const setOnboarded = useSession((s) => s.setOnboarded);

  const [q, setQ] = useState<Questionnaire>({ ...saved });
  // Every required question starts blank and must be answered (pre-filled answers
  // let people tap through without reading them).
  const [unanswered, setUnanswered] = useState<Set<RequiredQuestion>>(() => new Set(REQUIRED_QUESTIONS));
  const [step, setStep] = useState(0);

  const update = (p: Partial<Questionnaire>) => {
    setQ((prev) => ({ ...prev, ...p }));
    setUnanswered((prev) => {
      const next = new Set(prev);
      Object.keys(p).forEach((k) => next.delete(k as RequiredQuestion));
      return next;
    });
  };

  const current = STEPS[step];
  const last = step === STEPS.length - 1;
  const missing = stillToAnswer(q, unanswered).filter((k) => current.questions.includes(k));
  const canGoOn = missing.length === 0;

  const next = () => {
    if (!canGoOn) return;
    if (!last) {
      setStep(step + 1);
      return;
    }
    setHousehold(q);
    setOnboarded(true);
    navigation.reset({ index: 0, routes: [{ name: 'Home', params: { tour: true } }] });
  };

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.top}>
        <Image source={IMAGES.paw} style={styles.paw} resizeMode="contain" />
        <Text style={styles.welcome}>Getting Started</Text>
        <Text style={styles.welcomeSub}>Tell us about your home so we can check it for a new friend.</Text>
      </SafeAreaView>

      <View style={styles.panel}>
        <View style={styles.progress} accessibilityLabel={`Step ${step + 1} of ${STEPS.length}`}>
          {STEPS.map((_, i) => (
            <View key={i} style={[styles.bar, i <= step && styles.barOn]} />
          ))}
        </View>

        <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <Text style={styles.stepCount}>
            Step {step + 1} of {STEPS.length}
          </Text>
          <Text style={styles.h1}>{current.title}</Text>
          <Text style={styles.sub}>{current.why}</Text>
          <View style={{ marginTop: 24 }}>
            <HouseholdForm value={q} onChange={update} blank={unanswered} only={current.questions} />
          </View>
        </ScrollView>

        <SafeAreaView edges={['bottom']} style={styles.bottom}>
          <View style={styles.actions}>
            {step > 0 && (
              <PrimaryButton label="Back" onPress={() => setStep(step - 1)} style={[styles.backBtn, { backgroundColor: colors.track }]} />
            )}
            <PrimaryButton label={last ? 'Looks good!' : 'Next'} onPress={next} disabled={!canGoOn} style={styles.nextBtn} />
          </View>
          <Text style={styles.foot}>
            {canGoOn
              ? last
                ? 'You can change these any time in your profile.'
                : ' '
              : missing.length > 1
                ? 'Answer the questions above to continue.'
                : 'Answer the question above to continue.'}
          </Text>
        </SafeAreaView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.orange },
  top: { paddingHorizontal: 29, paddingBottom: 18 },
  paw: { width: 36, height: 36, tintColor: colors.orangeDeep, marginTop: 6 },
  welcome: { fontFamily: fonts.semibold, fontSize: 24, color: colors.text, marginTop: 14 },
  welcomeSub: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 21, color: colors.text, marginTop: 4 },
  panel: { flex: 1, backgroundColor: colors.bg, borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  progress: { flexDirection: 'row', gap: 5, paddingHorizontal: 32, paddingTop: 20 },
  bar: { flex: 1, height: 6, borderRadius: 3, backgroundColor: colors.track },
  barOn: { backgroundColor: colors.orange },
  body: { paddingHorizontal: 32, paddingTop: 18, paddingBottom: 20 },
  stepCount: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.textMuted },
  h1: { fontFamily: fonts.bold, color: colors.text, fontSize: 20, marginTop: 4 },
  sub: { fontFamily: fonts.regular, color: colors.text, fontSize: 15, lineHeight: 21, marginTop: 6 },
  bottom: { paddingHorizontal: 32, paddingTop: 6 },
  actions: { flexDirection: 'row', gap: 12 },
  backBtn: { width: '38%' },
  nextBtn: { flex: 1 },
  foot: { fontFamily: fonts.regular, color: colors.textMuted, fontSize: 12, textAlign: 'center', marginTop: 10, lineHeight: 17, marginBottom: 6 },
});
