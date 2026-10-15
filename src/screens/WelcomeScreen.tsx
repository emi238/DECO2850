// Stage 0 — Welcome. Orange hero with the peeking dog over a white panel.

import React, { useCallback, useRef } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { View, Text, Image, StyleSheet, Animated, PanResponder, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

import { colors, fonts } from '../theme';
import { IMAGES } from '../assets';
import type { ScreenProps } from '../navigation';

// "Get Started" is a slide-to-unlock: drag the paw to the right end of the pill.
const TRACK_W = 181;
const KNOB = 47;
const MAX_X = TRACK_W - KNOB;

function SlideToStart({ onUnlock }: { onUnlock: () => void }) {
  const x = useRef(new Animated.Value(0)).current;
  const unlockRef = useRef(onUnlock);
  unlockRef.current = onUnlock;

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderMove: (_e, g) => x.setValue(Math.min(Math.max(g.dx, 0), MAX_X)),
      onPanResponderRelease: (_e, g) => {
        if (g.dx > MAX_X * 0.8) {
          // Far enough: snap to the end, then go.
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
          Animated.timing(x, { toValue: MAX_X, duration: 120, useNativeDriver: true }).start(() => unlockRef.current());
        } else if (Math.abs(g.dx) < 4) {
          // A tap: nudge the paw right to show it slides.
          Animated.sequence([
            Animated.timing(x, { toValue: 28, duration: 180, useNativeDriver: true }),
            Animated.spring(x, { toValue: 0, bounciness: 10, useNativeDriver: true }),
          ]).start();
        } else {
          Animated.spring(x, { toValue: 0, bounciness: 6, useNativeDriver: true }).start();
        }
      },
      onPanResponderTerminate: () => Animated.spring(x, { toValue: 0, useNativeDriver: true }).start(),
    })
  ).current;

  // Back on this screen (e.g. after Back from Sign Up): paw returns to the start.
  useFocusEffect(useCallback(() => x.setValue(0), [x]));

  const labelOpacity = x.interpolate({ inputRange: [0, MAX_X * 0.6], outputRange: [1, 0], extrapolate: 'clamp' });

  return (
    <View
      style={styles.cta}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel="Slide to get started"
      accessibilityActions={[{ name: 'activate' }]}
      onAccessibilityAction={() => unlockRef.current()}
    >
      <Animated.Text style={[styles.ctaTxt, { opacity: labelOpacity }]}>Get Started</Animated.Text>
      <Animated.View style={[styles.ctaCircle, { transform: [{ translateX: x }] }]} {...pan.panHandlers}>
        <Image source={IMAGES.pawOutline} style={styles.ctaPaw} resizeMode="contain" />
      </Animated.View>
    </View>
  );
}

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
            <SlideToStart onUnlock={() => navigation.navigate('CreateAccount')} />
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
    justifyContent: 'center',
    backgroundColor: colors.orange,
    borderRadius: 999,
    height: KNOB,
    width: TRACK_W,
  },
  ctaCircle: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: KNOB,
    height: KNOB,
    borderRadius: KNOB / 2,
    backgroundColor: colors.bg,
    borderWidth: 2,
    borderColor: colors.orange,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaPaw: { width: 30, height: 30 },
  ctaTxt: { fontFamily: fonts.semibold, color: colors.text, fontSize: 17, marginLeft: KNOB + 20 },
});
