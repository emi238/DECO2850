// Hidden bottom nav: an orange handle bar at the bottom that swipes/taps up to
// reveal three overlapping round actions (spaces, new space, help), then
// swipes/taps down to hide again. Home shows it open by default.

import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Animated, PanResponder } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
        <Pressable style={styles.item} onPress={act(onSpaces)} accessibilityLabel="Home">
          <View style={[styles.btn, styles.btnSide]}>
            <DoorIcon size={26} />
          </View>
          <Text style={styles.label}>Home</Text>
        </Pressable>
        <Pressable style={[styles.item, styles.itemMain]} onPress={act(onCapture)} accessibilityLabel="Upload">
          <View style={[styles.btn, styles.btnMain]}>
            <UploadIcon size={30} />
          </View>
          <Text style={styles.label}>Upload</Text>
        </Pressable>
        <Pressable style={styles.item} onPress={act(onHelp)} accessibilityLabel="Help">
          <View style={[styles.btn, styles.btnSide]}>
            <HelpIcon size={28} />
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
  bar: { position: 'absolute', flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  btn: { width: 54, height: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center' },
  btnSide: { backgroundColor: colors.track },
  btnMain: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.orange },
  item: { alignItems: 'center', width: 60 },
  itemMain: { marginHorizontal: -6, zIndex: 2 },
  // Light pill behind each name so it stays readable over room photos.
  label: { fontFamily: fonts.semibold, fontSize: 12, color: colors.text, marginTop: 4, backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 1, overflow: 'hidden' },
});
