// The 3D room, rendered inline (three.js in a WebView). Given a space's result +
// frame count it builds the generated room; shows a loading state, an error state
// if three.js can't load, and a hint when the room has no located hazards.

import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';

import { colors, spacing, font, radius } from '../theme';
import { buildScene } from '../three/scene';
import { buildRoomHtml } from '../three/roomHtml';
import type { Assessment } from '../types';

export function Room3DView({ result, frameCount }: { result: Assessment; frameCount: number }) {
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [hintDismissed, setHintDismissed] = useState(false);

  const scene = useMemo(() => buildScene(result, frameCount), [result, frameCount]);
  const html = useMemo(() => buildRoomHtml(scene), [scene]);
  const noMarkers = scene.markers.length === 0;

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

      {loading && !failed && (
        <View style={styles.overlay} pointerEvents="none">
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={styles.overlayTitle}>Generating 3D model…</Text>
        </View>
      )}

      {failed && (
        <View style={styles.overlay}>
          <Text style={styles.overlayTitle}>Couldn’t load the 3D view</Text>
          <Text style={styles.overlaySub}>It needs an internet connection. Switch to the 2D map, or try again.</Text>
        </View>
      )}

      {!loading && !failed && noMarkers && !hintDismissed && (
        <View style={styles.hintWrap} pointerEvents="box-none">
          <View style={styles.hintCard}>
            <Text style={styles.hintTitle}>No pinned hazards to show here yet</Text>
            <Text style={styles.hintBody}>
              This space has only whole-room findings. To fill the 3D room with objects, run the real
              AI on real photos — or tag objects on the 2D map. Both put located hazards here.
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
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.xl, backgroundColor: colors.bg },
  overlayTitle: { color: colors.text, fontSize: font.h3, fontWeight: '700', marginTop: spacing.sm },
  overlaySub: { color: colors.textMuted, fontSize: font.body, textAlign: 'center' },
  hintWrap: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: spacing.lg, alignItems: 'center' },
  hintCard: { backgroundColor: 'rgba(23,26,32,0.96)', borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.lg, maxWidth: 460 },
  hintTitle: { color: colors.text, fontSize: font.h3, fontWeight: '700' },
  hintBody: { color: colors.textMuted, fontSize: font.small, lineHeight: 20, marginTop: 8 },
  hintBtn: { alignSelf: 'flex-start', marginTop: spacing.md, backgroundColor: colors.surfaceStrong, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 18, paddingVertical: 10, borderRadius: radius.md },
  hintBtnTxt: { color: colors.text, fontSize: font.body, fontWeight: '700' },
});
