// Profile — personal details and the household questionnaire, each unlocked for
// editing with its pencil button, plus data controls (Delete All Data / Log Out).
// No real auth in this prototype, so the password field is display-only.

import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AvatarButton, Field, JoinedButtons, TopBar } from '../components/kit';
import { HouseholdForm } from '../components/HouseholdForm';
import { EditIcon } from '../components/icons';
import { SwipeUpNav } from '../components/SwipeUpNav';
import { colors, fonts } from '../theme';
import { useSession } from '../store/session';
import type { ScreenProps } from '../navigation';

export default function ProfileScreen({ navigation }: ScreenProps<'Profile'>) {
  const profile = useSession((s) => s.profile);
  const setProfile = useSession((s) => s.setProfile);
  const household = useSession((s) => s.household);
  const setHousehold = useSession((s) => s.setHousehold);
  const resetAll = useSession((s) => s.resetAll);

  const [editDetails, setEditDetails] = useState(false);
  const [editHousehold, setEditHousehold] = useState(false);
  const [name, setName] = useState(profile.name);
  const [email, setEmail] = useState(profile.email);

  const toggleDetails = () => {
    if (editDetails) setProfile({ name: name.trim(), email: email.trim() });
    setEditDetails(!editDetails);
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
        <TopBar onBack={() => navigation.goBack()} right={<AvatarButton ring />} style={styles.topBar} />

        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <View style={styles.titleRow}>
              <Text style={styles.h1}>Personal Details</Text>
              <Pressable onPress={toggleDetails} hitSlop={10} style={styles.pencil}>
                <EditIcon size={22} color={editDetails ? colors.orange : colors.text} />
              </Pressable>
            </View>

            <View style={styles.row}>
              <Field label="Name" variant="white" value={name} onChangeText={setName} editable={editDetails} autoCapitalize="words" style={{ flex: 0.66 }} />
              <Field label="Email" variant="white" value={email} onChangeText={setEmail} editable={editDetails} autoCapitalize="none" keyboardType="email-address" style={{ flex: 1 }} />
            </View>
            <Field label="Password" variant="white" value="••••••••" editable={false} style={{ marginTop: 20 }} />

            <View style={[styles.titleRow, { marginTop: 28 }]}>
              <Text style={styles.h1}>Household Questionnaire</Text>
              <Pressable onPress={() => setEditHousehold(!editHousehold)} hitSlop={10} style={styles.pencil}>
                <EditIcon size={22} color={editHousehold ? colors.orange : colors.text} />
              </Pressable>
            </View>
            <View style={styles.card}>
              <HouseholdForm value={household} onChange={setHousehold} disabled={!editHousehold} compact />
            </View>

            <JoinedButtons
              left={{ label: 'Delete All Data', onPress: deleteAll }}
              right={{ label: 'Log Out', onPress: logout }}
              leftBg={colors.danger}
              height={40}
              style={styles.controls}
            />
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
      <SwipeUpNav
        onSpaces={() => navigation.navigate('Home')}
        onCapture={() => navigation.navigate('Capture', { fresh: true })}
        onHelp={() => Alert.alert('Profile', 'Tap a pencil to edit that section. Changes save straight away.')}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg2 },
  topBar: { paddingHorizontal: 22, paddingTop: 6 },
  body: { paddingHorizontal: 22, paddingTop: 4, paddingBottom: 60 },
  titleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  h1: { fontFamily: fonts.bold, color: colors.text, fontSize: 20 },
  pencil: { marginLeft: 14 },
  row: { flexDirection: 'row', gap: 10 },
  card: { backgroundColor: colors.bg, borderRadius: 22, paddingHorizontal: 19, paddingVertical: 18 },
  controls: { marginTop: 30 },
});
