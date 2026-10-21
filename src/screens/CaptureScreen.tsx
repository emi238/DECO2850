// Capture a space: take as many photos as you like with the camera (you press
// the shutter for each one), or upload photos or a video (the Simulator has no
// camera). Photos and uploads collect on this screen; the orange Next button
// (bottom right) opens "Review your space", which shows the frames in a
// carousel before continuing to tagging.

import React, { useCallback, useEffect, useRef, useState } from 'react';
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

import { TopBar, PrimaryButton } from '../components/kit';
import { FrameView } from '../components/FrameView';
import { ZoomBox } from '../components/ZoomBox';
import { SwipeUpNav } from '../components/SwipeUpNav';
import { ChevronIcon } from '../components/icons';
import { GuideSheet, type GuideStep } from '../components/GuideSheet';
import { ScanCornerArt, ScanOverlapArt, ScanLowArt, ScanExitsArt } from '../components/guideArt';
import { colors, fonts } from '../theme';
import { useSession } from '../store/session';
import { pickPhotos, pickVideoFrames, type PickResult } from '../capture/upload';
import type { Frame } from '../types';
import type { ScreenProps } from '../navigation';

// "How to scan": shown the first time someone opens Capture, and from the link.
const SCAN_GUIDE: GuideStep[] = [
  {
    art: <ScanCornerArt />,
    title: 'Start from a corner',
    body: 'Stand in a corner and take your first photo looking across the whole room.',
  },
  {
    art: <ScanOverlapArt />,
    title: 'Turn slowly, 6 to 10 photos',
    body: 'Turn a little between shots so each photo overlaps the last. Turn the lights on and hold steady.',
  },
  {
    art: <ScanLowArt />,
    title: 'Get down to dog height',
    body: 'Tilt down to show the floor, cords, plants and low shelves. That’s where a dog explores.',
  },
  {
    art: <ScanExitsArt />,
    title: 'Show the ways out',
    body: 'Include doors, windows, balconies and stairs so we can check for escapes and falls. A slow video works too.',
  },
];

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

  const scanSeen = useSession((s) => s.seenGuides.includes('scan'));
  const markGuideSeen = useSession((s) => s.markGuideSeen);
  const [guideOpen, setGuideOpen] = useState(false);
  useEffect(() => {
    if (scanSeen) return;
    const t = setTimeout(() => setGuideOpen(true), 400);
    return () => clearTimeout(t);
    // Only on arrival: closing the guide marks it seen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const closeGuide = () => {
    setGuideOpen(false);
    markGuideSeen('scan');
  };

  const { width } = useWindowDimensions();
  const cardW = width - 44;
  const itemW = Math.round(cardW * 0.7);
  const itemH = Math.round(itemW * 1.45);
  const reviewRef = useRef<ScrollView>(null);

  const toReview = (frames: Frame[]) => {
    framesRef.current = frames;
    setCaptured(frames);
    setPage(0);
    setPhase('review');
  };

  // Shutter: one photo per tap, no limit. Photos collect until "Next".
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
      // Uploads join any photos already taken; Next moves on to the review.
      framesRef.current = [...framesRef.current, ...res.frames];
      setCaptured([...framesRef.current]);
      setSource('upload');
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

  // Review carousel: one whole frame per page (no clipped neighbour peeking in).
  const onCarousel = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / cardW);
    if (i !== page) setPage(Math.max(0, Math.min(captured.length - 1, i)));
  };
  const goToFrame = (i: number) => {
    const next = Math.max(0, Math.min(captured.length - 1, i));
    reviewRef.current?.scrollTo({ x: next * cardW, animated: true });
    setPage(next);
  };

  const close = () => navigation.navigate('Home');
  const granted = permission?.granted;

  // ---------- REVIEW ----------
  if (phase === 'review' && !preparing) {
    const n = captured.length;
    const subtitle = `${n} ${source === 'upload' ? 'uploaded ' : ''}${n === 1 ? 'frame' : 'frames'} to be mapped onto a room map, double check all corners are captured and no personal identifiable information is shown.`;
    return (
      <View style={styles.root}>
        <SafeAreaView edges={['top']} style={{ flex: 1 }}>
          <TopBar onBack={retake} onClose={close} style={styles.topBar} />
          <View style={styles.body}>
            <Text style={styles.h1}>Review your space</Text>
            <Text style={styles.sub}>{subtitle}</Text>

            <View style={[styles.card, { width: cardW }]}>
              <ProgressBars count={n} active={page} onSelect={goToFrame} />
              <View>
                <ScrollView
                  ref={reviewRef}
                  horizontal
                  pagingEnabled
                  showsHorizontalScrollIndicator={false}
                  onScroll={onCarousel}
                  scrollEventThrottle={32}
                >
                  {captured.map((f, i) => (
                    <View key={i} style={{ width: cardW, alignItems: 'center' }}>
                      <ZoomBox width={itemW} height={itemH}>
                        <FrameView frame={f} width={itemW} height={itemH} radius={12} />
                      </ZoomBox>
                      <PhotoCount index={i} total={n} />
                    </View>
                  ))}
                </ScrollView>
                {/* Arrows in the side margins show there are more frames that way. */}
                {page > 0 && (
                  <Pressable onPress={() => goToFrame(page - 1)} hitSlop={8} accessibilityLabel="Previous photo" style={[styles.arrow, { left: (cardW - itemW) / 4 - 16, top: itemH / 2 - 16 }]}>
                    <ChevronIcon dir="left" size={12} />
                  </Pressable>
                )}
                {page < n - 1 && (
                  <Pressable onPress={() => goToFrame(page + 1)} hitSlop={8} accessibilityLabel="Next photo" style={[styles.arrow, { right: (cardW - itemW) / 4 - 16, top: itemH / 2 - 16 }]}>
                    <ChevronIcon dir="right" size={12} />
                  </Pressable>
                )}
              </View>
            </View>

            {n < 4 && (
              <Text style={styles.warn}>Only {n} {n === 1 ? 'frame' : 'frames'}, a few more angles give a better read of the room.</Text>
            )}

            {/* Two separate buttons: neutral Retake, orange Continue. */}
            <View style={styles.reviewActions}>
              <PrimaryButton label="Retake Images" onPress={retake} style={[styles.retakeBtn, { backgroundColor: colors.bg }]} />
              <PrimaryButton label="Continue" onPress={proceed} disabled={n === 0} style={styles.continueBtn} />
            </View>
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
          <Pressable onPress={() => setGuideOpen(true)} hitSlop={8} style={styles.howLink}>
            <Text style={styles.howTxt}>How to scan →</Text>
          </Pressable>

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
              {captured.length > 0 && !preparing && (
                <View style={styles.countPill} pointerEvents="none">
                  <Text style={styles.countTxt}>
                    {captured.length} {captured.length === 1 ? 'photo' : 'photos'}
                  </Text>
                </View>
              )}
              {/* Bottom right of the camera, opposite the latest-photo thumbnail. */}
              {captured.length > 0 && !preparing && (
                <Pressable
                  onPress={clearPhotos}
                  hitSlop={8}
                  accessibilityLabel="Reset photos"
                  style={({ pressed }) => [styles.reset, pressed && { opacity: 0.7 }]}
                >
                  <Text style={styles.resetTxt}>Reset</Text>
                </Pressable>
              )}
            </View>
          </View>

          {/* Two separate neutral (white) upload buttons; only Next is orange. */}
          <View style={styles.uploadRow}>
            <PrimaryButton label="Upload Video" onPress={() => runUpload(pickVideoFrames, 'video')} style={[styles.uploadBtn, { backgroundColor: colors.bg }]} />
            <PrimaryButton label="Upload Photos" onPress={() => runUpload(pickPhotos, 'photos')} style={[styles.uploadBtn, { backgroundColor: colors.bg }]} />
          </View>

          <View style={styles.footer}>
            <PrimaryButton
              label="Next"
              onPress={finishPhotos}
              disabled={captured.length === 0 || !!preparing}
              style={styles.next}
            />
          </View>
        </View>
      </SafeAreaView>
      <GuideSheet visible={guideOpen} heading="How to scan" steps={SCAN_GUIDE} doneLabel="Start scanning" onClose={closeGuide} />
    </View>
  );
}

// "Photo 2 of 5" pill on the bottom of a photo, so the count is clear even when
// the progress bars above are fewer or more than the photos.
export function PhotoCount({ index, total }: { index: number; total: number }) {
  return (
    <View style={styles.photoCount} pointerEvents="none">
      <Text style={styles.photoCountTxt}>
        Photo {index + 1} of {total}
      </Text>
    </View>
  );
}

// Thin bars across the top of the carousel card; the orange one is the current frame.
// With onSelect, tapping a bar jumps to its frame.
export function ProgressBars({ count, active, onSelect }: { count: number; active: number; onSelect?: (i: number) => void }) {
  const bars = Math.max(3, Math.min(count, 8));
  const current = count > bars ? Math.round((active / Math.max(1, count - 1)) * (bars - 1)) : active;
  const frameFor = (bar: number) => (count > bars ? Math.round((bar / (bars - 1)) * (count - 1)) : bar);
  return (
    <View style={styles.bars}>
      {Array.from({ length: bars }, (_, i) => {
        const bar = <View style={[styles.bar, { width: bars > 3 ? 32 : 58 }, i === current && { backgroundColor: colors.orange }]} />;
        if (!onSelect || frameFor(i) >= count) return <View key={i}>{bar}</View>;
        return (
          <Pressable key={i} onPress={() => onSelect(frameFor(i))} hitSlop={{ top: 12, bottom: 12, left: 2, right: 2 }} accessibilityLabel={`Show photo ${frameFor(i) + 1}`}>
            {bar}
          </Pressable>
        );
      })}
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
  photoCount: { position: 'absolute', bottom: 10, alignSelf: 'center', backgroundColor: 'rgba(36,30,24,0.7)', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 },
  photoCountTxt: { fontFamily: fonts.semibold, fontSize: 12, color: '#fff' },
  bars: { flexDirection: 'row', justifyContent: 'center', gap: 5, marginBottom: 16 },
  bar: { height: 6, borderRadius: 3, backgroundColor: colors.dots },
  arrow: { position: 'absolute', width: 32, height: 32, borderRadius: 16, backgroundColor: colors.bg2, alignItems: 'center', justifyContent: 'center' },
  warn: { fontFamily: fonts.regular, color: colors.orangeDeep, fontSize: 12, marginTop: 10 },

  viewport: { height: 380, borderRadius: 12, overflow: 'hidden', backgroundColor: colors.track },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 8 },
  centerTitle: { fontFamily: fonts.semibold, color: colors.text, fontSize: 16 },
  centerTxt: { fontFamily: fonts.regular, color: colors.textMuted, fontSize: 13, textAlign: 'center', lineHeight: 18 },
  grant: { marginTop: 8, backgroundColor: colors.orange, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 8 },
  grantTxt: { fontFamily: fonts.semibold, color: colors.text, fontSize: 14 },
  countPill: { position: 'absolute', top: 12, alignSelf: 'center', backgroundColor: colors.orangeLight, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 6 },
  countTxt: { fontFamily: fonts.semibold, color: colors.text, fontSize: 13 },
  howLink: { alignSelf: 'flex-start', marginTop: 6 },
  howTxt: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.orangeDeep },
  uploadRow: { flexDirection: 'row', gap: 12, marginTop: 20 },
  uploadBtn: { flex: 1 },
  reviewActions: { flexDirection: 'row', gap: 12, marginTop: 24 },
  retakeBtn: { width: '38%' },
  continueBtn: { flex: 1 }, // takes the remaining, larger share
  footer: { marginTop: 'auto', marginBottom: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end' },
  reset: { position: 'absolute', right: 24, bottom: 34, height: 36, paddingHorizontal: 14, borderRadius: 10, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  resetTxt: { fontFamily: fonts.semibold, color: colors.text, fontSize: 12.5 },
  next: { width: 140 },
  shutterRow: { position: 'absolute', left: 0, right: 0, bottom: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24 },
  thumbSlot: { width: 44, height: 44 },
  shutter: { width: 72, height: 72, borderRadius: 36, borderWidth: 4, borderColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  shutterInner: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.orange },

});
