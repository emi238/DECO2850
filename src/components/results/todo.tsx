// Shared pieces for the results screens 2–4 (Results guide step 2, Part B):
// the data hook, pins, photo crops and the to-do row (Figma 00 · Components).

import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, Image, type ImageSourcePropType } from 'react-native';
import { PackIcon } from '../icons';
import { colors, fonts } from '../../theme';
import { useSession, useCurrentSpace } from '../../store/session';
import { evaluate } from '../../logic/evaluate';
import { buildTodo, type TodoGroup, type TodoItem, type TodoNeed } from '../../logic/recommend';
import { useFrameImageSize } from '../FrameView';
import { NEED_ICON } from './Overview';
import type { Frame } from '../../types';

// The space, its evaluation and the one ordered to-do list.
export function useResults() {
  const space = useCurrentSpace();
  const household = useSession((s) => s.household);
  return useMemo(() => {
    const evaluation = space ? evaluate(space, household) : null;
    // An example result (AI busy or off) can't point at anything in the photos.
    const photosChecked = space?.resultSource !== 'mock' && space?.result?.photo_check?.usable !== false;
    const items = buildTodo(evaluation, space?.result ?? null).filter((i) => photosChecked || i.frame_index == null);
    return { space, evaluation, items, photosChecked };
  }, [space, household]);
}

export const GROUP: Record<TodoGroup, { chip: string; heading: string; fg: string; tint: string; pin: string }> = {
  do_first: { chip: 'DO FIRST', heading: 'Do first', fg: colors.statePlan, tint: colors.statePlanTint, pin: colors.statePlan },
  worth_doing: { chip: 'WORTH DOING', heading: 'Worth doing', fg: colors.stateWork, tint: colors.stateWorkTint, pin: colors.orange },
  nice_extra: { chip: 'NICE EXTRA', heading: 'Nice extras', fg: colors.stateUnknown, tint: colors.stateUnknownTint, pin: colors.stateUnknown },
  spot: { chip: 'MY SPOT', heading: 'My favourite spots', fg: colors.stateGood, tint: colors.stateGoodTint, pin: colors.stateGood },
  protect: { chip: 'PROTECT THIS', heading: 'Protect this', fg: colors.statePlan, tint: colors.statePlanTint, pin: colors.peach },
};

export const NEED_LABEL: Record<TodoNeed, string> = {
  safety: 'Staying safe',
  energy: 'Exercise',
  room: 'Room',
  household: 'Fitting in',
  noise: 'Neighbours',
  setup: 'Setup',
};

const PIN_IMG: Partial<Record<TodoGroup, ImageSourcePropType>> = {
  spot: require('../../../assets/images/pins/star.png'),
  protect: require('../../../assets/images/pins/heart.png'),
};

const PRODUCT_IMG: Record<string, ImageSourcePropType> = {
  window: require('../../../assets/images/products/window-guard.png'),
  cable: require('../../../assets/images/products/cable-cover.png'),
  cord: require('../../../assets/images/products/cable-cover.png'),
  puzzle: require('../../../assets/images/products/puzzle-feeder.png'),
  basket: require('../../../assets/images/products/storage-basket.png'),
  'dog bed': require('../../../assets/images/products/dog-bed.png'),
};
// Products without an illustration fall back to a grey rounded square.
export function productImage(name: string): ImageSourcePropType | null {
  const n = name.toLowerCase();
  const k = Object.keys(PRODUCT_IMG).find((key) => n.includes(key));
  return k ? PRODUCT_IMG[k] : null;
}

// Map pin: numbered for to-dos, star for spots, heart for things to protect.
export function Pin({ item, size = 30, selected }: { item: TodoItem; size?: number; selected?: boolean }) {
  const g = GROUP[item.group];
  const img = PIN_IMG[item.group];
  const pin = (
    <View style={[styles.pin, { width: size, height: size, borderRadius: size / 2, backgroundColor: g.pin }]}>
      {img ? (
        <Image source={img} style={{ width: size * 0.4, height: size * 0.53 }} resizeMode="contain" />
      ) : (
        <Text style={[styles.pinNum, { fontSize: size * 0.4 }]}>{item.number}</Text>
      )}
    </View>
  );
  if (!selected) return pin;
  return <View style={[styles.selectedRing, { width: size + 12, height: size + 12, borderRadius: (size + 12) / 2 }]}>{pin}</View>;
}

// The user's photo zoomed on (x, y) (fractions of the original image), cover-fitted.
export function PhotoCrop({
  frame,
  x,
  y,
  width,
  height,
  zoom = 3,
  radius = 12,
  children,
}: {
  frame: Frame;
  x: number;
  y: number;
  width: number;
  height: number;
  zoom?: number;
  radius?: number;
  children?: React.ReactNode;
}) {
  const size = useFrameImageSize(frame);
  let img = null;
  if (size) {
    const s = Math.max(width / size.w, height / size.h) * zoom;
    const w = size.w * s;
    const h = size.h * s;
    const left = Math.min(0, Math.max(width - w, width / 2 - x * w));
    const top = Math.min(0, Math.max(height - h, height / 2 - y * h));
    img = <Image source={{ uri: frame.uri }} style={{ position: 'absolute', width: w, height: h, left, top }} />;
  }
  return (
    <View style={{ width, height, borderRadius: radius, overflow: 'hidden', backgroundColor: colors.track }}>
      {img}
      {children}
    </View>
  );
}

// Where the item's pin lands inside a PhotoCrop of that size (it's off-centre near edges).
export function cropPinPos(frameSize: { w: number; h: number } | null, x: number, y: number, width: number, height: number, zoom: number) {
  if (!frameSize) return { left: width / 2, top: height / 2 };
  const s = Math.max(width / frameSize.w, height / frameSize.h) * zoom;
  const w = frameSize.w * s;
  const h = frameSize.h * s;
  const left = Math.min(0, Math.max(width - w, width / 2 - x * w));
  const top = Math.min(0, Math.max(height - h, height / 2 - y * h));
  return { left: left + x * w, top: top + y * h };
}

export function ToneChip({ group }: { group: TodoGroup }) {
  const g = GROUP[group];
  return (
    <View style={[styles.toneChip, { backgroundColor: g.tint }]}>
      <Text style={[styles.label, { color: g.fg }]}>{g.chip}</Text>
    </View>
  );
}

// The thumbnail: photo crop with the pin, or the tint + need icon for items with no photo.
export function TodoThumb({ item, frames, size = 64 }: { item: TodoItem; frames: Frame[]; size?: number }) {
  const frame = item.frame_index != null ? frames[item.frame_index] : undefined;
  const fs = useFrameImageSize(frame);
  if (!frame || item.x == null || item.y == null) {
    const g = GROUP[item.group];
    const icon = item.need === 'setup' || item.need === 'household' ? null : NEED_ICON[item.need];
    return (
      <View style={[styles.thumbTint, { width: size, height: size, backgroundColor: g.tint }]}>
        {icon ? <PackIcon name={icon} size={24} /> : <Pin item={item} size={26} />}
      </View>
    );
  }
  const p = cropPinPos(fs, item.x, item.y, size, size, 3);
  return (
    <PhotoCrop frame={frame} x={item.x} y={item.y} width={size} height={size} zoom={3}>
      <View style={{ position: 'absolute', left: p.left - 13, top: p.top - 13 }}>
        <Pin item={item} size={26} />
      </View>
    </PhotoCrop>
  );
}

export function TodoRow({ item, frames, onPress, chevron = true }: { item: TodoItem; frames: Frame[]; onPress?: () => void; chevron?: boolean }) {
  return (
    <Pressable style={styles.row} onPress={onPress} disabled={!onPress}>
      <TodoThumb item={item} frames={frames} />
      <View style={{ flex: 1, gap: 4 }}>
        <ToneChip group={item.group} />
        <Text style={styles.rowTitle}>{item.title}</Text>
        <Text style={styles.rowBody} numberOfLines={3}>
          {item.tagged ? 'You tagged this to protect. Keep it out of reach.' : item.whatToDo}
        </Text>
      </View>
      {chevron && <PackIcon name="chevron-right" size={20} color={colors.textFaint} />}
    </Pressable>
  );
}

// List | Map segmented toggle.
export function ListMapToggle({ active, onList, onMap }: { active: 'list' | 'map'; onList: () => void; onMap: () => void }) {
  return (
    <View style={styles.toggle}>
      <Pressable style={[styles.toggleSeg, active === 'list' && styles.toggleOn]} onPress={onList}>
        <Text style={styles.toggleTxt}>List</Text>
      </Pressable>
      <Pressable style={[styles.toggleSeg, active === 'map' && styles.toggleOn]} onPress={onMap}>
        <Text style={styles.toggleTxt}>Map</Text>
      </Pressable>
    </View>
  );
}

export const resultStyles = StyleSheet.create({
  title: { fontFamily: fonts.bold, fontSize: 20, lineHeight: 26, color: colors.text },
  heading: { fontFamily: fonts.semibold, fontSize: 17, lineHeight: 22, color: colors.text },
  body: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 21, color: colors.textMuted },
  small: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.textMuted },
  btnPrimary: { backgroundColor: colors.orange, borderRadius: 999, paddingVertical: 11, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 4 },
  btnSecondary: { backgroundColor: '#fff', borderRadius: 999, paddingVertical: 11, paddingHorizontal: 18, borderWidth: 1, borderColor: 'rgba(36,30,24,0.18)', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 4 },
  btnTxt: { fontFamily: fonts.medium, fontSize: 15, lineHeight: 21, color: colors.text },
  roundBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
  darkPill: { backgroundColor: 'rgba(36,30,24,0.8)', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5 },
  darkPillTxt: { fontFamily: fonts.medium, fontSize: 12, lineHeight: 16, color: '#fff' },
});

const styles = StyleSheet.create({
  pin: { borderWidth: 2.5, borderColor: '#fff', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 3, shadowOffset: { width: 0, height: 2 } },
  pinNum: { fontFamily: fonts.bold, color: '#fff' },
  selectedRing: { borderWidth: 2, borderStyle: 'dashed', borderColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  toneChip: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  label: { fontFamily: fonts.semibold, fontSize: 11, lineHeight: 14, letterSpacing: 0.9 },
  thumbTint: { borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', borderRadius: 18, borderWidth: 1, borderColor: 'rgba(36,30,24,0.10)', paddingVertical: 12, paddingHorizontal: 14 },
  rowTitle: { fontFamily: fonts.medium, fontSize: 15, lineHeight: 21, color: colors.text },
  rowBody: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.textMuted },
  toggle: { flexDirection: 'row', backgroundColor: '#fff', borderRadius: 999, padding: 4, borderWidth: 1, borderColor: 'rgba(36,30,24,0.10)' },
  toggleSeg: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 999 },
  toggleOn: { backgroundColor: colors.orange },
  toggleTxt: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 18, color: colors.text },
});
