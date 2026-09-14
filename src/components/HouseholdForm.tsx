// The household questionnaire controls (dwelling, rental, neighbours, outdoor
// access, existing pets). Shared by onboarding ("Getting Started") and Profile.

import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';

import { Segmented, Chip, SectionLabel } from './kit';
import { CloseIcon } from './icons';
import { OptionSheet } from './OptionSheet';
import { colors, fonts } from '../theme';
import { useBreedCatalogue } from '../logic/breeds';
import type { Questionnaire, ExistingPet } from '../types';

const OUTDOOR: { value: Questionnaire['outdoor_access']; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'balcony', label: 'Balcony' },
  { value: 'shared yard', label: 'Shared Yard' },
  { value: 'private yard', label: 'Private Yard' },
  { value: 'pool', label: 'Pool' },
];

// Dogs only (Prototype 1): existing pets are the household's current dogs,
// picked from the breed catalogue (The Dog API when a key is set).
const MIXED = 'Mixed breed';
const petLabel = (p: ExistingPet) => p.breed || 'Dog';

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
  const { breeds } = useBreedCatalogue();
  const gap = compact ? 12 : 26;
  // Onboarding uses bigger, filled controls; the Profile card keeps them compact.
  const big = !compact;
  const segH = big ? 44 : undefined;
  const segTxt = big ? styles.segTxtBig : undefined;
  const label = big ? styles.labelBig : undefined;

  const addPet = (breed: string) => {
    onChange({ existing_pets: [...q.existing_pets, { species: 'Dog', breed }] });
    setPickerOpen(false);
  };
  const removePet = (i: number) => onChange({ existing_pets: q.existing_pets.filter((_, idx) => idx !== i) });

  return (
    <View style={disabled && { opacity: 0.85 }}>
      <View style={{ marginBottom: gap }}>
        <SectionLabel style={label}>Dwelling Type</SectionLabel>
        <Segmented
          disabled={disabled}
          value={q.dwelling}
          onChange={(v) => onChange({ dwelling: v })}
          options={[{ value: 'apartment', label: 'Apartment' }, { value: 'house', label: 'House' }]}
          style={big ? styles.segBig : styles.seg}
          height={segH}
          textStyle={segTxt}
        />
      </View>

      <View style={{ marginBottom: gap }}>
        <SectionLabel style={label}>Is this a rental?</SectionLabel>
        <Segmented
          disabled={disabled}
          value={q.rental ? 'yes' : 'no'}
          onChange={(v) => onChange({ rental: v === 'yes' })}
          options={[{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }]}
          style={big ? styles.segBig : styles.seg}
          height={segH ?? 22}
          textStyle={segTxt}
        />
      </View>

      <View style={{ marginBottom: gap }}>
        <SectionLabel style={label}>How close are your nearest neighbours?</SectionLabel>
        <Segmented
          disabled={disabled}
          value={q.neighbours}
          onChange={(v) => onChange({ neighbours: v })}
          options={[
            { value: 'attached', label: 'Attached walls' },
            { value: 'close_separate', label: 'Close, but a\nseparate building' },
            { value: 'not_close', label: 'Not close by' },
          ]}
          style={big ? styles.segBig : styles.seg}
          height={big ? 52 : 31}
          textStyle={segTxt}
        />
      </View>

      <View style={{ marginBottom: gap }}>
        <SectionLabel style={label}>Outdoor Access</SectionLabel>
        <View style={styles.chips}>
          {OUTDOOR.map((o) => (
            <Chip
              key={o.value}
              disabled={disabled}
              label={o.label}
              selected={q.outdoor_access === o.value}
              onPress={() => onChange({ outdoor_access: o.value })}
              style={big && styles.chipBig}
              textStyle={big && styles.chipTxtBig}
            />
          ))}
        </View>
      </View>

      <View>
        <SectionLabel style={label}>Existing Dogs</SectionLabel>
        {q.existing_pets.length > 0 && (
          <View style={[styles.chips, { marginBottom: 8 }]}>
            {q.existing_pets.map((p, i) => (p.species.toLowerCase() !== 'dog' ? null : (
              <View key={i} style={[styles.petChip, big && styles.chipBig]}>
                <Text style={[styles.petChipTxt, big && styles.chipTxtBig]}>{petLabel(p)}</Text>
                {!disabled && (
                  <Pressable onPress={() => removePet(i)} hitSlop={8}>
                    <CloseIcon size={big ? 10 : 8} />
                  </Pressable>
                )}
              </View>
            )))}
          </View>
        )}
        <Pressable disabled={disabled} onPress={() => setPickerOpen(true)} style={[styles.addPet, big && styles.addPetBig]}>
          <Text style={[styles.addPetTxt, big && styles.addPetTxtBig]}>+ Add a dog (dropdown search)</Text>
        </Pressable>
      </View>

      <OptionSheet
        visible={pickerOpen}
        title="Add a dog"
        searchable
        searchPlaceholder="Search dog breeds"
        options={[
          { value: MIXED, label: 'Not sure / mixed breed' },
          ...breeds.map((b) => ({ value: b.name, label: b.name, image: b.sitting })),
        ]}
        onSelect={addPet}
        onClose={() => setPickerOpen(false)}
        footer={(query) =>
          query && !breeds.some((b) => b.name.toLowerCase().includes(query.toLowerCase())) ? (
            <Pressable onPress={() => addPet(query)} style={styles.addCustom}>
              <Text style={styles.addCustomTxt}>Add “{query}”</Text>
            </Pressable>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  seg: { marginRight: 14 },
  segBig: { borderRadius: 12 },
  labelBig: { fontFamily: fonts.semibold, fontSize: 15, marginBottom: 10 },
  segTxtBig: { fontFamily: fonts.medium, fontSize: 13.5, lineHeight: 17 },
  chipBig: { height: 40, minWidth: 96, borderRadius: 12, paddingHorizontal: 14 },
  chipTxtBig: { fontFamily: fonts.medium, fontSize: 14 },
  addPetBig: { height: 44, borderRadius: 12, paddingHorizontal: 14, marginRight: 0 },
  addPetTxtBig: { fontFamily: fonts.medium, fontSize: 14 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 10, rowGap: 10 },
  petChip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.orangeLight, borderRadius: 10, height: 22, paddingHorizontal: 10 },
  petChipTxt: { fontFamily: fonts.regular, fontSize: 10, color: colors.text },
  addPet: { backgroundColor: colors.track, borderRadius: 8, height: 28, justifyContent: 'center', paddingHorizontal: 7, marginRight: 30 },
  addPetTxt: { fontFamily: fonts.regular, fontSize: 10, color: colors.text },

  addCustom: { paddingVertical: 12, paddingHorizontal: 10 },
  addCustomTxt: { fontFamily: fonts.semibold, fontSize: 15, color: colors.orangeDeep },
});
