import React, { ReactNode } from 'react';
import {
  View, StyleSheet, ViewStyle, StyleProp, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

/**
 * VYBGlowCard — colorful inner-glow glass card.
 *
 * React Native doesn't ship CSS `inset` shadows, so we layer 4 LinearGradients
 * over a translucent dark base to approximate the inner-glow + luminous-edge
 * look. All gradients run with `pointerEvents="none"` so children stay fully
 * interactive.
 *
 * Variants are tuned to the VYB palette — sand/sage/blue/coral/violet/neutral.
 * Coral is reserved for warm callouts (reading), violet for ideas.
 */

type GlowVariant = 'gold' | 'sage' | 'blue' | 'coral' | 'violet' | 'neutral';

type VYBGlowCardProps = {
  children: ReactNode;
  variant?: GlowVariant;
  intensity?: 'soft' | 'medium';
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
};

const VARIANTS = {
  gold:    { border: 'rgba(160,138,86,0.24)',  edge: 'rgba(160,138,86,0.42)',  glowA: 'rgba(160,138,86,0.18)',  glowB: 'rgba(90,58,24,0.16)' },
  sage:    { border: 'rgba(94,117,88,0.24)',   edge: 'rgba(94,117,88,0.42)',   glowA: 'rgba(94,117,88,0.18)',   glowB: 'rgba(40,76,65,0.16)' },
  blue:    { border: 'rgba(72,150,205,0.24)',  edge: 'rgba(72,150,205,0.48)',  glowA: 'rgba(35,110,180,0.22)',  glowB: 'rgba(12,45,90,0.18)' },
  coral:   { border: 'rgba(210,112,80,0.22)',  edge: 'rgba(210,112,80,0.42)',  glowA: 'rgba(180,72,48,0.18)',   glowB: 'rgba(110,48,38,0.14)' },
  violet:  { border: 'rgba(135,120,220,0.22)', edge: 'rgba(135,120,220,0.42)', glowA: 'rgba(92,85,200,0.18)',   glowB: 'rgba(45,40,110,0.16)' },
  neutral: { border: 'rgba(255,255,255,0.08)', edge: 'rgba(244,240,232,0.18)', glowA: 'rgba(244,240,232,0.06)', glowB: 'rgba(160,138,86,0.08)' },
};

// Boost a rgba alpha by multiplying it. The regex just rewrites the last
// number of the rgba string with the new alpha.
function withOpacity(rgba: string, opacity: number) {
  return rgba.replace(/rgba\(([^)]+),\s*[\d.]+\)/, `rgba($1, ${opacity})`);
}

export function VYBGlowCard({
  children, variant = 'neutral', intensity = 'soft', style, contentStyle,
}: VYBGlowCardProps) {
  const v = VARIANTS[variant];
  const boost = intensity === 'medium' ? 1 : 0.72;

  return (
    <View style={[styles.shadowWrap, style]}>
      <View style={[styles.card, { borderColor: v.border }]}>
        {/* 1. Dark glass base — slight white→dark diagonal */}
        <LinearGradient
          pointerEvents="none"
          colors={['rgba(255,255,255,0.065)', 'rgba(255,255,255,0.025)', 'rgba(0,0,0,0.18)']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />

        {/* 2. Large soft color glow from top-left */}
        <LinearGradient
          pointerEvents="none"
          colors={[withOpacity(v.glowA, 0.24 * boost), withOpacity(v.glowA, 0.10 * boost), 'rgba(0,0,0,0)']}
          start={{ x: 0, y: 0 }} end={{ x: 0.85, y: 0.85 }}
          style={styles.topGlow}
        />

        {/* 3. Inner bottom glow → fakes the inner shadow we'd get on web */}
        <LinearGradient
          pointerEvents="none"
          colors={['rgba(0,0,0,0)', withOpacity(v.glowB, 0.20 * boost), withOpacity(v.edge, 0.32 * boost)]}
          start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
          style={styles.bottomGlow}
        />

        {/* 4. Edge luminous wash diagonal — the bit of light along the rim */}
        <LinearGradient
          pointerEvents="none"
          colors={[withOpacity(v.edge, 0.22 * boost), 'rgba(255,255,255,0.025)', 'rgba(0,0,0,0)']}
          start={{ x: 0, y: 0.1 }} end={{ x: 1, y: 0.9 }}
          style={styles.edgeWash}
        />

        {/* 5. Subtle dark center scrim — keeps text readable on top of color */}
        <LinearGradient
          pointerEvents="none"
          colors={['rgba(13,12,11,0.04)', 'rgba(13,12,11,0.48)', 'rgba(13,12,11,0.08)']}
          start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFill}
        />

        <View style={[styles.content, contentStyle]}>{children}</View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shadowWrap: {
    borderRadius: 22,
    ...Platform.select({
      ios:     { shadowColor: '#000', shadowOpacity: 0.32, shadowRadius: 26, shadowOffset: { width: 0, height: 16 } },
      android: { elevation: 8 },
    }),
  },
  card: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 22,
    borderWidth: 1,
    backgroundColor: 'rgba(13,12,11,0.62)',
  },
  topGlow:    { position: 'absolute', top: -70, left: -60, width: 240, height: 220 },
  bottomGlow: { position: 'absolute', left: -12, right: -12, bottom: -18, height: 145 },
  edgeWash:   { position: 'absolute', top: -20, left: -20, width: '115%' as any, height: '115%' as any, opacity: 0.72 },
  content:    { position: 'relative', zIndex: 2 },
});

export default VYBGlowCard;
