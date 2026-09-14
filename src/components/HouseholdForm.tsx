// The household questionnaire controls (dwelling, rental, neighbours, outdoor
// access, existing pets). Shared by onboarding ("Getting Started") and Profile.

import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Modal, TextInput, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Segmented, Chip, SectionLabel } from './kit';
import { CloseIcon } from './icons';
import { colors, fonts } from '../theme';
import { BREEDS } from '../logic/breeds';
import type { Questionnaire, ExistingPet } from '../types';

const OUTDOOR: { value: Questionnaire['outdoor_access']; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'balcony', label: 'Balcony' },
  { value: 'shared yard', label: 'Shared Yard' },
  { value: 'private yard', label: 'Private Yard' },
  { value: 'pool', label: 'Pool' },
];

const PET_OPTIONS: ExistingPet[] = [
  ...BREEDS.map((b) => ({ species: 'Dog', breed: b.name })),
  { species: 'Dog', breed: 'Mixed breed' },
  { species: 'Cat', breed: '' },
  { species: 'Rabbit', breed: '' },
  { species: 'Bird', breed: '' },
  { species: 'Fish', breed: '' },
  { species: 'Other', breed: '' },
];

const petLabel = (p: ExistingPet) => (p.breed ? `${p.species} · ${p.breed}` : p.species);

export function HouseholdForm({
  value: q,
  onChange,
  disabled,
  compact,
}: {
  value: Questionnaire;
  onChange: (patch: Partial<Questionnaire>) => void;
  disabled?: boolean;
  compact?: boolean; // tighter spacing inside the Profile card
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [search, setSearch] = useState('');
  const gap = compact ? 12 : 26;

  const matches = useMemo(() => {
    const t = search.trim().toLowerCase();
    return PET_OPTIONS.filter((p) => !t || petLabel(p).toLowerCase().includes(t));
  }, [search]);

  const addPet = (p: ExistingPet) => {
    onChange({ existing_pets: [...q.existing_pets, p] });
    setPickerOpen(false);
    setSearch('');
  };
  const removePet = (i: number) => onChange({ existing_pets: q.existing_pets.filter((_, idx) => idx !== i) });

  return (
    <View style={disabled && { opacity: 0.85 }}>
      <View style={{ marginBottom: gap }}>
        <SectionLabel>Dwelling Type</SectionLabel>
        <Segmented
          disabled={disabled}
          value={q.dwelling}
          onChange={(v) => onChange({ dwelling: v })}
          options={[{ value: 'apartment', label: 'Apartment' }, { value: 'house', label: 'House' }]}
          style={styles.seg}
        />
      </View>

      <View style={{ marginBottom: gap }}>
        <SectionLabel>Is this a rental?</SectionLabel>
        <Segmented
          disabled={disabled}
          value={q.rental ? 'yes' : 'no'}
          onChange={(v) => onChange({ rental: v === 'yes' })}
          options={[{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }]}
          style={styles.seg}
          height={22}
        />
      </View>

      <View style={{ marginBottom: gap }}>
        <SectionLabel>How close are your nearest neighbours?</SectionLabel>
        <Segmented
          disabled={disabled}
          value={q.neighbours}
          onChange={(v) => onChange({ neighbours: v })}
          options={[
            { value: 'attached', label: 'Attached walls' },
            { value: 'close_separate', label: 'Close, but a\nseparate building' },
            { value: 'not_close', label: 'Not close by' },
          ]}
          style={styles.seg}
          height={31}
        />
      </View>

      <View style={{ marginBottom: gap }}>
        <SectionLabel>Outdoor Access</SectionLabel>
        <View style={styles.chips}>
          {OUTDOOR.map((o) => (
            <Chip
              key={o.value}
              disabled={disabled}
              label={o.label}
              selected={q.outdoor_access === o.value}
              onPress={() => onChange({ outdoor_access: o.value })}
            />
          ))}
        </View>
      </View>

      <View>
        <SectionLabel>Existing Pets</SectionLabel>
        {q.existing_pets.length > 0 && (
          <View style={[styles.chips, { marginBottom: 8 }]}>
            {q.existing_pets.map((p, i) => (
              <View key={i} style={styles.petChip}>
                <Text style={styles.petChipTxt}>{petLabel(p)}</Text>
                {!disabled && (
                  <Pressable onPress={() => removePet(i)} hitSlop={8}>
                    <CloseIcon size={8} />
                  </Pressable>
                )}
              </View>
            ))}
          </View>
        )}
        <Pressable disabled={disabled} onPress={() => setPickerOpen(true)} style={styles.addPet}>
          <Text style={styles.addPetTxt}>+ Add a pet (dropdown search)</Text>
        </Pressable>
      </View>

      <Modal visible={pickerOpen} animationType="slide" transparent onRequestClose={() => setPickerOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setPickerOpen(false)} />
        <SafeAreaView edges={['bottom']} style={styles.sheet}>
          <View style={styles.sheetHead}>
            <Text style={styles.sheetTitle}>Add a pet</Text>
            <Pressable onPress={() => setPickerOpen(false)} hitSlop={12}>
              <CloseIcon size={12} />
            </Pressable>
          </View>
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search pets or dog breeds"
            placeholderTextColor={colors.textFaint}
            style={styles.search}
            autoFocus
          />
          <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 320 }}>
            {matches.map((p) => (
              <Pressable key={petLabel(p)} onPress={() => addPet(p)} style={styles.option}>
                <Text style={styles.optionTxt}>{petLabel(p)}</Text>
              </Pressable>
            ))}
            {matches.length === 0 && search.trim() !== '' && (
              <Pressable onPress={() => addPet({ species: search.trim(), breed: '' })} style={styles.option}>
                <Text style={styles.optionTxt}>Add “{search.trim()}”</Text>
              </Pressable>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  seg: { marginRight: 14 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 10, rowGap: 6 },
  petChip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.orangeLight, borderRadius: 10, height: 22, paddingHorizontal: 10 },
  petChipTxt: { fontFamily: fonts.regular, fontSize: 10, color: colors.text },
  addPet: { backgroundColor: colors.track, borderRadius: 8, height: 28, justifyContent: 'center', paddingHorizontal: 7, marginRight: 30 },
  addPetTxt: { fontFamily: fonts.regular, fontSize: 10, color: colors.text },

  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: colors.bg, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 22 },
  sheetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  sheetTitle: { fontFamily: fonts.bold, fontSize: 18, color: colors.text },
  search: { backgroundColor: colors.track, borderRadius: 8, height: 36, paddingHorizontal: 12, fontFamily: fonts.regular, fontSize: 14, color: colors.text, marginBottom: 8 },
  option: { paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  optionTxt: { fontFamily: fonts.regular, fontSize: 14, color: colors.text },
});
