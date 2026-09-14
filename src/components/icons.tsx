// Small SVG icon set matching the Figma glyphs (Material-style shapes), drawn with
// react-native-svg so no extra icon package is needed.

import React from 'react';
import Svg, { Path, Rect, Circle } from 'react-native-svg';
import { colors } from '../theme';

type P = { size?: number; color?: string };

export function PersonIcon({ size = 24, color = colors.text }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path fill={color} d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
    </Svg>
  );
}

export function EditIcon({ size = 20, color = colors.text }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path fill={color} d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
    </Svg>
  );
}

// Standard upload glyph: an arrow rising out of an open tray.
export function UploadIcon({ size = 24, color = colors.text }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 15V4M7 9l5-5 5 5" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M4 14v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function HelpIcon({ size = 24, color = colors.text }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path fill={color} d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm2.07-7.75l-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H8c0-2.21 1.79-4 4-4s4 1.79 4 4c0 .88-.36 1.68-.93 2.25z" />
    </Svg>
  );
}

// Double door (the "spaces" button in the bottom nav).
export function DoorIcon({ size = 24, color = colors.text }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Rect x="4" y="3" width="16" height="18" rx="1" fill={color} />
      <Rect x="11.4" y="3" width="1.2" height="18" fill="#fff" />
      <Circle cx="9.6" cy="12" r="0.9" fill="#fff" />
      <Circle cx="14.4" cy="12" r="0.9" fill="#fff" />
    </Svg>
  );
}

// Thick broken ring (the "re-analyse" floating button).
export function RefreshRingIcon({ size = 30, color = '#fff' }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 30 30">
      <Path d="M15 4 A11 11 0 0 1 25.4 18.6" stroke={color} strokeWidth={5} fill="none" strokeLinecap="butt" />
      <Path d="M15 26 A11 11 0 0 1 4.6 11.4" stroke={color} strokeWidth={5} fill="none" strokeLinecap="butt" />
    </Svg>
  );
}

export function BackArrowIcon({ size = 18, color = colors.text }: P) {
  return (
    <Svg width={size} height={size * 0.5} viewBox="0 0 20 10">
      <Path d="M19 5H2M6 1L2 5l4 4" stroke={color} strokeWidth={1.8} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function CloseIcon({ size = 14, color = colors.text }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 14 14">
      <Path d="M2 2l10 10M12 2L2 12" stroke={color} strokeWidth={3} strokeLinecap="round" />
    </Svg>
  );
}

export function ChevronIcon({ size = 14, color = colors.text, dir = 'left', weight = 2 }: P & { dir?: 'left' | 'right'; weight?: number }) {
  const d = dir === 'left' ? 'M9 2L4 7l5 5' : 'M5 2l5 5-5 5';
  return (
    <Svg width={size} height={size} viewBox="0 0 14 14">
      <Path d={d} stroke={color} strokeWidth={weight} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function AlertIcon({ size = 22, color = colors.orange }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx="12" cy="12" r="11" fill={color} />
      <Rect x="10.6" y="5.5" width="2.8" height="8.5" rx="1.4" fill="#fff" />
      <Circle cx="12" cy="17.6" r="1.6" fill="#fff" />
    </Svg>
  );
}
