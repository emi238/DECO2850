// Live AR scan entry point. The real camera + YOLO detector (LiveScanNative) uses
// native modules (react-native-vision-camera + react-native-fast-tflite) that only
// exist in a DEVELOPMENT BUILD — never in Expo Go and never in the Simulator.
//
// So in Expo Go we show a friendly "needs the dev build" screen and never touch
// the native modules; in a dev build we lazily require the real scanner. This lets
// the rest of the app keep running in Expo Go on the Simulator.

import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Constants from 'expo-constants';

import { TopBar, PrimaryButton } from '../components/kit';
import { colors, fonts } from '../theme';
import type { ScreenProps } from '../navigation';

// Expo Go reports 'storeClient'; a dev/standalone build reports 'standalone'/'bare'.
const IN_EXPO_GO = Constants.executionEnvironment === 'storeClient';

export default function LiveScanScreen(props: ScreenProps<'LiveScan'>) {
  if (!IN_EXPO_GO) {
    // Dev build: load the real camera + YOLO screen only here, so Expo Go never
    // evaluates the native modules.
    const Native = require('../live/LiveScanNative').default;
    return <Native {...props} />;
  }

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        <TopBar onBack={() => props.navigation.goBack()} style={styles.topBar} />
        <View style={styles.body}>
          <Text style={styles.emoji}>📷🐾</Text>
          <Text style={styles.h1}>Live AR scan</Text>
          <Text style={styles.p}>
            This walks you through the room with the camera, spots objects with an on-device AI (YOLO), and pops hazard
            labels over them in real time.
          </Text>
          <Text style={styles.p}>
            It needs the <Text style={styles.b}>development build</Text> of PawSpace on a real phone — the live camera and
            the detection model can’t run in Expo Go or the Simulator. See <Text style={styles.mono}>docs/BUILD_DEV_CLIENT.md</Text>.
          </Text>
          <PrimaryButton label="Back" onPress={() => props.navigation.goBack()} style={{ marginTop: 22, alignSelf: 'stretch' }} />
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg2 },
  topBar: { paddingHorizontal: 22, paddingTop: 6 },
  body: { flex: 1, paddingHorizontal: 28, justifyContent: 'center' },
  emoji: { fontSize: 44, textAlign: 'center', marginBottom: 14 },
  h1: { fontFamily: fonts.bold, color: colors.text, fontSize: 24, textAlign: 'center' },
  p: { fontFamily: fonts.regular, color: colors.text, fontSize: 15, lineHeight: 22, textAlign: 'center', marginTop: 12 },
  b: { fontFamily: fonts.semibold },
  mono: { fontFamily: fonts.medium, color: colors.orangeDeep },
});
