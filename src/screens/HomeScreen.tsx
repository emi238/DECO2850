// Home dashboard — greets the user and lists their saved spaces. "Upload New
// Space" starts the capture flow; tapping a space opens its analysis. The
// swipe-up nav starts open here. A walkthrough (HomeTour) runs the first time,
// right after onboarding, and again from the Help button.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Image, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FrameView } from '../components/FrameView';
import { SwipeUpNav } from '../components/SwipeUpNav';
import { AvatarButton } from '../components/kit';
import { HomeTour, type Box, type TourStep } from '../components/HomeTour';
import { UploadIcon } from '../components/icons';
import { colors, fonts } from '../theme';
import { IMAGES } from '../assets';
import { useSession } from '../store/session';
import type { Space } from '../types';
import type { ScreenProps } from '../navigation';

export const HELP_TEXT =
  'Upload a new space (the middle button) to photograph a room, flag anything precious, then run an analysis for the dog breed you have in mind. Open a saved space to see its risks, and change your household answers any time from your profile.';

type TourKey = 'profile' | 'upload' | 'featured' | 'browse' | 'changed' | 'help';

const TOUR: TourStep<TourKey>[] = [
  {
    key: 'profile',
    title: 'Your profile',
    body: 'Edit your details and your household questionnaire here. This is also where you log out or delete your data.',
  },
  {
    key: 'upload',
    title: 'Upload a new space',
    body: 'Start here. Take or upload photos of a room, and we’ll check how well it suits a dog.',
  },
  {
    key: 'featured',
    title: 'Your most visited space',
    body: 'The space you open the most sits here, so you can jump straight back in.',
  },
  {
    key: 'browse',
    title: 'Saved spaces',
    body: 'Every space you save is kept here with its tags, ready to re-run the analysis any time.',
  },
  {
    key: 'changed',
    title: 'Has your situation changed?',
    body: 'Moved house or got another pet? Update your answers here and every analysis will use them.',
  },
  {
    key: 'help',
    title: 'Need a refresher?',
    body: 'Tap Help any time to replay this tour. Ready to find the right home for a dog?',
  },
];

export default function HomeScreen({ navigation, route }: ScreenProps<'Home'>) {
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

  // ---- walkthrough ----
  const [tourStep, setTourStep] = useState<number | null>(null); // null = not showing
  const [tourBox, setTourBox] = useState<Box | null>(null);
  const touring = tourStep !== null;
  const scrollRef = useRef<ScrollView>(null);
  const refs = {
    profile: useRef<View>(null),
    upload: useRef<View>(null),
    featured: useRef<View>(null),
    browse: useRef<View>(null),
    changed: useRef<View>(null),
    help: useRef<View>(null),
  };
  const contentY = useRef<Partial<Record<TourKey, number>>>({}); // where each part sits in the scroll
  const onPartLayout = (key: TourKey) => (e: { nativeEvent: { layout: { y: number } } }) => {
    contentY.current[key] = e.nativeEvent.layout.y;
  };

  // Scroll the step's part into view, then measure where it landed on screen.
  const showStep = useCallback((i: number) => {
    const key = TOUR[i].key;
    setTourStep(i);
    setTourBox(null);
    const y = contentY.current[key];
    if (y !== undefined) scrollRef.current?.scrollTo({ y: Math.max(0, y - 40), animated: true });
    else if (key === 'profile') scrollRef.current?.scrollTo({ y: 0, animated: true });
    setTimeout(() => {
      refs[key].current?.measureInWindow((x, top, width, height) => {
        // The puppy on the "living situation" card pokes ~38pt above it; include its head.
        const grow = key === 'changed' ? 38 : 0;
        if (width > 0) setTourBox({ x, y: top - grow, width, height: height + grow });
      });
    }, 420);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startTour = useCallback(() => showStep(0), [showStep]);
  const endTour = () => {
    setTourStep(null);
    setTourBox(null);
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  };

  // First visit after onboarding: start once the screen has laid out.
  useEffect(() => {
    if (!route.params?.tour) return;
    const t = setTimeout(() => {
      navigation.setParams({ tour: undefined }); // so it doesn't start again
      startTour();
    }, 500);
    return () => clearTimeout(t);
  }, [route.params?.tour, navigation, startTour]);

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.top}>
        <View style={styles.topRow}>
          <Image source={IMAGES.paw} style={styles.paw} resizeMode="contain" />
          <View ref={refs.profile} collapsable={false}>
            <AvatarButton onPress={() => navigation.navigate('Profile')} />
          </View>
        </View>
        <Text style={styles.hi}>Hi {name},</Text>
        <Text style={styles.sub}>Explore your spaces</Text>
      </SafeAreaView>

      <View style={styles.panel}>
        <ScrollView ref={scrollRef} contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
          <View ref={refs.upload} collapsable={false} onLayout={onPartLayout('upload')}>
            <Text style={[styles.label, { marginTop: 0 }]}>Scan your Space</Text>
            <Pressable style={({ pressed }) => [styles.upload, pressed && { opacity: 0.7 }]} onPress={startCapture}>
              <Text style={styles.uploadTxt}>Upload New Space</Text>
              <UploadIcon size={26} />
            </Pressable>
          </View>

          {/* During the tour, empty sections show grey placeholders so there's something to point at. */}
          {(featured || touring) && (
            <View ref={refs.featured} collapsable={false} onLayout={onPartLayout('featured')} style={styles.section}>
              <Pressable onPress={() => featured && openSpace(featured)}>
                <Text style={[styles.label, { marginTop: 0 }]}>Most Frequently Visited Space →</Text>
                {featured ? (
                  <FrameView frame={featured.capture.frames[0]} width={contentW} height={160} radius={12} />
                ) : (
                  <View style={[styles.placeholder, { width: contentW, height: 160 }]}>
                    <Text style={styles.placeholderTxt}>The space you open most will show here</Text>
                  </View>
                )}
              </Pressable>
            </View>
          )}

          {(rest.length > 0 || touring) && (
            <View ref={refs.browse} collapsable={false} onLayout={onPartLayout('browse')} style={styles.section}>
              <Text style={[styles.label, { marginTop: 0 }]}>Browse saved spaces →</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.browse} style={styles.browseScroll}>
                {rest.length > 0
                  ? rest.map((sp) => (
                      <Pressable key={sp.id} onPress={() => openSpace(sp)}>
                        <FrameView frame={sp.capture.frames[0]} width={125} height={160} radius={12} />
                      </Pressable>
                    ))
                  : [0, 1, 2].map((i) => <View key={i} style={[styles.placeholder, { width: 125, height: 160 }]} />)}
              </ScrollView>
            </View>
          )}

          {saved.length === 0 && !touring && (
            <Text style={styles.empty}>No saved spaces yet. Tap “Upload New Space” to capture your first room.</Text>
          )}

          <Pressable
            ref={refs.changed}
            onLayout={onPartLayout('changed')}
            style={styles.changed}
            onPress={() => navigation.navigate('Profile', { editHousehold: true })}
          >
            <View style={styles.changedText}>
              <Text style={styles.changedH}>Has your living{'\n'}situation changed? →</Text>
              <Text style={styles.changedSub}>Change your preferences and tell us what’s new!</Text>
            </View>
            <Image source={IMAGES.goldenPuppy} style={styles.changedDog} resizeMode="contain" />
          </Pressable>
        </ScrollView>
      </View>

      <SwipeUpNav defaultOpen keepOpen={touring} helpRef={refs.help} onSpaces={() => {}} onCapture={startCapture} onHelp={startTour} />

      {touring && (
        <HomeTour
          steps={TOUR}
          index={tourStep}
          target={tourBox}
          onNext={() => (tourStep < TOUR.length - 1 ? showStep(tourStep + 1) : endTour())}
          onBack={() => showStep(Math.max(0, tourStep - 1))}
          onSkip={endTour}
          onReplay={startTour}
        />
      )}
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
  section: { marginTop: 26 }, // outside the section, so the tour highlight hugs it
  placeholder: { backgroundColor: colors.track, borderRadius: 12, alignItems: 'center', justifyContent: 'center', padding: 16 },
  placeholderTxt: { fontFamily: fonts.regular, color: colors.textMuted, fontSize: 13, textAlign: 'center' },
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
