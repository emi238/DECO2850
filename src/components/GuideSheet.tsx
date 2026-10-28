// A short, swipeable "how to" guide in a bottom sheet: a drawn picture, a title and
// one line per step, with the same progress bars and 48pt buttons as onboarding.
// Used for "How to scan" (Capture) and "How to flag" (Tagging): shown once the
// first time, and again from the "How to…" link on each screen.

import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  ScrollView,
  NativeScrollEvent,
  NativeSyntheticEvent,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PrimaryButton } from './kit';
import { CloseIcon } from './icons';
import { colors, fonts } from '../theme';

export interface GuideStep {
  art: React.ReactNode;
  title: string;
  body: string;
}

const SIDE = 22;

export function GuideSheet({
  visible,
  heading,
  steps,
  doneLabel,
  onClose,
}: {
  visible: boolean;
  heading: string; // e.g. "How to scan"
  steps: GuideStep[];
  doneLabel: string; // last button, e.g. "Start scanning"
  onClose: () => void;
}) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const pageW = width; // one step per screen width; each step pads itself
  const [index, setIndex] = useState(0);
  const pager = useRef<React.ComponentRef<typeof ScrollView>>(null);

  // Always open on the first step.
  useEffect(() => {
    if (visible) setIndex(0);
  }, [visible]);

  const goTo = (i: number) => {
    setIndex(i);
    pager.current?.scrollTo({ x: i * pageW, animated: true });
  };
  const onSwipe = (e: NativeSyntheticEvent<NativeScrollEvent>) =>
    setIndex(Math.round(e.nativeEvent.contentOffset.x / pageW));

  const last = index === steps.length - 1;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <View style={styles.headRow}>
            <Text style={styles.heading}>{heading}</Text>
            <Pressable onPress={onClose} hitSlop={12} accessibilityLabel="Close guide">
              <CloseIcon size={14} />
            </Pressable>
          </View>

          <ScrollView
            ref={pager}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={onSwipe}
            style={{ marginHorizontal: -SIDE }}
          >
            {steps.map((s, i) => (
              <View key={i} style={{ width: pageW, paddingHorizontal: SIDE }}>
                <View style={styles.artBox}>{s.art}</View>
                <Text style={styles.title}>{s.title}</Text>
                <Text style={styles.body}>{s.body}</Text>
              </View>
            ))}
          </ScrollView>

          <View style={styles.progress} accessibilityLabel={`Step ${index + 1} of ${steps.length}`}>
            {steps.map((_, i) => (
              <View key={i} style={[styles.bar, i <= index && styles.barOn]} />
            ))}
          </View>

          <View style={styles.actions}>
            {index > 0 && (
              <PrimaryButton label="Back" onPress={() => goTo(index - 1)} style={[styles.backBtn, { backgroundColor: colors.track }]} />
            )}
            <PrimaryButton label={last ? doneLabel : 'Next'} onPress={() => (last ? onClose() : goTo(index + 1))} style={styles.nextBtn} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(36,30,24,0.5)' },
  sheet: {
    backgroundColor: colors.bg,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: SIDE,
    paddingTop: 20,
  },
  headRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  heading: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.textMuted },
  artBox: { height: 170, borderRadius: 12, backgroundColor: colors.peach, padding: 10 },
  title: { fontFamily: fonts.bold, fontSize: 20, color: colors.text, marginTop: 18 },
  body: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 21, color: colors.text, marginTop: 6, minHeight: 63 },
  progress: { flexDirection: 'row', gap: 5, marginTop: 16 },
  bar: { flex: 1, height: 6, borderRadius: 3, backgroundColor: colors.track },
  barOn: { backgroundColor: colors.orange },
  actions: { flexDirection: 'row', gap: 12, marginTop: 18 },
  backBtn: { width: '38%' },
  nextBtn: { flex: 1 },
});
