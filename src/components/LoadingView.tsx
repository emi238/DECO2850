// "Un-fur-ling details..." — the processing state while a space is analysed
// (spec Stage 3). The cartoon dog walks along a filling progress bar.

import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PawTile } from './kit';
import { colors, fonts } from '../theme';
import { IMAGES } from '../assets';

const BAR_W = 280;
const DOG_W = 140;

export function LoadingView({ done, label = 'Un-fur-ling details...' }: { done?: boolean; label?: string }) {
  const progress = useRef(new Animated.Value(0.05)).current;

  useEffect(() => {
    // Ease towards ~85% while waiting; jump to full once the work is done.
    Animated.timing(progress, {
      toValue: done ? 1 : 0.85,
      duration: done ? 300 : 2600,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [done, progress]);

  const fillW = progress.interpolate({ inputRange: [0, 1], outputRange: [0, BAR_W] });
  const dogX = progress.interpolate({ inputRange: [0, 1], outputRange: [-DOG_W / 2, BAR_W - DOG_W * 0.8] });

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.top}>
        <PawTile />
      </SafeAreaView>
      <View style={styles.center}>
        <View style={{ width: BAR_W }}>
          <Animated.Image
            source={IMAGES.loadingDog}
            style={[styles.dog, { transform: [{ translateX: dogX }] }]}
            resizeMode="contain"
          />
          <View style={styles.track}>
            <Animated.View style={[styles.fill, { width: fillW }]} />
          </View>
        </View>
        <Text style={styles.label}>{label}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  top: { paddingHorizontal: 25, paddingTop: 8 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', marginTop: -60 },
  dog: { width: DOG_W, height: DOG_W * (222 / 310), marginBottom: -4 },
  track: { height: 10, borderRadius: 5, backgroundColor: colors.track, overflow: 'hidden' },
  fill: { height: 10, borderRadius: 5, backgroundColor: colors.orangeDeep },
  label: { fontFamily: fonts.regular, fontSize: 18, color: colors.text, marginTop: 18 },
});
