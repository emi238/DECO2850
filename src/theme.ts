// Central design tokens for PawSpace.
// Kept deliberately minimal (PRD §9): neutral surfaces, generous whitespace,
// ONE warm accent reserved for the primary action and the "high" severity ramp.

export const colors = {
  // Neutral base
  bg: '#0F1115', // deep charcoal behind the frosted glass
  bgElevated: '#171A20',
  surface: 'rgba(255,255,255,0.08)', // glass fill
  surfaceStrong: 'rgba(255,255,255,0.14)',
  border: 'rgba(255,255,255,0.16)',

  text: '#F4F5F7',
  textMuted: '#AEB4BE',
  textFaint: '#7C828C',

  // Single warm accent — primary CTA + "high" severity (PRD §9)
  accent: '#E5643C',
  accentText: '#FFFFFF',

  // Severity ramp (low / medium / high) — a simple, intuitive traffic ramp
  sevLow: '#5FB07E',
  sevMedium: '#E6A93C',
  sevHigh: '#E5643C',

  // Verdict tints
  good: '#5FB07E',
  ok: '#E6A93C',
  bad: '#E5643C',
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
  pill: 999,
} as const;

export const font = {
  h1: 28,
  h2: 22,
  h3: 18,
  body: 15,
  small: 13,
  tiny: 11,
} as const;
