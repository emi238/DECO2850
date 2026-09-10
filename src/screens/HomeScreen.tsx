// Home hub — the app's main screen once onboarded. Shows the current space's map
// (toggle between 2D and 3D), a switcher for all spaces, "Add space" (re-runs the
// onboarding flow), and buttons to edit the questionnaire and re-analyse.

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Modal,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '../components/Button';
import { GlassCard } from '../components/GlassCard';
import { Space2DView } from '../components/Space2DView';
import { Room3DView } from '../components/Room3DView';
import { colors, spacing, font, radius } from '../theme';
import { useSession, useCurrentSpace } from '../store/session';
import { runAssessment } from '../ai/assess';
import type { ScreenProps } from '../navigation';

export default function HomeScreen({ navigation }: ScreenProps<'Home'>) {
  const spaces = useSession((s) => s.spaces);
  const currentSpaceId = useSession((s) => s.currentSpaceId);
  const setCurrentSpace = useSession((s) => s.setCurrentSpace);
  const renameSpace = useSession((s) => s.renameSpace);
  const removeSpace = useSession((s) => s.removeSpace);
  const setResult = useSession((s) => s.setResult);
  const space = useCurrentSpace();

  const [view, setView] = useState<'2d' | '3d'>('2d');
  const [analyzing, setAnalyzing] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameVal, setRenameVal] = useState('');

  // No spaces at all (e.g. after deleting the last one).
  if (!space) {
    return (
      <View style={styles.root}>
        <SafeAreaView style={styles.center} edges={['top', 'bottom']}>
          <Text style={styles.emptyTitle}>No spaces yet</Text>
          <Text style={styles.emptySub}>Add a space to check whether it suits a pet.</Text>
          <Button label="Add a space" onPress={() => navigation.navigate('NewSpace', { first: true })} style={{ marginTop: spacing.lg }} />
        </SafeAreaView>
      </View>
    );
  }

  const result = space.result;
  const frames = space.capture.frames;

  const analyse = async () => {
    setAnalyzing(true);
    const cur = useSession.getState().current();
    if (cur) {
      const r = await runAssessment(cur);
      setResult(r.assessment, r.source, r.fallbackReason);
    }
    setAnalyzing(false);
  };

  const openRename = () => {
    setRenameVal(space.name);
    setRenameOpen(true);
  };
  const saveRename = () => {
    renameSpace(space.id, renameVal);
    setRenameOpen(false);
  };
  const confirmDelete = () => {
    Alert.alert('Delete space?', `Remove “${space.name}” and its assessment?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => removeSpace(space.id) },
    ]);
  };

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']}>
        {/* Space switcher */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
          {spaces.map((sp) => (
            <Pressable
              key={sp.id}
              onPress={() => setCurrentSpace(sp.id)}
              style={[styles.tab, sp.id === currentSpaceId && styles.tabOn]}
            >
              <Text style={[styles.tabTxt, sp.id === currentSpaceId && styles.tabTxtOn]} numberOfLines={1}>
                {sp.name}
              </Text>
            </Pressable>
          ))}
          <Pressable onPress={() => navigation.navigate('NewSpace')} style={styles.addTab}>
            <Text style={styles.addTabTxt}>+ Add space</Text>
          </Pressable>
        </ScrollView>

        {/* Title row */}
        <View style={styles.titleRow}>
          <Pressable onPress={openRename} style={styles.titlePress}>
            <Text style={styles.title} numberOfLines={1}>{space.name}</Text>
            <Text style={styles.pencil}>  ✎</Text>
          </Pressable>
          <Pressable onPress={confirmDelete} hitSlop={8}>
            <Text style={styles.delete}>Delete</Text>
          </Pressable>
        </View>

        {/* 2D / 3D toggle */}
        {result && (
          <View style={styles.toggle}>
            {(['2d', '3d'] as const).map((v) => (
              <Pressable key={v} onPress={() => setView(v)} style={[styles.seg, view === v && styles.segOn]}>
                <Text style={[styles.segTxt, view === v && styles.segTxtOn]}>{v === '2d' ? '2D map' : '3D room'}</Text>
              </Pressable>
            ))}
          </View>
        )}
      </SafeAreaView>

      {/* Map area */}
      <View style={{ flex: 1 }}>
        {frames.length === 0 ? (
          <View style={styles.center}>
            <Text style={styles.emptyTitle}>Not set up yet</Text>
            <Text style={styles.emptySub}>Capture or upload this space to assess it.</Text>
            <Button label="Continue setup" onPress={() => navigation.navigate('Capture')} style={{ marginTop: spacing.lg }} />
          </View>
        ) : !result ? (
          <View style={styles.center}>
            <Text style={styles.emptyTitle}>Ready to analyse</Text>
            <Text style={styles.emptySub}>Run the assessment for “{space.name}”.</Text>
            <Button label="Analyse this space" onPress={analyse} style={{ marginTop: spacing.lg }} />
          </View>
        ) : view === '2d' ? (
          <Space2DView frames={frames} result={result} source={space.resultSource} fallbackReason={space.resultNote} />
        ) : (
          <Room3DView result={result} frameCount={frames.length} />
        )}
      </View>

      {/* Bottom actions */}
      {result && (
        <SafeAreaView edges={['bottom']} style={styles.footerSafe}>
          <View style={styles.footer}>
            <Button
              label="Edit questionnaire"
              variant="secondary"
              onPress={() => navigation.navigate('Questionnaire', { editing: true })}
              style={{ flex: 1 }}
            />
            <Button label="Re-analyse" variant="secondary" onPress={analyse} style={{ flex: 1 }} />
          </View>
        </SafeAreaView>
      )}

      {/* Analysing overlay */}
      {analyzing && (
        <View style={styles.overlay}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={styles.overlayTxt}>Analysing “{space.name}”…</Text>
        </View>
      )}

      {/* Rename modal */}
      <Modal visible={renameOpen} transparent animationType="fade" onRequestClose={() => setRenameOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setRenameOpen(false)} />
        <View style={styles.renameWrap}>
          <GlassCard intensity={60} style={styles.renameCard}>
            <Text style={styles.renameTitle}>Rename space</Text>
            <TextInput
              value={renameVal}
              onChangeText={setRenameVal}
              style={styles.input}
              autoFocus
              placeholder="Space name"
              placeholderTextColor={colors.textFaint}
              onSubmitEditing={saveRename}
            />
            <View style={styles.renameActions}>
              <Button label="Cancel" variant="secondary" onPress={() => setRenameOpen(false)} style={{ flex: 1 }} />
              <Button label="Save" onPress={saveRename} style={{ flex: 1 }} />
            </View>
          </GlassCard>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  emptyTitle: { color: colors.text, fontSize: font.h2, fontWeight: '700' },
  emptySub: { color: colors.textMuted, fontSize: font.body, textAlign: 'center', marginTop: 6 },

  tabs: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, gap: spacing.sm, alignItems: 'center' },
  tab: {
    paddingHorizontal: 16, paddingVertical: 9, borderRadius: radius.pill,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, maxWidth: 180,
  },
  tabOn: { backgroundColor: colors.surfaceStrong, borderColor: colors.accent },
  tabTxt: { color: colors.textMuted, fontSize: font.small, fontWeight: '600' },
  tabTxtOn: { color: colors.text },
  addTab: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.accent, borderStyle: 'dashed' },
  addTabTxt: { color: colors.accent, fontSize: font.small, fontWeight: '700' },

  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.xl, paddingTop: spacing.md },
  titlePress: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  title: { color: colors.text, fontSize: font.h1, fontWeight: '700', letterSpacing: -0.5, flexShrink: 1 },
  pencil: { color: colors.textFaint, fontSize: font.body },
  delete: { color: colors.sevHigh, fontSize: font.small, fontWeight: '600' },

  toggle: {
    flexDirection: 'row', margin: spacing.lg, marginBottom: spacing.sm,
    backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: 4, gap: 4,
  },
  seg: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: radius.sm },
  segOn: { backgroundColor: colors.accent },
  segTxt: { color: colors.textMuted, fontSize: font.small, fontWeight: '700' },
  segTxtOn: { color: colors.accentText },

  footerSafe: { backgroundColor: colors.bg },
  footer: { flexDirection: 'row', gap: spacing.md, paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.md },

  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', gap: spacing.md, backgroundColor: 'rgba(15,17,21,0.85)' },
  overlayTxt: { color: colors.text, fontSize: font.h3, fontWeight: '700' },

  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.55)' },
  renameWrap: { position: 'absolute', left: spacing.lg, right: spacing.lg, top: '32%' },
  renameCard: { padding: spacing.lg },
  renameTitle: { color: colors.text, fontSize: font.h3, fontWeight: '700', marginBottom: spacing.md },
  input: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    paddingHorizontal: 14, paddingVertical: 12, color: colors.text, fontSize: font.body,
  },
  renameActions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg },
});
