// "Flag anything important" (spec P2.1). Tap the photo to mark an object as
// valuable or fragile; tags persist and count as valuables at risk in the Safety
// band, and are sent to the model as high-priority context.
//
// The tappable frame is a single NON-scrolling image with < > buttons to change
// frame — a scroll view here swallowed taps on real devices.

import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  Modal,
  GestureResponderEvent,
  PanResponder,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { TopBar, PrimaryButton, JoinedButtons, Segmented } from '../components/kit';
import { FrameView, useFrameImageSize, viewToImage, imageToView } from '../components/FrameView';
import { ChevronIcon } from '../components/icons';
import { ZoomBox } from '../components/ZoomBox';
import { ProgressBars } from './CaptureScreen';
import { colors, fonts } from '../theme';
import { useSession, useCurrentSpace } from '../store/session';
import type { ScreenProps } from '../navigation';
import type { Tag } from '../types';

export default function TaggingScreen({ navigation }: ScreenProps<'Tagging'>) {
  const space = useCurrentSpace();
  const frames = space?.capture.frames ?? [];
  const tags = space?.tags ?? [];
  const addTag = useSession((s) => s.addTag);
  const removeTag = useSession((s) => s.removeTag);
  const updateTag = useSession((s) => s.updateTag);

  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const cardW = width - 44;
  const FW = Math.round(cardW * 0.7);
  const FH = Math.round(FW * 1.45);

  const [active, setActive] = useState(0);
  // A new tag (from tapping the photo) or an existing one being edited (id set).
  const [draft, setDraft] = useState<{ frame: number; x: number; y: number; id?: string } | null>(null);
  const [dragging, setDragging] = useState(false);
  const [label, setLabel] = useState('');
  const [kind, setKind] = useState<'Valuable' | 'Fragile'>('Valuable');

  const frameIndex = Math.min(active, Math.max(0, frames.length - 1));
  const img = useFrameImageSize(frames[frameIndex]);
  const goToFrame = (i: number) => setActive(Math.max(0, Math.min(frames.length - 1, i)));

  const onFramePress = (e: GestureResponderEvent) => {
    const p = viewToImage(img, FW, FH, e.nativeEvent.locationX, e.nativeEvent.locationY);
    setDraft({ frame: frameIndex, ...p });
    setLabel('');
    setKind('Valuable');
  };

  const editTag = (t: Tag) => {
    setDraft({ frame: t.frame, x: t.x ?? 0.5, y: t.y ?? 0.5, id: t.id });
    setLabel(t.label);
    setKind(t.note === 'Fragile' ? 'Fragile' : 'Valuable');
  };

  const saveTag = () => {
    if (!draft || !label.trim()) return;
    if (draft.id) updateTag(draft.id, { label: label.trim(), note: kind });
    else addTag({ label: label.trim(), note: kind, frame: draft.frame, x: draft.x, y: draft.y });
    setDraft(null);
  };

  const deleteDraft = () => {
    if (draft?.id) removeTag(draft.id);
    setDraft(null);
  };

  // Drag a pin to a new spot; the drop point is saved as a fraction of the image.
  const movePin = (t: Tag, viewX: number, viewY: number) => {
    const x = Math.max(0, Math.min(FW, viewX));
    const y = Math.max(0, Math.min(FH, viewY));
    updateTag(t.id, viewToImage(img, FW, FH, x, y));
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
        <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false} scrollEnabled={!dragging}>
          <Text style={styles.h1}>Flag anything important</Text>
          <Text style={styles.sub}>
            Tap the photo to mark an object. E.g a fragile vase, a sharp edge, any valuable items. This is optional but if
            flagged, the AI will treat this as a top priority.
          </Text>

          <View style={[styles.card, { width: cardW }]}>
            <ProgressBars count={frames.length} active={frameIndex} onSelect={goToFrame} />
            <View style={styles.frames}>
              <ZoomBox key={frameIndex} width={FW} height={FH} locked={dragging}>
                <Pressable onPress={onFramePress}>
                  <FrameView frame={frames[frameIndex]} width={FW} height={FH} radius={12} />
                  {pins.map((t) => {
                    const p = imageToView(img, FW, FH, t.x as number, t.y as number);
                    return (
                      <DraggablePin
                        key={t.id}
                        x={p.x}
                        y={p.y}
                        onTap={() => editTag(t)}
                        onDragStart={() => setDragging(true)}
                        onDrop={(nx, ny) => {
                          setDragging(false);
                          movePin(t, nx, ny);
                        }}
                      />
                    );
                  })}
                </Pressable>
              </ZoomBox>
              {/* Side arrows (same as Review) show there are more frames that way. */}
              {frameIndex > 0 && (
                <Pressable onPress={() => goToFrame(frameIndex - 1)} hitSlop={8} accessibilityLabel="Previous photo" style={[styles.sideArrow, { left: (cardW - FW) / 4 - 16, top: FH / 2 - 16 }]}>
                  <ChevronIcon dir="left" size={12} />
                </Pressable>
              )}
              {frameIndex < frames.length - 1 && (
                <Pressable onPress={() => goToFrame(frameIndex + 1)} hitSlop={8} accessibilityLabel="Next photo" style={[styles.sideArrow, { right: (cardW - FW) / 4 - 16, top: FH / 2 - 16 }]}>
                  <ChevronIcon dir="right" size={12} />
                </Pressable>
              )}
            </View>
          </View>

          <View style={styles.selector}>
            <Text style={styles.frameLabel}>Frame {frameIndex + 1} of {frames.length}</Text>
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
          />
        </ScrollView>
      </SafeAreaView>

      <Modal visible={!!draft} transparent animationType="fade" onRequestClose={() => setDraft(null)}>
        {/* Sits at the top of the screen so the keyboard never covers it. */}
        <View style={{ flex: 1 }}>
          <Pressable style={styles.backdrop} onPress={() => setDraft(null)} />
          <View style={[styles.sheet, { top: insets.top + 12 }]}>
            <Text style={styles.sheetTitle}>{draft?.id ? 'Edit this tag' : 'Flag this object'}</Text>
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
              height={48}
              textStyle={{ fontFamily: fonts.semibold, fontSize: 15 }}
              style={{ marginTop: 12 }}
            />
            <JoinedButtons
              left={{ label: 'Cancel', onPress: () => setDraft(null) }}
              right={{ label: 'Save tag', onPress: saveTag, disabled: !label.trim() }}
              leftBg={colors.track}
              style={{ marginTop: 18 }}
            />
            {draft?.id && (
              <Pressable onPress={deleteDraft} hitSlop={8} style={styles.removeTag}>
                <Text style={styles.remove}>Remove tag</Text>
              </Pressable>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

// A tag star on the photo: drag it to move the tag, tap it to edit or remove.
function DraggablePin({
  x,
  y,
  onTap,
  onDragStart,
  onDrop,
}: {
  x: number;
  y: number;
  onTap: () => void;
  onDragStart: () => void;
  onDrop: (x: number, y: number) => void;
}) {
  const [offset, setOffset] = useState({ dx: 0, dy: 0 });
  const pos = useRef({ x, y });
  pos.current = { x, y };
  const handlers = useRef({ onTap, onDragStart, onDrop });
  handlers.current = { onTap, onDragStart, onDrop };

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => handlers.current.onDragStart(),
      onPanResponderMove: (_, g) => setOffset({ dx: g.dx, dy: g.dy }),
      onPanResponderRelease: (_, g) => {
        setOffset({ dx: 0, dy: 0 });
        if (Math.abs(g.dx) < 4 && Math.abs(g.dy) < 4) {
          handlers.current.onDrop(pos.current.x, pos.current.y); // re-enables page scroll
          handlers.current.onTap();
        } else {
          handlers.current.onDrop(pos.current.x + g.dx, pos.current.y + g.dy);
        }
      },
      onPanResponderTerminate: () => {
        setOffset({ dx: 0, dy: 0 });
        handlers.current.onDrop(pos.current.x, pos.current.y);
      },
    })
  ).current;

  const dragged = offset.dx !== 0 || offset.dy !== 0;
  return (
    <View
      {...responder.panHandlers}
      hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      accessibilityLabel="Tag, drag to move or tap to edit"
      style={[
        styles.pin,
        { left: x + offset.dx - 11, top: y + offset.dy - 11 },
        dragged && { transform: [{ scale: 1.3 }] },
      ]}
    >
      <Text style={styles.pinTxt}>★</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg2 },
  center: { alignItems: 'center', justifyContent: 'center' },
  topBar: { paddingHorizontal: 22, paddingTop: 6 },
  body: { paddingHorizontal: 22, paddingBottom: 40 },
  h1: { fontFamily: fonts.bold, color: colors.text, fontSize: 20, marginTop: 14 },
  sub: { fontFamily: fonts.regular, color: colors.text, fontSize: 15, lineHeight: 21, marginTop: 6 },

  card: { backgroundColor: colors.bg, borderRadius: 20, paddingTop: 13, paddingBottom: 22, marginTop: 16 },
  frames: { alignItems: 'center' }, // one whole frame, centred; no clipped neighbour
  sideArrow: { position: 'absolute', width: 32, height: 32, borderRadius: 16, backgroundColor: colors.bg2, alignItems: 'center', justifyContent: 'center' },
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
  removeTag: { alignSelf: 'center', marginTop: 14 },

  selector: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, marginTop: 9 },
  frameLabel: { fontFamily: fonts.regular, color: colors.text, fontSize: 15, minWidth: 90, textAlign: 'center' },

  empty: { fontFamily: fonts.regular, color: colors.text, fontSize: 15, textAlign: 'center', lineHeight: 21, marginTop: 16, marginBottom: 26 },
  list: { gap: 8, marginTop: 15, marginBottom: 18 },
  tagRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bg, borderRadius: 12, paddingHorizontal: 14, minHeight: 58, paddingVertical: 8 },
  tagLabel: { fontFamily: fonts.semibold, color: colors.text, fontSize: 15 },
  tagNote: { fontFamily: fonts.regular, color: colors.text, fontSize: 13, marginTop: 2 },
  remove: { fontFamily: fonts.semibold, color: colors.text, fontSize: 13 },

  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: { position: 'absolute', left: 12, right: 12, backgroundColor: colors.bg, borderRadius: 22, padding: 22, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 16, shadowOffset: { width: 0, height: 6 } },
  sheetTitle: { fontFamily: fonts.bold, color: colors.text, fontSize: 18 },
  sheetSub: { fontFamily: fonts.regular, color: colors.textMuted, fontSize: 12, marginTop: 2, marginBottom: 12 },
  input: { backgroundColor: colors.track, borderRadius: 12, height: 48, paddingHorizontal: 12, fontFamily: fonts.regular, fontSize: 14, color: colors.text },
});
