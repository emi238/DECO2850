// Screen 3 · Item detail (Results guide step 2, B4; Figma "Results / Item detail").
// The user's photo zoomed on the item with its pin, then why it matters (dog voice),
// what to do (app voice), a product idea, and Prev · Show on my photo · Next.

import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Image, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PackIcon } from '../components/icons';
import { useResults, ToneChip, NEED_LABEL, Pin, PhotoCrop, cropPinPos, GROUP, productImage, resultStyles as R } from '../components/results/todo';
import { NEED_ICON } from '../components/results/Overview';
import { useFrameImageSize } from '../components/FrameView';
import { colors, fonts } from '../theme';
import type { ScreenProps } from '../navigation';

const PHOTO_H = 300;

export default function ItemDetailScreen({ navigation, route }: ScreenProps<'ItemDetail'>) {
  const { space, evaluation, items: all } = useResults();
  const items = route.params?.need ? all.filter((i) => i.need === route.params?.need) : all;
  const [index, setIndex] = useState(Math.max(0, items.findIndex((i) => i.id === route.params?.id)));
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const item = items[index];
  const frames = space?.capture.frames ?? [];
  const frame = item?.frame_index != null ? frames[item.frame_index] : undefined;
  const fs = useFrameImageSize(frame);
  if (!space || !evaluation || !item) return null;

  const hasPhoto = !!frame && item.x != null && item.y != null;
  const pin = hasPhoto ? cropPinPos(fs, item.x!, item.y!, width, PHOTO_H, 2) : null;
  // Dog voice only when the model wrote it in the first person; tags are in the app voice.
  const why = item.tagged ? 'You tagged this to protect it.' : item.why;
  const dogVoice = !item.tagged && !!why && /\b(I|I'm|I’d|I'd|me|my)\b/.test(why);
  const product = item.product;
  const productImg = product ? productImage(product) : null;
  const g = GROUP[item.group];
  const needIcon = item.need === 'setup' || item.need === 'household' ? null : NEED_ICON[item.need];

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
        {hasPhoto ? (
          <PhotoCrop frame={frame!} x={item.x!} y={item.y!} width={width} height={PHOTO_H} zoom={2} radius={0}>
            <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.25)' }]} />
            <View style={{ position: 'absolute', left: pin!.left - 26, top: pin!.top - 26 }}>
              <Pin item={item} size={40} selected />
            </View>
          </PhotoCrop>
        ) : (
          // No exact spot (e.g. daily walks): the room's first photo as a backdrop, no pin.
          <View style={{ height: PHOTO_H, backgroundColor: g.tint }}>
            {frames[0] && <Image source={{ uri: frames[0].uri }} style={StyleSheet.absoluteFill} resizeMode="cover" />}
            <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.25)' }]} />
          </View>
        )}
        <View style={[styles.topControls, { top: insets.top + 8 }]}>
          <Pressable style={R.roundBtn} onPress={() => navigation.goBack()} accessibilityLabel="Back">
            <PackIcon name="arrow-left" size={22} />
          </Pressable>
          <View style={R.darkPill}>
            <Text style={R.darkPillTxt}>
              {index + 1} of {items.length}
            </Text>
          </View>
        </View>

        <View style={styles.card}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <ToneChip group={item.group} />
            <View style={styles.needChip}>
              <Text style={styles.needChipTxt}>{NEED_LABEL[item.need].toUpperCase()}</Text>
            </View>
          </View>
          <Text style={R.title}>{item.title}</Text>

          {!!why && (
            <View style={styles.why}>
              <Text style={styles.whyLabel}>Why it matters</Text>
              <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                {dogVoice && <Image source={evaluation.dog.happy} style={styles.avatar} resizeMode="cover" />}
                <Text style={[styles.whyTxt, { flex: 1 }]}>{dogVoice ? `“${why}”` : why}</Text>
              </View>
            </View>
          )}

          <View style={{ gap: 6 }}>
            <Text style={R.heading}>What to do</Text>
            <Text style={R.body}>{item.tagged ? 'Keep it up high or behind a closed door, out of reach of paws and tails.' : item.whatToDo}</Text>
          </View>

          {!!product && (
            <View style={styles.product}>
              {productImg ? <Image source={productImg} style={styles.productImg} /> : <View style={[styles.productImg, { backgroundColor: colors.track }]} />}
              <View style={{ flex: 1 }}>
                <Text style={styles.productName}>{product}</Text>
                <Text style={R.small}>A general idea, not a specific brand</Text>
              </View>
            </View>
          )}

          {item.offLimits && (
            <Pressable style={[R.btnSecondary, { alignSelf: 'flex-start' }]} onPress={() => navigation.navigate('Analysis', { place: item.title })}>
              <Text style={R.btnTxt}>Keep the dog out of here</Text>
            </Pressable>
          )}
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <Pressable style={[R.btnSecondary, styles.side, { opacity: index > 0 ? 1 : 0.4 }]} disabled={index === 0} onPress={() => setIndex(index - 1)}>
          <PackIcon name="chevron-left" size={16} />
          <Text style={R.btnTxt}>Prev</Text>
        </Pressable>
        {hasPhoto ? (
          <Pressable style={[R.btnPrimary, { flex: 1, paddingHorizontal: 10 }]} onPress={() => navigation.navigate('ResultsMap', { id: item.id })}>
            <Text style={[R.btnTxt, { textAlign: 'center' }]} numberOfLines={1} adjustsFontSizeToFit>Show on my photo</Text>
          </Pressable>
        ) : (
          <View style={{ flex: 1 }} />
        )}
        <Pressable style={[R.btnSecondary, styles.side, { opacity: index < items.length - 1 ? 1 : 0.4 }]} disabled={index >= items.length - 1} onPress={() => setIndex(index + 1)}>
          <Text style={R.btnTxt}>Next</Text>
          <PackIcon name="chevron-right" size={16} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.cream },
  tintHeader: { alignItems: 'center', justifyContent: 'center' },
  topControls: { position: 'absolute', left: 18, right: 18, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  card: { backgroundColor: colors.cream, borderTopLeftRadius: 28, borderTopRightRadius: 28, marginTop: -24, padding: 24, gap: 16 },
  needChip: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3, backgroundColor: colors.track },
  needChipTxt: { fontFamily: fonts.semibold, fontSize: 11, lineHeight: 14, letterSpacing: 0.9, color: colors.textMuted },
  why: { backgroundColor: '#fff', borderRadius: 18, borderWidth: 1, borderColor: 'rgba(36,30,24,0.10)', padding: 16, gap: 8 },
  whyLabel: { fontFamily: fonts.medium, fontSize: 12, lineHeight: 16, color: colors.textMuted },
  whyTxt: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 21, color: colors.text },
  avatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.peach },
  product: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', borderRadius: 18, borderWidth: 1, borderColor: 'rgba(36,30,24,0.10)', padding: 12 },
  productImg: { width: 56, height: 56, borderRadius: 10 },
  productName: { fontFamily: fonts.medium, fontSize: 15, lineHeight: 21, color: colors.text },
  side: { paddingHorizontal: 14, width: 96 },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 18, paddingTop: 12, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: 'rgba(36,30,24,0.08)' },
});
