// B1 · Results, no dog chosen yet (Results guide step 5; Figma "04 · Breed
// suggestions"). Dark photo header, then "Who's moving in?" with two options.

import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PackIcon } from '../icons';
import type { PackIconName } from '../packIcons';
import { PawTile } from '../kit';
import { colors, fonts } from '../../theme';
import type { Frame } from '../../types';

const ILLUSTRATION = require('../../../assets/images/whos-moving-in.png');

function Option({ icon, title, body, primary, onPress }: { icon: PackIconName; title: string; body: string; primary?: boolean; onPress: () => void }) {
  return (
    <Pressable style={[styles.option, primary ? { backgroundColor: colors.peach } : styles.optionWhite]} onPress={onPress}>
      <View style={[styles.optionIcon, { backgroundColor: primary ? colors.orange : colors.track }]}>
        <PackIcon name={icon} size={20} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.optionTitle}>{title}</Text>
        <Text style={styles.small}>{body}</Text>
      </View>
      <PackIcon name="chevron-right" size={16} color={colors.textFaint} />
    </Pressable>
  );
}

export function NoDogYet({
  title,
  photo,
  onBack,
  onHelpChoose,
  onInMind,
}: {
  title: string;
  photo?: Frame;
  onBack: () => void;
  onHelpChoose: () => void;
  onInMind: () => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView style={styles.root} contentContainerStyle={{ paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        {photo && <Image source={{ uri: photo.uri }} style={StyleSheet.absoluteFill} resizeMode="cover" />}
        <View style={[StyleSheet.absoluteFill, { backgroundColor: photo ? 'rgba(0,0,0,0.72)' : colors.text }]} />
        <PawTile size={40} />
        <Pressable onPress={onBack} hitSlop={12} style={{ marginTop: 14, alignSelf: 'flex-start' }} accessibilityLabel="Back">
          <PackIcon name="arrow-left" size={24} color="#fff" />
        </Pressable>
        <Text style={styles.space} numberOfLines={1}>{title}</Text>
        <Text style={styles.spaceSub}>Your room is saved. Now, who’s moving in?</Text>
      </View>
      <View style={styles.sheet}>
        <View style={styles.art}>
          <Image source={ILLUSTRATION} style={styles.artImg} />
        </View>
        <Text style={styles.heading}>Who’s moving in?</Text>
        <Text style={styles.body}>Pick a dog to see how they’d feel in this room, or let us suggest a few who’d love it here.</Text>
        <Option icon="star-01" primary title="Help me choose" body="Suggestions that suit this room and your days." onPress={onHelpChoose} />
        <Option icon="search-md" title="I have a dog in mind" body="Search breeds, or tell us about a mixed breed." onPress={onInMind} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.cream },
  header: { height: 220, paddingHorizontal: 22, backgroundColor: colors.text, overflow: 'hidden' },
  space: { fontFamily: fonts.bold, fontSize: 20, lineHeight: 26, color: '#fff', marginTop: 12 },
  spaceSub: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.cream },
  sheet: { backgroundColor: colors.cream, borderTopLeftRadius: 28, borderTopRightRadius: 28, marginTop: -28, paddingHorizontal: 24, paddingTop: 28, gap: 14, alignItems: 'center' },
  // Figma crops the 3-dog image inside a 220×116 frame.
  art: { width: 220, height: 116, overflow: 'hidden' },
  artImg: { position: 'absolute', width: 220 * 1.0171, height: 116 * 1.286, left: -220 * 0.0386, top: -116 * 0.0202 },
  heading: { fontFamily: fonts.bold, fontSize: 20, lineHeight: 26, color: colors.text },
  body: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 21, color: colors.textMuted, textAlign: 'center' },
  option: { alignSelf: 'stretch', flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: 20, padding: 16 },
  optionWhite: { backgroundColor: '#fff', borderWidth: 1, borderColor: 'rgba(36,30,24,0.10)' },
  optionIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  optionTitle: { fontFamily: fonts.medium, fontSize: 15, lineHeight: 21, color: colors.text },
  small: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.textMuted },
});
