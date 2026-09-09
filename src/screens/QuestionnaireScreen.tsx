// F3 — Household questionnaire. All fields persist; sensible defaults let the
// demo move fast (PRD F3.2). Answers become structured context for the model.

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';

import { Screen } from '../components/Screen';
import { Button } from '../components/Button';
import { GlassCard } from '../components/GlassCard';
import { colors, spacing, font, radius } from '../theme';
import { useSession } from '../store/session';
import type { ExistingPet, Questionnaire } from '../types';
import type { ScreenProps } from '../navigation';

export default function QuestionnaireScreen({ navigation }: ScreenProps<'Questionnaire'>) {
  const saved = useSession((s) => s.questionnaire);
  const setQuestionnaire = useSession((s) => s.setQuestionnaire);
  const [q, setQ] = useState<Questionnaire>({ ...saved });

  const patch = (p: Partial<Questionnaire>) => setQ((prev) => ({ ...prev, ...p }));

  const proceed = () => {
    setQuestionnaire(q);
    navigation.navigate('Tagging');
  };

  const addPet = () =>
    patch({ existing_pets: [...q.existing_pets, { species: '', breed: '' }] });
  const updatePet = (i: number, p: Partial<ExistingPet>) =>
    patch({ existing_pets: q.existing_pets.map((e, idx) => (idx === i ? { ...e, ...p } : e)) });
  const removePet = (i: number) =>
    patch({ existing_pets: q.existing_pets.filter((_, idx) => idx !== i) });

  return (
    <Screen step={2} title="Your household" subtitle="A few quick details so the assessment fits your home.">
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={40}>
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <GlassCard style={styles.card}>
            <Field label="Dwelling type">
              <Segmented
                options={['apartment', 'house']}
                value={q.dwelling}
                onChange={(v) => patch({ dwelling: v as Questionnaire['dwelling'] })}
              />
            </Field>

            <Field label="Is it a rental?">
              <Segmented
                options={['yes', 'no']}
                value={q.rental ? 'yes' : 'no'}
                onChange={(v) => patch({ rental: v === 'yes' })}
              />
            </Field>

            {q.dwelling === 'apartment' && (
              <Field label="Floor level">
                <Stepper
                  value={q.floor_level ?? 0}
                  min={0}
                  onChange={(v) => patch({ floor_level: v })}
                  suffix={q.floor_level === 0 ? ' (ground)' : ''}
                />
              </Field>
            )}

            <Field label="Outdoor access">
              <Chips
                options={['none', 'balcony', 'shared yard', 'private yard', 'pool']}
                value={q.outdoor_access}
                onChange={(v) => patch({ outdoor_access: v as Questionnaire['outdoor_access'] })}
              />
            </Field>
          </GlassCard>

          <GlassCard style={styles.card}>
            <Field label="Adults">
              <Stepper value={q.adults} min={0} onChange={(v) => patch({ adults: v })} />
            </Field>
            <Field label="Children">
              <Stepper value={q.children} min={0} onChange={(v) => patch({ children: v })} />
            </Field>
            {q.children > 0 && (
              <Field label="Rough ages">
                <TextInput
                  value={q.children_ages}
                  onChangeText={(t) => patch({ children_ages: t })}
                  placeholder="e.g. 2, 5"
                  placeholderTextColor={colors.textFaint}
                  style={styles.input}
                />
              </Field>
            )}
            <Field label="Infant present?">
              <Segmented
                options={['yes', 'no']}
                value={q.infant_present ? 'yes' : 'no'}
                onChange={(v) => patch({ infant_present: v === 'yes' })}
              />
            </Field>
          </GlassCard>

          <GlassCard style={styles.card}>
            <Text style={styles.sectionTitle}>Existing pets</Text>
            {q.existing_pets.map((p, i) => (
              <View key={i} style={styles.petRow}>
                <TextInput
                  value={p.species}
                  onChangeText={(t) => updatePet(i, { species: t })}
                  placeholder="Species"
                  placeholderTextColor={colors.textFaint}
                  style={[styles.input, { flex: 1 }]}
                />
                <TextInput
                  value={p.breed}
                  onChangeText={(t) => updatePet(i, { breed: t })}
                  placeholder="Breed"
                  placeholderTextColor={colors.textFaint}
                  style={[styles.input, { flex: 1 }]}
                />
                <Pressable onPress={() => removePet(i)} style={styles.removeBtn}>
                  <Text style={styles.removeTxt}>×</Text>
                </Pressable>
              </View>
            ))}
            <Pressable onPress={addPet} style={styles.addBtn}>
              <Text style={styles.addTxt}>+ Add a pet</Text>
            </Pressable>
          </GlassCard>

          <GlassCard style={styles.card}>
            <Field label="Off-limit / sensitive zones">
              <TextInput
                value={q.off_limit_zones.join(', ')}
                onChangeText={(t) =>
                  patch({ off_limit_zones: t.split(',').map((s) => s.trim()).filter(Boolean) })
                }
                placeholder="e.g. nursery, home office"
                placeholderTextColor={colors.textFaint}
                style={styles.input}
              />
            </Field>
            <Field label="Household activity level">
              <Segmented
                options={['low', 'medium', 'high']}
                value={q.activity_level}
                onChange={(v) => patch({ activity_level: v as Questionnaire['activity_level'] })}
              />
            </Field>
            <Field label="Want an apartment-friendly pet?">
              <Segmented
                options={['yes', 'no']}
                value={q.wants_apartment_friendly ? 'yes' : 'no'}
                onChange={(v) => patch({ wants_apartment_friendly: v === 'yes' })}
              />
            </Field>
          </GlassCard>
        </ScrollView>
      </KeyboardAvoidingView>

      <View style={styles.footer}>
        <Button label="Continue" onPress={proceed} />
      </View>
    </Screen>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

function Segmented({
  options,
  value,
  onChange,
}: {
  options: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <View style={styles.segmented}>
      {options.map((o) => {
        const on = o === value;
        return (
          <Pressable key={o} onPress={() => onChange(o)} style={[styles.segment, on && styles.segmentOn]}>
            <Text style={[styles.segmentTxt, on && styles.segmentTxtOn]}>{o}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function Chips({
  options,
  value,
  onChange,
}: {
  options: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <View style={styles.chipRow}>
      {options.map((o) => {
        const on = o === value;
        return (
          <Pressable key={o} onPress={() => onChange(o)} style={[styles.chip, on && styles.chipOn]}>
            <Text style={[styles.chipTxt, on && styles.chipTxtOn]}>{o}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function Stepper({
  value,
  onChange,
  min = 0,
  suffix = '',
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  suffix?: string;
}) {
  return (
    <View style={styles.stepper}>
      <Pressable onPress={() => onChange(Math.max(min, value - 1))} style={styles.stepBtn}>
        <Text style={styles.stepTxt}>−</Text>
      </Pressable>
      <Text style={styles.stepVal}>
        {value}
        {suffix}
      </Text>
      <Pressable onPress={() => onChange(value + 1)} style={styles.stepBtn}>
        <Text style={styles.stepTxt}>+</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xl, gap: spacing.md },
  card: { gap: spacing.md },
  field: { gap: spacing.sm },
  fieldLabel: { color: colors.textMuted, fontSize: font.small, fontWeight: '600' },
  sectionTitle: { color: colors.text, fontSize: font.h3, fontWeight: '600' },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.text,
    fontSize: font.body,
  },
  segmented: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 4,
    gap: 4,
  },
  segment: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: radius.sm },
  segmentOn: { backgroundColor: colors.accent },
  segmentTxt: { color: colors.textMuted, fontSize: font.small, fontWeight: '600', textTransform: 'capitalize' },
  segmentTxtOn: { color: colors.accentText },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipTxt: { color: colors.text, fontSize: font.small, fontWeight: '600', textTransform: 'capitalize' },
  chipTxtOn: { color: colors.accentText },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  stepBtn: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceStrong,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepTxt: { color: colors.text, fontSize: 22, fontWeight: '600' },
  stepVal: { color: colors.text, fontSize: font.h3, fontWeight: '700', minWidth: 90, textAlign: 'center' },
  petRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  removeBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  removeTxt: { color: colors.textMuted, fontSize: 22, lineHeight: 24 },
  addBtn: { paddingVertical: 10 },
  addTxt: { color: colors.accent, fontSize: font.body, fontWeight: '600' },
  footer: { paddingHorizontal: spacing.xl, paddingTop: spacing.sm, paddingBottom: spacing.md },
});
