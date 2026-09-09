// Shared screen shell: dark neutral background, safe areas, a step indicator,
// and a title/subtitle block. Keeps every step visually consistent (PRD §9).

import React from 'react';
import { View, Text, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, font } from '../theme';

export const STEPS = ['Capture', 'Pet', 'Household', 'Tag', 'Results'];

export function StepDots({ active }: { active: number }) {
  return (
    <View style={styles.dots}>
      {STEPS.map((label, i) => (
        <View key={label} style={styles.dotWrap}>
          <View
            style={[
              styles.dot,
              i === active && styles.dotActive,
              i < active && styles.dotDone,
            ]}
          />
        </View>
      ))}
    </View>
  );
}

export function Screen({
  step,
  title,
  subtitle,
  children,
  contentStyle,
  edges = ['top', 'bottom'],
}: {
  step?: number;
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
  edges?: ('top' | 'bottom' | 'left' | 'right')[];
}) {
  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safe} edges={edges}>
        {typeof step === 'number' && <StepDots active={step} />}
        {(title || subtitle) && (
          <View style={styles.header}>
            {title && <Text style={styles.title}>{title}</Text>}
            {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
          </View>
        )}
        <View style={[styles.content, contentStyle]}>{children}</View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  safe: { flex: 1 },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  dotWrap: {},
  dot: {
    width: 22,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  dotActive: { backgroundColor: colors.accent, width: 26 },
  dotDone: { backgroundColor: 'rgba(255,255,255,0.4)' },
  header: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  title: {
    color: colors.text,
    fontSize: font.h1,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: font.body,
    marginTop: 6,
    lineHeight: 21,
  },
  content: { flex: 1 },
});
