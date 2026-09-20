// Simulated real-time scan + object detection, layered over the 3D room. This is
// the testable stand-in for the RoomPlan + YOLO experience (docs/AR_NATIVE_PLAN.md):
// a scan sweep runs, then detected objects/hazards pop in one by one as on-screen
// labels/tags — dynamic and responsive — driven by THIS space's assessment.
//
// Real version later: the same tags get anchored to ARKit world positions so they
// track as the user physically moves through the room.

import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Animated, Easing } from 'react-native';

import { AlertIcon } from './icons';
import { colors, fonts } from '../theme';
import { CATEGORY_LABELS } from '../ai/categories';
import type { Hazard } from '../types';

const SWEEP_MS = 1500; // "scanning…" phase
const STEP_MS = 550; // gap between each detection popping in

// Deterministic scatter across the lower two-thirds of the view (where the floor
// is), so a room always lays its tags out the same way.
function spot(i: number, w: number, h: number): { left: number; top: number } {
  const col = i % 3;
  const row = Math.floor(i / 3);
  const jitterX = ((i * 37) % 13) - 6;
  const jitterY = ((i * 53) % 11) - 5;
  const left = w * (0.12 + col * 0.3) + jitterX;
  const top = h * (0.32 + row * 0.17) + jitterY;
  return { left: Math.max(8, Math.min(w - 150, left)), top: Math.max(60, Math.min(h - 70, top)) };
}

export function ScanOverlay({
  risks,
  width,
  height,
  onOpenRisk,
}: {
  risks: Hazard[];
  width: number;
  height: number;
  onOpenRisk: (id: string) => void;
}) {
  // Only located object hazards read as "detected objects" in the space.
  const detected = risks.filter((h) => h.scope === 'object');

  const [phase, setPhase] = useState<'scanning' | 'detecting' | 'done'>('scanning');
  const [shown, setShown] = useState(0);
  const sweep = useRef(new Animated.Value(0)).current;

  // Re-run the whole sequence whenever the set of findings changes (e.g. re-run).
  const key = detected.map((d) => d.id).join(',');
  useEffect(() => {
    setPhase('scanning');
    setShown(0);
    sweep.setValue(0);
    const loop = Animated.loop(
      Animated.timing(sweep, { toValue: 1, duration: SWEEP_MS, easing: Easing.inOut(Easing.quad), useNativeDriver: true })
    );
    loop.start();

    const timers: ReturnType<typeof setTimeout>[] = [];
    timers.push(
      setTimeout(() => {
        loop.stop();
        if (detected.length === 0) {
          setPhase('done');
          return;
        }
        setPhase('detecting');
        detected.forEach((_, i) => {
          timers.push(
            setTimeout(() => {
              setShown(i + 1);
              if (i === detected.length - 1) setPhase('done');
            }, i * STEP_MS)
          );
        });
      }, SWEEP_MS)
    );

    return () => {
      loop.stop();
      timers.forEach(clearTimeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const translateY = sweep.interpolate({ inputRange: [0, 1], outputRange: [height * 0.18, height * 0.92] });

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {/* Scanning sweep line */}
      {phase === 'scanning' && (
        <Animated.View style={[styles.sweep, { width, transform: [{ translateY }] }]} pointerEvents="none" />
      )}

      {/* Detected object tags */}
      {detected.slice(0, shown).map((h, i) => (
        <DetectionTag key={h.id} hazard={h} at={spot(i, width, height)} onPress={() => onOpenRisk(h.id)} />
      ))}

      {/* HUD */}
      <View style={styles.hud} pointerEvents="box-none">
        <View style={styles.hudPill}>
          <View style={[styles.dot, phase === 'done' ? styles.dotDone : styles.dotLive]} />
          <Text style={styles.hudTxt}>
            {phase === 'scanning'
              ? 'Scanning space…'
              : phase === 'detecting'
              ? `Detecting objects · ${shown}/${detected.length}`
              : detected.length === 0
              ? 'Scan complete · no located hazards'
              : `Scan complete · ${detected.length} ${detected.length === 1 ? 'object' : 'objects'} flagged`}
          </Text>
        </View>
      </View>
    </View>
  );
}

function DetectionTag({ hazard, at, onPress }: { hazard: Hazard; at: { left: number; top: number }; onPress: () => void }) {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(a, { toValue: 1, useNativeDriver: true, friction: 6, tension: 90 }).start();
  }, [a]);
  const high = hazard.severity === 'high';
  return (
    <Animated.View
      style={[
        styles.tagWrap,
        { left: at.left, top: at.top, opacity: a, transform: [{ scale: a }] },
      ]}
    >
      <Pressable style={[styles.tag, high && styles.tagHigh]} onPress={onPress} hitSlop={6}>
        <AlertIcon size={13} />
        <Text style={styles.tagTxt} numberOfLines={1}>{CATEGORY_LABELS[hazard.category]}</Text>
      </Pressable>
      <View style={[styles.tagStem, high && { backgroundColor: '#E4572E' }]} />
      <View style={[styles.tagDot, high && { backgroundColor: '#E4572E' }]} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  sweep: {
    position: 'absolute',
    left: 0,
    height: 3,
    backgroundColor: colors.orange,
    shadowColor: colors.orange,
    shadowOpacity: 0.9,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
  },
  hud: { position: 'absolute', left: 0, right: 0, bottom: 24, alignItems: 'center' },
  hudPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(20,20,22,0.82)',
    borderRadius: 20,
    paddingVertical: 9,
    paddingHorizontal: 15,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  dotLive: { backgroundColor: colors.orange },
  dotDone: { backgroundColor: '#5FAE7F' },
  hudTxt: { fontFamily: fonts.semibold, fontSize: 12.5, color: '#fff' },

  tagWrap: { position: 'absolute', alignItems: 'center' },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    maxWidth: 150,
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderRadius: 9,
    paddingVertical: 6,
    paddingHorizontal: 9,
    borderWidth: 1.5,
    borderColor: colors.orange,
  },
  tagHigh: { borderColor: '#E4572E' },
  tagTxt: { fontFamily: fonts.semibold, fontSize: 11.5, color: colors.text },
  tagStem: { width: 2, height: 14, backgroundColor: colors.orange },
  tagDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.orange, borderWidth: 2, borderColor: '#fff' },
});
