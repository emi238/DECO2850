// PawSpace wordmark: paw glyph + "PawSpace" in Mojiw Mochizuki.

import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { colors, fonts } from '../theme';
import { IMAGES } from '../assets';

export function Logo({
  color = colors.orangeDeep,
  size = 22,
}: {
  color?: string;
  size?: number;
}) {
  return (
    <View style={styles.row}>
      <Image
        source={IMAGES.paw}
        style={{ width: size * 1.15, height: size * 1.15, tintColor: color }}
        resizeMode="contain"
      />
      <Text style={[styles.word, { color, fontSize: size }]}>PawSpace</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  word: { fontFamily: fonts.display, includeFontPadding: false },
});
