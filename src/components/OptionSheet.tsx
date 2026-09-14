// Bottom-sheet list used as a "dropdown" picker.

import React from 'react';
import { View, Text, StyleSheet, Pressable, Modal, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CloseIcon } from './icons';
import { colors, fonts } from '../theme';

export function OptionSheet<T extends string>({
  visible,
  title,
  options,
  value,
  onSelect,
  onClose,
}: {
  visible: boolean;
  title: string;
  options: { value: T; label: string; hint?: string }[];
  value?: T | null;
  onSelect: (v: T) => void;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <SafeAreaView edges={['bottom']} style={styles.sheet}>
        <View style={styles.head}>
          <Text style={styles.title}>{title}</Text>
          <Pressable onPress={onClose} hitSlop={12}>
            <CloseIcon size={12} />
          </Pressable>
        </View>
        <ScrollView style={{ maxHeight: 380 }}>
          {options.map((o) => (
            <Pressable
              key={o.value}
              onPress={() => {
                onSelect(o.value);
                onClose();
              }}
              style={[styles.option, o.value === value && styles.optionOn]}
            >
              <Text style={styles.optionTxt}>{o.label}</Text>
              {!!o.hint && <Text style={styles.hint}>{o.hint}</Text>}
            </Pressable>
          ))}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: colors.bg, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 22 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  title: { fontFamily: fonts.bold, fontSize: 18, color: colors.text },
  option: { paddingVertical: 12, paddingHorizontal: 10, borderRadius: 10 },
  optionOn: { backgroundColor: colors.orangeLight },
  optionTxt: { fontFamily: fonts.regular, fontSize: 14, color: colors.text },
  hint: { fontFamily: fonts.regular, fontSize: 11, color: colors.textMuted, marginTop: 2 },
});
