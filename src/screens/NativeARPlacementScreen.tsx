import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ViroARPlaneSelector,
  ViroARScene,
  ViroARSceneNavigator,
  ViroBox,
  ViroMaterials,
  ViroText,
  isARSupportedOnDevice,
} from '@reactvision/react-viro';

import { colors, fonts } from '../theme';
import type { ScreenProps } from '../navigation';

ViroMaterials.createMaterials([
  {
    name: 'pawspaceMarker',
    diffuseColor: colors.orange,
  },
]);

function MarkerScene() {
  const selectorRef = useRef<any>(null);

  return (
    <ViroARScene
      anchorDetectionTypes={['PlanesHorizontal']}
      onAnchorFound={(anchor) => selectorRef.current?.handleAnchorFound(anchor)}
      onAnchorUpdated={(anchor) => selectorRef.current?.handleAnchorUpdated(anchor)}
      onAnchorRemoved={(anchor) => anchor && selectorRef.current?.handleAnchorRemoved(anchor)}
    >
      <ViroARPlaneSelector ref={selectorRef} alignment="Horizontal">
        <ViroBox
          position={[0, 0.07, 0]}
          scale={[0.14, 0.14, 0.14]}
          materials={['pawspaceMarker']}
        />
        <ViroText
          text="PawSpace marker"
          position={[0, 0.24, 0]}
          width={1.1}
          height={0.22}
          style={{ fontFamily: 'Arial', fontSize: 36, fontWeight: '700', color: '#FFFFFF' }}
          color="#FFFFFF"
          transformBehaviors={['billboard']}
        />
      </ViroARPlaneSelector>
    </ViroARScene>
  );
}

export default function NativeARPlacementScreen({ navigation }: ScreenProps<'ARPlacement'>) {
  const [sessionKey, setSessionKey] = useState(0);
  const [arSupported, setArSupported] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;
    isARSupportedOnDevice()
      .then((result) => {
        if (active) setArSupported(!!result?.isARSupported);
      })
      .catch(() => {
        if (active) setArSupported(false);
      });
    return () => {
      active = false;
    };
  }, []);

  if (arSupported === null) {
    return (
      <View style={styles.fallback}>
        <ActivityIndicator color={colors.orangeDeep} />
        <Text style={styles.fallbackTitle}>Checking AR support…</Text>
      </View>
    );
  }

  if (!arSupported) {
    return (
      <View style={styles.fallback}>
        <Text style={styles.fallbackTitle}>AR is unavailable on this device</Text>
        <Text style={styles.fallbackBody}>You can still use PawSpace’s camera capture and room map.</Text>
        <Pressable style={styles.fallbackButton} onPress={() => navigation.navigate('Capture', { fresh: true })}>
          <Text style={styles.fallbackButtonText}>Continue with camera capture</Text>
        </Pressable>
        <Pressable style={styles.backLink} onPress={() => navigation.goBack()}>
          <Text style={styles.fallbackBody}>Back to PawSpace</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <ViroARSceneNavigator
        key={sessionKey}
        autofocus
        initialScene={{ scene: MarkerScene }}
        style={StyleSheet.absoluteFill}
      />

      <SafeAreaView style={styles.overlay} pointerEvents="box-none">
        <View style={styles.header}>
          <Pressable accessibilityRole="button" onPress={() => navigation.goBack()} style={styles.smallButton}>
            <Text style={styles.smallButtonText}>‹  Back</Text>
          </Pressable>
          <Text style={styles.title}>AR placement</Text>
          <Pressable accessibilityRole="button" onPress={() => setSessionKey((key) => key + 1)} style={styles.smallButton}>
            <Text style={styles.smallButtonText}>Reset</Text>
          </Pressable>
        </View>

        <View style={styles.instructions}>
          <Text style={styles.instructionTitle}>Find a floor</Text>
          <Text style={styles.instructionBody}>
            Move your phone slowly across a well-lit floor. When a plane appears, tap it to place the marker.
          </Text>
        </View>

        <View style={styles.footer}>
          <Text style={styles.disclosure}>AR placement demo · no room scan or measurements are saved</Text>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#111111' },
  fallback: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', padding: 28 },
  fallbackTitle: { color: colors.text, fontFamily: fonts.semibold, fontSize: 20, textAlign: 'center', marginTop: 14 },
  fallbackBody: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 14, textAlign: 'center', lineHeight: 21, marginTop: 8 },
  fallbackButton: { backgroundColor: colors.orange, paddingHorizontal: 20, paddingVertical: 14, borderRadius: 12, marginTop: 24 },
  fallbackButtonText: { color: colors.text, fontFamily: fonts.semibold, fontSize: 14 },
  backLink: { padding: 12, marginTop: 6 },
  overlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'space-between' },
  header: {
    minHeight: 58,
    marginHorizontal: 16,
    marginTop: 8,
    paddingHorizontal: 10,
    borderRadius: 16,
    backgroundColor: 'rgba(22, 20, 18, 0.78)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: { color: '#FFFFFF', fontFamily: fonts.semibold, fontSize: 17 },
  smallButton: { paddingHorizontal: 10, paddingVertical: 10 },
  smallButtonText: { color: '#FFFFFF', fontFamily: fonts.medium, fontSize: 14 },
  instructions: {
    marginHorizontal: 20,
    marginTop: 'auto',
    marginBottom: 18,
    padding: 18,
    borderRadius: 16,
    backgroundColor: 'rgba(22, 20, 18, 0.82)',
  },
  instructionTitle: { color: colors.orangeLight, fontFamily: fonts.semibold, fontSize: 18 },
  instructionBody: { color: '#FFFFFF', fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, marginTop: 6 },
  footer: { alignItems: 'center', paddingHorizontal: 18, paddingBottom: 8 },
  disclosure: { color: 'rgba(255,255,255,0.82)', fontFamily: fonts.regular, fontSize: 11, textAlign: 'center' },
});
