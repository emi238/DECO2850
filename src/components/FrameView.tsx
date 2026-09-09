// Renders a single captured frame at a given size: the bundled demo room is
// drawn as SVG, a real capture is shown as an image.

import React from 'react';
import { Image, View, StyleSheet } from 'react-native';
import { DemoFrame, isDemoUri, demoIndex } from '../demo/room';
import type { Frame } from '../types';
import { colors } from '../theme';

export function FrameView({
  frame,
  width,
  height,
  radius = 0,
}: {
  frame: Frame;
  width: number;
  height: number;
  radius?: number;
}) {
  return (
    <View style={[styles.wrap, { width, height, borderRadius: radius }]}>
      {isDemoUri(frame.uri) ? (
        <DemoFrame index={demoIndex(frame.uri)} width={width} height={height} />
      ) : (
        <Image source={{ uri: frame.uri }} style={{ width, height }} resizeMode="cover" />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    overflow: 'hidden',
    backgroundColor: colors.bgElevated,
  },
});
