// Capture a space: take as many photos as you like with the camera (you press
// the shutter for each one), or upload photos or a video (the Simulator has no
// camera). Then "Review your space" shows the frames in a
// carousel before continuing to tagging.

import React, { useCallback, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
  NativeScrollEvent,
  NativeSyntheticEvent,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';

import { TopBar, JoinedButtons } from '../components/kit';
import { FrameView } from '../components/FrameView';
import { SwipeUpNav } from '../components/SwipeUpNav';
import { colors, fonts } from '../theme';
import { useSession } from '../store/session';
import { pickPhotos, pickVideoFrames, type PickResult } from '../capture/upload';
import type { Frame } from '../types';
import type { ScreenProps } from '../navigation';

export default function CaptureScreen({ navigation, route }: ScreenProps<'Capture'>) {
  const fresh = !!route.params?.fresh;
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const addSpace = useSession((s) => s.addSpace);
  const setFrames = useSession((s) => s.setFrames);

  const [phase, setPhase] = useState<'camera' | 'review'>('camera');
  const [captured, setCaptured] = useState<Frame[]>([]);
  const [source, setSource] = useState<'camera' | 'upload'>('camera');
  const [preparing, setPreparing] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const busy = useRef(false);
  const framesRef = useRef<Frame[]>([]);

  const { width } = useWindowDimensions();
  const cardW = width - 44;
  const itemW = Math.round(cardW * 0.7);
  const itemH = Math.round(itemW * 1.45);
  const itemGap = 18;

  const toReview = (frames: Frame[]) => {
    framesRef.current = frames;
    setCaptured(frames);
    setPage(0);
    setPhase('review');
  };

  // Shutter: one photo per tap, no limit. Photos collect until "Done".
  const takePhoto = useCallback(async () => {
    if (busy.current || !cameraRef.current) return;
    busy.current = true;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.4, base64: true, skipProcessing: true });
      if (photo?.uri) {
        framesRef.current = [...framesRef.current, { uri: photo.uri, base64: photo.base64, mime: 'image/jpeg' }];
        setCaptured([...framesRef.current]);
        setSource('camera');
      }
    } catch {
      // A failed shot is skipped; the user can simply tap again.
    } finally {
      busy.current = false;
    }
  }, []);

  const finishPhotos = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    toReview([...framesRef.current]);
  };

  const clearPhotos = () => {
    framesRef.current = [];
    setCaptured([]);
  };

  const retake = () => {
    framesRef.current = [];
    setCaptured([]);
    setSource('camera');
    setPhase('camera');
  };

  const runUpload = async (picker: () => Promise<PickResult>, kind: 'photos' | 'video') => {
    setPreparing(kind === 'video' ? 'Sampling frames from your video…' : 'Processing your photos…');
    try {
      const res = await picker();
      if (res.status === 'denied') {
        Alert.alert('Photo access needed', 'Allow photo library access to upload photos or a video of the room.');
        return;
      }
      if (res.status === 'cancelled') return;
      if (res.status === 'empty') {
        Alert.alert('Nothing to use', 'No usable frames were found. Try different photos or a clearer video.');
        return;
      }
      setSource('upload');
      toReview(res.frames);
    } catch (e) {
      Alert.alert('Upload failed', e instanceof Error ? e.message : 'Could not import from your library.');
    } finally {
      setPreparing(null);
    }
  };

  // A fresh capture creates its space once (coming back here and continuing
  // again reuses it rather than making a duplicate).
  const createdRef = useRef(false);
  const proceed = () => {
    if ((fresh && !createdRef.current) || !useSession.getState().current()) {
      const n = useSession.getState().spaces.length + 1;
      addSpace(`Space ${n}`);
      useSession.getState().patchSpace({ saved: false });
      createdRef.current = true;
    }
    const cur = useSession.getState().current();
    if (cur && cur.capture.frames !== framesRef.current) {
      // New photos: tags and results pinned to the old ones no longer line up.
      useSession.getState().patchSpace({ tags: [], result: null });
    }
    setFrames(framesRef.current);
    navigation.navigate('Tagging');
  };

  const onCarousel = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / (itemW + itemGap));
    if (i !== page) setPage(Math.max(0, Math.min(captured.length - 1, i)));
  };

  const close = () => navigation.navigate('Home');
  const granted = permission?.granted;

  // ---------- REVIEW ----------
  if (phase === 'review' && !preparing) {
    const n = captured.length;
    const subtitle = `${n} ${source === 'upload' ? 'uploaded ' : ''}${n === 1 ? 'frame' : 'frames'} to be mapped into a 2D/3D map, double check all corners are captured and no personal identifiable information is shown.`;
    return (
      <View style={styles.root}>
        <SafeAreaView edges={['top']} style={{ flex: 1 }}>
          <TopBar onBack={retake} onClose={close} style={styles.topBar} />
          <View style={styles.body}>
            <Text style={styles.h1}>Review your space</Text>
            <Text style={styles.sub}>{subtitle}</Text>

            <View style={[styles.card, { width: cardW }]}>
              <ProgressBars count={n} active={page} />
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                snapToInterval={itemW + itemGap}
                decelerationRate="fast"
                onScroll={onCarousel}
                scrollEventThrottle={32}
                contentContainerStyle={{ paddingHorizontal: 12, gap: itemGap }}
              >
                {captured.map((f, i) => (
                  <FrameView key={i} frame={f} width={itemW} height={itemH} radius={12} />
                ))}
                {n === 1 && <View style={[styles.ghostFrame, { width: cardW - itemW - 42, height: itemH }]} />}
              </ScrollView>
            </View>

            {n < 4 && (
              <Text style={styles.warn}>Only {n} {n === 1 ? 'frame' : 'frames'}, a few more angles give a better read of the room.</Text>
            )}

            <JoinedButtons
              left={{ label: 'Retake Images', onPress: retake }}
              right={{ label: 'Continue', onPress: proceed, disabled: n === 0 }}
              style={{ marginTop: 24 }}
            />
          </View>
        </SafeAreaView>
        <SwipeUpNav onSpaces={close} onCapture={retake} />
      </View>
    );
  }

  // ---------- CAMERA / UPLOAD ----------
  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        <TopBar onBack={() => navigation.goBack()} onClose={close} style={styles.topBar} />
        <View style={styles.body}>
          <Text style={styles.h1}>Capture your space</Text>
          <Text style={styles.sub}>
            Tap the shutter to take a photo, as many as you need to capture every corner of the room. Or upload photos or a video.
          </Text>

          <View style={[styles.card, styles.cameraCard, { width: cardW }]}>
            <View style={styles.viewport}>
              {preparing ? (
                <View style={styles.center}>
                  <ActivityIndicator color={colors.orange} size="large" />
                  <Text style={styles.centerTxt}>{preparing}</Text>
                </View>
              ) : granted ? (
                <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" />
              ) : (
                <View style={styles.center}>
                  <Text style={styles.centerTitle}>Camera not available</Text>
                  <Text style={styles.centerTxt}>
                    {permission && !permission.granted
                      ? 'Allow camera access to photograph the room, or upload photos or a video instead.'
                      : 'No camera here (e.g. the Simulator). Upload photos or a video of the room instead.'}
                  </Text>
                  {permission && !permission.granted && permission.canAskAgain && (
                    <Pressable onPress={requestPermission} style={styles.grant}>
                      <Text style={styles.grantTxt}>Allow camera</Text>
                    </Pressable>
                  )}
                </View>
              )}
              {granted && !preparing && (
                <>
                  {captured.length > 0 && (
                    <View style={styles.countPill} pointerEvents="none">
                      <Text style={styles.countTxt}>
                        {captured.length} {captured.length === 1 ? 'photo' : 'photos'}
                      </Text>
                    </View>
                  )}
                  <View style={styles.shutterRow}>
                    <View style={styles.thumbSlot}>
                      {captured.length > 0 && (
                        <FrameView frame={captured[captured.length - 1]} width={44} height={44} radius={8} />
                      )}
                    </View>
                    <Pressable
                      onPress={takePhoto}
                      accessibilityLabel="Take photo"
                      style={({ pressed }) => [styles.shutter, pressed && { transform: [{ scale: 0.92 }] }]}
                    >
                      <View style={styles.shutterInner} />
                    </Pressable>
                    <View style={styles.thumbSlot} />
                  </View>
                </>
              )}
            </View>
          </View>

          {captured.length > 0 && source === 'camera' ? (
            <JoinedButtons
              left={{ label: 'Start Over', onPress: clearPhotos }}
              right={{ label: `Done (${captured.length})`, onPress: finishPhotos }}
              style={{ marginTop: 20 }}
            />
          ) : (
            <JoinedButtons
              left={{ label: 'Upload Video', onPress: () => runUpload(pickVideoFrames, 'video') }}
              right={{ label: 'Upload Photos', onPress: () => runUpload(pickPhotos, 'photos') }}
              style={{ marginTop: 20 }}
            />
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}

// Thin bars across the top of the carousel card; the orange one is the current frame.
export function ProgressBars({ count, active }: { count: number; active: number }) {
  const bars = Math.max(3, Math.min(count, 8));
  const current = count > bars ? Math.round((active / Math.max(1, count - 1)) * (bars - 1)) : active;
  return (
    <View style={styles.bars}>
      {Array.from({ length: bars }, (_, i) => (
        <View key={i} style={[styles.bar, { width: bars > 3 ? 32 : 58 }, i === current && { backgroundColor: colors.orange }]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg2 },
  topBar: { paddingHorizontal: 22, paddingTop: 6 },
  body: { flex: 1, paddingHorizontal: 22 },
  h1: { fontFamily: fonts.bold, color: colors.text, fontSize: 20, marginTop: 14 },
  sub: { fontFamily: fonts.regular, color: colors.text, fontSize: 15, lineHeight: 21, marginTop: 6 },

  card: { backgroundColor: colors.bg, borderRadius: 20, paddingTop: 13, paddingBottom: 22, marginTop: 16 },
  cameraCard: { paddingHorizontal: 12, paddingTop: 12, paddingBottom: 12 },
  bars: { flexDirection: 'row', justifyContent: 'center', gap: 5, marginBottom: 16 },
  bar: { height: 6, borderRadius: 3, backgroundColor: colors.dots },
  ghostFrame: { backgroundColor: colors.track, borderRadius: 12 },
  warn: { fontFamily: fonts.regular, color: colors.orangeDeep, fontSize: 12, marginTop: 10 },

  viewport: { height: 380, borderRadius: 12, overflow: 'hidden', backgroundColor: colors.track },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 8 },
  centerTitle: { fontFamily: fonts.semibold, color: colors.text, fontSize: 16 },
  centerTxt: { fontFamily: fonts.regular, color: colors.textMuted, fontSize: 13, textAlign: 'center', lineHeight: 18 },
  grant: { marginTop: 8, backgroundColor: colors.orange, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 8 },
  grantTxt: { fontFamily: fonts.semibold, color: colors.text, fontSize: 14 },
  countPill: { position: 'absolute', top: 12, alignSelf: 'center', backgroundColor: colors.orangeLight, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 6 },
  countTxt: { fontFamily: fonts.semibold, color: colors.text, fontSize: 13 },
  shutterRow: { position: 'absolute', left: 0, right: 0, bottom: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24 },
  thumbSlot: { width: 44, height: 44 },
  shutter: { width: 72, height: 72, borderRadius: 36, borderWidth: 4, borderColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  shutterInner: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.orange },

});
