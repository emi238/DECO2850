// Full-screen 3D room (reached from the onboarding Results "View in 3D"). The
// Home hub shows the same 3D inline via its 2D/3D toggle.

import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '../components/Button';
import { Room3DView } from '../components/Room3DView';
import { colors, spacing, font, radius } from '../theme';
import { useCurrentSpace } from '../store/session';
import type { ScreenProps } from '../navigation';

export default function Room3DScreen({ navigation }: ScreenProps<'Room3D'>) {
  const space = useCurrentSpace();
  const result = space?.result ?? null;

  if (!result) {
    return (
      <View style={styles.root}>
        <SafeAreaView style={styles.center} edges={['top', 'bottom']}>
          <Text style={styles.msg}>No assessment yet — analyse this space first.</Text>
          <Button label="Back" onPress={() => navigation.goBack()} style={{ marginTop: spacing.lg }} />
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.headerBar} edges={['top']}>
        <View style={styles.header}>
          <Pressable style={styles.pill} onPress={() => navigation.goBack()}>
            <Text style={styles.pillTxt}>‹ Back</Text>
          </Pressable>
          <View style={styles.pillGhost}>
            <Text style={styles.pillGhostTxt}>3D room · generated</Text>
          </View>
        </View>
      </SafeAreaView>
      <Room3DView result={result} frameCount={space!.capture.frames.length} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.lg, padding: spacing.xl },
  msg: { color: colors.textMuted, fontSize: font.body, textAlign: 'center' },
  headerBar: { backgroundColor: colors.bg },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.sm },
  pill: { backgroundColor: 'rgba(23,26,32,0.85)', borderWidth: 1, borderColor: colors.border, paddingHorizontal: 14, paddingVertical: 9, borderRadius: radius.pill },
  pillTxt: { color: colors.text, fontSize: font.body, fontWeight: '700' },
  pillGhost: { backgroundColor: 'rgba(23,26,32,0.6)', paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.pill },
  pillGhostTxt: { color: colors.textMuted, fontSize: font.tiny, fontWeight: '600' },
});
