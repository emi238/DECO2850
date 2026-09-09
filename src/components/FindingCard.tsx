// Compact finding card (PRD F6.2): title, severity, why it matters, the fix.

import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { GlassCard } from './GlassCard';
import { colors, spacing, font, radius, severityColor } from '../theme';
import { CATEGORY_LABELS } from '../ai/categories';
import type { Hazard } from '../types';

export function FindingCard({
  hazard,
  number,
  onClose,
}: {
  hazard: Hazard;
  number?: number;
  onClose?: () => void;
}) {
  const sev = severityColor(hazard.severity);
  return (
    <GlassCard intensity={60} style={styles.card}>
      <View style={styles.head}>
        <View style={[styles.badge, { backgroundColor: sev }]}>
          <Text style={styles.badgeTxt}>{number ?? '•'}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{hazard.title}</Text>
          <Text style={styles.meta}>
            {CATEGORY_LABELS[hazard.category]} · {hazard.severity.toUpperCase()} · risk to{' '}
            {hazard.risk_to}
          </Text>
        </View>
        {onClose && (
          <Pressable onPress={onClose} hitSlop={10} style={styles.close}>
            <Text style={styles.closeTxt}>×</Text>
          </Pressable>
        )}
      </View>

      {!!hazard.why_it_matters && (
        <Text style={styles.body}>
          <Text style={styles.lead}>Why it matters  </Text>
          {hazard.why_it_matters}
        </Text>
      )}
      {!!hazard.recommendation && (
        <View style={[styles.fix, { borderLeftColor: sev }]}>
          <Text style={styles.fixTxt}>
            <Text style={styles.lead}>Fix  </Text>
            {hazard.recommendation}
          </Text>
        </View>
      )}
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  card: { padding: spacing.lg, gap: spacing.md },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  badge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  badgeTxt: { color: '#fff', fontWeight: '800', fontSize: font.small },
  title: { color: colors.text, fontSize: font.h3, fontWeight: '700' },
  meta: { color: colors.textMuted, fontSize: font.tiny, marginTop: 3, textTransform: 'capitalize' },
  close: { paddingHorizontal: 6 },
  closeTxt: { color: colors.textMuted, fontSize: 24, lineHeight: 26 },
  body: { color: colors.textMuted, fontSize: font.small, lineHeight: 20 },
  lead: { color: colors.text, fontWeight: '700', fontSize: font.tiny },
  fix: {
    borderLeftWidth: 3,
    paddingLeft: spacing.md,
    paddingVertical: 4,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: radius.sm,
  },
  fixTxt: { color: colors.text, fontSize: font.small, lineHeight: 20 },
});
