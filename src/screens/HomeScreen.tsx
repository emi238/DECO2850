// Home dashboard — greets the user and lists their saved spaces. "Upload New
// Space" starts the capture flow; tapping a space opens its analysis. The
// swipe-up nav starts open here.

import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Image, Alert, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FrameView } from '../components/FrameView';
import { SwipeUpNav } from '../components/SwipeUpNav';
import { AvatarButton } from '../components/kit';
import { UploadIcon } from '../components/icons';
import { colors, fonts } from '../theme';
import { IMAGES } from '../assets';
import { useSession } from '../store/session';
import type { Space } from '../types';
import type { ScreenProps } from '../navigation';

export const HELP_TEXT =
  'Upload a new space (the middle button) to photograph a room, flag anything precious, then run an analysis for the dog breed you have in mind. Open a saved space to see its risks, and change your household answers any time from your profile.';

export default function HomeScreen({ navigation }: ScreenProps<'Home'>) {
  const spaces = useSession((s) => s.spaces);
  const name = useSession((s) => s.profile.name) || 'Friend';
  const visitSpace = useSession((s) => s.visitSpace);

  const { width } = useWindowDimensions();
  const contentW = width - 29 * 2;

  const startCapture = () => navigation.navigate('Capture', { fresh: true });
  const openSpace = (sp: Space) => {
    visitSpace(sp.id);
    navigation.navigate('Analysis');
  };

  // Only finished spaces with a frame are shown.
  const saved = [...spaces].reverse().filter((sp) => sp.saved !== false && sp.capture.frames.length > 0);
  const featured = [...saved].sort((a, b) => (b.visits ?? 0) - (a.visits ?? 0))[0];
  const rest = saved.filter((sp) => sp !== featured);

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.top}>
        <View style={styles.topRow}>
          <Image source={IMAGES.paw} style={styles.paw} resizeMode="contain" />
          <AvatarButton onPress={() => navigation.navigate('Profile')} />
        </View>
        <Text style={styles.hi}>Hi {name},</Text>
        <Text style={styles.sub}>Explore your spaces</Text>
      </SafeAreaView>

      <View style={styles.panel}>
        <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
          <Text style={[styles.label, { marginTop: 0 }]}>Create new space</Text>
          <Pressable style={({ pressed }) => [styles.upload, pressed && { opacity: 0.7 }]} onPress={startCapture}>
            <Text style={styles.uploadTxt}>Upload New Space</Text>
            <UploadIcon size={26} />
          </Pressable>

          {featured && (
            <Pressable onPress={() => openSpace(featured)}>
              <Text style={styles.label}>Most Frequently Visited Space →</Text>
              <FrameView frame={featured.capture.frames[0]} width={contentW} height={160} radius={12} />
            </Pressable>
          )}

          {rest.length > 0 && (
            <>
              <Text style={styles.label}>Browse saved spaces →</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.browse} style={styles.browseScroll}>
                {rest.map((sp) => (
                  <Pressable key={sp.id} onPress={() => openSpace(sp)}>
                    <FrameView frame={sp.capture.frames[0]} width={125} height={160} radius={12} />
                  </Pressable>
                ))}
              </ScrollView>
            </>
          )}

          {saved.length === 0 && (
            <Text style={styles.empty}>No saved spaces yet. Tap “Upload New Space” to capture your first room.</Text>
          )}

          <Pressable style={styles.changed} onPress={() => navigation.navigate('Profile', { editHousehold: true })}>
            <View style={styles.changedText}>
              <Text style={styles.changedH}>Has your living{'\n'}situation changed? →</Text>
              <Text style={styles.changedSub}>Change your preferences and tell us what’s new!</Text>
            </View>
            <Image source={IMAGES.goldenPuppy} style={styles.changedDog} resizeMode="contain" />
          </Pressable>
        </ScrollView>
      </View>

      <SwipeUpNav
        defaultOpen
        onSpaces={() => {}}
        onCapture={startCapture}
        onHelp={() => Alert.alert('How PawSpace works', HELP_TEXT)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.orange },
  top: { paddingHorizontal: 29, paddingBottom: 14 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 },
  paw: { width: 36, height: 36, tintColor: colors.orangeDeep },
  hi: { fontFamily: fonts.semibold, color: colors.text, fontSize: 24, marginTop: 8 },
  sub: { fontFamily: fonts.regular, color: colors.text, fontSize: 17, marginTop: 4 },

  panel: { flex: 1, backgroundColor: colors.bg, borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  body: { paddingHorizontal: 29, paddingTop: 24, paddingBottom: 120 },
  label: { fontFamily: fonts.semibold, color: colors.text, fontSize: 16, marginBottom: 10, marginTop: 26 },

  upload: {
    borderWidth: 1.5,
    borderColor: colors.orange,
    borderStyle: 'dashed',
    borderRadius: 8,
    backgroundColor: '#F7F7F7',
    height: 76,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  uploadTxt: { fontFamily: fonts.regular, color: colors.text, fontSize: 15 },

  browseScroll: { marginRight: -29 },
  browse: { gap: 8, paddingRight: 29 },
  empty: { fontFamily: fonts.regular, color: colors.textMuted, fontSize: 15, textAlign: 'center', marginTop: 26, lineHeight: 21 },

  // The puppy sits at the bottom-right and pokes out above the card (as in the Figma).
  changed: {
    backgroundColor: colors.peach,
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 20,
    marginTop: 64,
    overflow: 'visible',
  },
  changedText: { paddingRight: 96 },
  changedH: { fontFamily: fonts.semibold, color: colors.text, fontSize: 17, lineHeight: 21 },
  changedSub: { fontFamily: fonts.regular, color: colors.text, fontSize: 12, marginTop: 4 },
  changedDog: { position: 'absolute', right: 18, bottom: 8, width: 90, height: 145 },
});
