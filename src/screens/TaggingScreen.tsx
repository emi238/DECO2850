// F4 — Object tagging. Tap an object on a captured frame to flag it with a
// label + note. Tags persist and are sent to the model as HIGH-PRIORITY context.

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  Modal,
  GestureResponderEvent,
} from 'react-native';

import { Screen } from '../components/Screen';
import { Button } from '../components/Button';
import { GlassCard } from '../components/GlassCard';
import { FrameView } from '../components/FrameView';
import { colors, spacing, font, radius } from '../theme';
import { useSession } from '../store/session';
import type { ScreenProps } from '../navigation';

const FW = 258;
const FH = 344;

export default function TaggingScreen({ navigation }: ScreenProps<'Tagging'>) {
  const frames = useSession((s) => s.capture.frames);
  const tags = useSession((s) => s.tags);
  const addTag = useSession((s) => s.addTag);
  const removeTag = useSession((s) => s.removeTag);

  const [draft, setDraft] = useState<{ frame: number; x: number; y: number } | null>(null);
  const [label, setLabel] = useState('');
  const [note, setNote] = useState('');

  const onFramePress = (frame: number, e: GestureResponderEvent) => {
    const { locationX, locationY } = e.nativeEvent;
    setDraft({ frame, x: clamp01(locationX / FW), y: clamp01(locationY / FH) });
    setLabel('');
    setNote('');
  };

  const saveTag = () => {
    if (!draft || !label.trim()) return;
    addTag({ label: label.trim(), note: note.trim(), frame: draft.frame, x: draft.x, y: draft.y });
    setDraft(null);
  };

  return (
    <Screen
      step={3}
      title="Flag anything important"
      subtitle="Tap an object on the room map to mark it — e.g. a fragile vase or a door left open. Optional, but the AI treats tags as top priority."
    >
      <View style={{ flex: 1 }}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.strip}
        >
          {frames.map((f, i) => (
            <View key={i} style={styles.frameBox}>
              <Pressable onPress={(e) => onFramePress(i, e)}>
                <FrameView frame={f} width={FW} height={FH} radius={radius.md} />
                {tags
                  .filter((t) => t.frame === i && t.x != null && t.y != null)
                  .map((t) => (
                    <View
                      key={t.id}
                      pointerEvents="none"
                      style={[styles.pin, { left: (t.x as number) * FW - 11, top: (t.y as number) * FH - 11 }]}
                    >
                      <Text style={styles.pinTxt}>★</Text>
                    </View>
                  ))}
              </Pressable>
              <Text style={styles.frameIdx}>Frame {i}</Text>
            </View>
          ))}
        </ScrollView>

        <ScrollView contentContainerStyle={styles.list}>
          {tags.length === 0 ? (
            <Text style={styles.empty}>No tags yet — tap an object above, or continue without tagging.</Text>
          ) : (
            tags.map((t) => (
              <GlassCard key={t.id} style={styles.tagCard}>
                <View style={styles.tagRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.tagLabel}>★ {t.label}</Text>
                    {!!t.note && <Text style={styles.tagNote}>{t.note}</Text>}
                    <Text style={styles.tagMeta}>Frame {t.frame}</Text>
                  </View>
                  <Pressable onPress={() => removeTag(t.id)} style={styles.del}>
                    <Text style={styles.delTxt}>Remove</Text>
                  </Pressable>
                </View>
              </GlassCard>
            ))
          )}
        </ScrollView>
      </View>

      <View style={styles.footer}>
        <Button label="Analyse room" onPress={() => navigation.navigate('Results')} />
      </View>

      {/* Tag entry sheet */}
      <Modal visible={!!draft} transparent animationType="slide" onRequestClose={() => setDraft(null)}>
        <Pressable style={styles.backdrop} onPress={() => setDraft(null)} />
        <View style={styles.sheet}>
          <GlassCard intensity={60} style={styles.sheetCard}>
            <Text style={styles.sheetTitle}>Flag this object</Text>
            <Text style={styles.sheetSub}>Frame {draft?.frame}</Text>
            <TextInput
              value={label}
              onChangeText={setLabel}
              placeholder="Label (e.g. antique vase)"
              placeholderTextColor={colors.textFaint}
              style={styles.input}
              autoFocus
            />
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder="Note (e.g. valuable & fragile)"
              placeholderTextColor={colors.textFaint}
              style={[styles.input, { marginTop: spacing.sm }]}
            />
            <View style={styles.sheetActions}>
              <Button label="Cancel" variant="secondary" onPress={() => setDraft(null)} style={{ flex: 1 }} />
              <Button label="Save tag" onPress={saveTag} disabled={!label.trim()} style={{ flex: 1 }} />
            </View>
          </GlassCard>
        </View>
      </Modal>
    </Screen>
  );
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

const styles = StyleSheet.create({
  strip: { paddingHorizontal: spacing.xl, gap: spacing.md, paddingBottom: spacing.md },
  frameBox: { alignItems: 'center', gap: 6 },
  frameIdx: { color: colors.textFaint, fontSize: font.tiny, fontWeight: '600' },
  pin: {
    position: 'absolute',
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  pinTxt: { color: '#fff', fontSize: 11, fontWeight: '700' },
  list: { paddingHorizontal: spacing.xl, paddingTop: spacing.sm, gap: spacing.sm, paddingBottom: spacing.md },
  empty: { color: colors.textFaint, fontSize: font.small, textAlign: 'center', paddingVertical: spacing.lg },
  tagCard: { paddingVertical: spacing.md },
  tagRow: { flexDirection: 'row', alignItems: 'center' },
  tagLabel: { color: colors.text, fontSize: font.body, fontWeight: '600' },
  tagNote: { color: colors.textMuted, fontSize: font.small, marginTop: 2 },
  tagMeta: { color: colors.textFaint, fontSize: font.tiny, marginTop: 4 },
  del: { paddingHorizontal: 12, paddingVertical: 8 },
  delTxt: { color: colors.sevHigh, fontSize: font.small, fontWeight: '600' },
  footer: { paddingHorizontal: spacing.xl, paddingTop: spacing.sm, paddingBottom: spacing.md },
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.55)' },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: spacing.lg },
  sheetCard: { padding: spacing.lg },
  sheetTitle: { color: colors.text, fontSize: font.h3, fontWeight: '700' },
  sheetSub: { color: colors.textFaint, fontSize: font.small, marginTop: 2, marginBottom: spacing.md },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.text,
    fontSize: font.body,
  },
  sheetActions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg },
});
