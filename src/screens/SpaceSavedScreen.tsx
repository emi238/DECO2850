// "Purrfect! Space Saved" — name + label the new space, then either start the
// analysis, edit the household questionnaire first, or go home.

import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, ScrollView, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { TopBar, JoinedButtons, Chip } from '../components/kit';
import { FrameView } from '../components/FrameView';
import { EditIcon } from '../components/icons';
import { colors, fonts } from '../theme';
import { useSession, useCurrentSpace } from '../store/session';
import type { ScreenProps } from '../navigation';

const LABELS = ['Living Room', 'Kitchen', 'Bedroom'];

export default function SpaceSavedScreen({ navigation }: ScreenProps<'SpaceSaved'>) {
  const space = useCurrentSpace();
  const patchSpace = useSession((s) => s.patchSpace);
  const nameRef = useRef<TextInput>(null);
  const { width } = useWindowDimensions();
  const cardW = width - 44;
  const { height } = useWindowDimensions();
  // Photo sized so the whole screen (buttons included) fits without scrolling.
  const FH = Math.max(220, Math.min(Math.round(cardW * 0.7 * 1.45), height - 600));
  const FW = Math.round(FH / 1.45);

  // Reaching this screen means the space is saved (it now shows on Home).
  useEffect(() => {
    patchSpace({ saved: true });
  }, [patchSpace]);

  if (!space) return <View style={styles.root} />;

  const startAnalysis = () => {
    // Analyse with the latest household answers.
    patchSpace({ questionnaire: { ...useSession.getState().household }, result: null });
    navigation.navigate('Analysis', { run: true });
  };

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1 }}>
        <TopBar onBack={() => navigation.goBack()} onClose={() => navigation.navigate('Home')} style={styles.topBar} />
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Text style={styles.h1}>Purrfect! Space Saved</Text>
          <Text style={styles.sub}>
            Ensure that your household questionnaire (in profile!) is filled out before analysing the space for better
            results and analysis. You can edit or tag any new items through the home → specific space.
          </Text>

          <View style={[styles.card, { height: FH + 44 }]}>
            {space.capture.frames[0] && (
              <View style={styles.tilt}>
                <FrameView frame={space.capture.frames[0]} width={FW} height={FH} radius={12} />
              </View>
            )}
          </View>

          <Text style={styles.label}>Space Saved Under:</Text>
          <Pressable style={styles.nameBox} onPress={() => nameRef.current?.focus()}>
            <TextInput
              ref={nameRef}
              defaultValue={space.name}
              onEndEditing={(e) => patchSpace({ name: e.nativeEvent.text.trim() || space.name })}
              style={styles.nameInput}
              returnKeyType="done"
            />
            <View style={styles.pencil} pointerEvents="none">
              <EditIcon size={22} />
            </View>
          </Pressable>

          <Text style={styles.label}>Space Label:</Text>
          <View style={styles.chips}>
            {LABELS.map((l) => (
              <Chip
                key={l}
                label={l}
                selected={space.label === l}
                onPress={() => patchSpace({ label: space.label === l ? undefined : l })}
                style={[styles.chip, space.label !== l && { backgroundColor: colors.bg }]}
                textStyle={{ fontSize: 12.5 }}
              />
            ))}
          </View>

          <JoinedButtons
            left={{ label: 'Edit Questionnaire', onPress: () => navigation.navigate('Household') }}
            right={{ label: 'Start Space Analysis', onPress: startAnalysis }}
            leftBg={colors.midGray}
            style={{ marginTop: 20 }}
          />
          <Pressable onPress={() => navigation.reset({ index: 0, routes: [{ name: 'Home' }] })} style={styles.home} hitSlop={8}>
            <Text style={styles.homeTxt}>Go Home Instead</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg2 },
  topBar: { paddingHorizontal: 22, paddingTop: 6 },
  body: { paddingHorizontal: 22, paddingBottom: 30 },
  h1: { fontFamily: fonts.bold, color: colors.text, fontSize: 20, marginTop: -2 },
  sub: { fontFamily: fonts.regular, color: colors.text, fontSize: 12.5, lineHeight: 17, marginTop: 4 },
  card: { backgroundColor: colors.bg, borderRadius: 20, marginTop: 6, alignItems: 'center', justifyContent: 'center' },
  tilt: { transform: [{ rotate: '-3deg' }] },
  label: { fontFamily: fonts.regular, color: colors.text, fontSize: 12.5, marginTop: 16, marginBottom: 8 },
  nameBox: { backgroundColor: colors.bg, borderRadius: 12, height: 51, justifyContent: 'center' },
  nameInput: { fontFamily: fonts.medium, fontSize: 20, color: colors.text, textAlign: 'center', paddingHorizontal: 50, height: 51 },
  pencil: { position: 'absolute', right: 14 },
  chips: { flexDirection: 'row', gap: 10 },
  chip: { flex: 1, height: 29, borderRadius: 8 },
  home: { alignSelf: 'center', marginTop: 16 },
  homeTxt: { fontFamily: fonts.regular, color: colors.text, fontSize: 12, textDecorationLine: 'underline' },
});
