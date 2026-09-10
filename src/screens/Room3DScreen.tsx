// The later-stage 3D room view (PRD §3): a generated, movable 3D room with the
// hazardous objects highlighted and a risk card on tap. Rendered with three.js
// inside a WebView so it still runs in Expo Go (no native 3D module).

import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';

import { colors, spacing, font, radius } from '../theme';
import { useSession } from '../store/session';
import { buildScene } from '../three/scene';
import { buildRoomHtml } from '../three/roomHtml';
import type { ScreenProps } from '../navigation';

export default function Room3DScreen({ navigation }: ScreenProps<'Room3D'>) {
  const result = useSession((s) => s.result);
  const frameCount = useSession((s) => s.capture.frames.length);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [hintDismissed, setHintDismissed] = useState(false);

  const scene = useMemo(
    () => (result ? buildScene(result, frameCount) : null),
    [result, frameCount]
  );
  const html = useMemo(() => (scene ? buildRoomHtml(scene) : ''), [scene]);
  const noMarkers = !!scene && scene.markers.length === 0;

  if (!result) {
    return (
      <View style={styles.root}>
        <SafeAreaView style={styles.center} edges={['top', 'bottom']}>
          <Text style={styles.msg}>No assessment yet — analyse a room first.</Text>
          <Pressable style={styles.btn} onPress={() => navigation.goBack()}>
            <Text style={styles.btnTxt}>Back</Text>
          </Pressable>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <WebView
        originWhitelist={['*']}
        source={{ html, baseUrl: 'https://localhost/' }}
        style={styles.web}
        javaScriptEnabled
        domStorageEnabled
        scrollEnabled={false}
        overScrollMode="never"
        allowsInlineMediaPlayback
        onLoadEnd={() => setLoading(false)}
        onError={() => {
          setLoading(false);
          setFailed(true);
        }}
        onMessage={(e) => {
          try {
            const data = JSON.parse(e.nativeEvent.data);
            if (data.type === 'ready') setLoading(false);
            if (data.type === 'error') setFailed(true);
          } catch {}
        }}
      />

      {/* Header overlay */}
      <SafeAreaView style={styles.headerWrap} edges={['top']} pointerEvents="box-none">
        <View style={styles.header} pointerEvents="box-none">
          <Pressable style={styles.pill} onPress={() => navigation.goBack()}>
            <Text style={styles.pillTxt}>‹ 2D map</Text>
          </Pressable>
          <View style={styles.pillGhost}>
            <Text style={styles.pillGhostTxt}>3D room · generated</Text>
          </View>
        </View>
      </SafeAreaView>

      {loading && !failed && (
        <View style={styles.loading} pointerEvents="none">
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={styles.loadingTitle}>Generating 3D model…</Text>
          <Text style={styles.loadingSub}>Building the room and placing hazards.</Text>
        </View>
      )}

      {failed && (
        <View style={styles.loading}>
          <Text style={styles.loadingTitle}>Couldn’t load the 3D view</Text>
          <Text style={styles.loadingSub}>It needs an internet connection. Go back and try again.</Text>
          <Pressable style={styles.btn} onPress={() => navigation.goBack()}>
            <Text style={styles.btnTxt}>Back to 2D map</Text>
          </Pressable>
        </View>
      )}

      {/* Empty state: no located hazards to place as objects in the room. */}
      {!loading && !failed && noMarkers && !hintDismissed && (
        <View style={styles.hintWrap} pointerEvents="box-none">
          <View style={styles.hintCard}>
            <Text style={styles.hintTitle}>No pinned hazards to show here yet</Text>
            <Text style={styles.hintBody}>
              This room has only whole-room findings (see the summary above). To fill the 3D room
              with objects, run the real AI on real photos of the room — or go back and tag objects
              on the map. Both put located hazards here.
            </Text>
            <Pressable style={styles.hintBtn} onPress={() => setHintDismissed(true)}>
              <Text style={styles.hintBtnTxt}>Got it</Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  web: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.lg, padding: spacing.xl },
  msg: { color: colors.textMuted, fontSize: font.body, textAlign: 'center' },
  headerWrap: { position: 'absolute', top: 0, left: 0, right: 0 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  pill: { backgroundColor: 'rgba(23,26,32,0.85)', borderWidth: 1, borderColor: colors.border, paddingHorizontal: 14, paddingVertical: 9, borderRadius: radius.pill },
  pillTxt: { color: colors.text, fontSize: font.body, fontWeight: '700' },
  pillGhost: { backgroundColor: 'rgba(23,26,32,0.6)', paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.pill },
  pillGhostTxt: { color: colors.textMuted, fontSize: font.tiny, fontWeight: '600' },
  loading: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.xl, backgroundColor: colors.bg },
  loadingTitle: { color: colors.text, fontSize: font.h3, fontWeight: '700', marginTop: spacing.sm },
  loadingSub: { color: colors.textMuted, fontSize: font.body, textAlign: 'center' },
  btn: { marginTop: spacing.md, backgroundColor: colors.accent, paddingHorizontal: 20, paddingVertical: 14, borderRadius: radius.md },
  btnTxt: { color: colors.accentText, fontSize: font.body, fontWeight: '700' },
  hintWrap: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: spacing.lg, alignItems: 'center' },
  hintCard: {
    backgroundColor: 'rgba(23,26,32,0.96)',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.lg,
    maxWidth: 460,
  },
  hintTitle: { color: colors.text, fontSize: font.h3, fontWeight: '700' },
  hintBody: { color: colors.textMuted, fontSize: font.small, lineHeight: 20, marginTop: 8 },
  hintBtn: { alignSelf: 'flex-start', marginTop: spacing.md, backgroundColor: colors.surfaceStrong, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 18, paddingVertical: 10, borderRadius: radius.md },
  hintBtnTxt: { color: colors.text, fontSize: font.body, fontWeight: '700' },
});
