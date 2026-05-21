import React, { ReactNode } from 'react';
import { View, Platform, StyleProp, ViewStyle, StyleSheet } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { colors as C, radius as R } from '../../theme';

/**
 * VYBGlassCard — frosted-glass surface, key v2 language for floating /
 * overlay / glass-stat / leaderboard / leaderboard-podium containers.
 *
 * iOS uses native BlurView; Android falls back to a layered translucent
 * surface that mimics the look without the platform's blur cost.
 *
 * Use this when a card needs to feel like it floats over an image or a
 * gradient backdrop (circle covers, challenge heroes, leaderboard tile).
 * For solid dashboard widgets, prefer VYBCard.
 */

type Tint = 'dark' | 'sand' | 'sage' | 'midnight';
type Intensity = 'soft' | 'medium' | 'strong';

const TINT_HSL: Record<Tint, string> = {
  dark:     '20,20,26',
  sand:     '201,169,97',
  sage:     '143,168,138',
  midnight: '93,163,201',
};

const INTENSITY: Record<Intensity, { blur: number; baseAlpha: number; edgeAlpha: number }> = {
  soft:   { blur: 18, baseAlpha: 0.32, edgeAlpha: 0.10 },
  medium: { blur: 26, baseAlpha: 0.42, edgeAlpha: 0.14 },
  strong: { blur: 36, baseAlpha: 0.55, edgeAlpha: 0.18 },
};

export function VYBGlassCard({
  children, tint = 'dark', intensity = 'medium',
  borderRadius, padding = 16, style, contentStyle,
  onPress,
}: {
  children: ReactNode;
  tint?: Tint;
  intensity?: Intensity;
  borderRadius?: number;
  padding?: number;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  onPress?: () => void;
}) {
  const v = INTENSITY[intensity];
  const rgb = TINT_HSL[tint];
  const radius = borderRadius ?? R.md;
  const baseColor = tint === 'dark'
    ? `rgba(${rgb},${v.baseAlpha})`
    : `rgba(13,12,11,${0.5 + v.baseAlpha * 0.2})`;
  const tintWash = tint === 'dark'
    ? 'rgba(0,0,0,0)'
    : `rgba(${rgb},${0.08 + v.edgeAlpha * 0.4})`;

  return (
    <View style={[{
      borderRadius: radius, overflow: 'hidden',
      borderColor: `rgba(${tint === 'dark' ? '255,255,255' : rgb},${v.edgeAlpha + 0.06})`,
      borderWidth: 1,
      shadowColor: '#000', shadowOpacity: 0.30, shadowRadius: 18, shadowOffset: { width: 0, height: 8 },
    }, style]}>
      {Platform.OS === 'ios' ? (
        <BlurView
          intensity={v.blur} tint="dark"
          style={StyleSheet.absoluteFill}
        />
      ) : (
        // Android: layered translucent fill (BlurView cost is too high on
        // many Android devices, and overdraw warnings are common).
        <View style={[StyleSheet.absoluteFill, { backgroundColor: baseColor }]} />
      )}
      {/* Dark scrim — keeps text readable over any backdrop */}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: baseColor }]} />
      {/* Tint wash — only when not 'dark' */}
      {tint !== 'dark' && (
        <LinearGradient pointerEvents="none"
          colors={[tintWash, 'rgba(0,0,0,0)']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      )}
      {/* Top inner highlight — light-from-above edge */}
      <LinearGradient pointerEvents="none"
        colors={[`rgba(255,255,255,${v.edgeAlpha + 0.04})`, 'rgba(255,255,255,0)']}
        start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
        style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 24 }}
      />
      <View style={[{ padding }, contentStyle]} onTouchEnd={onPress}>
        {children}
      </View>
    </View>
  );
}
