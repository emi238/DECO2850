// The household questionnaire controls (dwelling, rental, neighbours, outdoor
// access, existing pets). Shared by onboarding ("Getting Started") and Profile.

import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';

import { Segmented, Chip, SectionLabel } from './kit';
import { CloseIcon } from './icons';
import { OptionSheet } from './OptionSheet';
import { colors, fonts } from '../theme';
import { useBreedCatalogue } from '../logic/breeds';
import type { Questionnaire, ExistingPet, OtherPet } from '../types';

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

// The questions a new user must answer at onboarding (existing dogs is optional).
export const REQUIRED_QUESTIONS = [
  'dwelling',
  'rental',
  'neighbours',
  'outdoor_access',
  'outdoor_use', // only when there is outdoor access
  'children_at_home',
  'hours_alone',
  'alone_plan', // only when the dog is alone 4+ hours
  'owner_activity',
  'exercise_time',
  'experience',
  'household_atmosphere',
  'allergies',
  'has_other_pets',
  'other_pets', // only when they have other pets
] as const;
export type RequiredQuestion = (typeof REQUIRED_QUESTIONS)[number];

// Every question the form can show; `only` picks a subset (one onboarding step).
export type FormQuestion = RequiredQuestion | 'existing_dogs';

// Follow-up questions only apply once their parent question has an answer that needs them.
export function applies(k: RequiredQuestion, q: Questionnaire, blank?: ReadonlySet<RequiredQuestion>): boolean {
  if (k === 'outdoor_use') return !blank?.has('outdoor_access') && q.outdoor_access !== 'none';
  if (k === 'alone_plan') return !blank?.has('hours_alone') && !!q.hours_alone && q.hours_alone !== 'under_4';
  if (k === 'other_pets') return !blank?.has('has_other_pets') && q.has_other_pets === true;
  return true;
}

// The required questions still waiting for an answer. "What kind?" needs at least one
// pet picked (un-ticking the last one counts as unanswered again).
export function stillToAnswer(q: Questionnaire, blank: ReadonlySet<RequiredQuestion>): RequiredQuestion[] {
  return REQUIRED_QUESTIONS.filter(
    (k) => applies(k, q, blank) && (blank.has(k) || (k === 'other_pets' && !q.other_pets?.length))
  );
}

export const OTHER_PETS: { value: OtherPet; label: string }[] = [
  { value: 'cat', label: 'Cat' },
  { value: 'bird', label: 'Bird' },
  { value: 'small_animal', label: 'Rabbit, guinea pig or similar' },
  { value: 'fish', label: 'Fish' },
  { value: 'reptile', label: 'Reptile' },
  { value: 'other', label: 'Other' },
];
const petLabel = (p: ExistingPet) => p.breed || 'Dog';

export function HouseholdForm({
  value: q,
  onChange,
  disabled,
  compact,
  blank,
  only,
}: {
  value: Questionnaire;
  onChange: (patch: Partial<Questionnaire>) => void;
  disabled?: boolean;
  blank?: ReadonlySet<RequiredQuestion>; // shown with nothing selected until answered (onboarding)
  only?: readonly FormQuestion[]; // show just these questions (a follow-up shows with its parent)

  compact?: boolean; // tighter spacing between questions inside the Profile card
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const show = (k: FormQuestion) => !only || only.includes(k);
  const { breeds } = useBreedCatalogue();
  const gap = compact ? 20 : 26;
  // Big, filled controls everywhere (onboarding and Profile); `compact` only
  // tightens the spacing between questions inside the Profile card.
  const big = true;
  const segH = big ? 44 : undefined;
  const segTxt = big ? styles.segTxtBig : undefined;
  const label = big ? styles.labelBig : undefined;

  // One single-choice question; a blank (unanswered) question shows nothing selected.
  const ask = <T extends string>(
    key: RequiredQuestion,
    title: string,
    current: T | undefined,
    options: { value: T; label: string }[],
    patch: (v: T) => Partial<Questionnaire>,
    tall = false
  ) => show(key) && (
    <View style={{ marginBottom: gap }}>
      <SectionLabel style={label}>{title}</SectionLabel>
      <Segmented
        disabled={disabled}
        value={blank?.has(key) ? null : current ?? null}
        onChange={(v) => onChange(patch(v))}
        options={options}
        style={big ? styles.segBig : styles.seg}
        height={tall ? 52 : segH}
        textStyle={segTxt}
      />
    </View>
  );
  const yesNo = (v: boolean | undefined) => (v === undefined ? undefined : v ? 'yes' : 'no');

  const addPet = (breed: string) => {
    onChange({ existing_pets: [...q.existing_pets, { species: 'Dog', breed }] });
    setPickerOpen(false);
  };
  const removePet = (i: number) => onChange({ existing_pets: q.existing_pets.filter((_, idx) => idx !== i) });

  return (
    <View style={disabled && { opacity: 0.85 }}>
      {show('dwelling') && (
      <View style={{ marginBottom: gap }}>
        <SectionLabel style={label}>Dwelling Type</SectionLabel>
        <Segmented
          disabled={disabled}
          value={blank?.has('dwelling') ? null : q.dwelling}
          onChange={(v) => onChange({ dwelling: v })}
          options={[{ value: 'apartment', label: 'Apartment' }, { value: 'house', label: 'House' }]}
          style={big ? styles.segBig : styles.seg}
          height={segH}
          textStyle={segTxt}
        />
      </View>
      )}

      {show('rental') && (
      <View style={{ marginBottom: gap }}>
        <SectionLabel style={label}>Is this a rental?</SectionLabel>
        <Segmented
          disabled={disabled}
          value={blank?.has('rental') ? null : q.rental ? 'yes' : 'no'}
          onChange={(v) => onChange({ rental: v === 'yes' })}
          options={[{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }]}
          style={big ? styles.segBig : styles.seg}
          height={segH ?? 22}
          textStyle={segTxt}
        />
      </View>
      )}

      {show('neighbours') && (
      <View style={{ marginBottom: gap }}>
        <SectionLabel style={label}>How close are your nearest neighbours?</SectionLabel>
        <Segmented
          disabled={disabled}
          value={blank?.has('neighbours') ? null : q.neighbours}
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
      )}

      {show('outdoor_access') && (
      <View style={{ marginBottom: gap }}>
        <SectionLabel style={label}>Outdoor Access</SectionLabel>
        <View style={styles.chips}>
          {OUTDOOR.map((o) => (
            <Chip
              key={o.value}
              disabled={disabled}
              label={o.label}
              selected={!blank?.has('outdoor_access') && q.outdoor_access === o.value}
              onPress={() => onChange({ outdoor_access: o.value })}
              style={big && styles.chipBig}
              textStyle={big && styles.chipTxtBig}
            />
          ))}
        </View>
      </View>
      )}

      {show('outdoor_access') && applies('outdoor_use', q, blank) &&
        ask('outdoor_use', 'Will the dog get to use it?', q.outdoor_use, [
          { value: 'most_days', label: 'Most days' },
          { value: 'sometimes', label: 'Sometimes' },
          { value: 'rarely', label: 'Rarely' },
        ], (v) => ({ outdoor_use: v }))}

      {show('children_at_home') && (
      <View style={{ marginBottom: gap }}>
        <SectionLabel style={label}>Any children living at home?</SectionLabel>
        <Segmented
          disabled={disabled}
          value={blank?.has('children_at_home') ? null : q.children_at_home ?? null}
          onChange={(v) => onChange({ children_at_home: v })}
          options={[
            { value: 'none', label: 'No' },
            { value: 'young', label: 'Yes, under 5' },
            { value: 'older', label: 'Yes, 5 or older' },
          ]}
          style={big ? styles.segBig : styles.seg}
          height={segH}
          textStyle={segTxt}
        />
      </View>
      )}

      {show('hours_alone') && (
      <View style={{ marginBottom: gap }}>
        <SectionLabel style={label}>On a typical day, how long would the dog be home alone?</SectionLabel>
        <Segmented
          disabled={disabled}
          value={blank?.has('hours_alone') ? null : q.hours_alone ?? null}
          onChange={(v) => onChange({ hours_alone: v })}
          options={[
            { value: 'under_4', label: 'Under 4 hours' },
            { value: '4_to_8', label: '4 to 8 hours' },
            { value: 'over_8', label: 'Over 8 hours' },
          ]}
          style={big ? styles.segBig : styles.seg}
          height={segH}
          textStyle={segTxt}
        />
      </View>
      )}

      {show('hours_alone') && applies('alone_plan', q, blank) &&
        ask('alone_plan', 'On those days, will someone check in on the dog?', q.alone_plan, [
          { value: 'none', label: 'No' },
          { value: 'walker', label: 'Dog walker' },
          { value: 'daycare', label: 'Daycare' },
        ], (v) => ({ alone_plan: v }))}

      {ask('owner_activity', 'How active are you day to day?', q.owner_activity, [
        { value: 'sedentary', label: 'Mostly relaxed' },
        { value: 'moderate', label: 'Fairly active' },
        { value: 'active', label: 'Very active' },
      ], (v) => ({ owner_activity: v }), true)}

      {ask('exercise_time', 'How much time could you spend walking and playing with a dog each day?', q.exercise_time, [
        { value: 'under_30', label: 'Under 30 min' },
        { value: '30_60', label: '30 to 60 min' },
        { value: 'over_60', label: 'Over an hour' },
      ], (v) => ({ exercise_time: v }))}

      {ask('experience', 'Have you owned a dog before?', q.experience, [
        { value: 'some', label: 'Yes' },
        { value: 'none', label: 'No, first dog' },
      ], (v) => ({ experience: v }))}

      {ask('household_atmosphere', 'What is your home usually like?', q.household_atmosphere, [
        { value: 'calm', label: 'Calm' },
        { value: 'mixed', label: 'A mix' },
        { value: 'busy', label: 'Busy and noisy' },
      ], (v) => ({ household_atmosphere: v }), true)}

      {ask('allergies', 'Does anyone at home have pet allergies?', yesNo(q.allergies), [
        { value: 'yes', label: 'Yes' },
        { value: 'no', label: 'No' },
      ], (v) => ({ allergies: v === 'yes' }))}

      {ask('has_other_pets', 'Do you have any other pets?', yesNo(q.has_other_pets), [
        { value: 'yes', label: 'Yes' },
        { value: 'no', label: 'No' },
      ], (v) => (v === 'yes' ? { has_other_pets: true } : { has_other_pets: false, other_pets: [] }))}

      {show('has_other_pets') && applies('other_pets', q, blank) && (
        <View style={{ marginBottom: gap }}>
          <SectionLabel style={label}>What kind? (choose all that apply)</SectionLabel>
          <View style={styles.chips}>
            {OTHER_PETS.map((o) => {
              const picked = !blank?.has('other_pets') && (q.other_pets ?? []).includes(o.value);
              return (
                <Chip
                  key={o.value}
                  disabled={disabled}
                  label={o.label}
                  selected={picked}
                  onPress={() => {
                    const now = blank?.has('other_pets') ? [] : q.other_pets ?? [];
                    onChange({ other_pets: picked ? now.filter((p) => p !== o.value) : [...now, o.value] });
                  }}
                  style={big && styles.chipBig}
                  textStyle={big && styles.chipTxtBig}
                />
              );
            })}
          </View>
        </View>
      )}

      {show('existing_dogs') && (
      <View>
        <SectionLabel style={label}>{only ? 'Any dogs already at home? (optional)' : 'Existing Dogs'}</SectionLabel>
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
      )}

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
