// Screen 4 · Photo map (Results guide step 2, B3; Figma "Results / Photo map").
// The user's photos full screen with a pin on every item; a cream bottom card shows
// the selected item, See details and Next pin. Owner-placed off-limits areas keep ✕.

import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Image, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PackIcon } from '../components/icons';
import { useFrameImageSize } from '../components/FrameView';
import { useResults, Pin, TodoRow, ListMapToggle, GROUP, resultStyles as R } from '../components/results/todo';
import { colors, fonts } from '../theme';
import type { ScreenProps } from '../navigation';
import type { TodoGroup } from '../logic/recommend';

const LEGEND: { g: TodoGroup; word: string }[] = [
  { g: 'do_first', word: 'Do first' },
  { g: 'worth_doing', word: 'Worth doing' },
  { g: 'nice_extra', word: 'Extra' },
  { g: 'spot', word: 'Spot' },
  { g: 'protect', word: 'Protect' },
];

export default function ResultsMapScreen({ navigation, route }: ScreenProps<'ResultsMap'>) {
  const { space, items: all, photosChecked } = useResults();
  const need = route.params?.need;
  const pinned = useMemo(
    () => (need ? all.filter((i) => i.need === need) : all).filter((i) => i.frame_index != null && i.x != null && i.y != null),
    [all, need]
  );
  const start = pinned.find((i) => i.id === route.params?.id);
  const [selected, setSelected] = useState<string | null>(start?.id ?? null);
  const [page, setPage] = useState(start?.frame_index ?? 0);
  const { width: W, height: H } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const frames = space?.capture.frames ?? [];
  const frame = frames[page];
  const img = useFrameImageSize(frame);
  if (!space || !frame) return null;

  const onPage = pinned.filter((i) => i.frame_index === page);
  const sel = pinned.find((i) => i.id === selected);
  // The photo is drawn "cover"; when it's wider (or taller) than the screen it
  // slides so the selected pin is in view instead of always showing the middle.
  const scale = img ? Math.max(W / img.w, H / img.h) : 1;
  const dw = img ? img.w * scale : W;
  const dh = img ? img.h * scale : H;
  const sheetH = 230; // keep pins clear of the bottom card
  const focus = sel && sel.frame_index === page ? sel : null;
  const ox = focus ? Math.min(0, Math.max(W - dw, W / 2 - focus.x! * dw)) : (W - dw) / 2;
  const oy = focus ? Math.min(0, Math.max(H - dh, (H - sheetH) / 2 - focus.y! * dh)) : (H - dh) / 2;
  const toView = (x: number, y: number) => ({ x: ox + x * dw, y: oy + y * dh });
  const offLimits = space.tags.filter((t) => t.offLimits && t.frame === page);
  const nextPin = () => {
    if (!pinned.length) return;
    const i = sel ? pinned.indexOf(sel) : -1;
    const n = pinned[(i + 1) % pinned.length];
    setSelected(n.id);
    setPage(n.frame_index!);
  };

  return (
    <View style={styles.root}>
      <Image source={{ uri: frame.uri }} style={{ position: 'absolute', left: ox, top: oy, width: dw, height: dh }} />
      {Array.from({ length: 10 }, (_, i) => (
        <View key={i} pointerEvents="none" style={[styles.fade, { height: (insets.top + 130) * (1 - i / 10), backgroundColor: 'rgba(0,0,0,0.045)' }]} />
      ))}
      {!photosChecked && <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.45)' }]} pointerEvents="none" />}

      {onPage.map((it) => {
        const p = toView(it.x!, it.y!);
        const on = it.id === selected;
        const s = on ? 40 : 30;
        const off = on ? (s + 12) / 2 : s / 2;
        return (
          <Pressable key={it.id} onPress={() => setSelected(it.id)} hitSlop={8} style={{ position: 'absolute', left: p.x - off, top: p.y - off, zIndex: on ? 2 : 1 }}>
            <Pin item={it} size={s} selected={on} />
          </Pressable>
        );
      })}
      {offLimits.map((t) => {
        const p = toView(t.x as number, t.y as number);
        return (
          <View key={t.id} style={[styles.offLimits, { left: p.x - 14, top: p.y - 14 }]} pointerEvents="none">
            <Text style={styles.offLimitsTxt}>✕</Text>
          </View>
        );
      })}

      <View style={[styles.top, { top: insets.top + 8 }]}>
        <Pressable style={R.roundBtn} onPress={() => navigation.goBack()} accessibilityLabel="Back">
          <PackIcon name="arrow-left" size={22} />
        </Pressable>
        <ListMapToggle active="map" onList={() => navigation.replace('Todo', { need })} onMap={() => {}} />
      </View>
      <View style={[R.darkPill, { position: 'absolute', left: 18, top: insets.top + 60 }]}>
        <Text style={R.darkPillTxt}>
          Photo {page + 1} of {frames.length}
          {photosChecked ? '' : ' · not checked'}
        </Text>
      </View>
      {frames.length > 1 && (
        <>
          {page > 0 && (
            <Pressable style={[styles.side, { left: 10, top: H * 0.42 }]} onPress={() => setPage(page - 1)} accessibilityLabel="Previous photo">
              <PackIcon name="chevron-left" size={20} />
            </Pressable>
          )}
          {page < frames.length - 1 && (
            <Pressable style={[styles.side, { right: 10, top: H * 0.42 }]} onPress={() => setPage(page + 1)} accessibilityLabel="Next photo">
              <PackIcon name="chevron-right" size={20} />
            </Pressable>
          )}
        </>
      )}

      <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <View style={styles.legend}>
          {LEGEND.map((l) => (
            <View key={l.g} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <View style={[styles.dot, { backgroundColor: GROUP[l.g].pin }]} />
              <Text style={styles.legendTxt}>{l.word}</Text>
            </View>
          ))}
        </View>
        {!photosChecked ? (
          <View style={{ gap: 10 }}>
            <Text style={R.heading}>No pins yet</Text>
            <Text style={R.small}>We couldn’t check these photos this time, so there’s nothing to pin yet.</Text>
            <Pressable style={R.btnPrimary} onPress={() => navigation.navigate('Analysis', { run: true, report: true })}>
              <Text style={R.btnTxt}>Try again</Text>
            </Pressable>
          </View>
        ) : sel ? (
          <>
            <TodoRow item={sel} frames={frames} onPress={() => navigation.navigate('ItemDetail', { id: sel.id, need })} />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Pressable style={[R.btnPrimary, { flex: 1 }]} onPress={() => navigation.navigate('ItemDetail', { id: sel.id, need })}>
                <Text style={R.btnTxt}>See details</Text>
              </Pressable>
              <Pressable style={R.btnSecondary} onPress={nextPin}>
                <Text style={R.btnTxt}>Next pin</Text>
                <PackIcon name="chevron-right" size={16} />
              </Pressable>
            </View>
          </>
        ) : (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Text style={[R.small, { flex: 1 }]}>{pinned.length ? 'Tap a pin to see what it is.' : 'Nothing is pinned on these photos.'}</Text>
            {pinned.length > 0 && (
              <Pressable style={R.btnSecondary} onPress={nextPin}>
                <Text style={R.btnTxt}>Next pin</Text>
                <PackIcon name="chevron-right" size={16} />
              </Pressable>
            )}
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.text },
  fade: { position: 'absolute', left: 0, right: 0, top: 0 },
  top: { position: 'absolute', left: 18, right: 18, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  side: { position: 'absolute', width: 36, height: 36, borderRadius: 18, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  offLimits: { position: 'absolute', width: 28, height: 28, borderRadius: 14, backgroundColor: '#E4572E', borderWidth: 2, borderColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  offLimitsTxt: { color: '#fff', fontFamily: fonts.bold, fontSize: 13 },
  sheet: { zIndex: 5, position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: colors.cream, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 16, paddingTop: 16, gap: 12 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  legendTxt: { fontFamily: fonts.medium, fontSize: 12, lineHeight: 16, color: colors.text },
});
