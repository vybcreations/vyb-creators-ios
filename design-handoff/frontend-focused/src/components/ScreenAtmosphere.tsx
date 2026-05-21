import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors as C } from '../theme';

/**
 * ScreenAtmosphere — ambient tinted light behind a screen's content.
 *
 * Earlier attempts used circular "blobs" but they read as visible discs.
 * Instead we use very large, very soft diagonal LinearGradients positioned
 * partially off-screen. The tint fades to transparent well before crossing
 * the visible area, so the user perceives atmospheric light from off-screen
 * rather than a shape.
 *
 * pointerEvents="none" so nothing here ever intercepts touches.
 */

type SweepTone = 'sand' | 'sage' | 'teal' | 'amber';

type Sweep = {
  tone: SweepTone;
  opacity?: number;          // peak opacity at the tinted corner, 0..1
  corner: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
};

const TONE: Record<SweepTone, string> = {
  sand:  C.glowSand,
  sage:  C.glowSage,
  teal:  C.glowTeal,
  amber: C.glowAmber,
};

// Default arrangement — subtle ambient lighting from two opposing corners,
// kept low enough to feel like air, not a graphic.
const DEFAULT_SWEEPS: Sweep[] = [
  { tone: 'sage', corner: 'top-right',    opacity: 0.10 },
  { tone: 'sand', corner: 'bottom-left',  opacity: 0.08 },
];

export function ScreenAtmosphere({ sweeps, style }: { sweeps?: Sweep[]; style?: ViewStyle }) {
  const list = sweeps ?? DEFAULT_SWEEPS;
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { overflow: 'hidden' }, style]}>
      {list.map((s, i) => <Sweep key={i} {...s} />)}
    </View>
  );
}

function Sweep({ tone, corner, opacity = 0.10 }: Sweep) {
  const color = TONE[tone];
  const rgbaTint = withAlpha(color, opacity);
  const rgbaZero = withAlpha(color, 0);

  // Each sweep is an oversized rectangle that hangs ~30% off-screen at the
  // tinted corner, fading diagonally to fully transparent at the opposite
  // corner. Because the gradient stops 0 → 0.55 → 1, the actual visible
  // tint only paints the outer third — the center of the screen stays clean.
  const sizeStyle = { width: '170%' as const, height: '90%' as const };
  let positionStyle: any = {};
  let start = { x: 0, y: 0 };
  let end   = { x: 1, y: 1 };
  switch (corner) {
    case 'top-right':
      positionStyle = { top: '-30%', right: '-40%' };
      start = { x: 1, y: 0 }; end = { x: 0, y: 1 };
      break;
    case 'top-left':
      positionStyle = { top: '-30%', left: '-40%' };
      start = { x: 0, y: 0 }; end = { x: 1, y: 1 };
      break;
    case 'bottom-right':
      positionStyle = { bottom: '-30%', right: '-40%' };
      start = { x: 1, y: 1 }; end = { x: 0, y: 0 };
      break;
    case 'bottom-left':
      positionStyle = { bottom: '-30%', left: '-40%' };
      start = { x: 0, y: 1 }; end = { x: 1, y: 0 };
      break;
  }

  return (
    <LinearGradient
      colors={[rgbaTint, rgbaZero]}
      locations={[0, 0.55]}
      start={start}
      end={end}
      style={[{ position: 'absolute' }, sizeStyle, positionStyle]}
    />
  );
}

function withAlpha(hex: string, a: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}
