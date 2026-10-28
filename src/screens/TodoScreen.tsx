// Screen 2 · Things to sort (Results guide step 2, B2; Figma "Results / To-do list").
// Every item once, most important first, grouped; filter chips per need; List | Map
// toggle; shopping ideas tied to items.

import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PackIcon } from '../components/icons';
import { useResults, GROUP, NEED_LABEL, TodoRow, ListMapToggle, productImage, resultStyles as R } from '../components/results/todo';
import { TODO_GROUPS, todoShopping, type TodoNeed } from '../logic/recommend';
import { colors, fonts } from '../theme';
import type { ScreenProps } from '../navigation';

export default function TodoScreen({ navigation, route }: ScreenProps<'Todo'>) {
  const { space, evaluation, items, photosChecked } = useResults();
  const [filter, setFilter] = useState<TodoNeed | 'all'>(route.params?.need ?? 'all');

  const needs = useMemo(() => {
    const counts = new Map<TodoNeed, number>();
    items.forEach((i) => counts.set(i.need, (counts.get(i.need) ?? 0) + 1));
    return [...counts.entries()];
  }, [items]);
  const shown = filter === 'all' ? items : items.filter((i) => i.need === filter);
  const shopping = todoShopping(shown);
  const frames = space?.capture.frames ?? [];
  if (!space || !evaluation) return null;

  const open = (id: string) => navigation.navigate('ItemDetail', { id, need: filter === 'all' ? undefined : filter });

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
          <View style={styles.topBar}>
            <Pressable onPress={() => navigation.goBack()} hitSlop={12} accessibilityLabel="Back">
              <PackIcon name="arrow-left" size={24} />
            </Pressable>
            <View style={{ flex: 1 }}>
              <Text style={R.title}>Things to sort</Text>
              <Text style={R.small} numberOfLines={1}>
                {space.label || space.name} · {evaluation.dog.name}
              </Text>
            </View>
            <ListMapToggle active="list" onList={() => {}} onMap={() => navigation.replace('ResultsMap', { need: filter === 'all' ? undefined : filter })} />
          </View>

          <Text style={R.small}>Most important first. Tap any item to see it on your photo.</Text>

          {!photosChecked && (
            <View style={styles.notice}>
              <PackIcon name="info-circle" size={20} />
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={styles.noticeTitle}>Nothing is pinned to your room yet</Text>
                <Text style={R.small}>
                  We couldn’t check your photos this time, so this list only has tips from your answers. Retake the photos to
                  see items in your room.
                </Text>
                <Pressable onPress={() => navigation.navigate('Capture')} style={[R.btnSecondary, { alignSelf: 'flex-start', marginTop: 6 }]}>
                  <Text style={R.btnTxt}>Retake photos</Text>
                </Pressable>
              </View>
            </View>
          )}

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }} style={{ marginHorizontal: -24 }}>
            <View style={{ width: 16 }} />
            {[['all', items.length] as const, ...needs].map(([k, n]) => {
              const on = filter === k;
              return (
                <Pressable key={k} onPress={() => setFilter(k)} style={[styles.filter, on && styles.filterOn]}>
                  <Text style={[styles.filterTxt, on && { color: '#fff' }]}>
                    {k === 'all' ? 'All' : NEED_LABEL[k]} · {n}
                  </Text>
                </Pressable>
              );
            })}
            <View style={{ width: 16 }} />
          </ScrollView>

          {shown.length === 0 && (
            <View style={{ gap: 12 }}>
              <Text style={R.body}>“Nothing here I can get into. I feel safe!”</Text>
              {needs.some(([k]) => k === 'setup') && (
                <Pressable style={[R.btnPrimary, { alignSelf: 'flex-start' }]} onPress={() => setFilter('setup')}>
                  <Text style={R.btnTxt}>See setup ideas</Text>
                </Pressable>
              )}
            </View>
          )}

          {TODO_GROUPS.map((g) => {
            const rows = shown.filter((i) => i.group === g);
            if (!rows.length) return null;
            return (
              <View key={g} style={{ gap: 10 }}>
                <Text style={R.heading}>
                  {GROUP[g].heading}
                  <Text style={styles.count}>   {rows.length}</Text>
                </Text>
                {rows.map((it) => (
                  <TodoRow key={it.id} item={it} frames={frames} onPress={() => open(it.id)} />
                ))}
              </View>
            );
          })}

          {photosChecked && shown.length > 0 && (
            <Pressable style={styles.recheck} onPress={() => navigation.popTo('Analysis', { recheck: true })}>
              <PackIcon name="refresh-cw-01" size={20} />
              <Text style={[R.btnTxt, { flex: 1 }]}>Done some of these? Re-check my room</Text>
              <PackIcon name="chevron-right" size={18} color={colors.textFaint} />
            </Pressable>
          )}

          {shopping.length > 0 && (
            <View style={styles.shop}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={[R.heading, { flex: 1 }]}>Shopping list</Text>
                <Text style={styles.faint}>{shopping.length === 1 ? '1 idea' : `${shopping.length} ideas`}</Text>
              </View>
              {shopping.map((p) => {
                const img = productImage(p.product);
                return (
                  <Pressable key={p.product} style={styles.product} onPress={() => open(p.itemId)}>
                    {img ? <Image source={img} style={styles.productImg} /> : <View style={[styles.productImg, { backgroundColor: colors.track }]} />}
                    <View style={{ flex: 1 }}>
                      <Text style={styles.productName}>{p.product}</Text>
                      <Text style={R.small} numberOfLines={1}>For: {p.forTitle}</Text>
                    </View>
                  </Pressable>
                );
              })}
              <Text style={styles.faint}>General ideas tied to what we found, not specific brands.</Text>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.cream },
  body: { padding: 24, gap: 18, paddingBottom: 40 },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  notice: { flexDirection: 'row', gap: 10, backgroundColor: '#fff', borderRadius: 18, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.textFaint, padding: 14 },
  noticeTitle: { fontFamily: fonts.semibold, fontSize: 15, lineHeight: 21, color: colors.text },
  filter: { borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: '#fff', borderWidth: 1, borderColor: 'rgba(36,30,24,0.10)' },
  filterOn: { backgroundColor: colors.text, borderColor: colors.text },
  filterTxt: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 18, color: colors.text },
  count: { fontFamily: fonts.regular, fontSize: 13, color: colors.textFaint },
  recheck: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.stateGoodTint, borderRadius: 18, padding: 14 },
  shop: { backgroundColor: '#fff', borderRadius: 20, borderWidth: 1, borderColor: 'rgba(36,30,24,0.10)', padding: 16, gap: 12 },
  product: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  productImg: { width: 44, height: 44, borderRadius: 10 },
  productName: { fontFamily: fonts.medium, fontSize: 15, lineHeight: 21, color: colors.text },
  faint: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.textFaint },
});
