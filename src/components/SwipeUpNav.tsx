// Hidden bottom nav: an orange handle bar at the bottom that swipes/taps up to
// reveal three overlapping round actions (spaces, new space, help), then
// swipes/taps down to hide again. Home shows it open by default.

import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Animated, PanResponder } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { colors, fonts } from '../theme';
import { DoorIcon, UploadIcon, HelpIcon } from './icons';

export function SwipeUpNav({
  onSpaces,
  onCapture,
  onHelp,
  defaultOpen = false,
}: {
  onSpaces?: () => void;
  onCapture?: () => void;
  onHelp?: () => void;
  defaultOpen?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(defaultOpen);
  const anim = useRef(new Animated.Value(defaultOpen ? 1 : 0)).current;

  const set = (v: boolean) => {
    setOpen(v);
    Animated.spring(anim, { toValue: v ? 1 : 0, useNativeDriver: true, bounciness: 4 }).start();
  };
  const setRef = useRef(set);
  setRef.current = set;

  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dy) > 6,
      onPanResponderRelease: (_e, g) => {
        if (g.dy < -12) setRef.current(true);
        else if (g.dy > 12) setRef.current(false);
      },
    })
  ).current;

  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [100, 0] });
  const act = (fn?: () => void) => () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    fn?.();
  };
  const bottom = Math.max(insets.bottom - 14, 6);

  return (
    <View style={styles.wrap} pointerEvents="box-none" {...pan.panHandlers}>
      <Animated.View
        style={[styles.bar, { bottom, transform: [{ translateY }], opacity: anim }]}
        pointerEvents={open ? 'auto' : 'none'}
      >
        {/* Liquid-glass backdrop: blurred content behind + a faint white sheen and edge. */}
        <BlurView intensity={40} tint="systemUltraThinMaterialLight" style={styles.glass} pointerEvents="none" />
        <Pressable style={styles.item} onPress={act(onSpaces)} accessibilityLabel="Home">
          <View style={[styles.btn, styles.btnSide]}>
            <DoorIcon size={24} />
          </View>
          <Text style={styles.label}>Home</Text>
        </Pressable>
        <Pressable style={[styles.item, styles.itemMain]} onPress={act(onCapture)} accessibilityLabel="Upload">
          <View style={[styles.btn, styles.btnMain]}>
            <UploadIcon size={24} />
          </View>
          <Text style={styles.label}>Upload</Text>
        </Pressable>
        <Pressable style={styles.item} onPress={act(onHelp)} accessibilityLabel="Help">
          <View style={[styles.btn, styles.btnSide]}>
            <HelpIcon size={26} />
          </View>
          <Text style={styles.label}>Help</Text>
        </Pressable>
      </Animated.View>

      {!open && (
        <Pressable onPress={() => set(true)} hitSlop={18} style={[styles.handleHit, { bottom }]}>
          <View style={styles.handle} />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 130, alignItems: 'center' },
  handleHit: { position: 'absolute', paddingVertical: 10, paddingHorizontal: 20 },
  handle: { width: 156, height: 6, borderRadius: 3, backgroundColor: colors.orange },
  // One continuous bar: icons with their names underneath, no separate bubbles.
  bar: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 30,
    paddingVertical: 8,
    paddingHorizontal: 4,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.7)',
    backgroundColor: 'rgba(255,255,255,0.35)',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
  },
  glass: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  btn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  btnSide: {},
  btnMain: { backgroundColor: colors.orange },
  item: { alignItems: 'center', width: 66 },
  itemMain: {},
  label: { fontFamily: fonts.semibold, fontSize: 12, color: colors.text, marginTop: 2 },
});
