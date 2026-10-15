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
  GestureResponderEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';

import { TopBar, AvatarButton, Segmented, PrimaryButton } from '../components/kit';
import { FrameView, useFrameImageSize, imageToView, viewToImage } from '../components/FrameView';
import { Room3DView } from '../components/Room3DView';
import { LoadingView } from '../components/LoadingView';
import { SwipeUpNav } from '../components/SwipeUpNav';
import { AlertIcon, ChevronIcon, CloseIcon, EditIcon, RefreshRingIcon, TrashIcon } from '../components/icons';
import { HELP_TEXT } from './HomeScreen';
import { colors, fonts } from '../theme';
import { useSession, useCurrentSpace } from '../store/session';
import { runAssessment } from '../ai/assess';
import {
  evaluate,
  isTagEntry,
  REPORT_ROWS,
  runSnapshot,
  SEVERITY_WORD,
  TAG_WORD,
  type Band,
  type Evaluation,
  type SetupItem,
} from '../logic/evaluate';
import { diffRuns, hasChanges, type RunChanges } from '../logic/changes';
import { buildRecommendations, type RecommendationSet } from '../logic/recommend';
import type { Frame, Hazard, Tag } from '../types';
import type { ScreenProps } from '../navigation';

const MIN_LOADING_MS = 2200;

// Marking an area off-limits: the next tap on the map (or 3D view) drops the tag.
type Placing = { area: string } | null;

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
  const [recOpen, setRecOpen] = useState(false); // Recommendations / shopping panel
  const [placing, setPlacing] = useState<Placing>(null); // marking an off-limits area
  const addTag = useSession((s) => s.addTag);
  const removeTag = useSession((s) => s.removeTag);
  // "What's new" starts open in the report shown straight after a Re-run.
  const [whatsNewOpen, setWhatsNewOpen] = useState(false);
  // A "Suggested setup" item picked in the report, highlighted on the map.
  const [setupFocus, setSetupFocus] = useState<string | null>(null);
  const [cardH, setCardH] = useState(Math.round(height * 0.65));
  const [headerH, setHeaderH] = useState(160);

  // ---- run the assessment when asked (or when there is no result yet) ----
  const runRef = useRef(0);
  const analyse = async (opts?: { openReport?: boolean }) => {
    const id = ++runRef.current;
    setLoading(true);
    setLoadDone(false);
    setRiskIndex(null);
    setReportOpen(false);
    const started = Date.now();
    const cur = useSession.getState().current();
    if (cur) {
      const household = useSession.getState().household;
      // What the user saw last time: saved after the previous run (so edited answers
      // and tags count as changes too), or worked out now for older spaces.
      const before = opts?.openReport ? cur.runSnapshot ?? runSnapshot(cur, household) : null;
      const r = await runAssessment({ ...cur, questionnaire: { ...household } });
      if (id !== runRef.current) return;
      setResult(r.assessment, r.source, r.fallbackReason);
      const after = useSession.getState().current();
      if (after) {
        const snap = runSnapshot(after, useSession.getState().household);
        // Only a Re-run compares; a first run or a new breed starts fresh.
        useSession.getState().patchSpace({
          runSnapshot: snap,
          lastChanges: before ? diffRuns(before, snap, new Date().toISOString()) : undefined,
        });
      }
    }
    const wait = Math.max(0, MIN_LOADING_MS - (Date.now() - started));
    setTimeout(() => {
      if (id !== runRef.current) return;
      setLoadDone(true);
      setTimeout(() => {
        if (id !== runRef.current) return;
        setLoading(false);
        // Re-run: open the report straight away so the updated result is visible.
        setWhatsNewOpen(!!opts?.openReport);
        if (opts?.openReport) setReportOpen(true);
      }, 350);
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

  const recSet = useMemo(() => buildRecommendations(evaluation, result), [evaluation, result]);
  const offLimits = useMemo(() => (space?.tags ?? []).filter((t) => t.offLimits), [space?.tags]);

  // Drop an off-limits tag at a tapped point (frame -1 = the 3D view).
  const placeOffLimits = (frame: number, x: number, y: number) => {
    if (!placing) return;
    addTag({ label: placing.area || 'Off-limits', note: 'Off-limits', offLimits: true, frame, x, y });
    setPlacing(null);
  };
  const removeOffLimits = (t: Tag) =>
    Alert.alert('Remove this off-limits area?', t.label, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => removeTag(t.id) },
    ]);

  if (loading || !space) return <LoadingView done={loadDone} />;

  const hasDog = !!evaluation;
  const title = space.label || space.name;
  const frames = space.capture.frames;

  const reanalyse = () =>
    Alert.alert('Re-analyse this space?', 'Runs the analysis again with your latest household answers and tags.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Re-analyse', onPress: () => analyse({ openReport: true }) },
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
            setup={evaluation?.setup ?? []}
            setupFocus={setupFocus}
            offLimits={offLimits}
            width={width}
            height={cardH}
            selectedId={riskIndex != null ? risks[riskIndex]?.id : undefined}
            onPin={(id) => {
              setSetupFocus(null);
              setRiskIndex(risks.findIndex((r) => r.id === id));
            }}
            placing={!!placing}
            onPlace={placeOffLimits}
            onRemoveTag={removeOffLimits}
          />
        ) : result ? (
          <View style={StyleSheet.absoluteFill}>
            <Room3DView result={result} frameCount={frames.length} />

            {/* Off-limits areas marked in 3D (frame -1, positioned in view space). */}
            {offLimits
              .filter((t) => t.frame === -1)
              .map((t) => (
                <Pressable
                  key={t.id}
                  onPress={() => removeOffLimits(t)}
                  hitSlop={6}
                  style={[styles.offTag, { left: (t.x ?? 0.5) * width - 52, top: (t.y ?? 0.5) * cardH - 15 }]}
                >
                  <Text style={styles.offTagTxt} numberOfLines={1}>✕ {t.label}</Text>
                </Pressable>
              ))}

            {/* Tap-to-place while marking an off-limits area. */}
            {placing && (
              <Pressable
                style={StyleSheet.absoluteFill}
                onPress={(e) => placeOffLimits(-1, e.nativeEvent.locationX / width, e.nativeEvent.locationY / cardH)}
              >
                <View style={styles.placingVeil} pointerEvents="none" />
              </Pressable>
            )}

            {!placing && hasDog && riskIndex == null && !reportOpen && !recOpen && (
              <Pressable style={styles.addZoneBtn} onPress={() => setPlacing({ area: 'Off-limits area' })}>
                <Text style={styles.addZoneTxt}>✕  Add off-limits area</Text>
              </Pressable>
            )}
          </View>
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

        {/* Recommendations tab, top-left, level with the 2D/3D toggle. */}
        {hasDog && riskIndex == null && !reportOpen && !placing && (
          <Pressable style={styles.recTab} onPress={() => setRecOpen(true)}>
            <Text style={styles.recTabTxt}>Recommendations</Text>
            {recSet.recommendations.length > 0 && (
              <View style={styles.recCount}>
                <Text style={styles.recCountTxt}>{recSet.recommendations.length}</Text>
              </View>
            )}
          </Pressable>
        )}

        {placing && (
          <View style={styles.placingHint} pointerEvents="box-none">
            <Text style={styles.placingTxt}>Tap the {view === '2d' ? 'photo' : 'room'} to mark “{placing.area}” off-limits</Text>
            <Pressable onPress={() => setPlacing(null)} hitSlop={8}>
              <Text style={styles.placingCancel}>Cancel</Text>
            </Pressable>
          </View>
        )}

        {!!space.resultNote && view === '2d' && riskIndex == null && !reportOpen && !placing && (
          <View style={[styles.note, hasDog && { top: 76 }]} pointerEvents="none">
            <Text style={styles.noteTxt} numberOfLines={3}>{space.resultNote}</Text>
          </View>
        )}

        {riskIndex != null && risks[riskIndex] && (
          <RiskSheet
            hazard={risks[riskIndex]}
            tagged={isTagEntry(risks[riskIndex], space.tags)}
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
            changes={space.lastChanges}
            changesOpen={whatsNewOpen}
            roomName={title}
            riskCount={risks.length}
            onRisks={() => {
              setReportOpen(false);
              if (risks.length) setRiskIndex(0);
            }}
            onClose={() => {
              setReportOpen(false);
              setWhatsNewOpen(false); // later opens show it collapsed
            }}
            onEditProfile={() => {
              setReportOpen(false);
              navigation.navigate('Profile', { editHousehold: true });
            }}
            onShowSetup={(key) => {
              setReportOpen(false);
              setView('2d');
              setSetupFocus(key);
            }}
          />
        )}

        {recOpen && (
          <RecommendPanel
            recSet={recSet}
            offLimitCount={offLimits.length}
            onFenceOff={(area) => {
              setRecOpen(false);
              setView('2d');
              setPlacing({ area });
            }}
            onClose={() => setRecOpen(false)}
          />
        )}

        {hasPet && riskIndex == null && !reportOpen && !recOpen && !placing && (
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

      {riskIndex == null && !reportOpen && !recOpen && !placing && (
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
  setup,
  setupFocus,
  offLimits,
  width,
  height,
  selectedId,
  onPin,
  placing,
  onPlace,
  onRemoveTag,
}: {
  frames: Frame[];
  risks: Hazard[];
  setup: SetupItem[];
  setupFocus: string | null;
  offLimits: Tag[];
  width: number;
  height: number;
  selectedId?: string;
  onPin: (id: string) => void;
  placing: boolean;
  onPlace: (frame: number, x: number, y: number) => void;
  onRemoveTag: (t: Tag) => void;
}) {
  const [page, setPage] = useState(0);
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => setPage(Math.round(e.nativeEvent.contentOffset.x / width));
  // When a risk is picked (pin tap or the sheet's < >), jump to the photo it's on.
  const scrollRef = useRef<ScrollView>(null);
  const selectedFrame = risks.find((r) => r.id === selectedId)?.location?.frame_index;
  useEffect(() => {
    if (selectedFrame == null) return;
    scrollRef.current?.scrollTo({ x: selectedFrame * width, animated: true });
    setPage(selectedFrame);
  }, [selectedFrame, width]);
  // Same for a Suggested setup item picked in the report.
  const focusFrame = setup.find((s) => s.key === setupFocus)?.frame_index;
  useEffect(() => {
    if (focusFrame == null) return;
    scrollRef.current?.scrollTo({ x: focusFrame * width, animated: true });
    setPage(focusFrame);
  }, [focusFrame, setupFocus, width]);
  // Only suggestions with a position go on the map; the rest are listed in the report.
  const pinned = setup.filter((s) => s.x != null && s.y != null);
  return (
    <View style={StyleSheet.absoluteFill}>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        scrollEnabled={!placing}
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScroll}
      >
        {frames.map((f, i) => (
          <MapPage
            key={i}
            frame={f}
            width={width}
            height={height}
            risks={risks.filter((r) => r.location?.frame_index === i)}
            setup={pinned.filter((s) => s.frame_index === i)}
            setupFocus={setupFocus}
            offLimits={offLimits.filter((t) => t.frame === i)}
            selectedId={selectedId}
            onPin={onPin}
            placing={placing}
            onPlace={(x, y) => onPlace(i, x, y)}
            onRemoveTag={onRemoveTag}
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

// Suggested setup colours: keep out (red), dog spots (green), safety to add (dark).
const SETUP_COLOR: Record<SetupItem['kind'], string> = { keep_out: '#E4572E', dog_spot: '#5FAE7F', add: colors.text };
const SETUP_PIN_W = 120;

function MapPage({
  frame,
  width,
  height,
  risks,
  setup,
  setupFocus,
  offLimits,
  selectedId,
  onPin,
  placing,
  onPlace,
  onRemoveTag,
}: {
  frame: Frame;
  width: number;
  height: number;
  risks: Hazard[];
  setup: SetupItem[];
  setupFocus: string | null;
  offLimits: Tag[];
  selectedId?: string;
  onPin: (id: string) => void;
  placing: boolean;
  onPlace: (x: number, y: number) => void;
  onRemoveTag: (t: Tag) => void;
}) {
  const img = useFrameImageSize(frame);
  // While marking an off-limits area, a tap anywhere on the photo places it.
  const onPress = (e: GestureResponderEvent) => {
    if (!placing) return;
    const p = viewToImage(img, width, height, e.nativeEvent.locationX, e.nativeEvent.locationY);
    onPlace(p.x, p.y);
  };
  // The photo is cover-cropped, so a pin near its edge can fall outside the card;
  // keep every pin inside the visible area so nothing flagged is cut off.
  const PIN_INSET = 24;
  const pinAt = (h: Hazard) => {
    const p = imageToView(img, width, height, h.location!.x, h.location!.y);
    return {
      x: Math.max(PIN_INSET, Math.min(width - PIN_INSET, p.x)),
      y: Math.max(PIN_INSET + 40, Math.min(height - PIN_INSET, p.y)), // clear of the 2D/3D toggle
    };
  };
  // The risk sheet covers the bottom of the card; slide the photo up so the
  // selected pin sits in the visible part above it.
  const selected = risks.find((h) => h.id === selectedId);
  const visibleH = height * (1 - SHEET_SHARE);
  const selY = selected ? pinAt(selected).y : 0;
  const shift = selected && selY > visibleH - 50 ? Math.max(-(height * SHEET_SHARE), visibleH / 2 - selY) : 0;
  return (
    <Pressable style={{ width, height, overflow: 'hidden' }} onPress={onPress} disabled={!placing}>
      <View style={{ width, height, transform: [{ translateY: shift }] }} pointerEvents={placing ? 'none' : 'auto'}>
        <FrameView frame={frame} width={width} height={height} />
        {risks.map((h) => {
          const p = pinAt(h);
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
        {/* Suggested setup: labelled pills at the spot they apply to; tap for the reason. */}
        {setup.map((s) => {
          const p = imageToView(img, width, height, s.x!, s.y!);
          const cx = Math.max(SETUP_PIN_W / 2 + 6, Math.min(width - SETUP_PIN_W / 2 - 6, p.x));
          const cy = Math.max(PIN_INSET + 40, Math.min(height - PIN_INSET, p.y));
          const on = s.key === setupFocus;
          const c = SETUP_COLOR[s.kind];
          return (
            <View key={s.key} style={[styles.setupPinWrap, { left: cx - SETUP_PIN_W / 2, top: cy - 14 }]} pointerEvents="box-none">
              <Pressable
                onPress={() => Alert.alert(s.title, s.detail)}
                hitSlop={6}
                style={[styles.setupPin, { borderColor: c }, on && { backgroundColor: c, transform: [{ scale: 1.12 }] }]}
              >
                <View style={[styles.setupDot, { backgroundColor: on ? '#fff' : c }]} />
                <Text style={[styles.setupPinTxt, { color: on ? '#fff' : c }]} numberOfLines={1}>{s.pin}</Text>
              </Pressable>
            </View>
          );
        })}
        {/* Off-limits areas the owner marked; tap to remove. */}
        {offLimits.map((t) => {
          const p = imageToView(img, width, height, t.x ?? 0.5, t.y ?? 0.5);
          const cx = Math.max(58, Math.min(width - 58, p.x));
          const cy = Math.max(PIN_INSET + 40, Math.min(height - PIN_INSET, p.y));
          return (
            <Pressable key={t.id} onPress={() => onRemoveTag(t)} hitSlop={6} style={[styles.offTag, { left: cx - 52, top: cy - 15 }]}>
              <Text style={styles.offTagTxt} numberOfLines={1}>✕ {t.label}</Text>
            </Pressable>
          );
        })}
      </View>
      {placing && <View style={styles.placingVeil} pointerEvents="none" />}
    </Pressable>
  );
}

// Share of the map card the "Potential Risks!" sheet covers (matches styles.sheetWrap).
const SHEET_SHARE = 0.44;

// ---------------------------------------------------------------------------
// "Potential Risks!" frosted sheet: what's flagged, why, and the fix (P4.2).



function RiskSheet({
  hazard,
  tagged,
  index,
  total,
  onPrev,
  onNext,
  onClose,
}: {
  hazard: Hazard;
  tagged: boolean;
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
            {tagged ? (
              <View style={[styles.sevChip, { backgroundColor: colors.track }]}>
                <Text style={styles.sevTxt}>{TAG_WORD}</Text>
              </View>
            ) : (
              <View style={[styles.sevChip, hazard.severity === 'high' && { backgroundColor: colors.orange }]}>
                <Text style={styles.sevTxt}>{SEVERITY_WORD[hazard.severity]}</Text>
              </View>
            )}
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

// The three cutout images are cropped differently, so the Collie and Labrador sit
// a touch high next to the Frenchie — nudge just those two down to line them up.
const DOG_NUDGE: Record<string, number> = { border_collie: 16, labrador_retriever: 16 };

function DogAvatar({ evaluation, top, onPress }: { evaluation: Evaluation; top: number; onPress: () => void }) {
  const { mood, dog } = evaluation;
  const nudge = (dog.breed?.id && DOG_NUDGE[dog.breed.id]) || 0;

  return (
    <View style={[styles.dogWrap, { top: top + nudge }]} pointerEvents="box-none">
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
// Outside-3D summary report: the verdict, what to change, then one row per
// sub-score (logic v2, most heavily weighted first), and any profile nudges.

const BAND_COLOR: Record<Band, string> = { poor: '#E4572E', adequate: colors.orange, good: '#5FAE7F' };
const BAND_MARK: Record<Band, string> = { poor: '✕', adequate: '!', good: '✓' };

function ReportOverlay({
  evaluation: e,
  changes,
  changesOpen,
  roomName,
  riskCount,
  onRisks,
  onClose,
  onEditProfile,
  onShowSetup,
}: {
  evaluation: Evaluation;
  changes?: RunChanges;
  changesOpen: boolean;
  roomName: string;
  riskCount: number;
  onRisks: () => void;
  onClose: () => void;
  onEditProfile: () => void;
  onShowSetup: (key: string) => void;
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
          {/* Plain verdict first (user testing asked for a clear good-fit / bad-fit answer). */}
          <View style={[styles.verdict, { backgroundColor: BAND_COLOR[e.verdict] }]}>
            {/* Dark text on the light orange, white on green/red, for contrast. */}
            <Text style={[styles.verdictTitle, e.verdict === 'adequate' && { color: colors.text }]}>
              {BAND_MARK[e.verdict]}  {e.verdictTitle}
            </Text>
            <Text style={[styles.verdictRoom, e.verdict === 'adequate' && { color: colors.text }]}>{roomName}</Text>
            <Text style={[styles.verdictLine, e.verdict === 'adequate' && { color: colors.text }]}>{e.verdictLine}</Text>
          </View>

          {!!changes && <WhatsNew changes={changes} initiallyOpen={changesOpen} />}

          {e.changes.length > 0 && (
            <View style={styles.reportRow}>
              <Text style={styles.reportRowTitle}>What to change</Text>
              {e.changes.map((c, i) => (
                <View key={i} style={styles.changeItem}>
                  <Text style={styles.reportLine}>•</Text>
                  <Text style={[styles.reportLine, { flex: 1 }]}>{c}</Text>
                </View>
              ))}
            </View>
          )}

          {e.setup.length > 0 && (
            <View style={styles.reportRow}>
              <Text style={styles.reportRowTitle}>Suggested setup</Text>
              {SETUP_GROUPS.map((g) => {
                const items = e.setup.filter((s) => s.kind === g.kind);
                if (!items.length) return null;
                return (
                  <View key={g.kind} style={{ marginTop: 8 }}>
                    <View style={styles.setupGroupHead}>
                      <View style={[styles.setupDot, { backgroundColor: SETUP_COLOR[g.kind] }]} />
                      <Text style={styles.setupGroupTxt}>{g.label}</Text>
                    </View>
                    {items.map((s) => (
                      <View key={s.key} style={styles.setupItem}>
                        <Text style={styles.reportLine}>
                          <Text style={{ fontFamily: fonts.semibold }}>{s.title}. </Text>
                          {s.detail}
                        </Text>
                        {s.x != null && s.y != null && (
                          <Pressable onPress={() => dismiss(() => onShowSetup(s.key))} hitSlop={8} style={{ alignSelf: 'flex-start', marginTop: 2 }}>
                            <Text style={styles.nudgeLink}>Show on map</Text>
                          </Pressable>
                        )}
                      </View>
                    ))}
                  </View>
                );
              })}
            </View>
          )}

          {REPORT_ROWS.map((r) => (
            <ReportRow
              key={r.key}
              heading={r.heading}
              tag={e.labels[r.key]}
              band={e.bands[r.key]}
              line={e.lines[r.key]}
              chips={r.key === 'room' ? e.roomChips : undefined}
            />
          ))}

          {/* What the photos suggest vs the profile: a gentle prompt, never an automatic change. */}
          {e.nudges.length > 0 && (
            <View style={[styles.reportRow, styles.nudge]}>
              {e.nudges.map((n) => (
                <Text key={n.id} style={styles.reportLine}>{n.text}</Text>
              ))}
              <Pressable onPress={() => dismiss(onEditProfile)} hitSlop={8} style={{ marginTop: 6 }}>
                <Text style={styles.nudgeLink}>Update profile</Text>
              </Pressable>
            </View>
          )}

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

// "What's new since your last run": shown after a Re-run, grouped and collapsible.
function WhatsNew({ changes: c, initiallyOpen }: { changes: RunChanges; initiallyOpen: boolean }) {
  const [open, setOpen] = useState(initiallyOpen);
  const when = new Date(c.at);
  const time = isNaN(when.getTime())
    ? ''
    : when.toLocaleString(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
  const any = hasChanges(c);
  const groups: { label: string; mark: string; color: string; items: string[] }[] = [
    { label: 'Newly flagged', mark: '+', color: '#E4572E', items: c.added },
    { label: 'No longer flagged', mark: '−', color: '#5FAE7F', items: c.removed },
    { label: 'Changed', mark: '~', color: colors.orangeDeep, items: c.changed.map((x) => `${x.title}: ${x.from} → ${x.to}`) },
    { label: 'New suggestions', mark: '+', color: colors.text, items: c.setupAdded },
    { label: 'Suggestions removed', mark: '−', color: colors.textMuted, items: c.setupRemoved },
  ];
  return (
    <View style={[styles.reportRow, styles.whatsNew]}>
      <Pressable onPress={() => setOpen((o) => !o)} hitSlop={6} style={styles.whatsNewHead} accessibilityRole="button">
        <View style={{ flex: 1 }}>
          <Text style={styles.reportRowTitle}>What’s new since your last run</Text>
          {!!time && <Text style={styles.whatsNewTime}>Re-run {time}</Text>}
        </View>
        <View style={{ transform: [{ rotate: open ? '90deg' : '0deg' }] }}>
          <ChevronIcon size={12} dir="right" />
        </View>
      </Pressable>
      {open &&
        (!any ? (
          <Text style={[styles.reportLine, { marginTop: 6 }]}>
            No changes. To see a different result, update your profile answers or tags, or capture new photos.
          </Text>
        ) : (
          <View style={{ marginTop: 4 }}>
            {!!c.verdict && (
              <Text style={[styles.reportLine, { marginTop: 4 }]}>
                <Text style={{ fontFamily: fonts.semibold }}>Verdict: </Text>
                {c.verdict.from} → {c.verdict.to}
              </Text>
            )}
            {c.rows.map((r) => (
              <Text key={r.heading} style={[styles.reportLine, { marginTop: 4 }]}>
                <Text style={{ fontFamily: fonts.semibold }}>{r.heading}: </Text>
                {r.from} → {r.to}
              </Text>
            ))}
            {groups
              .filter((g) => g.items.length)
              .map((g) => (
                <View key={g.label} style={{ marginTop: 8 }}>
                  <Text style={styles.setupGroupTxt}>{g.label}</Text>
                  {g.items.map((t, i) => (
                    <View key={i} style={styles.changeItem}>
                      <Text style={[styles.reportLine, { color: g.color, fontFamily: fonts.semibold, width: 10 }]}>{g.mark}</Text>
                      <Text style={[styles.reportLine, { flex: 1 }]}>{t}</Text>
                    </View>
                  ))}
                </View>
              ))}
          </View>
        ))}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Recommendations + shopping list (spec §6.3 / §8), from the top-left tab.

const SEV_COLOR: Record<Hazard['severity'], string> = { high: '#E4572E', medium: colors.orange, low: '#5FAE7F' };
const SEV_LABEL: Record<Hazard['severity'], string> = { high: 'Priority', medium: 'Worth doing', low: 'Nice to have' };

function RecommendPanel({
  recSet,
  offLimitCount,
  onFenceOff,
  onClose,
}: {
  recSet: RecommendationSet;
  offLimitCount: number;
  onFenceOff: (area: string) => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<'improve' | 'shop'>('improve');
  const { recommendations, shopping } = recSet;
  return (
    <View style={styles.sheetWrap}>
      <BlurView intensity={40} tint="light" style={styles.sheet}>
        <View style={styles.sheetHead}>
          <Text style={styles.sheetTitle}>Recommendations</Text>
          <Pressable onPress={onClose} hitSlop={10}>
            <CloseIcon size={14} />
          </Pressable>
        </View>

        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: 'improve', label: `Improve (${recommendations.length})` },
            { value: 'shop', label: `Shopping (${shopping.length})` },
          ]}
          height={40}
          activeColor={colors.orange}
          style={{ marginBottom: 12 }}
          textStyle={{ fontFamily: fonts.semibold, fontSize: 12 }}
        />

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 30 }} showsVerticalScrollIndicator={false}>
          {tab === 'improve' ? (
            recommendations.length === 0 ? (
              <Text style={styles.recEmpty}>No changes needed, this space already suits your dog. Nice work!</Text>
            ) : (
              recommendations.map((r) => (
                <View key={r.id} style={styles.recCard}>
                  <View style={styles.recCardHead}>
                    <Text style={styles.recCardTitle}>{r.title}</Text>
                    <View style={[styles.recSev, { backgroundColor: SEV_COLOR[r.severity] }]}>
                      <Text style={styles.recSevTxt}>{SEV_LABEL[r.severity]}</Text>
                    </View>
                  </View>
                  <Text style={styles.recArea}>{r.area}</Text>
                  <Text style={styles.recDetail}>{r.detail}</Text>
                  {r.offLimits && (
                    <Pressable style={styles.recFenceBtn} onPress={() => onFenceOff(r.area)}>
                      <Text style={styles.recFenceTxt}>✕  Mark this area off-limits</Text>
                    </Pressable>
                  )}
                </View>
              ))
            )
          ) : shopping.length === 0 ? (
            <Text style={styles.recEmpty}>Nothing to buy, no hazards or gaps found for your dog.</Text>
          ) : (
            <>
              {shopping.map((s) => (
                <View key={s.id} style={styles.shopCard}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.shopItem}>{s.item}</Text>
                    <Text style={styles.shopWhy}>{s.why}</Text>
                  </View>
                  {s.offLimits && (
                    <Pressable style={styles.shopTagBtn} onPress={() => onFenceOff(s.area || s.item)}>
                      <Text style={styles.shopTagTxt}>Fence off</Text>
                    </Pressable>
                  )}
                </View>
              ))}
              <Text style={styles.disclosure}>
                {offLimitCount > 0 ? `${offLimitCount} off-limits ${offLimitCount === 1 ? 'area' : 'areas'} marked. ` : ''}
                Products are general suggestions tied to what was found, not specific brands.
              </Text>
            </>
          )}
        </ScrollView>
      </BlurView>
    </View>
  );
}

const SETUP_GROUPS: { kind: SetupItem['kind']; label: string }[] = [
  { kind: 'keep_out', label: 'Keep the dog out' },
  { kind: 'dog_spot', label: 'Good spots for the dog' },
  { kind: 'add', label: 'Safety to add' },
];

function ReportRow({ heading, tag, band, line, chips }: { heading: string; tag: string; band: Band; line: string; chips?: string[] }) {
  return (
    <View style={styles.reportRow}>
      <View style={styles.reportRowHead}>
        <Text style={styles.reportRowTitle}>{heading}</Text>
        <View style={[styles.bandChip, { borderColor: BAND_COLOR[band] }]}>
          <Text style={[styles.bandTxt, { color: BAND_COLOR[band] }]}>{BAND_MARK[band]} {tag}</Text>
        </View>
      </View>
      <Text style={styles.reportLine}>“{line}”</Text>
      {!!chips?.length && (
        <View style={styles.rowChips}>
          {chips.map((c) => (
            <View key={c} style={styles.rowChip}>
              <Text style={styles.rowChipTxt}>{c}</Text>
            </View>
          ))}
        </View>
      )}
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
  mapToggleTxt: { fontFamily: fonts.semibold, fontSize: 10.5 },

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

  sheetWrap: { position: 'absolute', left: 0, right: 0, bottom: 0, height: `${SHEET_SHARE * 100}%`, borderTopLeftRadius: 22, borderTopRightRadius: 22, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.8)' },
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
  verdict: { borderRadius: 12, padding: 14, marginBottom: 6 },
  verdictTitle: { fontFamily: fonts.bold, fontSize: 18, color: '#fff' },
  verdictRoom: { fontFamily: fonts.medium, fontSize: 12.5, color: '#fff', marginTop: 2, opacity: 0.9 },
  verdictLine: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 19, color: '#fff', marginTop: 6 },
  reportRow: { backgroundColor: colors.bg, borderRadius: 12, padding: 12, marginTop: 8 },
  reportRowHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  reportRowTitle: { fontFamily: fonts.semibold, fontSize: 13, color: colors.text },
  bandChip: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 1 },
  bandTxt: { fontFamily: fonts.semibold, fontSize: 10.5 },
  reportLine: { fontFamily: fonts.regular, fontSize: 12.5, lineHeight: 18, color: colors.text },
  changeItem: { flexDirection: 'row', gap: 6, marginTop: 4 },
  rowChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  rowChip: { backgroundColor: colors.bg2, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  rowChipTxt: { fontFamily: fonts.medium, fontSize: 11, color: colors.text },
  nudge: { borderLeftWidth: 4, borderLeftColor: colors.orange },
  nudgeLink: { fontFamily: fonts.semibold, fontSize: 12.5, color: colors.orangeDeep, textDecorationLine: 'underline' },
  setupPinWrap: { position: 'absolute', width: SETUP_PIN_W, alignItems: 'center' },
  setupPin: { flexDirection: 'row', alignItems: 'center', gap: 5, height: 28, maxWidth: SETUP_PIN_W, backgroundColor: 'rgba(255,255,255,0.94)', borderRadius: 10, borderWidth: 1.5, paddingHorizontal: 9 },
  setupDot: { width: 8, height: 8, borderRadius: 4 },
  setupPinTxt: { fontFamily: fonts.semibold, fontSize: 11.5, flexShrink: 1 },
  setupGroupHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  setupGroupTxt: { fontFamily: fonts.semibold, fontSize: 12, color: colors.textMuted },
  setupItem: { marginTop: 5, marginLeft: 14 },
  whatsNew: { borderLeftWidth: 4, borderLeftColor: colors.orangeDeep },

  // Recommendations tab (top-left, level with the 2D/3D toggle when a dog is chosen).
  recTab: { position: 'absolute', top: 34, left: 16, height: 36, flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 14, borderWidth: 1, borderColor: colors.orange },
  recTabTxt: { fontFamily: fonts.semibold, fontSize: 14, color: colors.text },
  recCount: { minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 5, backgroundColor: colors.orange, alignItems: 'center', justifyContent: 'center' },
  recCountTxt: { fontFamily: fonts.bold, fontSize: 11.5, color: '#fff' },

  // Off-limits placing hint, veil and markers.
  placingHint: { position: 'absolute', top: 76, left: 16, right: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, backgroundColor: '#E4572E', borderRadius: 10, paddingVertical: 9, paddingHorizontal: 12 },
  placingTxt: { flex: 1, fontFamily: fonts.semibold, fontSize: 12.5, color: '#fff' },
  placingCancel: { fontFamily: fonts.bold, fontSize: 12.5, color: '#fff', textDecorationLine: 'underline' },
  placingVeil: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(228,87,46,0.14)' },
  offTag: { position: 'absolute', width: 104, height: 30, borderRadius: 8, backgroundColor: 'rgba(228,87,46,0.92)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6, borderWidth: 1.5, borderColor: '#fff' },
  offTagTxt: { fontFamily: fonts.semibold, fontSize: 11, color: '#fff' },
  addZoneBtn: { position: 'absolute', left: 16, bottom: 118, flexDirection: 'row', alignItems: 'center', backgroundColor: '#E4572E', borderRadius: 22, paddingVertical: 12, paddingHorizontal: 16, shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
  addZoneTxt: { fontFamily: fonts.semibold, fontSize: 13.5, color: '#fff' },

  // Recommendations panel cards.
  recEmpty: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.textMuted, textAlign: 'center', marginTop: 30 },
  recCard: { backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 10 },
  recCardHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  recCardTitle: { flex: 1, fontFamily: fonts.semibold, fontSize: 15, color: colors.text },
  recSev: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  recSevTxt: { fontFamily: fonts.semibold, fontSize: 10, color: '#fff' },
  recArea: { fontFamily: fonts.semibold, fontSize: 11.5, color: colors.orangeDeep, marginTop: 4 },
  recDetail: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.text, marginTop: 4 },
  recFenceBtn: { alignSelf: 'flex-start', marginTop: 10, backgroundColor: '#FDE7DE', borderRadius: 9, paddingVertical: 8, paddingHorizontal: 12 },
  recFenceTxt: { fontFamily: fonts.semibold, fontSize: 12.5, color: '#E4572E' },
  shopCard: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 10 },
  shopItem: { fontFamily: fonts.semibold, fontSize: 14.5, color: colors.text },
  shopWhy: { fontFamily: fonts.regular, fontSize: 12.5, lineHeight: 17, color: colors.textMuted, marginTop: 2 },
  shopTagBtn: { backgroundColor: '#E4572E', borderRadius: 9, paddingVertical: 8, paddingHorizontal: 12 },
  shopTagTxt: { fontFamily: fonts.semibold, fontSize: 12, color: '#fff' },
  whatsNewHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  whatsNewTime: { fontFamily: fonts.regular, fontSize: 11.5, color: colors.textMuted, marginTop: 2 },
  reportBtn: { backgroundColor: colors.orange, borderRadius: 12, height: 48, alignItems: 'center', justifyContent: 'center', marginTop: 14 },
  reportBtnTxt: { fontFamily: fonts.semibold, fontSize: 15, color: colors.text },
});
