// F2 — Pet mode selection. "I have a pet in mind" (species + breed) or
// "Explore breeds for my space." Persisted to the session.

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';

import { Screen } from '../components/Screen';
import { Button } from '../components/Button';
import { GlassCard } from '../components/GlassCard';
import { colors, spacing, font, radius } from '../theme';
import { useSession } from '../store/session';
import type { Mode } from '../types';
import type { ScreenProps } from '../navigation';

const SPECIES = ['Dog', 'Cat', 'Rabbit', 'Bird', 'Other'];

const BREED_HINTS: Record<string, string[]> = {
  Dog: ['Border Collie', 'French Bulldog', 'Labrador', 'Greyhound', 'Dachshund'],
  Cat: ['Domestic Shorthair', 'Ragdoll', 'Bengal', 'Maine Coon', 'Siamese'],
  Rabbit: ['Mini Lop', 'Netherland Dwarf', 'Lionhead'],
  Bird: ['Budgerigar', 'Cockatiel', 'Canary'],
  Other: [],
};

export default function ModeScreen({ navigation }: ScreenProps<'Mode'>) {
  const setMode = useSession((s) => s.setMode);
  const setPet = useSession((s) => s.setPet);
  const savedMode = useSession((s) => s.mode);
  const savedPet = useSession((s) => s.pet);

  const [mode, setLocalMode] = useState<Mode | null>(savedMode);
  const [species, setSpecies] = useState<string>(savedPet?.species ?? '');
  const [breed, setBreed] = useState<string>(savedPet?.breed ?? '');

  const canContinue = mode === 'explore' || (mode === 'pet_in_mind' && species.trim() !== '');

  const proceed = () => {
    if (!mode) return;
    setMode(mode);
    if (mode === 'pet_in_mind') {
      setPet({ species: species.trim(), breed: breed.trim() });
    } else {
      setPet(null);
    }
    navigation.navigate('Questionnaire');
  };

  return (
    <Screen step={1} title="What are you deciding?" subtitle="Pick a specific pet, or let PawSpace suggest pets that fit this space.">
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <ModeOption
            title="I have a pet in mind"
            desc="Check whether this room suits a specific species and breed."
            selected={mode === 'pet_in_mind'}
            onPress={() => setLocalMode('pet_in_mind')}
          />
          <ModeOption
            title="Explore breeds for my space"
            desc="Get 2–3 pets that would fit this room and household."
            selected={mode === 'explore'}
            onPress={() => setLocalMode('explore')}
          />

          {mode === 'pet_in_mind' && (
            <GlassCard style={styles.petCard}>
              <Text style={styles.label}>Species</Text>
              <View style={styles.chips}>
                {SPECIES.map((s) => (
                  <Chip key={s} label={s} selected={species === s} onPress={() => setSpecies(s)} />
                ))}
              </View>

              <Text style={[styles.label, { marginTop: spacing.lg }]}>Breed (optional)</Text>
              <TextInput
                value={breed}
                onChangeText={setBreed}
                placeholder="Type a breed, or pick a suggestion"
                placeholderTextColor={colors.textFaint}
                style={styles.input}
              />
              {!!(species && BREED_HINTS[species]?.length) && (
                <View style={styles.chips}>
                  {BREED_HINTS[species].map((b) => (
                    <Chip key={b} label={b} selected={breed === b} onPress={() => setBreed(b)} small />
                  ))}
                </View>
              )}
            </GlassCard>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      <View style={styles.footer}>
        <Button label="Continue" onPress={proceed} disabled={!canContinue} />
      </View>
    </Screen>
  );
}

function ModeOption({
  title,
  desc,
  selected,
  onPress,
}: {
  title: string;
  desc: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress}>
      <GlassCard style={[styles.option, selected && styles.optionSelected]}>
        <View style={styles.optionRow}>
          <View style={styles.optionText}>
            <Text style={styles.optionTitle}>{title}</Text>
            <Text style={styles.optionDesc}>{desc}</Text>
          </View>
          <View style={[styles.radio, selected && styles.radioOn]}>
            {selected && <View style={styles.radioDot} />}
          </View>
        </View>
      </GlassCard>
    </Pressable>
  );
}

function Chip({
  label,
  selected,
  onPress,
  small,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  small?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, small && styles.chipSmall, selected && styles.chipOn]}
    >
      <Text style={[styles.chipText, selected && styles.chipTextOn]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xl, gap: spacing.md },
  option: { paddingVertical: spacing.lg },
  optionSelected: { borderColor: colors.accent },
  optionRow: { flexDirection: 'row', alignItems: 'center' },
  optionText: { flex: 1, paddingRight: spacing.md },
  optionTitle: { color: colors.text, fontSize: font.h3, fontWeight: '600' },
  optionDesc: { color: colors.textMuted, fontSize: font.small, marginTop: 4, lineHeight: 19 },
  radio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOn: { borderColor: colors.accent },
  radioDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.accent },
  petCard: { marginTop: spacing.sm },
  label: { color: colors.textMuted, fontSize: font.small, fontWeight: '600', marginBottom: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.xs },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipSmall: { paddingHorizontal: 12, paddingVertical: 7 },
  chipOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { color: colors.text, fontSize: font.small, fontWeight: '600' },
  chipTextOn: { color: colors.accentText },
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
  footer: { paddingHorizontal: spacing.xl, paddingTop: spacing.sm, paddingBottom: spacing.md },
});
