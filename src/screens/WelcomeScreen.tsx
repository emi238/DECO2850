// Stage 0 — Welcome. Orange hero with the peeking dog over a white panel.

import React from 'react';
import { View, Text, Image, StyleSheet, Pressable, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Logo } from '../components/Logo';
import { colors, fonts, spacing } from '../theme';
import { IMAGES } from '../assets';
import type { ScreenProps } from '../navigation';

export default function WelcomeScreen({ navigation }: ScreenProps<'Welcome'>) {
  const { width, height } = useWindowDimensions();
  const panelH = Math.round(height * 0.42);
  const dogW = Math.round(width * 0.66);
  const dogH = Math.round(dogW * 0.792); // welcome-dog aspect (1100x872)

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.top}>
        <Logo color={colors.orangeDeep} size={22} />
        <Text style={styles.title}>Discover your{'\n'}perfect dog{'\n'}match</Text>
      </SafeAreaView>

      {/* Peeking dog straddling the panel edge */}
      <View style={[styles.dog, { bottom: panelH - dogH * 0.18 }]} pointerEvents="none">
        <Image source={IMAGES.welcomeDog} resizeMode="contain" style={{ width: dogW, height: dogH }} />
      </View>

      {/* White panel */}
      <View style={[styles.panel, { height: panelH }]}>
        <SafeAreaView edges={['bottom']} style={styles.panelInner}>
          <Text style={styles.h2}>Design the purrfect space{'\n'}for your furry friend!</Text>
          <Text style={styles.body}>
            We tailor recommendations based on your space and unique needs.
          </Text>
          <View style={styles.btnRow}>
            <Pressable style={styles.cta} onPress={() => navigation.navigate('NewSpace', { first: true })}>
              <View style={styles.ctaCircle}>
                <Image source={IMAGES.paw} style={styles.ctaPaw} resizeMode="contain" />
              </View>
              <Text style={styles.ctaTxt}>Get Started</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.orange },
  top: { paddingHorizontal: spacing.xl, paddingTop: spacing.sm },
  title: {
    fontFamily: fonts.display,
    color: colors.text,
    fontSize: 40,
    lineHeight: 46,
    marginTop: spacing.xl,
  },
  dog: { position: 'absolute', alignSelf: 'center', zIndex: 2 },
  panel: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.bg,
    borderTopLeftRadius: 46,
    borderTopRightRadius: 30,
  },
  panelInner: { flex: 1, paddingHorizontal: spacing.xl, paddingTop: spacing.xl, justifyContent: 'center' },
  h2: { fontFamily: fonts.bold, color: colors.text, fontSize: 23, lineHeight: 29 },
  body: {
    fontFamily: fonts.regular,
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
    marginTop: spacing.md,
  },
  btnRow: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: spacing.xl },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.orange,
    borderRadius: 999,
    paddingLeft: 6,
    paddingRight: 22,
    height: 56,
  },
  ctaCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaPaw: { width: 24, height: 24, tintColor: colors.orange },
  ctaTxt: { fontFamily: fonts.bold, color: colors.accentText, fontSize: 17 },
});
