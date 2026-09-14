// Design tokens for the PawSpace redesign (light + warm orange).
// Palette: #FBAB4B orange, #FFD2A3 light orange, #FFFFFF / #EFEFEF backgrounds.
// Type: Mojiw Mochizuki for the logo + welcome/hero headers; Goga for everything
// else (switching weights).

export const fonts = {
  display: 'MojiwMochizuki', // logo + big welcome headers
  regular: 'Goga-Regular',
  medium: 'Goga-Medium',
  semibold: 'Goga-Semibold',
  bold: 'Goga-Bold',
} as const;

export const colors = {
  // Brand
  orange: '#FBAB4B',
  orangeLight: '#FFD2A3',
  orangeDeep: '#BF3D05', // the dark paw / accents in the logo

  // Backgrounds
  bg: '#FFFFFF',
  bg2: '#EFEFEF',
  bgElevated: '#EFEFEF',
  surface: '#EFEFEF',
  surfaceStrong: '#FFD2A3',
  cream: '#FFF6EC',
  border: 'rgba(0,0,0,0.08)',

  // Text (near-black ink on light)
  text: '#241E18',
  textMuted: '#6E655C',
  textFaint: '#A69C92',

  // Primary action = orange with dark ink text (matches the mockups)
  accent: '#FBAB4B',
  accentText: '#3A2712',

  // Severity ramp (warm): good / adequate / poor
  sevLow: '#5FAe7f',
  sevMedium: '#FBAB4B',
  sevHigh: '#E4572E',
  good: '#5FAe7f',
  ok: '#FBAB4B',
  bad: '#E4572E',
} as const;

export type Severity = 'low' | 'medium' | 'high';

export function severityColor(sev: Severity): string {
  if (sev === 'high') return colors.sevHigh;
  if (sev === 'medium') return colors.sevMedium;
  return colors.sevLow;
}

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 10,
  md: 16,
  lg: 22,
  xl: 28,
  pill: 999,
} as const;

export const font = {
  h1: 34,
  h2: 24,
  h3: 18,
  body: 15,
  small: 13,
  tiny: 11,
} as const;
