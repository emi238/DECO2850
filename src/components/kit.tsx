// Shared UI kit for the redesign — sizes and colours copied from the Figma frames
// (393pt wide, light + orange, Goga type).

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  Image,
  StyleProp,
  ViewStyle,
  TextStyle,
  TextInputProps,
  ActivityIndicator,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { colors, fonts } from '../theme';
import { IMAGES } from '../assets';
import { PersonIcon, BackArrowIcon, CloseIcon } from './icons';

const tap = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

export function PrimaryButton({
  label,
  onPress,
  disabled,
  loading,
  style,
  textStyle,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}) {
  return (
    <Pressable
      onPress={() => {
        if (disabled || loading) return;
        tap();
        onPress();
      }}
      disabled={disabled || loading}
      style={({ pressed }) => [styles.primary, (disabled || loading) && { opacity: 0.5 }, pressed && { opacity: 0.85 }, style]}
    >
      {loading ? <ActivityIndicator color={colors.text} /> : <Text style={[styles.primaryTxt, textStyle]}>{label}</Text>}
    </Pressable>
  );
}

// Two buttons fused into one pill: a neutral left half and an orange right half.
export function JoinedButtons({
  left,
  right,
  leftBg = colors.bg,
  rightBg = colors.orange,
  height = 48,
  style,
}: {
  left: { label: string; onPress: () => void };
  right: { label: string; onPress: () => void; disabled?: boolean };
  leftBg?: string;
  rightBg?: string;
  height?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const r = Math.min(height / 2, 12);
  return (
    <View style={[styles.joined, { height, borderRadius: r, backgroundColor: leftBg }, style]}>
      <Pressable onPress={() => { tap(); left.onPress(); }} style={({ pressed }) => [styles.joinedHalf, pressed && { opacity: 0.6 }]}>
        <Text style={styles.joinedTxt} numberOfLines={1} adjustsFontSizeToFit>{left.label}</Text>
      </Pressable>
      <Pressable
        onPress={() => { if (!right.disabled) { tap(); right.onPress(); } }}
        style={({ pressed }) => [styles.joinedHalf, styles.joinedRight, { backgroundColor: rightBg, borderRadius: r }, (pressed || right.disabled) && { opacity: right.disabled ? 0.5 : 0.85 }]}
      >
        <Text style={styles.joinedTxt} numberOfLines={1} adjustsFontSizeToFit>{right.label}</Text>
      </Pressable>
    </View>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  disabled,
  height = 25,
  style,
  textStyle,
  activeColor = colors.orangeLight,
}: {
  options: { value: T; label: string }[];
  value: T | null;
  onChange: (v: T) => void;
  disabled?: boolean;
  height?: number;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  activeColor?: string;
}) {
  return (
    <View style={[styles.segWrap, { minHeight: height }, style]}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            disabled={disabled}
            onPress={() => { tap(); onChange(o.value); }}
            style={[styles.seg, on && { backgroundColor: activeColor }]}
          >
            <Text style={[styles.segTxt, textStyle]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Chip({
  label,
  selected,
  onPress,
  disabled,
  style,
  textStyle,
}: {
  label: string;
  selected?: boolean;
  onPress: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}) {
  return (
    <Pressable disabled={disabled} onPress={() => { tap(); onPress(); }} style={[styles.chip, selected && styles.chipOn, style]}>
      <Text style={[styles.chipTxt, textStyle]}>{label}</Text>
    </Pressable>
  );
}

export function SectionLabel({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[styles.sectionLabel, style]}>{children}</Text>;
}

export function Field({
  label,
  variant = 'gray',
  style,
  inputStyle,
  ...props
}: {
  label?: string;
  variant?: 'gray' | 'white' | 'peach';
  style?: StyleProp<ViewStyle>;
  inputStyle?: StyleProp<TextStyle>;
} & Omit<TextInputProps, 'style'>) {
  return (
    <View style={style}>
      {!!label && <Text style={styles.fieldLabel}>{label}</Text>}
      <TextInput
        placeholderTextColor={colors.textFaint}
        style={[
          styles.field,
          variant === 'white' && styles.fieldWhite,
          variant === 'peach' && styles.fieldPeach,
          props.editable === false && { color: colors.textMuted },
          inputStyle,
        ]}
        {...props}
      />
    </View>
  );
}

// The app mark used on the grey screens: dark-orange paw over an orange tile.
export function PawTile({ size = 40 }: { size?: number }) {
  const tile = size * 0.78;
  return (
    <View style={{ width: size, height: size }}>
      <View
        style={{
          position: 'absolute',
          right: 0,
          bottom: 0,
          width: tile,
          height: tile,
          borderRadius: size * 0.14,
          backgroundColor: colors.orange,
        }}
      />
      <Image
        source={IMAGES.paw}
        style={{ position: 'absolute', left: 0, top: 0, width: size * 0.9, height: size * 0.9, tintColor: colors.orangeDeep }}
        resizeMode="contain"
      />
    </View>
  );
}

// Round profile button. `ring` = white with an orange outline (grey screens).
export function AvatarButton({ onPress, ring, size = 40 }: { onPress?: () => void; ring?: boolean; size?: number }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      hitSlop={6}
      style={[
        styles.avatar,
        { width: size, height: size, borderRadius: size / 2 },
        ring && { borderWidth: 2, borderColor: colors.orange },
      ]}
    >
      <PersonIcon size={size * 0.55} />
    </Pressable>
  );
}

// Top of the grey screens: paw tile on the left (with a thin back arrow under
// it), and an optional right-hand element (close ×, avatar, breed pill…).
export function TopBar({
  onBack,
  onClose,
  right,
  style,
}: {
  onBack?: () => void;
  onClose?: () => void;
  right?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.topBar, style]}>
      <View>
        <PawTile />
        {onBack ? (
          <Pressable onPress={onBack} hitSlop={12} style={styles.backBtn}>
            <BackArrowIcon />
          </Pressable>
        ) : (
          <View style={styles.backBtn} />
        )}
      </View>
      {right}
      {onClose && (
        <Pressable onPress={onClose} hitSlop={14} style={styles.closeBtn}>
          <CloseIcon size={13} />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  primary: {
    backgroundColor: colors.orange,
    borderRadius: 12,
    height: 48, // every action button in the app is 48pt (DESIGN.md)
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  primaryTxt: { fontFamily: fonts.semibold, color: colors.text, fontSize: 15 },

  joined: { flexDirection: 'row', overflow: 'hidden' },
  joinedHalf: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  joinedRight: { flex: 1.15 },
  joinedTxt: { fontFamily: fonts.semibold, color: colors.text, fontSize: 15 },

  segWrap: { flexDirection: 'row', backgroundColor: colors.track, borderRadius: 8 },
  seg: { flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 3 },
  segTxt: { fontFamily: fonts.regular, color: colors.text, fontSize: 10, textAlign: 'center', lineHeight: 14 },

  chip: { backgroundColor: colors.track, borderRadius: 10, height: 20, minWidth: 78, paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center' },
  chipOn: { backgroundColor: colors.orangeLight },
  chipTxt: { fontFamily: fonts.regular, color: colors.text, fontSize: 10 },

  sectionLabel: { fontFamily: fonts.semibold, color: colors.text, fontSize: 13, marginBottom: 7 },
  fieldLabel: { fontFamily: fonts.semibold, color: colors.text, fontSize: 13, marginBottom: 6 },
  field: {
    backgroundColor: colors.field,
    borderRadius: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.06)',
    height: 31,
    paddingHorizontal: 10,
    fontFamily: fonts.regular,
    color: colors.text,
    fontSize: 13,
  },
  fieldWhite: { backgroundColor: colors.bg, borderRadius: 12, height: 40, borderWidth: 0 },
  fieldPeach: { backgroundColor: colors.orangeLight, height: 38, borderWidth: 0 },

  avatar: { backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },

  topBar: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  backBtn: { marginTop: 8, height: 12, width: 24, justifyContent: 'center' },
  closeBtn: { marginTop: 22, marginRight: 4 },
});
