// Home walkthrough: dims the screen, cuts a highlighted window around one part of
// Home at a time and explains it in a white card underneath (or above, for things
// low on the screen). Shown once after onboarding, and again from the Help button.
// Home measures each part and passes its on-screen box in as `target`.

import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, Animated, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { PrimaryButton, JoinedButtons } from './kit';
import { colors, fonts } from '../theme';

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface TourStep<K extends string = string> {
  key: K;
  title: string;
  body: string;
}

const PAD = 10; // space between the highlighted part and the orange outline
const DIM = 'rgba(36,30,24,0.62)';
const SIDE = 22;

export function HomeTour({
  steps,
  index,
  target,
  onNext,
  onBack,
  onSkip,
  onReplay,
}: {
  steps: TourStep[];
  index: number;
  target: Box | null; // null while Home scrolls to the next part
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
  onReplay: () => void;
}) {
  const { width: W, height: H } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    fade.setValue(0);
    if (target) Animated.timing(fade, { toValue: 1, duration: 220, useNativeDriver: true }).start();
  }, [target, fade]);

  const step = steps[index];
  const last = index === steps.length - 1;

  if (!target) return <View style={[StyleSheet.absoluteFill, { backgroundColor: DIM }]} />;

  // The window, padded and kept on screen.
  const hole = {
    x: Math.max(4, target.x - PAD),
    y: Math.max(4, target.y - PAD),
    w: Math.min(W - 8, target.width + PAD * 2),
    h: target.height + PAD * 2,
  };
  const holeBottom = hole.y + hole.h;
  // Round parts (the profile button) get a round window; everything else a rounded box.
  const r = Math.abs(hole.w - hole.h) < 4 ? hole.h / 2 : 16;
  // The card goes under the highlight when it's in the top half, otherwise above it.
  const below = hole.y + hole.h / 2 < H / 2;
  const arrowX = Math.min(Math.max(hole.x + hole.w / 2 - SIDE - 8, 18), W - SIDE * 2 - 34);

  return (
    <View style={StyleSheet.absoluteFill}>
      {/* Dim layer: the whole screen with a rounded hole cut out (even-odd fill). The
          View around it catches every tap, so nothing on Home is pressed by accident. */}
      <View style={StyleSheet.absoluteFill}>
        <Svg width={W} height={H}>
          <Path fill={DIM} fillRule="evenodd" d={`M0 0H${W}V${H}H0Z ${roundRect(hole.x, hole.y, hole.w, hole.h, r)}`} />
        </Svg>
      </View>

      <Animated.View
        pointerEvents="none"
        style={[styles.outline, { left: hole.x, top: hole.y, width: hole.w, height: hole.h, borderRadius: r, opacity: fade }]}
      />

      <Animated.View
        style={[
          styles.card,
          { opacity: fade },
          below ? { top: holeBottom + 16 } : { bottom: Math.max(H - hole.y + 16, insets.bottom + 16) },
        ]}
      >
        <View style={[styles.arrow, below ? { top: -7 } : { bottom: -7 }, { left: arrowX }]} />

        <View style={styles.progress} accessibilityLabel={`Step ${index + 1} of ${steps.length}`}>
          {steps.map((_, i) => (
            <View key={i} style={[styles.bar, i <= index && styles.barOn]} />
          ))}
        </View>
        <View style={styles.metaRow}>
          <Text style={styles.count}>
            {index + 1} of {steps.length}
          </Text>
          {!last && (
            <Pressable onPress={onSkip} hitSlop={10}>
              <Text style={styles.skip}>Skip tour</Text>
            </Pressable>
          )}
        </View>
        <Text style={styles.title}>{step.title}</Text>
        <Text style={styles.body}>{step.body}</Text>

        {last ? (
          <JoinedButtons
            style={styles.actions}
            leftBg={colors.track}
            left={{ label: 'Replay tour', onPress: onReplay }}
            right={{ label: 'Get started', onPress: onNext }}
          />
        ) : (
          <View style={[styles.actions, styles.row]}>
            {index > 0 && (
              <PrimaryButton label="Back" onPress={onBack} style={[styles.backBtn, { backgroundColor: colors.track }]} />
            )}
            <PrimaryButton label="Next" onPress={onNext} style={styles.nextBtn} />
          </View>
        )}
      </Animated.View>
    </View>
  );
}

function roundRect(x: number, y: number, w: number, h: number, r: number): string {
  return `M${x + r} ${y}H${x + w - r}A${r} ${r} 0 0 1 ${x + w} ${y + r}V${y + h - r}A${r} ${r} 0 0 1 ${x + w - r} ${y + h}H${x + r}A${r} ${r} 0 0 1 ${x} ${y + h - r}V${y + r}A${r} ${r} 0 0 1 ${x + r} ${y}Z`;
}

const styles = StyleSheet.create({
  outline: { position: 'absolute', borderWidth: 3, borderColor: colors.orange },
  card: {
    position: 'absolute',
    left: SIDE,
    right: SIDE,
    backgroundColor: colors.bg,
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
  },
  arrow: { position: 'absolute', width: 14, height: 14, backgroundColor: colors.bg, transform: [{ rotate: '45deg' }] },
  progress: { flexDirection: 'row', gap: 5 },
  bar: { flex: 1, height: 6, borderRadius: 3, backgroundColor: colors.track },
  barOn: { backgroundColor: colors.orange },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 },
  count: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.textMuted },
  skip: { fontFamily: fonts.medium, fontSize: 12, color: colors.orangeDeep },
  title: { fontFamily: fonts.bold, fontSize: 20, color: colors.text, marginTop: 4 },
  body: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 21, color: colors.text, marginTop: 6 },
  actions: { marginTop: 18 },
  row: { flexDirection: 'row', gap: 12 },
  backBtn: { width: '38%' },
  nextBtn: { flex: 1 },
});
