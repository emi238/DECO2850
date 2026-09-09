// F6 — Results ARE the 2D room map with findings pinned in place. Object
// hazards become numbered, severity-coloured, tappable pins; space-level
// findings + the verdict live in a top banner; a collapsible list mirrors it.

import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Modal,
} from 'react-native';

import { Screen } from '../components/Screen';
import { Button } from '../components/Button';
import { GlassCard } from '../components/GlassCard';
import { FrameView } from '../components/FrameView';
import { FindingCard } from '../components/FindingCard';
import { colors, spacing, font, radius, severityColor } from '../theme';
import { CATEGORY_LABELS } from '../ai/categories';
import { useSession } from '../store/session';
import { runAssessment } from '../ai/assess';
import { FRAME_W as DEMO_FRAME_W, STEP as DEMO_STEP } from '../demo/room';
import type { Assessment, Hazard } from '../types';
import type { ScreenProps } from '../navigation';

const FW = 300;
const FH = 400;
// Overlap each frame by the demo room's true sweep step so the strip merges
// into one seamless panorama (a slow real-camera sweep overlaps similarly).
const ADVANCE = Math.round(FW * (DEMO_STEP / DEMO_FRAME_W));

const VERDICT_LABEL: Record<string, string> = {
  well_suited: 'Well suited',
  suitable_with_changes: 'Suitable with changes',
  poorly_suited: 'Poorly suited',
};
const VERDICT_COLOR: Record<string, string> = {
  well_suited: colors.good,
  suitable_with_changes: colors.ok,
  poorly_suited: colors.bad,
};

export default function ResultsScreen({ navigation }: ScreenProps<'Results'>) {
  const frames = useSession((s) => s.capture.frames);
  const setResult = useSession((s) => s.setResult);
  const reset = useSession((s) => s.reset);

  const [loading, setLoading] = useState(true);
  const [result, setLocalResult] = useState<Assessment | null>(null);
  const [source, setSource] = useState<'ai' | 'mock'>('mock');
  const [fallback, setFallback] = useState<string | undefined>();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [listOpen, setListOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      const r = await runAssessment(useSession.getState());
      if (!alive) return;
      setLocalResult(r.assessment);
      setSource(r.source);
      setFallback(r.fallbackReason);
      setResult(r.assessment);
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [setResult]);

  // Object hazards get numbered pins; space hazards go to the banner/list.
  const { objectHazards, spaceHazards, numberOf } = useMemo(() => {
    const objects = (result?.hazards ?? []).filter((h) => h.scope === 'object' && h.location);
    const spaces = (result?.hazards ?? []).filter((h) => h.scope === 'space');
    const num = new Map<string, number>();
    objects.forEach((h, i) => num.set(h.id, i + 1));
    return { objectHazards: objects, spaceHazards: spaces, numberOf: num };
  }, [result]);

  const selected = result?.hazards.find((h) => h.id === selectedId) ?? null;

  if (loading) {
    return (
      <Screen step={4}>
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={styles.loadingTxt}>Reading the room…</Text>
          <Text style={styles.loadingSub}>Checking hazards, fit, and improvements.</Text>
        </View>
      </Screen>
    );
  }

  if (!result) {
    return (
      <Screen step={4} title="Something went wrong">
        <View style={styles.loading}>
          <Text style={styles.loadingSub}>The assessment could not be produced. Please try again.</Text>
          <Button label="Start over" onPress={startOver} style={{ marginTop: spacing.lg }} />
        </View>
      </Screen>
    );
  }

  function startOver() {
    reset();
    navigation.reset({ index: 0, routes: [{ name: 'Capture' }] });
  }

  return (
    <Screen step={4}>
      {/* ---- Summary banner (verdict / recommended pets + space findings) ---- */}
      <View style={styles.bannerWrap}>
        <GlassCard intensity={50} style={styles.banner}>
          <Text style={styles.summary}>{result.space_summary}</Text>

          {result.mode === 'pet_in_mind' && result.suitability && (
            <View style={styles.verdictRow}>
              <View style={[styles.verdictPill, { backgroundColor: VERDICT_COLOR[result.suitability.verdict] }]}>
                <Text style={styles.verdictTxt}>{VERDICT_LABEL[result.suitability.verdict]}</Text>
              </View>
              <Text style={styles.score}>{result.suitability.score_0_100}<Text style={styles.scoreMax}>/100</Text></Text>
            </View>
          )}
          {result.mode === 'pet_in_mind' && result.suitability?.rationale && (
            <Text style={styles.rationale}>{result.suitability.rationale}</Text>
          )}

          {result.mode === 'explore' && result.recommended_pets.length > 0 && (
            <View style={{ marginTop: spacing.sm }}>
              <Text style={styles.blockLabel}>Recommended for this space</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.petCards}>
                {result.recommended_pets.map((p, i) => (
                  <View key={i} style={styles.petCard}>
                    <Text style={styles.petName}>{p.species}{p.breed ? ` · ${p.breed}` : ''}</Text>
                    <Text style={styles.petWhy}>{p.why}</Text>
                    {!!p.caveats && <Text style={styles.petCaveat}>⚠ {p.caveats}</Text>}
                  </View>
                ))}
              </ScrollView>
            </View>
          )}

          {spaceHazards.length > 0 && (
            <View style={{ marginTop: spacing.md }}>
              <Text style={styles.blockLabel}>Whole-room findings</Text>
              <View style={styles.spaceChips}>
                {spaceHazards.map((h) => (
                  <Pressable key={h.id} onPress={() => setSelectedId(h.id)} style={styles.spaceChip}>
                    <View style={[styles.sevDot, { backgroundColor: severityColor(h.severity) }]} />
                    <Text style={styles.spaceChipTxt}>{h.title}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}

          <Text style={styles.confidence}>
            {source === 'ai' ? 'AI assessment' : 'Sample assessment (demo mode)'} · confidence: {result.confidence}
          </Text>
          {!!fallback && <Text style={styles.fallback} numberOfLines={3}>{fallback}</Text>}
        </GlassCard>
      </View>

      {/* ---- The 2D map: one continuous panorama with pinned object hazards ---- */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.map}
      >
        <View
          style={[
            styles.pano,
            { width: ADVANCE * Math.max(0, frames.length - 1) + FW, height: FH },
          ]}
        >
          {frames.map((f, i) => (
            <View key={i} style={{ position: 'absolute', left: i * ADVANCE, top: 0 }}>
              <FrameView frame={f} width={FW} height={FH} radius={0} />
            </View>
          ))}
          {objectHazards.map((h) => {
            const n = numberOf.get(h.id)!;
            const isSel = h.id === selectedId;
            const px = h.location!.frame_index * ADVANCE + h.location!.x * FW - 15;
            const py = h.location!.y * FH - 15;
            return (
              <Pressable
                key={h.id}
                onPress={() => setSelectedId(isSel ? null : h.id)}
                style={[
                  styles.pin,
                  { left: px, top: py, backgroundColor: severityColor(h.severity) },
                  isSel && styles.pinSelected,
                ]}
              >
                <Text style={styles.pinNum}>{n}</Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      {/* ---- Selected finding card (floats above the footer) ---- */}
      {selected && (
        <View style={styles.selectedWrap} pointerEvents="box-none">
          <FindingCard
            hazard={selected}
            number={selected.scope === 'object' ? numberOf.get(selected.id) : undefined}
            onClose={() => setSelectedId(null)}
          />
        </View>
      )}

      {/* ---- Footer ---- */}
      <View style={styles.footer}>
        <Button label={`All findings (${result.hazards.length})`} variant="secondary" onPress={() => setListOpen(true)} style={{ flex: 1 }} />
        <Button label="Start over" onPress={startOver} style={{ flex: 1 }} />
      </View>

      {/* ---- Collapsible list view (mirrors the pins; PRD F6.5) ---- */}
      <Modal visible={listOpen} animationType="slide" transparent onRequestClose={() => setListOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setListOpen(false)} />
        <View style={styles.listSheet}>
          <GlassCard intensity={70} style={styles.listCard} padded={false}>
            <View style={styles.listHead}>
              <Text style={styles.listTitle}>All findings</Text>
              <Pressable onPress={() => setListOpen(false)} hitSlop={10}><Text style={styles.closeTxt}>Done</Text></Pressable>
            </View>
            <ScrollView contentContainerStyle={styles.listBody}>
              {result.improvements.length > 0 && (
                <View style={styles.improve}>
                  <Text style={styles.blockLabel}>Top improvements</Text>
                  {result.improvements.map((s, i) => (
                    <Text key={i} style={styles.improveItem}>• {s}</Text>
                  ))}
                </View>
              )}
              {objectHazards.map((h) => (
                <ListRow key={h.id} hazard={h} number={numberOf.get(h.id)} onPress={() => { setSelectedId(h.id); setListOpen(false); }} />
              ))}
              {spaceHazards.map((h) => (
                <ListRow key={h.id} hazard={h} onPress={() => { setSelectedId(h.id); setListOpen(false); }} />
              ))}
              {!!result.notes && <Text style={styles.notes}>{result.notes}</Text>}
            </ScrollView>
          </GlassCard>
        </View>
      </Modal>
    </Screen>
  );
}

function ListRow({ hazard, number, onPress }: { hazard: Hazard; number?: number; onPress: () => void }) {
  const sev = severityColor(hazard.severity);
  return (
    <Pressable onPress={onPress} style={styles.row}>
      <View style={[styles.rowBadge, { backgroundColor: sev }]}>
        <Text style={styles.rowBadgeTxt}>{number ?? '◻'}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle}>{hazard.title}</Text>
        <Text style={styles.rowMeta}>{CATEGORY_LABELS[hazard.category]} · {hazard.severity} · {hazard.scope}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.xl },
  loadingTxt: { color: colors.text, fontSize: font.h3, fontWeight: '700', marginTop: spacing.sm },
  loadingSub: { color: colors.textMuted, fontSize: font.body, textAlign: 'center' },

  bannerWrap: { paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  banner: { padding: spacing.lg },
  summary: { color: colors.text, fontSize: font.body, lineHeight: 21 },
  verdictRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.md },
  verdictPill: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: radius.pill },
  verdictTxt: { color: '#fff', fontWeight: '700', fontSize: font.small },
  score: { color: colors.text, fontSize: 26, fontWeight: '800' },
  scoreMax: { color: colors.textFaint, fontSize: font.body, fontWeight: '600' },
  rationale: { color: colors.textMuted, fontSize: font.small, lineHeight: 20, marginTop: spacing.sm },
  blockLabel: { color: colors.textFaint, fontSize: font.tiny, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: spacing.sm },
  petCards: { gap: spacing.sm, paddingRight: spacing.md },
  petCard: { width: 220, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md },
  petName: { color: colors.text, fontSize: font.body, fontWeight: '700' },
  petWhy: { color: colors.textMuted, fontSize: font.small, marginTop: 4, lineHeight: 18 },
  petCaveat: { color: colors.sevMedium, fontSize: font.tiny, marginTop: 6, lineHeight: 16 },
  spaceChips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  spaceChip: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.pill,
  },
  sevDot: { width: 9, height: 9, borderRadius: 5 },
  spaceChipTxt: { color: colors.text, fontSize: font.small, fontWeight: '600' },
  confidence: { color: colors.textFaint, fontSize: font.tiny, marginTop: spacing.md },
  fallback: { color: colors.sevMedium, fontSize: font.tiny, marginTop: 4, lineHeight: 15 },

  map: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  pano: {
    position: 'relative',
    borderRadius: radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgElevated,
  },
  pin: {
    position: 'absolute',
    width: 30, height: 30, borderRadius: 15,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#fff',
    shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 4, shadowOffset: { width: 0, height: 2 },
  },
  pinSelected: { transform: [{ scale: 1.25 }], borderColor: colors.text },
  pinNum: { color: '#fff', fontWeight: '800', fontSize: font.small },

  selectedWrap: { position: 'absolute', left: spacing.lg, right: spacing.lg, bottom: 92 },

  footer: { flexDirection: 'row', gap: spacing.md, paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.md },

  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.55)' },
  listSheet: { position: 'absolute', left: 0, right: 0, bottom: 0, top: '18%', padding: spacing.md },
  listCard: { flex: 1 },
  listHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border },
  listTitle: { color: colors.text, fontSize: font.h3, fontWeight: '700' },
  closeTxt: { color: colors.accent, fontSize: font.body, fontWeight: '700' },
  listBody: { padding: spacing.lg, gap: spacing.sm },
  improve: { marginBottom: spacing.md },
  improveItem: { color: colors.textMuted, fontSize: font.small, lineHeight: 21, marginBottom: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm },
  rowBadge: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  rowBadgeTxt: { color: '#fff', fontWeight: '800', fontSize: font.small },
  rowTitle: { color: colors.text, fontSize: font.body, fontWeight: '600' },
  rowMeta: { color: colors.textFaint, fontSize: font.tiny, marginTop: 2, textTransform: 'capitalize' },
  notes: { color: colors.textFaint, fontSize: font.small, lineHeight: 20, marginTop: spacing.md, fontStyle: 'italic' },
});
