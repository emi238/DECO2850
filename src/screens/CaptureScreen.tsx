// F1 — Room capture by sweep-and-snap. Live camera samples stills while the
// user pans; frames assemble into the scrollable 2D map used everywhere after.
// A "Use demo room" path works with no camera (iOS Simulator / reliable demo).

import React, { useCallback, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';

import { Screen } from '../components/Screen';
import { Button } from '../components/Button';
import { GlassCard } from '../components/GlassCard';
import { FrameView } from '../components/FrameView';
import { colors, spacing, font, radius } from '../theme';
import { useSession } from '../store/session';
import { DEMO_FRAMES, DemoRasterizer } from '../demo/room';
import { realAiEnabled } from '../ai/config';
import type { Frame } from '../types';
import type { ScreenProps } from '../navigation';

const TARGET_FRAMES = 10;
const MAX_FRAMES = 12;
const SAMPLE_MS = 550;

export default function CaptureScreen({ navigation }: ScreenProps<'Capture'>) {
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const setFrames = useSession((s) => s.setFrames);
  const reset = useSession((s) => s.reset);

  const [phase, setPhase] = useState<'camera' | 'review'>('camera');
  const [sweeping, setSweeping] = useState(false);
  const [captured, setCaptured] = useState<Frame[]>([]);
  const [isDemo, setIsDemo] = useState(false);
  const [rasterizing, setRasterizing] = useState(false);
  const busy = useRef(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const framesRef = useRef<Frame[]>([]);

  const stopSweep = useCallback(() => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    setSweeping(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setCaptured([...framesRef.current]);
    setPhase('review');
  }, []);

  const snap = useCallback(async () => {
    if (busy.current || !cameraRef.current) return;
    busy.current = true;
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.4,
        base64: true,
        skipProcessing: true,
      });
      if (photo?.uri) {
        framesRef.current = [...framesRef.current, { uri: photo.uri, base64: photo.base64, mime: 'image/jpeg' }];
        setCaptured([...framesRef.current]);
        if (framesRef.current.length >= MAX_FRAMES) stopSweep();
      }
    } catch {
      // A failed frame (e.g. no camera) is skipped; the demo path is the fallback.
    } finally {
      busy.current = false;
    }
  }, [stopSweep]);

  const startSweep = useCallback(() => {
    framesRef.current = [];
    setCaptured([]);
    setIsDemo(false);
    setSweeping(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    snap();
    timer.current = setInterval(snap, SAMPLE_MS);
  }, [snap]);

  const useDemoRoom = useCallback(() => {
    reset();
    setIsDemo(true);
    if (realAiEnabled()) {
      // Real model on: rasterise the demo room to PNGs so it can be analysed.
      setRasterizing(true);
    } else {
      framesRef.current = DEMO_FRAMES;
      setCaptured(DEMO_FRAMES);
      setPhase('review');
    }
  }, [reset]);

  const onRasterDone = useCallback((frames: Frame[]) => {
    framesRef.current = frames;
    setCaptured(frames);
    setRasterizing(false);
    setPhase('review');
  }, []);

  const retake = useCallback(() => {
    framesRef.current = [];
    setCaptured([]);
    setIsDemo(false);
    setPhase('camera');
  }, []);

  const proceed = useCallback(() => {
    setFrames(captured);
    navigation.navigate('Mode');
  }, [captured, navigation, setFrames]);

  // ---------- PREPARING DEMO ROOM (rasterising for the real model) ----------
  if (rasterizing) {
    return (
      <Screen step={0} title="Preparing demo room" subtitle="Rendering the room into images for the AI…">
        <View style={styles.prep}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={styles.prepTxt}>One moment…</Text>
        </View>
        <DemoRasterizer onDone={onRasterDone} />
      </Screen>
    );
  }

  // ---------- REVIEW ----------
  if (phase === 'review') {
    const enough = captured.length >= 6;
    return (
      <Screen
        step={0}
        title="Review your sweep"
        subtitle={
          isDemo
            ? 'This is the built-in demo room — a scrollable 2D map of the space.'
            : `${captured.length} frames assembled into one scrollable 2D room map.`
        }
      >
        <View style={styles.reviewBody}>
          <GlassCard style={styles.mapCard} padded={false}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.strip}
            >
              {captured.map((f, i) => (
                <View key={i} style={styles.reviewFrame}>
                  <FrameView frame={f} width={168} height={224} radius={radius.md} />
                  <Text style={styles.frameIdx}>{i}</Text>
                </View>
              ))}
            </ScrollView>
          </GlassCard>

          {!enough && !isDemo && (
            <Text style={styles.warn}>
              Only {captured.length} usable frames — aim for at least 6. Try a slower sweep, or
              use the demo room.
            </Text>
          )}

          <View style={styles.actions}>
            <Button label="Retake" variant="secondary" onPress={retake} style={{ flex: 1 }} />
            <Button
              label="Continue"
              onPress={proceed}
              disabled={captured.length === 0}
              style={{ flex: 1 }}
            />
          </View>
          {!isDemo && (
            <Button label="Use demo room instead" variant="ghost" onPress={useDemoRoom} />
          )}
        </View>
      </Screen>
    );
  }

  // ---------- CAMERA ----------
  const granted = permission?.granted;

  return (
    <Screen
      step={0}
      title="Capture the room"
      subtitle="Hold your phone up and sweep slowly left → right while it snaps frames."
    >
      <View style={styles.cameraBody}>
        <View style={styles.viewport}>
          {granted ? (
            <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" />
          ) : (
            <View style={styles.noCam}>
              <Text style={styles.noCamTitle}>Camera not available</Text>
              <Text style={styles.noCamText}>
                {permission && !permission.granted
                  ? 'Grant camera access to sweep a real room, or use the built-in demo room below.'
                  : 'On the simulator there is no camera — use the built-in demo room below.'}
              </Text>
              {permission && !permission.granted && permission.canAskAgain && (
                <Button
                  label="Grant camera access"
                  variant="secondary"
                  onPress={requestPermission}
                  style={{ marginTop: spacing.md }}
                />
              )}
            </View>
          )}

          {sweeping && (
            <View style={styles.sweepOverlay} pointerEvents="none">
              <View style={styles.counter}>
                <ActivityIndicator color={colors.accentText} />
                <Text style={styles.counterText}>{captured.length} / {TARGET_FRAMES}</Text>
              </View>
              <Text style={styles.sweepHint}>Keep panning slowly…</Text>
            </View>
          )}
        </View>

        <View style={styles.controls}>
          {granted ? (
            sweeping ? (
              <Button label="Done sweeping" onPress={stopSweep} />
            ) : (
              <Button label="Start sweep" onPress={startSweep} />
            )
          ) : null}
          <Pressable onPress={useDemoRoom} style={styles.demoLink}>
            <Text style={styles.demoLinkText}>Use demo room →</Text>
          </Pressable>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  prep: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  prepTxt: { color: colors.textMuted, fontSize: font.body },
  cameraBody: { flex: 1, paddingHorizontal: spacing.xl },
  viewport: {
    flex: 1,
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: '#000',
    borderWidth: 1,
    borderColor: colors.border,
  },
  noCam: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  noCamTitle: { color: colors.text, fontSize: font.h3, fontWeight: '600', marginBottom: 8 },
  noCamText: { color: colors.textMuted, fontSize: font.body, textAlign: 'center', lineHeight: 21 },
  sweepOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: spacing.xl,
  },
  counter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radius.pill,
  },
  counterText: { color: colors.accentText, fontSize: font.h3, fontWeight: '700' },
  sweepHint: { color: '#fff', marginTop: 10, fontSize: font.body },
  controls: { paddingVertical: spacing.lg, gap: spacing.md },
  demoLink: { alignItems: 'center', paddingVertical: 6 },
  demoLinkText: { color: colors.textMuted, fontSize: font.body, fontWeight: '600' },

  reviewBody: { flex: 1, paddingHorizontal: spacing.xl, gap: spacing.lg },
  mapCard: { paddingVertical: spacing.md },
  strip: { paddingHorizontal: spacing.md, gap: spacing.sm, alignItems: 'center' },
  reviewFrame: { position: 'relative' },
  frameIdx: {
    position: 'absolute',
    top: 6,
    left: 6,
    color: '#fff',
    fontSize: font.tiny,
    fontWeight: '700',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    overflow: 'hidden',
  },
  warn: { color: colors.sevMedium, fontSize: font.small, lineHeight: 19 },
  actions: { flexDirection: 'row', gap: spacing.md },
});
