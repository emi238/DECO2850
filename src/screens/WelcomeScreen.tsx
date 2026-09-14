// Stage 0 — Welcome. Orange hero with the peeking dog over a white panel.

import React from 'react';
import { View, Text, Image, StyleSheet, Pressable, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, fonts } from '../theme';
import { IMAGES } from '../assets';
import type { ScreenProps } from '../navigation';

export default function WelcomeScreen({ navigation }: ScreenProps<'Welcome'>) {
  const { width, height } = useWindowDimensions();
  const panelH = Math.round(height * 0.35);
  const dogW = Math.round(width * 1.04); // image has transparent padding
  const dogH = Math.round(dogW * 0.792); // welcome-dog aspect (1100x872)

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.top}>
        <View style={styles.logoRow}>
          <Image source={IMAGES.paw} style={styles.logoPaw} resizeMode="contain" />
          <Text style={styles.logoWord}>PawSpace</Text>
        </View>
        <Text style={styles.title}>Discover your{'\n'}perfect dog{'\n'}match</Text>
      </SafeAreaView>

      {/* Peeking dog straddling the panel edge */}
      <View style={[styles.dog, { bottom: panelH - dogH * 0.37 }]} pointerEvents="none">
        <Image source={IMAGES.welcomeDog} resizeMode="contain" style={{ width: dogW, height: dogH }} />
      </View>

      {/* White panel */}
      <View style={[styles.panel, { height: panelH }]}>
        <SafeAreaView edges={['bottom']} style={styles.panelInner}>
          <Text style={styles.h2}>Design the purrfect space{'\n'}for your furry friend!</Text>
          <Text style={styles.body}>We tailor recommendations based on your{'\n'}space and unique needs</Text>
          <View style={styles.btnRow}>
            <Pressable style={({ pressed }) => [styles.cta, pressed && { opacity: 0.85 }]} onPress={() => navigation.navigate('CreateAccount')}>
              <View style={styles.ctaCircle}>
                <Image source={IMAGES.pawOutline} style={styles.ctaPaw} resizeMode="contain" />
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
  top: { paddingHorizontal: 20, paddingTop: 4 },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  logoPaw: { width: 46, height: 46, tintColor: colors.orangeDeep },
  logoWord: { fontFamily: fonts.display, fontSize: 23, color: colors.text },
  title: {
    fontFamily: fonts.display,
    color: colors.text,
    fontSize: 37,
    lineHeight: 50,
    marginTop: 18,
    marginLeft: 11,
  },
  dog: { position: 'absolute', left: -66, zIndex: 2 },
  panel: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.bg,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  panelInner: { flex: 1, paddingHorizontal: 29, paddingTop: 70 },
  h2: { fontFamily: fonts.semibold, color: colors.text, fontSize: 23, lineHeight: 35 },
  body: { fontFamily: fonts.regular, color: colors.text, fontSize: 15, lineHeight: 21, marginTop: 10 },
  btnRow: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 24, marginRight: 1 },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.orange,
    borderRadius: 999,
    paddingRight: 36,
    height: 47,
    width: 181,
  },
  ctaCircle: {
    width: 47,
    height: 47,
    borderRadius: 24,
    backgroundColor: colors.bg,
    borderWidth: 2,
    borderColor: colors.orange,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 20,
  },
  ctaPaw: { width: 30, height: 30 },
  ctaTxt: { fontFamily: fonts.semibold, color: colors.text, fontSize: 17 },
});
