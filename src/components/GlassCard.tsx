// Frosted "liquid glass" panel (PRD §9): a blurred translucent surface with a
// soft border and rounded corners, floating over the room imagery.

import React from 'react';
import { View, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { BlurView } from 'expo-blur';
import { colors, radius } from '../theme';

export function GlassCard({
  children,
  style,
  intensity = 32,
  padded = true,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  intensity?: number;
  padded?: boolean;
}) {
  return (
    <View style={[styles.wrap, style]}>
      <BlurView intensity={intensity} tint="dark" style={StyleSheet.absoluteFill} />
      <View style={[styles.fill, padded && styles.padded]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'rgba(20,23,29,0.35)',
  },
  fill: {
    backgroundColor: colors.surface,
  },
  padded: {
    padding: 16,
  },
});
