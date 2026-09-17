// Profile — personal details and the household questionnaire, each unlocked for
// editing with its pencil button. Nothing is stored until "Save changes" is tapped.
// Also data controls (Delete All Data / Log Out).
// No real auth in this prototype, so the password field is display-only.

import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AvatarButton, Field, JoinedButtons, PrimaryButton, TopBar } from '../components/kit';
import { HouseholdForm } from '../components/HouseholdForm';
import { EditIcon } from '../components/icons';
import { SwipeUpNav } from '../components/SwipeUpNav';
import { colors, fonts } from '../theme';
import { useSession } from '../store/session';
import type { ScreenProps } from '../navigation';
import type { Questionnaire } from '../types';

export default function ProfileScreen({ navigation, route }: ScreenProps<'Profile'>) {
  const profile = useSession((s) => s.profile);
  const setProfile = useSession((s) => s.setProfile);
  const household = useSession((s) => s.household);
  const setHousehold = useSession((s) => s.setHousehold);
  const resetAll = useSession((s) => s.resetAll);

  const [editDetails, setEditDetails] = useState(false);
  const openHousehold = !!route.params?.editHousehold;
  const [editHousehold, setEditHousehold] = useState(openHousehold);
  // Opened from Home's "Has your living situation changed?": scroll to the questionnaire.
  const scrollRef = useRef<ScrollView>(null);
  const scrolled = useRef(false);
  const onHouseholdLayout = (y: number) => {
    if (!openHousehold || scrolled.current) return;
    scrolled.current = true;
    requestAnimationFrame(() => scrollRef.current?.scrollTo({ y: Math.max(0, y - 8), animated: true }));
  };
  const [name, setName] = useState(profile.name);
  const [email, setEmail] = useState(profile.email);
  const [draft, setDraft] = useState<Questionnaire>({ ...household });

  const dirty =
    name.trim() !== profile.name ||
    email.trim() !== profile.email ||
    JSON.stringify(draft) !== JSON.stringify(household);

  const save = () => {
    setProfile({ name: name.trim(), email: email.trim() });
    setHousehold(draft);
    setEditDetails(false);
    setEditHousehold(false);
    Alert.alert('Saved', 'Your details and household answers are updated.');
  };

  // Leaving with unsaved edits asks first.
  const back = () => {
    if (!dirty) return navigation.goBack();
    Alert.alert('Discard changes?', 'You have unsaved changes.', [
      { text: 'Keep editing', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: () => navigation.goBack() },
    ]);
  };

  const deleteAll = () => {
    Alert.alert('Delete all data?', 'This removes your spaces, profile and household answers from this device.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          resetAll();
          navigation.reset({ index: 0, routes: [{ name: 'Welcome' }] });
        },
      },
    ]);
  };
  const logout = () => navigation.reset({ index: 0, routes: [{ name: 'Welcome' }] });

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        <TopBar onBack={back} right={<AvatarButton ring />} style={styles.topBar} />

        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView ref={scrollRef} contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <View style={[styles.titleRow, { marginTop: 14 }]}>
              <Text style={styles.h1}>Personal Details</Text>
              <Pressable onPress={() => setEditDetails(!editDetails)} hitSlop={10} style={styles.pencil}>
                <EditIcon size={22} color={editDetails ? colors.orange : colors.text} />
              </Pressable>
            </View>

            <View style={styles.row}>
              <Field label="Name" variant="white" value={name} onChangeText={setName} editable={editDetails} autoCapitalize="words" style={{ flex: 0.66 }} />
              <Field label="Email" variant="white" value={email} onChangeText={setEmail} editable={editDetails} autoCapitalize="none" keyboardType="email-address" style={{ flex: 1 }} />
            </View>
            <Field label="Password" variant="white" value="••••••••" editable={false} style={{ marginTop: 16 }} />

            <View style={[styles.titleRow, { marginTop: 32 }]} onLayout={(e) => onHouseholdLayout(e.nativeEvent.layout.y)}>
              <Text style={styles.h1}>Household Questionnaire</Text>
              <Pressable onPress={() => setEditHousehold(!editHousehold)} hitSlop={10} style={styles.pencil}>
                <EditIcon size={22} color={editHousehold ? colors.orange : colors.text} />
              </Pressable>
            </View>
            <View style={styles.card}>
              <HouseholdForm value={draft} onChange={(p) => setDraft((d) => ({ ...d, ...p }))} disabled={!editHousehold} compact />
            </View>

            <PrimaryButton label="Save changes" onPress={save} disabled={!dirty} style={styles.save} />

            <JoinedButtons
              left={{ label: 'Delete All Data', onPress: deleteAll }}
              right={{ label: 'Log Out', onPress: logout }}
              leftBg={colors.danger}
              style={styles.controls}
            />
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
      <SwipeUpNav
        onSpaces={() => navigation.navigate('Home')}
        onCapture={() => navigation.navigate('Capture', { fresh: true })}
        onHelp={() => Alert.alert('Profile', 'Tap a pencil to edit that section, then tap Save changes.')}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg2 },
  topBar: { paddingHorizontal: 22, paddingTop: 6 },
  body: { paddingHorizontal: 22, paddingTop: 0, paddingBottom: 120 },
  titleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  h1: { fontFamily: fonts.bold, color: colors.text, fontSize: 20 },
  pencil: { marginLeft: 14 },
  row: { flexDirection: 'row', gap: 12 },
  card: { backgroundColor: colors.bg, borderRadius: 22, paddingHorizontal: 19, paddingVertical: 18 },
  save: { marginTop: 24 },
  controls: { marginTop: 16 },
});
