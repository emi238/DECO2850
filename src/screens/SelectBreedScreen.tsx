// Select breed (spec Stage 5). Two tabs:
//  • "I have a dog breed in mind" — search the breed catalogue (The Dog API when
//    a key is set, else the 3 built-ins), or "Not sure / mixed breed" with a
//    size; energy level can be adjusted. Shows the breed's facts + bias note.
//  • "Explore breeds for my space" — ranks every catalogue breed against this
//    space with the §4 logic and shows the best fits (no scores).
// Choosing a breed attaches it to the space and returns to the analysis report.

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Image, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { TopBar, Segmented, PrimaryButton } from '../components/kit';
import { OptionSheet } from '../components/OptionSheet';
import { colors, fonts } from '../theme';
import { useSession, useCurrentSpace } from '../store/session';
import { ENERGY_OPTIONS, MIXED_ID, SIZE_OPTIONS, findBreed, useBreedCatalogue, type BreedProfile, type Energy, type SizeClass } from '../logic/breeds';
import { suggestBreeds, type SuggestionResult } from '../ai/breedSuggest';
import type { ScreenProps } from '../navigation';

type Tab = 'in_mind' | 'explore';

export default function SelectBreedScreen({ navigation }: ScreenProps<'SelectBreed'>) {
  const space = useCurrentSpace();
  const household = useSession((s) => s.household);
  const setPet = useSession((s) => s.setPet);
  const setMode = useSession((s) => s.setMode);
  const { breeds, loading } = useBreedCatalogue();

  const current = space?.pet ?? null;
  const currentBreed = findBreed(current?.breed);

  const [tab, setTab] = useState<Tab>(space?.mode === 'explore' ? 'explore' : 'in_mind');
  const [breedId, setBreedId] = useState<string | null>(currentBreed?.id ?? (current?.breed ? MIXED_ID : null));
  const [energy, setEnergy] = useState<Energy | null>(current?.energy ?? currentBreed?.energy ?? null);
  const [size, setSize] = useState<SizeClass | null>(current?.size ?? currentBreed?.size ?? null);
  const [picker, setPicker] = useState<'breed' | 'energy' | 'size' | null>(null);
  const [thinking, setThinking] = useState(true);
  // Energy + size live under a collapsible "Advanced search"; opened automatically
  // for a mixed breed (size is required then) or if they were set before.
  const [advancedOpen, setAdvancedOpen] = useState(!!current?.energy || current?.breed === 'Mixed breed');

  const breed = breedId && breedId !== MIXED_ID ? breeds.find((b) => b.id === breedId) ?? findBreed(breedId) : undefined;

  // Once the full catalogue loads, re-link a previously saved breed by name.
  useEffect(() => {
    if (breedId || !current?.breed || current.breed === 'Mixed breed') return;
    const b = findBreed(current.breed);
    if (b) setBreedId(b.id);
  }, [breeds, breedId, current?.breed]);
  const mixed = breedId === MIXED_ID;

  // Explore tab: rules shortlist the whole catalogue, then the AI picks and
  // explains the best matches (src/ai/breedSuggest.ts). Waits for the catalogue.
  const [suggested, setSuggested] = useState<SuggestionResult | null>(null);
  useEffect(() => {
    if (tab !== 'explore' || !space || loading) return;
    let alive = true;
    setThinking(true);
    suggestBreeds(space, household, breeds).then((res) => {
      if (!alive) return;
      setSuggested(res);
      setThinking(false);
    });
    return () => {
      alive = false;
    };
  }, [tab, space, household, breeds, loading]);

  const pickBreed = (id: string) => {
    setBreedId(id);
    if (id === MIXED_ID) setAdvancedOpen(true);
    const b = breeds.find((x) => x.id === id);
    if (b) {
      setEnergy(b.energy);
      setSize(b.size);
    }
  };

  // A breed is set: go back, run the analysis for it, then show the report.
  const done = () => navigation.popTo('Analysis', { run: true, report: true });

  const confirmInMind = () => {
    if (!breedId) return;
    if (mixed) {
      setPet({ species: 'Dog', breed: 'Mixed breed', size: size ?? 'medium', energy: energy ?? 'moderate' });
    } else if (breed) {
      setPet(petFor(breed, energy && energy !== breed.energy ? energy : undefined));
    }
    setMode('pet_in_mind');
    done();
  };

  const chooseSuggested = (b: BreedProfile) => {
    setPet(petFor(b));
    setMode('explore');
    done();
  };


  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        <TopBar onBack={() => navigation.goBack()} style={styles.topBar} />
        <View style={styles.titles}>
          <Text style={styles.h1}>Select breed</Text>
          <Text style={styles.sub}>Got a dog in mind or open to any?</Text>
        </View>

        <View style={styles.card}>
          <Segmented
            value={tab}
            onChange={setTab}
            options={[
              { value: 'in_mind', label: 'I have a dog breed in mind' },
              { value: 'explore', label: 'Explore breeds for my space' },
            ]}
            height={48}
            activeColor={colors.orange}
            style={styles.tabs}
            textStyle={styles.tabTxt}
          />

          {tab === 'in_mind' ? (
            <ScrollView contentContainerStyle={{ paddingBottom: 30 }} showsVerticalScrollIndicator={false}>
              <Text style={styles.label}>Browse breeds:</Text>
              <Dropdown
                value={breed?.name ?? (mixed ? 'Not sure / mixed breed' : '')}
                placeholder={loading ? 'Loading breeds…' : 'Search breeds'}
                onPress={() => setPicker('breed')}
              />
              {breed && <BreedFacts breed={breed} />}

              <Pressable onPress={() => setAdvancedOpen((o) => !o)} hitSlop={8} style={styles.advancedBtn}>
                <Text style={styles.advanced}>
                  {advancedOpen ? 'Hide advanced search' : 'Advanced search for pets already in mind'}
                </Text>
              </Pressable>
              {advancedOpen && (
              <>

              <Text style={styles.label}>Energy Levels:</Text>
              <Text style={styles.hint}>
                “Low, happy to mostly relax” / “Moderate, regular play and movement” / “High, needs to run or climb often”
              </Text>
              <Dropdown value={ENERGY_OPTIONS.find((o) => o.value === energy)?.label ?? ''} placeholder="Choose an energy level" onPress={() => setPicker('energy')} />

              <Text style={[styles.label, { marginTop: 22 }]}>Size:</Text>
              <Text style={styles.hint}>Small, under 12kg / Medium, 12-25kg / Large, over 25kg</Text>
              <Dropdown
                value={SIZE_OPTIONS.find((o) => o.value === size)?.label ?? ''}
                placeholder={breed ? 'Set by the breed' : 'Choose a size'}
                disabled={!!breed}
                onPress={() => setPicker('size')}
              />
              </>
              )}

              <PrimaryButton
                label="Select Breed"
                onPress={confirmInMind}
                disabled={!breedId || (mixed && !size)}
                style={styles.selectBtn}
              />
            </ScrollView>
          ) : (
            <ScrollView contentContainerStyle={{ paddingBottom: 30 }} showsVerticalScrollIndicator={false}>
              {thinking || !suggested ? (
                <View style={styles.thinkingWrap}>
                  <ActivityIndicator color={colors.orange} />
                  <Text style={styles.thinking}>Matching breeds to your space…</Text>
                </View>
              ) : (
                <>
                  <Text style={styles.compat}>Compatible breeds with your space</Text>
                  <Text style={styles.bias}>
                    {suggested.source === 'ai' ? 'Picked by AI from ' : 'Ranked from '}
                    {breeds.length} breeds using your household answers and this room. Breed only explains part of an
                    individual dog’s behaviour, so treat these as a starting point.
                  </Text>
                  {!!suggested.note && <Text style={styles.suggestNote}>{suggested.note}</Text>}
                  {suggested.suggestions.map(({ breed: b, fit, reason, watchOut }) => (
                    <Pressable key={b.id} onPress={() => chooseSuggested(b)} style={({ pressed }) => [styles.suggestRow, pressed && { opacity: 0.8 }]}>
                      <Image
                        source={b.sitting}
                        style={styles.suggestImg}
                        resizeMode={b.cutout ? 'contain' : 'cover'}
                      />
                      <View style={{ flex: 1 }}>
                        <View style={styles.suggestHead}>
                          <Text style={styles.suggestName} numberOfLines={1}>{b.name}</Text>
                          <View style={[styles.fitChip, fit === 'good' && { backgroundColor: colors.orange }]}>
                            <Text style={styles.fitTxt}>{FIT_LABEL[fit]}</Text>
                          </View>
                        </View>
                        <Text style={styles.suggestReason}>{reason}</Text>
                        {!!watchOut && <Text style={styles.suggestWatch}>Watch out: {watchOut}</Text>}
                      </View>
                    </Pressable>
                  ))}
                </>
              )}
            </ScrollView>
          )}
        </View>
      </SafeAreaView>

      <OptionSheet
        visible={picker === 'breed'}
        title="Browse breeds"
        value={breedId}
        searchable
        searchPlaceholder="Search dog breeds"
        options={[
          { value: MIXED_ID, label: 'Not sure / mixed breed', hint: 'Tell us roughly what size' },
          ...breeds.map((b) => ({
            value: b.id,
            label: b.name,
            image: b.sitting,
            hint: [SIZE_OPTIONS.find((o) => o.value === b.size)!.label, b.temperament].filter(Boolean).join(' · '),
          })),
        ]}
        onSelect={pickBreed}
        onClose={() => setPicker(null)}
      />
      <OptionSheet visible={picker === 'energy'} title="Energy level" value={energy} options={ENERGY_OPTIONS} onSelect={setEnergy} onClose={() => setPicker(null)} />
      <OptionSheet visible={picker === 'size'} title="Size" value={size} options={SIZE_OPTIONS} onSelect={setSize} onClose={() => setPicker(null)} />
    </View>
  );
}

// Traits saved on the pet so the evaluation works even before the API list loads.
function petFor(b: BreedProfile, energy?: Energy) {
  return {
    species: 'Dog',
    breed: b.name,
    size: b.size,
    energy,
    noise: b.noise,
    imageUrl: typeof b.sitting === 'object' && b.sitting && 'uri' in b.sitting ? (b.sitting.uri as string) : undefined,
  };
}

// Facts from The Dog API plus the breed-bias disclaimer (spec P4.6).
function BreedFacts({ breed }: { breed: BreedProfile }) {
  const rows = [
    ['Temperament', breed.temperament],
    ['Bred for', breed.bredFor],
    ['Group', breed.group],
    ['Life span', breed.lifeSpan],
    ['Weight', breed.weightKg ? `about ${breed.weightKg} kg` : ''],
  ].filter(([, v]) => !!v);
  return (
    <View style={styles.facts}>
      <View style={styles.factsHead}>
        <Image source={breed.sitting} style={styles.factsImg} resizeMode={breed.cutout ? 'contain' : 'cover'} />
        <View style={{ flex: 1 }}>
          <Text style={styles.factsName}>{breed.name}</Text>
          <Text style={styles.factsTraits}>
            {SIZE_OPTIONS.find((o) => o.value === breed.size)!.label.split(',')[0]} · {breed.energy} energy · {breed.noise === 'vocal' ? 'vocal' : breed.noise === 'quiet' ? 'quiet' : 'some barking'}
          </Text>
        </View>
      </View>
      {!!breed.description && <Text style={styles.factDesc}>{breed.description}</Text>}
      {rows.map(([k, v]) => (
        <Text key={k} style={styles.factRow}>
          <Text style={styles.factKey}>{k}: </Text>
          {v}
        </Text>
      ))}
      <Text style={styles.biasNote}>
        Breed only explains part of an individual dog’s behaviour, every dog is different.
        {breed.traitsEstimated ? ' Energy and barking are estimated from the breed’s temperament.' : ''}
        {breed.source === 'api' || breed.temperament ? ' Breed facts from The Dog API.' : ''}
      </Text>
    </View>
  );
}

const FIT_LABEL = { good: 'Good fit', could_work: 'Could work', tricky: 'Tricky fit' } as const;

function Dropdown({ value, placeholder, onPress, disabled }: { value: string; placeholder: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} style={styles.dropdown}>
      <Text style={[styles.dropdownValue, !value && { color: colors.textFaint }]} numberOfLines={1}>
        {value || placeholder}
      </Text>
      <Text style={styles.dropdownTag}>dropdown</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg2 },
  topBar: { paddingHorizontal: 22, paddingTop: 6 },
  titles: { paddingHorizontal: 22 },
  h1: { fontFamily: fonts.bold, color: colors.text, fontSize: 20, marginTop: 14 },
  sub: { fontFamily: fonts.regular, color: colors.text, fontSize: 15, lineHeight: 21, marginTop: 6 },

  card: { flex: 1, backgroundColor: colors.bg, borderRadius: 22, marginHorizontal: 22, marginTop: 16, marginBottom: 40, paddingHorizontal: 12, paddingTop: 20 },
  tabs: { marginBottom: 20 },
  tabTxt: { fontFamily: fonts.semibold, fontSize: 12, lineHeight: 16 },

  label: { fontFamily: fonts.semibold, color: colors.text, fontSize: 16, marginBottom: 6 },
  hint: { fontFamily: fonts.regular, color: colors.textMuted, fontSize: 13, lineHeight: 18, marginBottom: 8 },
  advancedBtn: { alignSelf: 'center', marginTop: 22, marginBottom: 22 },
  advanced: { fontFamily: fonts.semibold, color: colors.orangeDeep, fontSize: 15, textAlign: 'center', textDecorationLine: 'underline' },
  dropdown: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.track, borderRadius: 12, height: 48, paddingHorizontal: 14 },
  dropdownValue: { flex: 1, fontFamily: fonts.regular, fontSize: 15, color: colors.text },
  dropdownTag: { fontFamily: fonts.medium, fontSize: 13, color: colors.textMuted, marginLeft: 8 },
  selectBtn: { marginTop: 18 },

  thinkingWrap: { alignItems: 'center', gap: 10, marginTop: 50 },
  thinking: { fontFamily: fonts.semibold, fontSize: 15, color: colors.text, textAlign: 'center' },
  suggestNote: { fontFamily: fonts.regular, fontSize: 12.5, color: colors.orangeDeep, marginLeft: 6, marginBottom: 10 },
  suggestRow: { flexDirection: 'row', gap: 12, backgroundColor: colors.cream, borderRadius: 14, padding: 10, marginBottom: 10 },
  suggestImg: { width: 72, height: 72, borderRadius: 12, backgroundColor: colors.orangeLight },
  suggestHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 3 },
  suggestName: { flexShrink: 1, fontFamily: fonts.semibold, fontSize: 15, color: colors.text },
  fitChip: { backgroundColor: colors.orangeLight, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2 },
  fitTxt: { fontFamily: fonts.semibold, fontSize: 11, color: colors.text },
  suggestReason: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.text },
  suggestWatch: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 16, color: colors.textMuted, marginTop: 3 },
  compat: { fontFamily: fonts.semibold, fontSize: 16, color: colors.text, marginTop: 18, marginLeft: 6 },
  bias: { fontFamily: fonts.regular, fontSize: 12.5, color: colors.textMuted, marginTop: 4, marginLeft: 6, marginBottom: 14 },
  facts: { backgroundColor: colors.cream, borderRadius: 12, padding: 12, marginTop: 10 },
  factsHead: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 },
  factsImg: { width: 48, height: 48, borderRadius: 10, backgroundColor: colors.orangeLight },
  factsName: { fontFamily: fonts.semibold, fontSize: 16, color: colors.text },
  factsTraits: { fontFamily: fonts.regular, fontSize: 13, color: colors.textMuted, marginTop: 2, textTransform: 'none' },
  factRow: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.text, marginTop: 2 },
  factKey: { fontFamily: fonts.semibold },
  factDesc: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.text, marginBottom: 4 },
  biasNote: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 16, color: colors.textMuted, marginTop: 8 },
});
