// F6 — Onboarding finale: run the assessment for the current space, show the 2D
// map with findings, then "Finish" into the Home hub.

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';

import { Screen } from '../components/Screen';
import { Button } from '../components/Button';
import { Space2DView } from '../components/Space2DView';
import { colors, spacing, font } from '../theme';
import { useSession, useCurrentSpace } from '../store/session';
import { runAssessment } from '../ai/assess';
import type { Assessment } from '../types';
import type { ScreenProps } from '../navigation';

export default function ResultsScreen({ navigation }: ScreenProps<'Results'>) {
  const space = useCurrentSpace();
  const setResult = useSession((s) => s.setResult);
  const setOnboarded = useSession((s) => s.setOnboarded);

  const [loading, setLoading] = useState(true);
  const [result, setLocalResult] = useState<Assessment | null>(null);
  const [source, setSource] = useState<'ai' | 'mock'>('mock');
  const [fallback, setFallback] = useState<string | undefined>();

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      const cur = useSession.getState().current();
      if (!cur) {
        setLoading(false);
        return;
      }
      const r = await runAssessment(cur);
      if (!alive) return;
      setLocalResult(r.assessment);
      setSource(r.source);
      setFallback(r.fallbackReason);
      setResult(r.assessment, r.source, r.fallbackReason);
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [setResult]);

  const finish = () => {
    setOnboarded(true);
    navigation.reset({ index: 0, routes: [{ name: 'Home' }] });
  };

  if (loading) {
    return (
      <Screen step={4}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={styles.title}>Reading the room…</Text>
          <Text style={styles.sub}>Checking hazards, fit, and improvements.</Text>
        </View>
      </Screen>
    );
  }

  if (!result || !space) {
    return (
      <Screen step={4} title="Something went wrong">
        <View style={styles.center}>
          <Text style={styles.sub}>The assessment could not be produced.</Text>
          <Button label="Go to Home" onPress={finish} style={{ marginTop: spacing.lg }} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen step={4}>
      <Space2DView
        frames={space.capture.frames}
        result={result}
        source={source}
        fallbackReason={fallback}
      />
      <View style={styles.footer}>
        <Button label="View in 3D" variant="secondary" onPress={() => navigation.navigate('Room3D')} style={{ flex: 1 }} />
        <Button label="Finish →" onPress={finish} style={{ flex: 1 }} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.xl },
  title: { color: colors.text, fontSize: font.h3, fontWeight: '700', marginTop: spacing.sm },
  sub: { color: colors.textMuted, fontSize: font.body, textAlign: 'center' },
  footer: { flexDirection: 'row', gap: spacing.md, paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.md },
});
