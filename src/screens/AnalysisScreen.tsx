// Space analysis — the "Living Room" view. Runs the assessment (with the
// "Un-fur-ling details…" loading state), then shows the room as a 2D photo map or
// 3D model with risk pins, the "Potential Risks!" sheet, and — once a breed is
// attached — the peeking dog avatar whose mood/movement follows the room tone
// (spec §4.1) plus the qualitative summary report (spec §6.3). No scores shown.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Image,
  Animated,
  Easing,
  Alert,
  PanResponder,
  useWindowDimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';

import { TopBar, AvatarButton, Segmented, PrimaryButton } from '../components/kit';
import { FrameView, useFrameImageSize, imageToView } from '../components/FrameView';
import { Room3DView } from '../components/Room3DView';
import { LoadingView } from '../components/LoadingView';
import { SwipeUpNav } from '../components/SwipeUpNav';
import { AlertIcon, ChevronIcon, CloseIcon, EditIcon, RefreshRingIcon, TrashIcon } from '../components/icons';
import { HELP_TEXT } from './HomeScreen';
import { colors, fonts } from '../theme';
import { useSession, useCurrentSpace } from '../store/session';
import { runAssessment } from '../ai/assess';
import { evaluate, type Band, type Evaluation } from '../logic/evaluate';
import type { Frame, Hazard } from '../types';
import type { ScreenProps } from '../navigation';

const MIN_LOADING_MS = 2200;

export default function AnalysisScreen({ navigation, route }: ScreenProps<'Analysis'>) {
  const space = useCurrentSpace();
  const household = useSession((s) => s.household);
  const setResult = useSession((s) => s.setResult);
  const { width, height } = useWindowDimensions();

  // The analysis only runs once a breed is chosen (without one it isn't accurate).
  const hasPet = !!space?.pet?.breed;
  const needsRun = hasPet && (!!route.params?.run || !space?.result);
  const [loading, setLoading] = useState(needsRun);
  const [loadDone, setLoadDone] = useState(false);
  const [view, setView] = useState<'2d' | '3d'>('2d');
  const [riskIndex, setRiskIndex] = useState<number | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [cardH, setCardH] = useState(Math.round(height * 0.65));
  const [headerH, setHeaderH] = useState(160);

  // ---- run the assessment when asked (or when there is no result yet) ----
  const runRef = useRef(0);
  const analyse = async () => {
    const id = ++runRef.current;
    setLoading(true);
    setLoadDone(false);
    setRiskIndex(null);
    const started = Date.now();
    const cur = useSession.getState().current();
    if (cur) {
      const r = await runAssessment({ ...cur, questionnaire: { ...useSession.getState().household } });
      if (id !== runRef.current) return;
      setResult(r.assessment, r.source, r.fallbackReason);
    }
    const wait = Math.max(0, MIN_LOADING_MS - (Date.now() - started));
    setTimeout(() => {
      if (id !== runRef.current) return;
      setLoadDone(true);
      setTimeout(() => id === runRef.current && setLoading(false), 350);
    }, wait);
  };

  // Runs on first open (if a breed is set) and again whenever Select breed sends
  // us back with `run` (a new breed means a new analysis).
  useEffect(() => {
    if (!needsRun) return;
    if (route.params?.run) navigation.setParams({ run: undefined });
    analyse();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route.params?.run]);
  useEffect(() => () => void runRef.current++, []);

  // Coming back from Select breed → show the report once the analysis is done.
  useEffect(() => {
    if (route.params?.report && !loading) {
      setReportOpen(true);
      navigation.setParams({ report: undefined });
    }
  }, [route.params?.report, loading, navigation]);

  const result = space?.result ?? null;
  const evaluation = useMemo(() => (space ? evaluate(space, household) : null), [space, household]);

  // Located hazards first (they have pins), then whole-room findings.
  const risks = useMemo(() => {
    const hz = result?.hazards ?? [];
    return [...hz.filter((h) => h.scope === 'object' && h.location), ...hz.filter((h) => !(h.scope === 'object' && h.location))];
  }, [result]);

  if (loading || !space) return <LoadingView done={loadDone} />;

  const hasDog = !!evaluation;
  const title = space.label || space.name;
  const frames = space.capture.frames;

  const reanalyse = () =>
    Alert.alert('Re-analyse this space?', 'Runs the analysis again with your latest household answers and tags.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Re-analyse', onPress: analyse },
    ]);
  const goHome = () => navigation.popTo('Home');
  const deleteSpace = () =>
    Alert.alert(`Delete “${title}”?`, 'This removes the space, its photos, tags and analysis. This can’t be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          runRef.current++; // stop any analysis still running for this space
          useSession.getState().removeSpace(space.id);
          navigation.reset({ index: 0, routes: [{ name: 'Home' }] });
        },
      },
    ]);
  const selectBreed = () => navigation.navigate('SelectBreed');

  return (
    <View style={[styles.root, { backgroundColor: hasDog ? colors.bg2 : colors.bg }]}>
      <SafeAreaView edges={['top']} style={styles.header}>
        <TopBar
          onBack={hasDog ? goHome : undefined}
          right={
            hasDog ? (
              <Pressable style={styles.breedPill} onPress={selectBreed}>
                <Text style={styles.breedPillTxt}>{evaluation!.dog.name}</Text>
                <EditIcon size={16} />
              </Pressable>
            ) : (
              <AvatarButton ring onPress={() => navigation.navigate('Profile')} />
            )
          }
        />
        <View style={styles.titleRow}>
          <Text style={styles.h1} numberOfLines={1}>{title}</Text>
          <Pressable onPress={deleteSpace} hitSlop={10} style={styles.trash} accessibilityLabel="Delete space">
            <TrashIcon size={22} color={colors.bad} />
          </Pressable>
        </View>
        <Text style={styles.sub}>Explore risks and{'\n'}improvements for your space</Text>
      </SafeAreaView>

      <View
        style={styles.card}
        onLayout={(e) => {
          setCardH(e.nativeEvent.layout.height);
          setHeaderH(e.nativeEvent.layout.y); // the dog peeks over the card's top edge
        }}
      >
        {view === '2d' ? (
          <PhotoMap
            frames={frames}
            risks={risks}
            width={width}
            height={cardH}
            selectedId={riskIndex != null ? risks[riskIndex]?.id : undefined}
            onPin={(id) => setRiskIndex(risks.findIndex((r) => r.id === id))}
          />
        ) : result ? (
          <Room3DView result={result} frameCount={frames.length} />
        ) : null}

        {!hasDog && (
          <Pressable style={styles.selectBreed} onPress={selectBreed}>
            <Text style={styles.selectBreedTxt}>Select breed</Text>
          </Pressable>
        )}
        {!hasPet && (
          <View style={styles.pickPrompt}>
            <Text style={styles.pickTitle}>Choose a dog breed to run analysis!</Text>
            <Text style={styles.pickBody}>
              Pick a breed yourself, or answer a few quick questions to get suggestions, the analysis runs as soon as you select one or hit the re-run button anytime to re-analyse.
            </Text>
            <PrimaryButton label="Select breed" onPress={selectBreed} style={{ marginTop: 14, alignSelf: 'stretch' }} />
          </View>
        )}
        <Segmented
          value={view}
          onChange={setView}
          options={[{ value: '2d', label: '2D map' }, { value: '3d', label: '3D map' }]}
          style={[styles.mapToggle, hasDog && { top: 38 }]}
          textStyle={styles.mapToggleTxt}
        />

        {!!space.resultNote && view === '2d' && riskIndex == null && !reportOpen && (
          <View style={[styles.note, hasDog && { top: 76 }]} pointerEvents="none">
            <Text style={styles.noteTxt} numberOfLines={3}>{space.resultNote}</Text>
          </View>
        )}

        {riskIndex != null && risks[riskIndex] && (
          <RiskSheet
            hazard={risks[riskIndex]}
            index={riskIndex}
            total={risks.length}
            onPrev={() => setRiskIndex((i) => ((i ?? 0) - 1 + risks.length) % risks.length)}
            onNext={() => setRiskIndex((i) => ((i ?? 0) + 1) % risks.length)}
            onClose={() => setRiskIndex(null)}
          />
        )}

        {reportOpen && evaluation && (
          <ReportOverlay
            evaluation={evaluation}
            roomName={title}
            riskCount={risks.length}
            onRisks={() => {
              setReportOpen(false);
              if (risks.length) setRiskIndex(0);
            }}
            onClose={() => setReportOpen(false)}
          />
        )}

        {hasPet && riskIndex == null && !reportOpen && (
          <Pressable style={styles.fab} onPress={reanalyse} hitSlop={6}>
            <RefreshRingIcon size={22} />
            <Text style={styles.fabTxt}>Re-run</Text>
          </Pressable>
        )}
      </View>

      {hasDog && (
        <DogAvatar evaluation={evaluation!} top={headerH - 116} onPress={() => setReportOpen(true)} />
      )}
      {/* Speech bubble beside the dog's ear, between the breed pill and the title; its sharp bottom-right corner points at the dog. */}
      {hasDog && !reportOpen && (
        <Pressable style={[styles.bubble, { top: headerH - 121 }]} onPress={() => setReportOpen(true)}>
          <Text style={styles.bubbleTxt} numberOfLines={2}>{evaluation!.speech}</Text>
        </Pressable>
      )}

      {riskIndex == null && !reportOpen && (
        <SwipeUpNav
          defaultOpen={!hasDog}
          onSpaces={goHome}
          onCapture={() => navigation.navigate('Capture', { fresh: true })}
          onHelp={() => Alert.alert('How PawSpace works', HELP_TEXT)}
        />
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// 2D photo map: one page per frame, with risk pins placed on the image.

function PhotoMap({
  frames,
  risks,
  width,
  height,
  selectedId,
  onPin,
}: {
  frames: Frame[];
  risks: Hazard[];
  width: number;
  height: number;
  selectedId?: string;
  onPin: (id: string) => void;
}) {
  const [page, setPage] = useState(0);
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => setPage(Math.round(e.nativeEvent.contentOffset.x / width));
  return (
    <View style={StyleSheet.absoluteFill}>
      <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} onMomentumScrollEnd={onScroll}>
        {frames.map((f, i) => (
          <MapPage
            key={i}
            frame={f}
            width={width}
            height={height}
            risks={risks.filter((r) => r.location?.frame_index === i)}
            selectedId={selectedId}
            onPin={onPin}
          />
        ))}
      </ScrollView>
      {frames.length > 1 && (
        <View style={styles.pageDots} pointerEvents="none">
          {frames.map((_, i) => (
            <View key={i} style={[styles.pageDot, i === page && { backgroundColor: colors.orange, width: 16 }]} />
          ))}
        </View>
      )}
    </View>
  );
}

function MapPage({
  frame,
  width,
  height,
  risks,
  selectedId,
  onPin,
}: {
  frame: Frame;
  width: number;
  height: number;
  risks: Hazard[];
  selectedId?: string;
  onPin: (id: string) => void;
}) {
  const img = useFrameImageSize(frame);
  return (
    <View style={{ width, height }}>
      <FrameView frame={frame} width={width} height={height} />
      {risks.map((h) => {
        const p = imageToView(img, width, height, h.location!.x, h.location!.y);
        const on = h.id === selectedId;
        return (
          <Pressable
            key={h.id}
            onPress={() => onPin(h.id)}
            hitSlop={8}
            style={[styles.pin, { left: p.x - 19, top: p.y - 19 }, on && styles.pinOn]}
          >
            <AlertIcon size={22} />
          </Pressable>
        );
      })}
    </View>
  );
}

// ---------------------------------------------------------------------------
// "Potential Risks!" frosted sheet: what's flagged, why, and the fix (P4.2).

const SEVERITY_WORD: Record<Hazard['severity'], string> = { high: 'Needs attention', medium: 'Worth fixing', low: 'Minor' };

function RiskSheet({
  hazard,
  index,
  total,
  onPrev,
  onNext,
  onClose,
}: {
  hazard: Hazard;
  index: number;
  total: number;
  onPrev: () => void;
  onNext: () => void;
  onClose: () => void;
}) {
  return (
    <View style={styles.sheetWrap}>
      <BlurView intensity={40} tint="light" style={styles.sheet}>
        <View style={styles.sheetHead}>
          <Text style={styles.sheetTitle}>Potential Risks!</Text>
          <View style={styles.sheetCtrls}>
            <Pressable onPress={onPrev} hitSlop={10} disabled={total < 2}>
              <ChevronIcon size={18} dir="left" weight={3} />
            </Pressable>
            <Pressable onPress={onNext} hitSlop={10} disabled={total < 2}>
              <ChevronIcon size={18} dir="right" weight={3} />
            </Pressable>
            <Pressable onPress={onClose} hitSlop={10}>
              <CloseIcon size={14} />
            </Pressable>
          </View>
        </View>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 30 }} showsVerticalScrollIndicator={false}>
          <View style={styles.riskTitleRow}>
            <Text style={styles.riskTitle}>{hazard.title}</Text>
            <View style={[styles.sevChip, hazard.severity === 'high' && { backgroundColor: colors.orange }]}>
              <Text style={styles.sevTxt}>{SEVERITY_WORD[hazard.severity]}</Text>
            </View>
          </View>
          <Text style={styles.riskBody}>{hazard.why_it_matters}</Text>
          <Text style={styles.riskLabel}>What might help</Text>
          <Text style={styles.riskBody}>{hazard.recommendation}</Text>
          <Text style={styles.disclosure}>
            {index + 1} of {total} · Hazard flagging is a best-effort extra layer, not a full safety sweep.
          </Text>
        </ScrollView>
      </BlurView>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Peeking dog avatar (static); its mood shows in the speech bubble and report.

function DogAvatar({ evaluation, top, onPress }: { evaluation: Evaluation; top: number; onPress: () => void }) {
  const { mood, dog } = evaluation;

  return (
    <View style={[styles.dogWrap, { top }]} pointerEvents="box-none">
      <Pressable onPress={onPress}>
        <View>
          {evaluation.dog.cutout ? (
            <Image source={dog.happy} style={[styles.dogImg, mood === 'sad' && { opacity: 0.92 }]} resizeMode="contain" />
          ) : (
            // Dog API breeds have a photo, not cartoon art: show it as a round badge.
            <Image source={dog.happy} style={[styles.dogPhoto, mood === 'sad' && { opacity: 0.92 }]} resizeMode="cover" />
          )}
        </View>
      </Pressable>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Outside-3D summary report (spec §6.3): advisory first, whole-home Noise Fit,
// then the room's lines on the cramped↔spacious / hazardous↔safe spectrum.

const BAND_COLOR: Record<Band, string> = { poor: '#E4572E', adequate: colors.orange, good: '#5FAE7F' };

function ReportOverlay({
  evaluation: e,
  roomName,
  riskCount,
  onRisks,
  onClose,
}: {
  evaluation: Evaluation;
  roomName: string;
  riskCount: number;
  onRisks: () => void;
  onClose: () => void;
}) {
  // Slides up from the bottom of the map card; slides back down before closing.
  const slide = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(slide, { toValue: 1, useNativeDriver: true, damping: 18, stiffness: 160 }).start();
  }, [slide]);
  const dismiss = (then: () => void) =>
    Animated.timing(slide, { toValue: 0, duration: 220, easing: Easing.in(Easing.cubic), useNativeDriver: true }).start(then);
  // Drag the sheet down to close it (the grabber at the top hints at this).
  const drag = useRef(new Animated.Value(0)).current;
  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) => g.dy > 8 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderMove: (_e, g) => drag.setValue(Math.max(0, g.dy)),
      onPanResponderRelease: (_e, g) => {
        if (g.dy > 120 || g.vy > 1) {
          Animated.timing(drag, { toValue: 800, duration: 200, useNativeDriver: true }).start(() => onCloseRef.current());
        } else {
          Animated.spring(drag, { toValue: 0, useNativeDriver: true }).start();
        }
      },
    })
  ).current;
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const translateY = Animated.add(slide.interpolate({ inputRange: [0, 1], outputRange: [700, 0] }), drag);

  return (
    <Animated.View style={[styles.reportWrap, { transform: [{ translateY }] }]}>
      {/* Liquid glass: blur of the room photo behind, a white sheen and a bright edge. */}
      <BlurView intensity={60} tint="systemUltraThinMaterialLight" style={styles.report}>
        <View {...pan.panHandlers} style={styles.dragZone}>
        <View style={styles.grabber} />
        <View style={styles.sheetHead}>
          <Text style={styles.sheetTitle}>{e.currentOwner ? `Your ${e.dog.name}` : e.dog.name}</Text>
          <Pressable onPress={() => dismiss(onClose)} hitSlop={10}>
            <CloseIcon size={14} />
          </Pressable>
        </View>
        </View>
        <ScrollView contentContainerStyle={{ paddingBottom: 90 }} showsVerticalScrollIndicator={false}>
          {e.lines.advisory && (
            <View style={styles.advisory}>
              <Text style={styles.advisoryHead}>Not ready for this dog yet</Text>
              <Text style={styles.reportLine}>{e.lines.advisory}</Text>
            </View>
          )}

          <ReportRow heading="Noise fit, whole home" tag={e.labels.noise} band={e.noise} line={e.lines.noise} />

          <Text style={styles.roomHead}>{roomName}</Text>
          <View style={styles.toneRow}>
            <View style={[styles.toneDot, { backgroundColor: BAND_COLOR[e.tone] }]} />
            <Text style={styles.toneTxt}>{e.labels.tone}</Text>
          </View>
          <ReportRow heading="Space" tag={e.labels.space} band={e.space} line={e.lines.space} />
          <ReportRow heading="Safety" tag={e.labels.safety} band={e.safety} line={e.lines.safety} />

          {riskCount > 0 && (
            <Pressable style={styles.reportBtn} onPress={() => dismiss(onRisks)}>
              <Text style={styles.reportBtnTxt}>See what’s flagged in this room</Text>
            </Pressable>
          )}
          <Text style={styles.disclosure}>
            Breed only explains part of an individual dog’s behaviour, every dog is different. Room measurements are
            estimated from your photos.
          </Text>
        </ScrollView>
      </BlurView>
    </Animated.View>
  );
}

function ReportRow({ heading, tag, band, line }: { heading: string; tag: string; band: Band; line: string }) {
  return (
    <View style={styles.reportRow}>
      <View style={styles.reportRowHead}>
        <Text style={styles.reportRowTitle}>{heading}</Text>
        <View style={[styles.bandChip, { borderColor: BAND_COLOR[band] }]}>
          <Text style={[styles.bandTxt, { color: BAND_COLOR[band] }]}>{tag}</Text>
        </View>
      </View>
      <Text style={styles.reportLine}>“{line}”</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingHorizontal: 22, paddingTop: 6, paddingBottom: 18 },
  titleRow: { flexDirection: 'row', alignItems: 'center', marginTop: 14, alignSelf: 'flex-start', maxWidth: '62%' },
  trash: { marginLeft: 12 },
  h1: { flexShrink: 1, fontFamily: fonts.bold, color: colors.text, fontSize: 20 },
  sub: { fontFamily: fonts.regular, color: colors.text, fontSize: 15, lineHeight: 21, marginTop: 6 },

  breedPill: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.orange, borderRadius: 10, height: 27, paddingHorizontal: 12, marginTop: 0 },
  breedPillTxt: { fontFamily: fonts.regular, fontSize: 12, color: colors.text },

  card: { flex: 1, borderTopLeftRadius: 22, borderTopRightRadius: 22, overflow: 'hidden', backgroundColor: colors.track },
  selectBreed: { position: 'absolute', top: 11, left: 16, backgroundColor: colors.orange, borderRadius: 10, height: 28, paddingHorizontal: 14, justifyContent: 'center', borderWidth: 1, borderColor: '#fff' }, // same height as the 2D/3D toggle
  selectBreedTxt: { fontFamily: fonts.semibold, fontSize: 14, color: colors.text },
  pickPrompt: { position: 'absolute', left: 24, right: 24, top: '30%', backgroundColor: 'rgba(255,255,255,0.94)', borderRadius: 20, padding: 20, alignItems: 'center' },
  pickTitle: { fontFamily: fonts.semibold, fontSize: 17, color: colors.text, textAlign: 'center' },
  pickBody: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.textMuted, textAlign: 'center', marginTop: 6 },
  mapToggle: { position: 'absolute', top: 11, right: 16, width: 127, height: 28, backgroundColor: colors.track, borderRadius: 10, borderWidth: 1, borderColor: '#fff' },
  mapToggleTxt: { fontSize: 10.5 },

  pin: { position: 'absolute', width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(251,171,75,0.35)', alignItems: 'center', justifyContent: 'center' },
  pinOn: { backgroundColor: 'rgba(251,171,75,0.7)', transform: [{ scale: 1.15 }] },
  pageDots: { position: 'absolute', top: 50, alignSelf: 'center', flexDirection: 'row', gap: 4 },
  pageDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.8)' },

  // Re-run pill: icon + label so it's clear what the button does.
  fab: { position: 'absolute', right: 17, bottom: 118, // sits above the bottom nav
    height: 48, borderRadius: 24, paddingLeft: 14, paddingRight: 18, flexDirection: 'row', gap: 8, backgroundColor: colors.orange, borderWidth: 2, borderColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  fabTxt: { fontFamily: fonts.semibold, fontSize: 15, color: '#fff' },

  note: { position: 'absolute', left: 16, right: 16, top: 50, backgroundColor: 'rgba(255,255,255,0.88)', borderRadius: 10, padding: 8 },
  noteTxt: { fontFamily: fonts.regular, fontSize: 10.5, color: colors.text },

  sheetWrap: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '44%', borderTopLeftRadius: 22, borderTopRightRadius: 22, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.8)' },
  sheet: { flex: 1, backgroundColor: 'rgba(255,255,255,0.72)', paddingHorizontal: 27, paddingTop: 22 },
  sheetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  sheetTitle: { fontFamily: fonts.bold, fontSize: 19, color: colors.text, flexShrink: 1 },
  sheetCtrls: { flexDirection: 'row', alignItems: 'center', gap: 36 },
  riskTitleRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 6 },
  riskTitle: { fontFamily: fonts.semibold, fontSize: 15, color: colors.text },
  sevChip: { backgroundColor: colors.orangeLight, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2 },
  sevTxt: { fontFamily: fonts.medium, fontSize: 10, color: colors.text },
  riskLabel: { fontFamily: fonts.semibold, fontSize: 12.5, color: colors.text, marginTop: 10 },
  riskBody: { fontFamily: fonts.regular, fontSize: 12.5, lineHeight: 18, color: colors.text, marginTop: 2 },
  disclosure: { fontFamily: fonts.regular, fontSize: 10, lineHeight: 14, color: colors.textMuted, marginTop: 14 },

  dogWrap: { position: 'absolute', right: 28, alignItems: 'flex-end' },
  dogImg: { width: 140, height: 150 },
  dogPhoto: { width: 104, height: 104, borderRadius: 52, borderWidth: 4, borderColor: '#fff', marginTop: 12, marginBottom: 20, marginRight: 18, backgroundColor: colors.orangeLight }, // images are cropped tight; paws overlap the card by ~34pt
  bubble: { position: 'absolute', right: 172, maxWidth: 200, backgroundColor: colors.bg, borderRadius: 14, borderBottomRightRadius: 2, paddingHorizontal: 10, paddingVertical: 6, zIndex: 3, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
  bubbleTxt: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.text },

  // Same size as the map card, so it covers the 2D/3D toggle too.
  reportWrap: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 20 },
  report: { flex: 1, backgroundColor: 'rgba(255,255,255,0.72)', borderTopLeftRadius: 22, borderTopRightRadius: 22, borderWidth: 1, borderColor: 'rgba(255,255,255,0.8)', overflow: 'hidden', paddingHorizontal: 22, paddingTop: 10 },
  dragZone: { paddingTop: 2 },
  grabber: { alignSelf: 'center', width: 44, height: 5, borderRadius: 3, backgroundColor: 'rgba(0,0,0,0.18)', marginBottom: 14 },
  advisory: { backgroundColor: '#FDE3D6', borderRadius: 12, padding: 12, marginBottom: 12 },
  advisoryHead: { fontFamily: fonts.bold, fontSize: 13, color: colors.orangeDeep, marginBottom: 4 },
  roomHead: { fontFamily: fonts.bold, fontSize: 17, color: colors.text, marginTop: 16 },
  toneRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4, marginBottom: 4 },
  toneDot: { width: 9, height: 9, borderRadius: 5 },
  toneTxt: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.text },
  reportRow: { backgroundColor: colors.bg, borderRadius: 12, padding: 12, marginTop: 8 },
  reportRowHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  reportRowTitle: { fontFamily: fonts.semibold, fontSize: 13, color: colors.text },
  bandChip: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 1 },
  bandTxt: { fontFamily: fonts.semibold, fontSize: 10.5 },
  reportLine: { fontFamily: fonts.regular, fontSize: 12.5, lineHeight: 18, color: colors.text },
  reportBtn: { backgroundColor: colors.orange, borderRadius: 12, height: 48, alignItems: 'center', justifyContent: 'center', marginTop: 14 },
  reportBtnTxt: { fontFamily: fonts.semibold, fontSize: 15, color: colors.text },
});
