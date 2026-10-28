// Space analysis — the "Living Room" view. Runs the assessment (with the
// "Un-fur-ling details…" loading state), then shows the room as a 2D photo map with
// risk pins, the "Potential Risks!" sheet, and — once a breed is
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
import { LoadingView } from '../components/LoadingView';
import { SwipeUpNav } from '../components/SwipeUpNav';
import { AlertIcon, ChevronIcon, CloseIcon, EditIcon, RefreshRingIcon, TrashIcon } from '../components/icons';
import { HELP_TEXT } from './HomeScreen';
import { colors, fonts } from '../theme';
import { useSession, useCurrentSpace } from '../store/session';
import { runAssessment } from '../ai/assess';
import { withPhotoData } from '../capture/upload';
import { ResultsOverview, type StartHere } from '../components/results/Overview';
import { GuideSheet } from '../components/GuideSheet';
import { RecheckSheet, SinceCard } from '../components/results/Recheck';
import { NoDogYet } from '../components/results/NoDogYet';
import { SCAN_GUIDE } from './CaptureScreen';
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
import { buildRecommendations, buildTodo, todoCount, type RecommendationSet } from '../logic/recommend';
import type { Frame, Hazard, Tag } from '../types';
import type { ScreenProps } from '../navigation';

const MIN_LOADING_MS = 2200;

// Marking an area off-limits: the next tap on the map drops the tag.
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
  const [riskIndex, setRiskIndex] = useState<number | null>(null);
  // The results overview is the main view once a breed is picked; Map shows the photos.
  const [reportOpen, setReportOpen] = useState(true);
  const [tipsOpen, setTipsOpen] = useState(false); // "Photo tips" (scanning guide)
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
      const frames = await withPhotoData(cur.capture.frames);
      if (id !== runRef.current) return;
      const r = await runAssessment({ ...cur, capture: { ...cur.capture, frames }, questionnaire: { ...household } });
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
        if (opts?.openReport) {
          setReportOpen(true);
          navigation.navigate('WhatChanged'); // R4 / R4b, then back to the updated results
        }
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

  // Re-check: open the sheet (from the to-do list), or re-run and compare (from Capture).
  const [recheckOpen, setRecheckOpen] = useState(false);
  useEffect(() => {
    if (route.params?.recheck) {
      setRecheckOpen(true);
      navigation.setParams({ recheck: undefined });
    }
    if (route.params?.compare) {
      navigation.setParams({ compare: undefined });
      analyse({ openReport: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route.params?.recheck, route.params?.compare]);

  // Item detail → "Keep the dog out of here": switch to the map and place an off-limits tag.
  useEffect(() => {
    if (!route.params?.place) return;
    setReportOpen(false);
    setPlacing({ area: route.params.place });
    navigation.setParams({ place: undefined });
  }, [route.params?.place, navigation]);

  // Coming back from Select breed → show the report once the analysis is done.
  useEffect(() => {
    if (route.params?.report && !loading) {
      setReportOpen(true);
      navigation.setParams({ report: undefined });
    }
  }, [route.params?.report, loading, navigation]);

  const result = space?.result ?? null;
  // The model couldn't see a room in the photos: say so, in place of the usual note.
  const photoNote =
    result?.photo_check?.usable === false
      ? result.photo_check.note || 'We couldn’t quite see the room. Try again with the lights on, and we’ll take another look.'
      : null;
  const bannerNote = photoNote ?? space?.resultNote;
  // The report always opens with one clear next step when the photos weren't really
  // checked (wording from the Results guide, step 3 "Special states").
  const notChecked: NotChecked | null = !result
    ? { title: 'Let’s check your room', body: 'We haven’t looked at your photos yet. It only takes a moment.', action: 'rerun', button: 'Check my room' }
    : space?.resultSource === 'mock'
      ? space.resultNote
        ? {
            title: 'This is an example result, not your room',
            body: `${/quota/i.test(space.resultNote) ? 'The free AI limit is used up for today' : /busy/i.test(space.resultNote) ? 'The AI was busy' : 'The AI couldn’t be reached'}, so you’re seeing an example. Your photos and answers are saved.`,
            action: 'rerun',
            button: 'Try again',
          }
        : { title: 'This is an example result, not your room', body: 'Real AI is turned off, so you’re seeing an example. Your photos and answers are saved.', action: null }
      : photoNote
        ? { title: 'Retake your photos', body: result.photo_check?.note || 'We couldn’t quite see the room. Try again with the lights on.', action: 'retake', button: 'Retake photos' }
        : null;
  const evaluation = useMemo(() => (space ? evaluate(space, household) : null), [space, household]);

  // Located hazards first (they have pins), then whole-room findings.
  const risks = useMemo(() => {
    const hz = result?.hazards ?? [];
    return [...hz.filter((h) => h.scope === 'object' && h.location), ...hz.filter((h) => !(h.scope === 'object' && h.location))];
  }, [result]);

  const recSet = useMemo(() => buildRecommendations(evaluation, result), [evaluation, result]);
  const offLimits = useMemo(() => (space?.tags ?? []).filter((t) => t.offLimits), [space?.tags]);

  // Drop an off-limits tag at a tapped point on a photo.
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

  // ---- No dog chosen yet: "Who's moving in?" (Results guide step 5, B1) ----
  if (!hasPet) {
    return (
      <NoDogYet
        title={title}
        photo={frames[0]}
        onBack={goHome}
        onHelpChoose={() => navigation.navigate('SelectBreed', { mode: 'explore' })}
        onInMind={() => navigation.navigate('SelectBreed', { mode: 'in_mind' })}
      />
    );
  }

  // ---- Results overview (Results guide step 2, Part A) ----
  if (hasDog && reportOpen && evaluation) {
    const e = evaluation;
    const todo = buildTodo(e, result);
    const n = todoCount(todo);
    const openMap = () => navigation.navigate('ResultsMap');
    const openList = () => navigation.navigate('Todo');
    const map = { label: 'Map', onPress: openMap };
    const things = (k: number) => (k === 1 ? '1 thing to sort' : `${k} things to sort`);
    const counted = new Set(e.score.safety.counted.map((c) => c.key));
    const gateItem =
      e.gates.includes('escape') || e.gates.includes('toxic')
        ? risks.find(
            (h) =>
              counted.has(h.object_key ?? h.title.toLowerCase()) &&
              (e.gates.includes('escape') ? h.hazard_type === 'escape_fall' : h.hazard_type === 'toxic_ingestible' && !h.easy_fix)
          )
        : undefined;
    const routineMissing = e.score.unknown.includes('routine');
    // Special states (Results guide step 3), first that applies: example → photos → routine.
    const example = space.resultSource === 'mock';
    const unclear = !example && result?.photo_check?.usable === false;
    const routineLeft = (['owner_activity', 'exercise_time', 'hours_alone'] as const).filter((k) => household[k] == null).length;
    const startHere: StartHere = !result
      ? {
          tone: 'unknown',
          label: 'HELP ME SEE',
          heading: 'Let’s check your room',
          body: 'We haven’t looked at your photos yet. It only takes a moment.',
          primary: { label: 'Check my room', onPress: () => analyse({ openReport: true }) },
        }
      : example
        ? {
            tone: 'unknown',
            label: 'HELP ME SEE',
            heading: 'Try the analysis again',
            body: 'It only takes a moment. If it’s still busy, try again a bit later.',
            ...(space.resultNote
              ? { primary: { label: 'Try again', onPress: () => analyse({ openReport: true }) }, secondary: { label: 'See what to sort', onPress: openList } }
              : { primary: { label: 'See what to sort', onPress: openList } }), // AI turned off: nothing to retry
          }
        : unclear
          ? {
              tone: 'unknown',
              label: 'HELP ME SEE',
              heading: 'Retake your photos',
              body: result.photo_check?.note || 'We couldn’t quite see the room. Try again with the lights on.',
              primary: { label: 'Retake photos', onPress: () => navigation.navigate('Capture') },
              secondary: { label: 'Photo tips', onPress: () => setTipsOpen(true) },
            }
      : e.gates.length
        ? {
            tone: 'plan',
            label: 'DO FIRST',
            heading: gateItem?.title ?? (e.gates[0] === 'energy' ? 'Plan daily walks and play' : 'Make the room safe first'),
            body: [gateItem?.recommendation, n > 1 ? `Then ${things(n - 1).replace(' to sort', '')} to sort.` : ''].filter(Boolean).join(' '),
            primary: {
              label: 'Show me how',
              onPress: () => navigation.navigate('ItemDetail', { id: gateItem ? `hz-${gateItem.id}` : todo[0]?.id ?? 'dog-exercise' }),
            },
            secondary: map,
          }
        : routineMissing
          ? {
              tone: 'unknown',
              label: 'HELP ME SEE',
              heading: routineLeft === 1 ? 'Answer 1 quick question' : `Answer ${routineLeft || 'a few'} quick questions`,
              body: 'Tell me about your days so I know we’ll keep up: how active you are, daily walks and time alone.',
              primary: { label: 'Answer now', onPress: () => navigation.navigate('Profile', { editHousehold: true, focus: 'routine' }) },
              secondary: { label: 'See what to sort', onPress: openList },
            }
          : n > 0
            ? {
                tone: 'work',
                label: 'START HERE',
                heading: things(n),
                body: e.changes.slice(0, 3).join(' '),
                primary: { label: 'See what to do', onPress: openList },
                secondary: map,
              }
            : {
                tone: 'good',
                label: 'ALL SET',
                heading: 'Nothing to sort',
                body: 'Have a look at My favourite spots for where a bed and bowls could go.',
                primary: { label: 'See setup ideas', onPress: openMap },
              };
    const photosOff = e.labels.safety === 'Not checked yet';
    return (
      <View style={{ flex: 1 }}>
        <ResultsOverview
          evaluation={e}
          title={title}
          photo={frames[0]}
          startHere={startHere}
          needUnknown={{ safety: photosOff, room: e.labels.room === 'Not checked yet', energy: e.score.energy.undecided }}
          onBack={goHome}
          onBreed={() => navigation.navigate('SelectBreed', { mode: space.mode === 'explore' ? 'explore' : 'in_mind' })}
          onNeed={(need) => navigation.navigate('Todo', { need })}
          onProfile={() => navigation.navigate('Profile', { editHousehold: true })}
          aboveStart={space.lastChanges && hasChanges(space.lastChanges) ? <SinceCard changes={space.lastChanges} onSee={() => navigation.navigate('WhatChanged')} /> : null}
          onRecheck={() => setRecheckOpen(true)}
          notice={
            example
              ? {
                  title: 'This is an example result, not your room',
                  body: `${
                    !space.resultNote ? 'Real AI is turned off' : /quota/i.test(space.resultNote) ? 'The free AI limit is used up for today' : /busy/i.test(space.resultNote) ? 'The AI was busy' : 'The AI couldn’t be reached'
                  }, so you’re seeing an example. Your photos and answers are saved.`,
                }
              : null
          }
        />
        <RecheckSheet
          visible={recheckOpen}
          canReuse={frames.length > 0}
          onClose={() => setRecheckOpen(false)}
          onRetake={() => {
            setRecheckOpen(false);
            navigation.navigate('Capture', { recheck: true });
          }}
          onReuse={() => {
            setRecheckOpen(false);
            analyse({ openReport: true });
          }}
        />
        <GuideSheet visible={tipsOpen} heading="How to scan" steps={SCAN_GUIDE} doneLabel="Got it" onClose={() => setTipsOpen(false)} />
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: hasDog ? colors.bg2 : colors.bg }]}>
      <SafeAreaView edges={['top']} style={styles.header}>
        <TopBar
          onBack={hasDog ? () => setReportOpen(true) : goHome} // map → back to the overview
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

        {!hasDog && (
          <Pressable style={styles.selectBreed} onPress={selectBreed}>
            <Text style={styles.selectBreedTxt}>Select breed</Text>
          </Pressable>
        )}
        {!hasPet && (
          <View style={styles.pickPrompt}>
            <Text style={styles.pickTitle}>Pick a dog to see how they’d feel here!</Text>
            <Text style={styles.pickBody}>
              Pick a breed yourself, or answer a few quick questions to get suggestions, the analysis runs as soon as you select one or hit the re-run button anytime to re-analyse.
            </Text>
            <PrimaryButton label="Select breed" onPress={selectBreed} style={{ marginTop: 14, alignSelf: 'stretch' }} />
          </View>
        )}

        {/* Top-left tabs: Recommendations, and Report to reopen the fit report after
            it's been closed (testers couldn't find the way back via the dog). */}
        {hasDog && riskIndex == null && !reportOpen && !placing && (
          <View style={styles.tabRow}>
            <Pressable style={styles.recTab} onPress={() => setRecOpen(true)}>
              <Text style={styles.recTabTxt}>Recommendations</Text>
              {recSet.recommendations.length > 0 && (
                <View style={styles.recCount}>
                  <Text style={styles.recCountTxt}>{recSet.recommendations.length}</Text>
                </View>
              )}
            </Pressable>
            {!recOpen && (
              <Pressable style={[styles.recTab, styles.reportTab]} onPress={() => setReportOpen(true)} accessibilityLabel="Open the fit report">
                <Text style={styles.recTabTxt}>Report</Text>
              </Pressable>
            )}
          </View>
        )}

        {placing && (
          <View style={styles.placingHint} pointerEvents="box-none">
            <Text style={styles.placingTxt}>Tap the photo to mark “{placing.area}” off-limits</Text>
            <Pressable onPress={() => setPlacing(null)} hitSlop={8}>
              <Text style={styles.placingCancel}>Cancel</Text>
            </Pressable>
          </View>
        )}

        {!!bannerNote && riskIndex == null && !reportOpen && !placing && (
          <View style={[styles.note, hasDog && { top: 76 }, !!photoNote && styles.noteWarn]} pointerEvents="none">
            <Text style={[styles.noteTxt, !!photoNote && styles.noteWarnTxt]} numberOfLines={3}>{bannerNote}</Text>
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
            notChecked={notChecked}
            onRerun={() => analyse({ openReport: true })} // the card's button is the confirmation
            onRetake={() => {
              setReportOpen(false);
              navigation.navigate('Capture'); // same space: new photos replace the old ones
            }}
            onShowSetup={(key) => {
              setReportOpen(false);
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
          <Text style={styles.sheetTitle}>Things to sort</Text>
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
          <Text style={styles.riskLabel}>What to do</Text>
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
const BAND_MARK: Record<Band, string> = { poor: '○', adequate: '◐', good: '✓' };
type NotChecked =
  | { title: string; body: string; action: 'rerun' | 'retake'; button: string }
  | { title: string; body: string; action: null };

const BAND_TINT: Record<Band, string> = { poor: '#FBE3DC', adequate: colors.peach, good: '#E3F2E8' };

function ReportOverlay({
  evaluation: e,
  changes,
  changesOpen,
  riskCount,
  onRisks,
  onClose,
  onEditProfile,
  onShowSetup,
  notChecked,
  onRerun,
  onRetake,
}: {
  evaluation: Evaluation;
  changes?: RunChanges;
  changesOpen: boolean;
  riskCount: number;
  onRisks: () => void;
  onClose: () => void;
  onEditProfile: () => void;
  onShowSetup: (key: string) => void;
  notChecked: NotChecked | null; // what to do when the photos weren't checked
  onRerun: () => void;
  onRetake: () => void;
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
          {/* Plain verdict first (user testing asked for a clear good-fit / bad-fit answer):
              a soft tint of the verdict colour, a round badge with the mark, then the words. */}
          <View style={[styles.verdict, { backgroundColor: BAND_TINT[e.verdict] }]}>
            <View style={[styles.verdictBadge, { backgroundColor: BAND_COLOR[e.verdict] }]}>
              <Text style={styles.verdictMark}>{BAND_MARK[e.verdict]}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.verdictTitle}>{e.verdictTitle}</Text>
              <Text style={styles.verdictLine}>{e.verdictLine}</Text>
            </View>
          </View>
          {!!notChecked && (
            <View style={styles.rerunCard}>
              <Text style={styles.rerunTitle}>{notChecked.title}</Text>
              <Text style={styles.rerunTxt}>{notChecked.body}</Text>
              {notChecked.action && (
                <PrimaryButton
                  label={notChecked.button}
                  onPress={() => dismiss(notChecked.action === 'retake' ? onRetake : onRerun)}
                  style={{ marginTop: 12 }}
                />
              )}
            </View>
          )}

          {!!changes && <WhatsNew changes={changes} initiallyOpen={changesOpen} />}

          {e.changes.length > 0 && (
            <View style={styles.reportRow}>
              <Text style={styles.reportRowTitle}>Start here</Text>
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
              <Text style={styles.reportBtnTxt}>See everything to sort</Text>
            </Pressable>
          )}
          <Text style={styles.disclosure}>
            Every dog is different, and breed is only part of the story. We spot what we can from your photos, so give
            the room a once-over yourself too.
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
    { label: 'New things to sort', mark: '+', color: '#E4572E', items: c.added },
    { label: 'Sorted!', mark: '−', color: '#5FAE7F', items: c.removed },
    { label: 'Updated', mark: '~', color: colors.orangeDeep, items: c.changed.map((x) => `${x.title}: ${x.from} → ${x.to}`) },
    { label: 'New ideas', mark: '+', color: colors.text, items: c.setupAdded },
    { label: 'No longer needed', mark: '−', color: colors.textMuted, items: c.setupRemoved },
  ];
  return (
    <View style={[styles.reportRow, styles.whatsNew]}>
      <Pressable onPress={() => setOpen((o) => !o)} hitSlop={6} style={styles.whatsNewHead} accessibilityRole="button">
        <View style={{ flex: 1 }}>
          <Text style={styles.reportRowTitle}>Since last time</Text>
          {!!time && <Text style={styles.whatsNewTime}>Re-run {time}</Text>}
        </View>
        <View style={{ transform: [{ rotate: open ? '90deg' : '0deg' }] }}>
          <ChevronIcon size={12} dir="right" />
        </View>
      </Pressable>
      {open &&
        (!any ? (
          <Text style={[styles.reportLine, { marginTop: 6 }]}>
            Nothing’s changed yet. Move a few things, then retake your photos to see your progress.
          </Text>
        ) : (
          <View style={{ marginTop: 4 }}>
            {!!c.verdict && (
              <Text style={[styles.reportLine, { marginTop: 4 }]}>
                <Text style={{ fontFamily: fonts.semibold }}>Overall: </Text>
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
const SEV_LABEL: Record<Hazard['severity'], string> = { high: 'Do first', medium: 'Worth doing', low: 'Nice extra' };

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
                      <Text style={styles.recFenceTxt}>Keep the dog out of here</Text>
                    </Pressable>
                  )}
                </View>
              ))
            )
          ) : shopping.length === 0 ? (
            <Text style={styles.recEmpty}>Nothing to buy. Your space has what a dog needs.</Text>
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
                      <Text style={styles.shopTagTxt}>Keep out</Text>
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
  { kind: 'keep_out', label: 'Keep me out of' },
  { kind: 'dog_spot', label: 'My favourite spots' },
  { kind: 'add', label: 'Handy additions' },
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
  noteWarn: { backgroundColor: '#FBE3DC', borderWidth: 1, borderColor: '#E4572E' },
  noteWarnTxt: { fontFamily: fonts.semibold, fontSize: 12, color: colors.orangeDeep },

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
  verdict: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, borderRadius: 16, padding: 16, marginBottom: 6 },
  verdictBadge: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  verdictMark: { fontFamily: fonts.bold, fontSize: 17, color: '#fff' },
  verdictTitle: { fontFamily: fonts.bold, fontSize: 18, lineHeight: 23, color: colors.text, marginTop: 5 },
  verdictLine: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.text, marginTop: 4 },
  rerunCard: { backgroundColor: '#fff', borderRadius: 16, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.textFaint, padding: 16, marginTop: 6, marginBottom: 6 },
  rerunTitle: { fontFamily: fonts.bold, fontSize: 16, color: colors.text },
  rerunTxt: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.text, marginTop: 4 },
  photoWarn: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 18, color: colors.orangeDeep, marginTop: 6, marginBottom: 4 },
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
  tabRow: { position: 'absolute', top: 34, left: 16, flexDirection: 'row', gap: 8 },
  reportTab: { backgroundColor: colors.orange },
  recTab: { height: 36, flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 14, borderWidth: 1, borderColor: colors.orange },
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
