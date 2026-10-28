// "Before we check your room": a one-time consent sheet shown before any photo or
// answer is sent to the AI (Google Gemini). Opting out keeps everything on the
// phone and uses the built-in example result. The choice can be changed in Profile.

import React from 'react';
import { View, Text, StyleSheet, Pressable, Modal, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PackIcon } from './icons';
import type { PackIconName } from './packIcons';
import { colors, fonts } from '../theme';
import { IMAGES } from '../assets';

const POINTS: { icon: PackIconName; text: string }[] = [
  { icon: 'camera-01', text: 'Your room photos and household answers are sent to Google’s Gemini AI to spot things a dog could get into.' },
  { icon: 'shield-tick', text: 'They’re used only to check this room. We don’t sell them or share them with anyone else.' },
  { icon: 'info-circle', text: 'Before you scan, put away anything personal: faces, mail, documents or screens.' },
  { icon: 'refresh-cw-01', text: 'You can change your mind any time in your Profile, or delete all your data there.' },
];

export function AiConsentSheet({ visible, onAllow, onDecline }: { visible: boolean; onAllow: () => void; onDecline: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onDecline}>
      <View style={styles.dim} />
      <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]}>
        <Image source={IMAGES.paw} style={styles.paw} resizeMode="contain" />
        <Text style={styles.title}>Before we check your room</Text>
        <Text style={styles.body}>PawSpace uses AI to look at your photos. Here’s what that means for your data.</Text>
        <View style={styles.card}>
          {POINTS.map((p) => (
            <View key={p.icon} style={styles.point}>
              <View style={styles.icon}>
                <PackIcon name={p.icon} size={18} />
              </View>
              <Text style={styles.pointTxt}>{p.text}</Text>
            </View>
          ))}
        </View>
        <Pressable style={styles.primary} onPress={onAllow}>
          <Text style={styles.btnTxt}>I agree, check my room</Text>
        </Pressable>
        <Pressable style={styles.secondary} onPress={onDecline}>
          <Text style={styles.btnTxt}>No thanks, don’t send my photos</Text>
        </Pressable>
        <Text style={styles.foot}>If you say no, you’ll see an example result instead, and nothing leaves your phone.</Text>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  dim: { flex: 1, backgroundColor: 'rgba(36,30,24,0.45)' },
  sheet: { backgroundColor: colors.cream, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 24, paddingTop: 24, gap: 12 },
  paw: { width: 36, height: 36, tintColor: colors.orangeDeep },
  title: { fontFamily: fonts.bold, fontSize: 20, lineHeight: 26, color: colors.text },
  body: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 21, color: colors.textMuted },
  card: { backgroundColor: '#fff', borderRadius: 18, borderWidth: 1, borderColor: 'rgba(36,30,24,0.10)', padding: 16, gap: 14 },
  point: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  icon: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.peach, alignItems: 'center', justifyContent: 'center' },
  pointTxt: { flex: 1, fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.text },
  primary: { height: 48, borderRadius: 12, backgroundColor: colors.orange, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  secondary: { height: 48, borderRadius: 12, backgroundColor: '#fff', borderWidth: 1, borderColor: 'rgba(36,30,24,0.18)', alignItems: 'center', justifyContent: 'center' },
  btnTxt: { fontFamily: fonts.semibold, fontSize: 15, color: colors.text },
  foot: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 17, color: colors.textFaint, textAlign: 'center' },
});
