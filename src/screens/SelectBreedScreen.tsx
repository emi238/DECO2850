// Select breed (spec Stage 5). Two tabs:
//  • "I have a dog breed in mind" — search the breed catalogue (The Dog API when
//    a key is set, else the 3 built-ins), or "Not sure / mixed breed" with a
//    size; energy level can be adjusted. Shows the breed's facts + bias note.
//  • "Explore breeds for my space" — ranks every catalogue breed against this
//    space with the §4 logic and shows the best fits (no scores).
// Choosing a breed attaches it to the space and returns to the analysis report.

import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Image, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { TopBar, Segmented, PrimaryButton } from '../components/kit';
import { OptionSheet } from '../components/OptionSheet';
import { colors, fonts } from '../theme';
import { useSession, useCurrentSpace } from '../store/session';
import { ENERGY_OPTIONS, MIXED_ID, SIZE_OPTIONS, findBreed, useBreedCatalogue, type BreedProfile, type Energy, type SizeClass } from '../logic/breeds';
import { rankBreeds } from '../logic/evaluate';
import type { ScreenProps } from '../navigation';

type Tab = 'in_mind' | 'explore';

export default function SelectBreedScreen({ navigation }: ScreenProps<'SelectBreed'>) {
  const space = useCurrentSpace();
  const household = useSession((s) => s.household);
  const setPet = useSession((s) => s.setPet);
  const setMode = useSession((s) => s.setMode);
  const { width } = useWindowDimensions();
  const { breeds, loading } = useBreedCatalogue();

  const current = space?.pet ?? null;
  const currentBreed = findBreed(current?.breed);

  const [tab, setTab] = useState<Tab>(space?.mode === 'explore' ? 'explore' : 'in_mind');
  const [breedId, setBreedId] = useState<string | null>(currentBreed?.id ?? (current?.breed ? MIXED_ID : null));
  const [energy, setEnergy] = useState<Energy | null>(current?.energy ?? currentBreed?.energy ?? null);
  const [size, setSize] = useState<SizeClass | null>(current?.size ?? currentBreed?.size ?? null);
  const [picker, setPicker] = useState<'breed' | 'energy' | 'size' | null>(null);
  const [thinking, setThinking] = useState(true);

  const breed = breedId && breedId !== MIXED_ID ? breeds.find((b) => b.id === breedId) ?? findBreed(breedId) : undefined;

  // Once the full catalogue loads, re-link a previously saved breed by name.
  useEffect(() => {
    if (breedId || !current?.breed || current.breed === 'Mixed breed') return;
    const b = findBreed(current.breed);
    if (b) setBreedId(b.id);
  }, [breeds, breedId, current?.breed]);
  const mixed = breedId === MIXED_ID;

  // Explore tab: a short "thinking......" beat before the ranked cards appear.
  useEffect(() => {
    if (tab !== 'explore') return;
    setThinking(true);
    const t = setTimeout(() => setThinking(false), 1400);
    return () => clearTimeout(t);
  }, [tab]);

  // Show the six best fits (the Figma has six card slots).
  const ranked = useMemo(() => (space ? rankBreeds(space, household, breeds).slice(0, 6) : []), [space, household, breeds]);

  const pickBreed = (id: string) => {
    setBreedId(id);
    const b = breeds.find((x) => x.id === id);
    if (b) {
      setEnergy(b.energy);
      setSize(b.size);
    }
  };

  const done = () => navigation.popTo('Analysis', { report: true });

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

  // screen − card margins (44) − card padding (36) − grid padding (12) − 2 gaps (24)
  const cardW = Math.floor((width - 44 - 36 - 12 - 2 * 12) / 3);

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
            height={26}
            activeColor={colors.orange}
            style={styles.tabs}
            textStyle={styles.tabTxt}
          />

          {tab === 'in_mind' ? (
            <ScrollView contentContainerStyle={{ paddingBottom: 30 }} showsVerticalScrollIndicator={false}>
              <Text style={styles.label}>Browse breeds:</Text>
              <Dropdown
                value={breed?.name ?? (mixed ? 'Not sure / mixed breed' : '')}
                placeholder={loading ? 'Loading breeds…' : `Search ${breeds.length} breeds`}
                onPress={() => setPicker('breed')}
              />
              {breed && <BreedFacts breed={breed} />}

              <Text style={styles.advanced}>Advanced search for pets already in mind</Text>

              <Text style={styles.label}>Energy Levels:</Text>
              <Text style={styles.hint}>
                “Low, happy to mostly relax” / “Moderate, regular play and movement” / “High, needs to run or climb often”
              </Text>
              <Dropdown value={ENERGY_OPTIONS.find((o) => o.value === energy)?.label ?? ''} placeholder="Choose an energy level" onPress={() => setPicker('energy')} />

              <Text style={[styles.label, { marginTop: 18 }]}>Size:</Text>
              <Text style={styles.hint}>Small, under 12kg / Medium, 12-25kg / Large, over 25kg</Text>
              <Dropdown
                value={SIZE_OPTIONS.find((o) => o.value === size)?.label ?? ''}
                placeholder={breed ? 'Set by the breed' : 'Choose a size'}
                disabled={!!breed}
                onPress={() => setPicker('size')}
              />

              <PrimaryButton
                label="Select Breed"
                onPress={confirmInMind}
                disabled={!breedId || (mixed && !size)}
                style={styles.selectBtn}
                textStyle={{ fontSize: 12.5 }}
              />
            </ScrollView>
          ) : (
            <ScrollView contentContainerStyle={{ paddingBottom: 30 }} showsVerticalScrollIndicator={false}>
              {thinking ? (
                <Text style={styles.thinking}>thinking......</Text>
              ) : (
                <>
                  <Text style={styles.compat}>Compatible breeds with your space</Text>
                  <Text style={styles.bias}>
                    Breed only explains part of an individual dog’s behaviour, so treat these as a starting point.
                  </Text>
                  <View style={styles.grid}>
                    {ranked.map(({ breed: b, summary }) => (
                      <Pressable key={b.id} onPress={() => chooseSuggested(b)} style={{ width: cardW }}>
                        <View style={[styles.breedCard, { width: cardW, height: Math.round(cardW * 1.8) }]}>
                          <Text style={styles.breedName}>{b.name}</Text>
                          <Image
                            source={b.sitting}
                            style={b.cutout ? styles.breedImg : styles.breedPhoto}
                            resizeMode={b.cutout ? 'contain' : 'cover'}
                          />
                        </View>
                        <Text style={styles.breedFit}>{summary}</Text>
                      </Pressable>
                    ))}
                  </View>
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
  topBar: { paddingHorizontal: 25, paddingTop: 6 },
  titles: { paddingHorizontal: 32 },
  h1: { fontFamily: fonts.bold, color: colors.text, fontSize: 20, marginTop: -2 },
  sub: { fontFamily: fonts.regular, color: colors.text, fontSize: 15, marginTop: 4 },

  card: { flex: 1, backgroundColor: colors.bg, borderRadius: 22, marginHorizontal: 22, marginTop: 12, marginBottom: 40, paddingHorizontal: 18, paddingTop: 20 },
  tabs: { marginBottom: 20 },
  tabTxt: { fontFamily: fonts.medium, fontSize: 10.5 },

  label: { fontFamily: fonts.semibold, color: colors.text, fontSize: 11, marginBottom: 5 },
  hint: { fontFamily: fonts.regular, color: colors.text, fontSize: 8.5, lineHeight: 11, marginBottom: 6 },
  advanced: { fontFamily: fonts.semibold, color: colors.text, fontSize: 11, textAlign: 'center', marginTop: 18, marginBottom: 18 },
  dropdown: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.track, borderRadius: 12, height: 34, paddingHorizontal: 14 },
  dropdownValue: { flex: 1, fontFamily: fonts.regular, fontSize: 12, color: colors.text },
  dropdownTag: { fontFamily: fonts.regular, fontSize: 11, color: colors.text, marginLeft: 8 },
  selectBtn: { alignSelf: 'flex-end', height: 25, borderRadius: 12, marginTop: 11, paddingHorizontal: 16 },

  thinking: { fontFamily: fonts.semibold, fontSize: 10, color: colors.text, textAlign: 'center', marginTop: 50 },
  compat: { fontFamily: fonts.medium, fontSize: 15, color: colors.text, marginTop: 18, marginLeft: 6 },
  bias: { fontFamily: fonts.regular, fontSize: 9.5, color: colors.textMuted, marginTop: 4, marginLeft: 6, marginBottom: 14 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingHorizontal: 6 },
  breedCard: { backgroundColor: colors.orangeLight, borderRadius: 10, overflow: 'hidden', alignItems: 'center', paddingTop: 8 },
  breedName: { fontFamily: fonts.semibold, fontSize: 10, color: colors.text, textAlign: 'center', paddingHorizontal: 4 },
  breedImg: { flex: 1, width: '92%', marginTop: 4 },
  breedPhoto: { flex: 1, width: '100%', marginTop: 6 },
  facts: { backgroundColor: colors.cream, borderRadius: 12, padding: 12, marginTop: 10 },
  factsHead: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 },
  factsImg: { width: 48, height: 48, borderRadius: 10, backgroundColor: colors.orangeLight },
  factsName: { fontFamily: fonts.semibold, fontSize: 14, color: colors.text },
  factsTraits: { fontFamily: fonts.regular, fontSize: 11, color: colors.textMuted, marginTop: 2, textTransform: 'none' },
  factRow: { fontFamily: fonts.regular, fontSize: 11.5, lineHeight: 16, color: colors.text, marginTop: 2 },
  factKey: { fontFamily: fonts.semibold },
  biasNote: { fontFamily: fonts.regular, fontSize: 10, lineHeight: 14, color: colors.textMuted, marginTop: 8 },
  breedFit: { fontFamily: fonts.regular, fontSize: 8.5, lineHeight: 11, color: colors.text, marginTop: 5 },
});
