import React, { Suspense } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { isRunningInExpoGo } from 'expo';

import { colors, fonts } from '../theme';
import type { ScreenProps } from '../navigation';

const NativeARPlacementScreen = React.lazy(() => import('./NativeARPlacementScreen'));

export default function ARPlacementScreen(props: ScreenProps<'ARPlacement'>) {
  if (Platform.OS === 'web' || isRunningInExpoGo()) {
    return (
      <View style={styles.fallback}>
        <Text style={styles.title}>AR needs the development build</Text>
        <Text style={styles.body}>
          Install PawSpace’s Android development APK to try AR marker placement. The camera capture and room map remain available here.
        </Text>
        <Pressable
          style={styles.button}
          onPress={() => props.navigation.navigate('Capture', { fresh: true })}
        >
          <Text style={styles.buttonText}>Continue with camera capture</Text>
        </Pressable>
        <Pressable style={styles.backLink} onPress={() => props.navigation.goBack()}>
          <Text style={styles.body}>Back to PawSpace</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <Suspense
      fallback={
        <View style={styles.fallback}>
          <ActivityIndicator color={colors.orangeDeep} />
          <Text style={styles.title}>Opening AR…</Text>
        </View>
      }
    >
      <NativeARPlacementScreen {...props} />
    </Suspense>
  );
}

const styles = StyleSheet.create({
  fallback: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', padding: 28 },
  title: { color: colors.text, fontFamily: fonts.semibold, fontSize: 20, textAlign: 'center', marginTop: 14 },
  body: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 14, textAlign: 'center', lineHeight: 21, marginTop: 8 },
  button: { backgroundColor: colors.orange, paddingHorizontal: 20, paddingVertical: 14, borderRadius: 12, marginTop: 24 },
  buttonText: { color: colors.text, fontFamily: fonts.semibold, fontSize: 14 },
  backLink: { padding: 12, marginTop: 6 },
});
