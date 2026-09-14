// Bottom-sheet list used as a "dropdown" picker. With `searchable` it adds a
// search box (used for the ~170-breed Dog API list); options may show a photo.

import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Modal,
  FlatList,
  TextInput,
  Image,
  ImageSourcePropType,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CloseIcon } from './icons';
import { colors, fonts } from '../theme';

export interface SheetOption<T extends string> {
  value: T;
  label: string;
  hint?: string;
  image?: ImageSourcePropType;
}

export function OptionSheet<T extends string>({
  visible,
  title,
  options,
  value,
  onSelect,
  onClose,
  searchable,
  searchPlaceholder = 'Search',
  footer,
}: {
  visible: boolean;
  title: string;
  options: SheetOption<T>[];
  value?: T | null;
  onSelect: (v: T) => void;
  onClose: () => void;
  searchable?: boolean;
  searchPlaceholder?: string;
  footer?: (query: string) => React.ReactNode; // e.g. "Add “…”" when nothing matches
}) {
  const [query, setQuery] = useState('');
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options;
  }, [options, query]);

  const close = () => {
    setQuery('');
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={styles.backdrop} onPress={close} />
        <SafeAreaView edges={['bottom']} style={[styles.sheet, searchable && { height: '75%' }]}>
          <View style={styles.head}>
            <Text style={styles.title}>{title}</Text>
            <Pressable onPress={close} hitSlop={12}>
              <CloseIcon size={12} />
            </Pressable>
          </View>
          {searchable && (
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder={searchPlaceholder}
              placeholderTextColor={colors.textFaint}
              style={styles.search}
              autoCorrect={false}
              clearButtonMode="while-editing"
            />
          )}
          <FlatList
            data={matches}
            keyExtractor={(o) => o.value}
            keyboardShouldPersistTaps="handled"
            style={searchable ? { flex: 1 } : { maxHeight: 380 }}
            initialNumToRender={20}
            renderItem={({ item: o }) => (
              <Pressable
                onPress={() => {
                  onSelect(o.value);
                  close();
                }}
                style={[styles.option, o.value === value && styles.optionOn]}
              >
                {!!o.image && <Image source={o.image} style={styles.thumb} resizeMode="cover" />}
                <View style={{ flex: 1 }}>
                  <Text style={styles.optionTxt}>{o.label}</Text>
                  {!!o.hint && <Text style={styles.hint} numberOfLines={1}>{o.hint}</Text>}
                </View>
              </Pressable>
            )}
            ListFooterComponent={footer ? <>{footer(query.trim())}</> : null}
          />
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: colors.bg, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 22 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  title: { fontFamily: fonts.bold, fontSize: 18, color: colors.text },
  search: { backgroundColor: colors.track, borderRadius: 12, height: 44, paddingHorizontal: 14, fontFamily: fonts.regular, fontSize: 15, color: colors.text, marginBottom: 8 },
  option: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 10, borderRadius: 10 },
  optionOn: { backgroundColor: colors.orangeLight },
  thumb: { width: 40, height: 40, borderRadius: 8, backgroundColor: colors.track },
  optionTxt: { fontFamily: fonts.regular, fontSize: 15, color: colors.text },
  hint: { fontFamily: fonts.regular, fontSize: 11.5, color: colors.textMuted, marginTop: 2 },
});
