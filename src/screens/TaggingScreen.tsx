// F4 — Object tagging. Tap an object on a captured frame to flag it with a
// label + note. Tags persist and are sent to the model as HIGH-PRIORITY context.
//
// The taggable frame is a single, full-width, NON-scrolling image (with prev/next
// arrows to change frame). Earlier this was a horizontal scroll strip, but on a
// real device the scroll view swallowed the tap, so tagging rarely fired.

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
  useWindowDimensions,
} from 'react-native';

import { Screen } from '../components/Screen';
import { Button } from '../components/Button';
import { GlassCard } from '../components/GlassCard';
import { FrameView } from '../components/FrameView';
import { colors, spacing, font, radius } from '../theme';
import { useSession } from '../store/session';
import type { ScreenProps } from '../navigation';

export default function TaggingScreen({ navigation }: ScreenProps<'Tagging'>) {
  const frames = useSession((s) => s.capture.frames);
  const tags = useSession((s) => s.tags);
  const addTag = useSession((s) => s.addTag);
  const removeTag = useSession((s) => s.removeTag);

  const { width: winW } = useWindowDimensions();
  const FW = winW - spacing.xl * 2;
  const FH = Math.round(FW * 1.2);

  const [active, setActive] = useState(0);
  const [draft, setDraft] = useState<{ frame: number; x: number; y: number } | null>(null);
  const [label, setLabel] = useState('');
  const [note, setNote] = useState('');

  const frameIndex = Math.min(active, Math.max(0, frames.length - 1));

  const onFramePress = (e: GestureResponderEvent) => {
    const { locationX, locationY } = e.nativeEvent;
    setDraft({ frame: frameIndex, x: clamp01(locationX / FW), y: clamp01(locationY / FH) });
    setLabel('');
    setNote('');
  };

  const saveTag = () => {
    if (!draft || !label.trim()) return;
    addTag({ label: label.trim(), note: note.trim(), frame: draft.frame, x: draft.x, y: draft.y });
    setDraft(null);
  };

  const activeTags = tags.filter((t) => t.frame === frameIndex && t.x != null && t.y != null);

  return (
    <Screen
      step={3}
      title="Flag anything important"
      subtitle="Tap the photo to mark an object — e.g. a fragile vase or a door left open. Optional, but the AI treats tags as top priority."
    >
      <View style={{ flex: 1 }}>
        <View style={styles.frameWrap}>
          <Pressable onPress={onFramePress}>
            <FrameView frame={frames[frameIndex]} width={FW} height={FH} radius={radius.lg} />
            {activeTags.map((t) => (
              <View
                key={t.id}
                pointerEvents="none"
                style={[styles.pin, { left: (t.x as number) * FW - 13, top: (t.y as number) * FH - 13 }]}
              >
                <Text style={styles.pinTxt}>★</Text>
              </View>
            ))}
          </Pressable>

          {/* Frame selector — plain buttons, no scroll to steal the tap */}
          {frames.length > 1 && (
            <View style={styles.selector}>
              <Pressable
                onPress={() => setActive((a) => Math.max(0, a - 1))}
                disabled={frameIndex === 0}
                style={[styles.arrow, frameIndex === 0 && styles.arrowOff]}
              >
                <Text style={styles.arrowTxt}>‹</Text>
              </Pressable>
              <Text style={styles.frameLabel}>Frame {frameIndex + 1} of {frames.length}</Text>
              <Pressable
                onPress={() => setActive((a) => Math.min(frames.length - 1, a + 1))}
                disabled={frameIndex === frames.length - 1}
                style={[styles.arrow, frameIndex === frames.length - 1 && styles.arrowOff]}
              >
                <Text style={styles.arrowTxt}>›</Text>
              </Pressable>
            </View>
          )}
        </View>

        <ScrollView contentContainerStyle={styles.list} keyboardShouldPersistTaps="handled">
          {tags.length === 0 ? (
            <Text style={styles.empty}>No tags yet — tap the photo above, or continue without tagging.</Text>
          ) : (
            tags.map((t) => (
              <GlassCard key={t.id} style={styles.tagCard}>
                <View style={styles.tagRow}>
                  <Pressable style={{ flex: 1 }} onPress={() => setActive(t.frame)}>
                    <Text style={styles.tagLabel}>★ {t.label}</Text>
                    {!!t.note && <Text style={styles.tagNote}>{t.note}</Text>}
                    <Text style={styles.tagMeta}>Frame {t.frame + 1}</Text>
                  </Pressable>
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
            <Text style={styles.sheetSub}>Frame {(draft?.frame ?? 0) + 1}</Text>
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
  frameWrap: { alignItems: 'center', paddingHorizontal: spacing.xl },
  selector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
    marginTop: spacing.md,
  },
  arrow: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surfaceStrong,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowOff: { opacity: 0.35 },
  arrowTxt: { color: colors.text, fontSize: 24, fontWeight: '700', lineHeight: 26 },
  frameLabel: { color: colors.textMuted, fontSize: font.small, fontWeight: '600', minWidth: 120, textAlign: 'center' },
  pin: {
    position: 'absolute',
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  pinTxt: { color: '#fff', fontSize: 13, fontWeight: '700' },
  list: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg, gap: spacing.sm, paddingBottom: spacing.md },
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
