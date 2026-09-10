// Start of the onboarding flow for a space: name it (living room, garage, …),
// create it, and continue into capture. Used for the very first space and for
// every "Add space" afterwards.

import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, KeyboardAvoidingView, Platform } from 'react-native';

import { Screen } from '../components/Screen';
import { Button } from '../components/Button';
import { colors, spacing, font, radius } from '../theme';
import { useSession } from '../store/session';
import type { ScreenProps } from '../navigation';

const SUGGESTIONS = ['Living room', 'Bedroom', 'Kitchen', 'Garage', 'Balcony', 'Studio', 'Backyard'];

export default function NewSpaceScreen({ navigation, route }: ScreenProps<'NewSpace'>) {
  const spaces = useSession((s) => s.spaces);
  const addSpace = useSession((s) => s.addSpace);
  const first = route.params?.first || spaces.length === 0;

  const [name, setName] = useState('');

  const proceed = () => {
    addSpace(name.trim() || 'My space');
    navigation.navigate('Capture');
  };

  return (
    <Screen
      title={first ? 'Welcome to PawSpace' : 'Add a space'}
      subtitle={
        first
          ? 'Check whether your home suits a pet — one space at a time. Start by naming your first space.'
          : 'Name the space you want to check. You can add as many as you like.'
      }
      edges={['top', 'bottom']}
    >
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.body}>
          <Text style={styles.label}>Space name</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="e.g. Living room"
            placeholderTextColor={colors.textFaint}
            style={styles.input}
            autoFocus
            returnKeyType="next"
            onSubmitEditing={proceed}
          />
          <View style={styles.chips}>
            {SUGGESTIONS.map((s) => (
              <Pressable key={s} onPress={() => setName(s)} style={[styles.chip, name === s && styles.chipOn]}>
                <Text style={[styles.chipTxt, name === s && styles.chipTxtOn]}>{s}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.footer}>
          {!first && (
            <Button label="Cancel" variant="secondary" onPress={() => navigation.goBack()} style={{ flex: 1 }} />
          )}
          <Button label="Start capture" onPress={proceed} style={{ flex: first ? undefined : 1 }} />
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, paddingHorizontal: spacing.xl, paddingTop: spacing.lg, gap: spacing.md },
  label: { color: colors.textMuted, fontSize: font.small, fontWeight: '600' },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: colors.text,
    fontSize: font.h3,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipTxt: { color: colors.text, fontSize: font.small, fontWeight: '600' },
  chipTxtOn: { color: colors.accentText },
  footer: { flexDirection: 'row', gap: spacing.md, paddingHorizontal: spacing.xl, paddingTop: spacing.sm, paddingBottom: spacing.md },
});
