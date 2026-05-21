import React from 'react';
import { ViewStyle, StyleProp } from 'react-native';
import { BlurView } from 'expo-blur';
import { colors as C } from '../theme';

/**
 * GlassCard — reusable dark glass surface, modeled after the bottom nav.
 *
 * Bottom-nav formula:
 *   BlurView intensity=50 + tint="dark"
 *   borderColor: borderMid, borderWidth: 1
 *   rounded
 *
 * Cards that wrap meaningful sections (priority groups, completed drawer,
 * Reading Now hero, etc.) should use this so the whole app feels coherent.
 *
 * Notes:
 * - BlurView is a real native blur (UIVisualEffectView on iOS). It costs a
 *   bit per layer — use it for *outer* cards, not individual task rows.
 * - `intensity` is a touch lower than the nav so cards don't compete with it.
 */
export function GlassCard({
  children, style, intensity = 40, radius = 20,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  intensity?: number;
  radius?: number;
}) {
  return (
    <BlurView intensity={intensity} tint="dark" style={[{
      borderRadius: radius, overflow: 'hidden',
      borderColor: C.borderMid, borderWidth: 1,
    }, style]}>
      {children}
    </BlurView>
  );
}
