// "Flag anything important" (spec P2.1). Tap the photo to mark an object as
// valuable or fragile; tags persist and count as valuables at risk in the Safety
// band, and are sent to the model as high-priority context.
//
// The tappable frame is a single NON-scrolling image with < > buttons to change
// frame — a scroll view here swallowed taps on real devices.

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
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { TopBar, PrimaryButton, JoinedButtons, Segmented } from '../components/kit';
import { FrameView, useFrameImageSize, viewToImage, imageToView } from '../components/FrameView';
import { ChevronIcon } from '../components/icons';
import { ProgressBars } from './CaptureScreen';
import { colors, fonts } from '../theme';
import { useSession, useCurrentSpace } from '../store/session';
import type { ScreenProps } from '../navigation';

export default function TaggingScreen({ navigation }: ScreenProps<'Tagging'>) {
  const space = useCurrentSpace();
  const frames = space?.capture.frames ?? [];
  const tags = space?.tags ?? [];
  const addTag = useSession((s) => s.addTag);
  const removeTag = useSession((s) => s.removeTag);

  const { width } = useWindowDimensions();
  const cardW = width - 44;
  const FW = Math.round(cardW * 0.7);
  const FH = Math.round(FW * 1.45);

  const [active, setActive] = useState(0);
  const [draft, setDraft] = useState<{ frame: number; x: number; y: number } | null>(null);
  const [label, setLabel] = useState('');
  const [kind, setKind] = useState<'Valuable' | 'Fragile'>('Valuable');

  const frameIndex = Math.min(active, Math.max(0, frames.length - 1));
  const img = useFrameImageSize(frames[frameIndex]);
  const next = frames[frameIndex + 1];

  const onFramePress = (e: GestureResponderEvent) => {
    const p = viewToImage(img, FW, FH, e.nativeEvent.locationX, e.nativeEvent.locationY);
    setDraft({ frame: frameIndex, ...p });
    setLabel('');
    setKind('Valuable');
  };

  const saveTag = () => {
    if (!draft || !label.trim()) return;
    addTag({ label: label.trim(), note: kind, frame: draft.frame, x: draft.x, y: draft.y });
    setDraft(null);
  };

  const pins = tags.filter((t) => t.frame === frameIndex && t.x != null && t.y != null);

  if (!space || frames.length === 0) {
    return (
      <View style={[styles.root, styles.center]}>
        <Text style={styles.sub}>No frames captured yet.</Text>
        <PrimaryButton label="Back" onPress={() => navigation.goBack()} style={{ marginTop: 16, width: 160 }} />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1 }}>
        <TopBar onBack={() => navigation.goBack()} onClose={() => navigation.navigate('Home')} style={styles.topBar} />
        <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
          <Text style={styles.h1}>Flag anything important</Text>
          <Text style={styles.sub}>
            Tap the photo to mark an object. E.g a fragile vase, a sharp edge, any valuable items. This is optional but if
            flagged, the AI will treat this as a top priority.
          </Text>

          <View style={[styles.card, { width: cardW }]}>
            <ProgressBars count={frames.length} active={frameIndex} />
            <View style={styles.frames}>
              <Pressable onPress={onFramePress}>
                <FrameView frame={frames[frameIndex]} width={FW} height={FH} radius={12} />
                {pins.map((t) => {
                  const p = imageToView(img, FW, FH, t.x as number, t.y as number);
                  return (
                    <View key={t.id} pointerEvents="none" style={[styles.pin, { left: p.x - 11, top: p.y - 11 }]}>
                      <Text style={styles.pinTxt}>★</Text>
                    </View>
                  );
                })}
              </Pressable>
              <Pressable
                disabled={!next}
                onPress={() => setActive(frameIndex + 1)}
                style={[styles.peek, { height: FH }]}
              >
                {next && <FrameView frame={next} width={cardW - FW - 42} height={FH} radius={12} />}
              </Pressable>
            </View>
          </View>

          <View style={styles.selector}>
            <Pressable
              onPress={() => setActive(Math.max(0, frameIndex - 1))}
              disabled={frameIndex === 0}
              style={[styles.arrow, frameIndex > 0 && styles.arrowOn]}
            >
              <ChevronIcon size={11} dir="left" weight={1.6} />
            </Pressable>
            <Text style={styles.frameLabel}>Frame {frameIndex + 1} of {frames.length}</Text>
            <Pressable
              onPress={() => setActive(Math.min(frames.length - 1, frameIndex + 1))}
              disabled={frameIndex === frames.length - 1}
              style={[styles.arrow, frameIndex < frames.length - 1 && styles.arrowOn]}
            >
              <ChevronIcon size={11} dir="right" weight={1.6} />
            </Pressable>
          </View>

          {tags.length === 0 ? (
            <Text style={styles.empty}>No tags yet, tap the photo above to{'\n'}add flags, or continue without tagging</Text>
          ) : (
            <View style={styles.list}>
              {tags.map((t) => (
                <Pressable key={t.id} style={styles.tagRow} onPress={() => setActive(t.frame)}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.tagLabel}>{t.label}</Text>
                    {!!t.note && <Text style={styles.tagNote}>{t.note}</Text>}
                  </View>
                  <Pressable onPress={() => removeTag(t.id)} hitSlop={10}>
                    <Text style={styles.remove}>Remove</Text>
                  </Pressable>
                </Pressable>
              ))}
            </View>
          )}

          <PrimaryButton
            label="Save Space!"
            onPress={() => navigation.navigate('SpaceSaved')}
            style={styles.save}
          />
        </ScrollView>
      </SafeAreaView>

      <Modal visible={!!draft} transparent animationType="slide" onRequestClose={() => setDraft(null)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Pressable style={styles.backdrop} onPress={() => setDraft(null)} />
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Flag this object</Text>
            <Text style={styles.sheetSub}>Frame {(draft?.frame ?? 0) + 1}</Text>
            <TextInput
              value={label}
              onChangeText={setLabel}
              placeholder="What is it? (e.g. Antique Vase)"
              placeholderTextColor={colors.textFaint}
              style={styles.input}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={saveTag}
            />
            <Segmented
              value={kind}
              onChange={setKind}
              options={[{ value: 'Valuable', label: 'Valuable' }, { value: 'Fragile', label: 'Fragile' }]}
              height={32}
              textStyle={{ fontSize: 13 }}
              style={{ marginTop: 12 }}
            />
            <JoinedButtons
              left={{ label: 'Cancel', onPress: () => setDraft(null) }}
              right={{ label: 'Save tag', onPress: saveTag, disabled: !label.trim() }}
              leftBg={colors.track}
              height={40}
              style={{ marginTop: 18 }}
            />
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg2 },
  center: { alignItems: 'center', justifyContent: 'center' },
  topBar: { paddingHorizontal: 22, paddingTop: 6 },
  body: { paddingHorizontal: 22, paddingBottom: 40 },
  h1: { fontFamily: fonts.bold, color: colors.text, fontSize: 20, marginTop: -2 },
  sub: { fontFamily: fonts.regular, color: colors.text, fontSize: 12.5, lineHeight: 17, marginTop: 4 },

  card: { backgroundColor: colors.bg, borderRadius: 20, paddingTop: 13, paddingBottom: 22, marginTop: 16 },
  frames: { flexDirection: 'row', paddingHorizontal: 12, gap: 18, overflow: 'hidden' },
  peek: { flex: 1, borderRadius: 12, backgroundColor: colors.track, overflow: 'hidden' },
  pin: {
    position: 'absolute',
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.orange,
    borderWidth: 2,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinTxt: { color: '#fff', fontSize: 10 },

  selector: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, marginTop: 9 },
  arrow: { width: 30, height: 30, borderRadius: 15, borderWidth: 1, borderColor: '#D9D9D9', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg2 },
  arrowOn: { borderColor: colors.orange },
  frameLabel: { fontFamily: fonts.regular, color: colors.text, fontSize: 12, minWidth: 64, textAlign: 'center' },

  empty: { fontFamily: fonts.regular, color: colors.text, fontSize: 12, textAlign: 'center', lineHeight: 17, marginTop: 44, marginBottom: 26 },
  list: { gap: 8, marginTop: 15, marginBottom: 18 },
  tagRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bg, borderRadius: 12, paddingHorizontal: 12, height: 50 },
  tagLabel: { fontFamily: fonts.regular, color: colors.text, fontSize: 12.5 },
  tagNote: { fontFamily: fonts.regular, color: colors.text, fontSize: 10, marginTop: 2 },
  remove: { fontFamily: fonts.regular, color: colors.text, fontSize: 10.5 },
  save: { height: 35, borderRadius: 10 },

  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: colors.bg, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 22, paddingBottom: 36 },
  sheetTitle: { fontFamily: fonts.bold, color: colors.text, fontSize: 18 },
  sheetSub: { fontFamily: fonts.regular, color: colors.textMuted, fontSize: 12, marginTop: 2, marginBottom: 12 },
  input: { backgroundColor: colors.track, borderRadius: 8, height: 40, paddingHorizontal: 12, fontFamily: fonts.regular, fontSize: 14, color: colors.text },
});
