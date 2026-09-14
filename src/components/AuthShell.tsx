// Shared layout for the account screens (Create Account, Log In, Reset Password):
// coloured header with the PawSpace wordmark + paw, a big dark-orange title, and
// a white rounded panel with the form and a footer link.

import React from 'react';
import { View, Text, StyleSheet, Image, ScrollView, KeyboardAvoidingView, Platform, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PawTile } from './kit';
import { colors, fonts } from '../theme';
import { IMAGES } from '../assets';

export function AuthShell({
  title,
  subtitle,
  headerColor = colors.orange,
  tile,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  headerColor?: string;
  tile?: boolean; // paw on an orange tile (Reset Password) instead of a bare paw
  children: React.ReactNode;
  footer?: { text: string; link: string; onPress: () => void };
}) {
  return (
    <View style={[styles.root, { backgroundColor: headerColor }]}>
      <SafeAreaView edges={['top']} style={styles.top}>
        <View style={styles.topRow}>
          <Text style={styles.word}>PawSpace</Text>
          {tile ? (
            <PawTile size={50} />
          ) : (
            <Image source={IMAGES.paw} style={styles.paw} resizeMode="contain" />
          )}
        </View>
        <Text style={styles.title}>{title}</Text>
        {!!subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      </SafeAreaView>

      <View style={styles.panel}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {children}
          </ScrollView>
          {footer && (
            <SafeAreaView edges={['bottom']} style={styles.footer}>
              <Pressable onPress={footer.onPress} hitSlop={10}>
                <Text style={styles.footerTxt}>
                  {footer.text} <Text style={styles.footerLink}>{footer.link}</Text>
                </Text>
              </Pressable>
            </SafeAreaView>
          )}
        </KeyboardAvoidingView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  top: { paddingHorizontal: 30, paddingBottom: 26 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  word: { fontFamily: fonts.display, fontSize: 25, color: colors.text },
  paw: { width: 46, height: 46, tintColor: colors.orangeDeep },
  title: { fontFamily: fonts.bold, fontSize: 29, color: colors.orangeDeep, textAlign: 'center', marginTop: 30 },
  subtitle: { fontFamily: fonts.regular, fontSize: 15, color: colors.text, textAlign: 'center', lineHeight: 21, marginTop: 12, paddingHorizontal: 20 },
  panel: { flex: 1, backgroundColor: colors.bg, borderTopLeftRadius: 30, borderTopRightRadius: 30 },
  body: { paddingHorizontal: 52, paddingTop: 36, paddingBottom: 24 },
  footer: { alignItems: 'center', paddingTop: 8, paddingBottom: 10 },
  footerTxt: { fontFamily: fonts.regular, fontSize: 14, color: '#8A8580' },
  footerLink: { fontFamily: fonts.semibold, color: colors.orangeDeep },
});

export const authStyles = StyleSheet.create({
  field: { marginBottom: 14 },
  submit: { height: 31, borderRadius: 10, marginTop: 14 },
  submitTxt: { fontFamily: fonts.semibold, color: colors.bg, fontSize: 15 },
  note: { fontFamily: fonts.regular, fontSize: 12, color: '#8A8580', textAlign: 'center', marginTop: 16 },
  avatar: { width: 58, height: 58, alignSelf: 'center', marginBottom: 30 },
});
