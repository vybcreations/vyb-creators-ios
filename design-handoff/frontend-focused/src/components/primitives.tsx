import React from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator, ViewStyle, TextStyle } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { colors as C, gradients as G, fonts as F, radius as R, shadow as S, space as SP } from '../theme';

// ─── Card ──────────────────────────────────────────────────
export function Card({ children, padding = 20, style }: { children: React.ReactNode; padding?: number; style?: ViewStyle }) {
  return (
    <View style={[{
      backgroundColor: C.bgElevated, borderColor: C.borderSubtle, borderWidth: 1,
      borderRadius: 24, padding, ...S.md,
    }, style]}>{children}</View>
  );
}

// ─── HeroCard (gradient) ───────────────────────────────────
export function HeroCard({
  children, gradient = G.gold, padding = 22, style,
}: { children: React.ReactNode; gradient?: readonly string[]; padding?: number; style?: ViewStyle }) {
  return (
    <View style={[{ borderRadius: 32, overflow: 'hidden', ...S.xl }, style]}>
      <LinearGradient colors={gradient as any} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={{ padding }}>
        {children}
      </LinearGradient>
    </View>
  );
}

// ─── SectionLabel ──────────────────────────────────────────
export function SectionLabel({ children, color = C.textMuted, style }: { children: React.ReactNode; color?: string; style?: TextStyle }) {
  return (
    <Text style={[{
      fontFamily: F.sansBold, fontSize: 10, letterSpacing: 2,
      color, textTransform: 'uppercase',
    }, style]}>{children}</Text>
  );
}

// ─── Pill ──────────────────────────────────────────────────
type PillColor = 'neutral' | 'gold' | 'forest' | 'midnight' | 'amber' | 'clay';
const pillTints: Record<PillColor, { bg: string; border: string; text: string }> = {
  neutral:  { bg: C.bgGlassSolid, border: C.borderMid, text: C.textSecondary },
  gold:     { bg: 'rgba(201,169,97,0.14)', border: 'rgba(201,169,97,0.42)', text: C.textPrimary },
  forest:   { bg: 'rgba(74,107,82,0.18)', border: 'rgba(74,107,82,0.55)', text: C.textPrimary },
  midnight: { bg: 'rgba(44,62,92,0.22)', border: 'rgba(79,106,142,0.55)', text: C.textPrimary },
  amber:    { bg: 'rgba(232,181,71,0.14)', border: 'rgba(232,181,71,0.45)', text: C.textPrimary },
  clay:     { bg: 'rgba(184,100,60,0.18)', border: 'rgba(184,100,60,0.55)', text: C.textPrimary },
};
export function Pill({
  children, selected = false, color = 'neutral', onPress, size = 'sm',
}: { children: React.ReactNode; selected?: boolean; color?: PillColor; onPress?: () => void; size?: 'sm' | 'md' | 'lg' }) {
  const t = selected ? pillTints[color] : pillTints.neutral;
  const h = size === 'lg' ? 34 : size === 'md' ? 30 : 26;
  const px = size === 'lg' ? 14 : 12;
  const fs = size === 'lg' ? 12 : 11;
  return (
    <Pressable onPress={onPress} style={{
      height: h, paddingHorizontal: px, borderRadius: R.pill,
      backgroundColor: t.bg, borderColor: t.border, borderWidth: 1,
      flexDirection: 'row', alignItems: 'center', gap: 6,
    }}>
      <Text style={{ fontFamily: F.sansBold, fontSize: fs, color: t.text, letterSpacing: 0.3 }}>
        {children}
      </Text>
    </Pressable>
  );
}

// ─── GoldButton ────────────────────────────────────────────
type ButtonVariant = 'complete' | 'progress' | 'primary' | 'secondary' | 'ghost';
export function GoldButton({
  children, onPress, variant = 'complete', size = 'md', style,
  icon, trailingIcon, loading, disabled,
}: {
  children?: React.ReactNode;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: 'sm' | 'md' | 'lg';
  style?: ViewStyle;
  icon?: React.ReactNode;
  trailingIcon?: React.ReactNode;
  loading?: boolean;
  disabled?: boolean;
}) {
  const sizes = { sm: { h: 32, px: 14, fs: 11 }, md: { h: 44, px: 18, fs: 13 }, lg: { h: 52, px: 24, fs: 14 } };
  const s = sizes[size];
  const variants: Record<ButtonVariant, { bg: string; color: string; border: string; shadow: any }> = {
    complete:  { bg: C.gold, color: C.bgBase, border: 'transparent', shadow: S.goldGlow },
    progress:  { bg: C.forestBright, color: C.bgBase, border: 'transparent', shadow: S.md },
    primary:   { bg: C.forest, color: C.textPrimary, border: 'transparent', shadow: S.md },
    secondary: { bg: 'transparent', color: C.textPrimary, border: C.borderStrong, shadow: {} as any },
    ghost:     { bg: 'transparent', color: C.textPrimary, border: C.borderMid, shadow: {} as any },
  };
  const v = variants[variant];
  const inactive = disabled || loading;
  return (
    <Pressable onPress={inactive ? undefined : onPress} disabled={inactive}
      style={({ pressed }) => [{
        height: s.h, paddingHorizontal: s.px, borderRadius: R.pill,
        backgroundColor: v.bg, borderColor: v.border, borderWidth: 1,
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
        opacity: inactive ? 0.55 : pressed ? 0.92 : 1,
        ...v.shadow,
      }, style]}>
      {loading ? (
        <ActivityIndicator color={v.color} />
      ) : (
        <>
          {icon}
          {typeof children === 'string' ? (
            <Text style={{ fontFamily: F.sansBold, fontSize: s.fs, color: v.color, letterSpacing: 0.3 }}>
              {children}
            </Text>
          ) : children}
          {trailingIcon}
        </>
      )}
    </Pressable>
  );
}

// ─── IconButton (wraps a Lucide icon) ──────────────────────
export function IconButton({
  children, size = 40, variant = 'default', onPress, style,
}: { children: React.ReactNode; size?: number; variant?: 'default' | 'accent' | 'ghost'; onPress?: () => void; style?: ViewStyle }) {
  const bg = variant === 'accent' ? C.goldFaint : variant === 'ghost' ? 'transparent' : C.bgElevated;
  return (
    <Pressable onPress={onPress} style={[{
      width: size, height: size, borderRadius: R.pill, backgroundColor: bg,
      borderColor: C.borderSubtle, borderWidth: variant === 'ghost' ? 0 : 1,
      alignItems: 'center', justifyContent: 'center',
    }, style]}>{children}</Pressable>
  );
}

// ─── Ring (progress) ───────────────────────────────────────
export function Ring({
  pct = 60, size = 96, stroke = 8, color, track = 'rgba(255,255,255,0.06)', children, style,
}: { pct?: number; size?: number; stroke?: number; color?: string; track?: string; children?: React.ReactNode; style?: ViewStyle }) {
  const complete = pct >= 100;
  const ringColor = color || (complete ? C.goldBright : C.forestBright);
  const r = size / 2 - stroke;
  const circ = 2 * Math.PI * r;
  return (
    <View style={[{ width: size, height: size }, style]}>
      <Svg width={size} height={size}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={stroke} fill="none" />
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={ringColor} strokeWidth={stroke} fill="none"
          strokeLinecap="round"
          strokeDasharray={`${(pct / 100) * circ} ${circ}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      </Svg>
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
        alignItems: 'center', justifyContent: 'center' }}>{children}</View>
    </View>
  );
}

// ─── Avatar ────────────────────────────────────────────────
type AvatarTone = 'neutral' | 'gold' | 'forest' | 'midnight';
const avatarTones: Record<AvatarTone, { bg: string; border: string; color: string }> = {
  neutral:  { bg: C.bgOverlay, border: C.borderMid, color: C.textPrimary },
  gold:     { bg: 'rgba(201,169,97,0.18)', border: 'rgba(201,169,97,0.55)', color: C.goldBright },
  forest:   { bg: 'rgba(74,107,82,0.18)', border: 'rgba(107,143,112,0.5)', color: C.forestBright },
  midnight: { bg: 'rgba(44,62,92,0.25)', border: 'rgba(79,106,142,0.5)', color: '#A8C0E0' },
};
export function Avatar({
  size = 36, label = 'A', tone = 'neutral', online = false, style,
}: { size?: number; label?: string; tone?: AvatarTone; online?: boolean; style?: ViewStyle }) {
  const t = avatarTones[tone];
  const dot = size * 0.28;
  return (
    <View style={[{ width: size, height: size }, style]}>
      <View style={{
        width: size, height: size, borderRadius: size / 2,
        backgroundColor: t.bg, borderColor: t.border, borderWidth: 1,
        alignItems: 'center', justifyContent: 'center',
      }}>
        <Text style={{ fontFamily: F.sansBold, fontSize: size * 0.42, color: t.color, letterSpacing: -0.5 }}>
          {label}
        </Text>
      </View>
      {online && (
        <View style={{
          position: 'absolute', bottom: 0, right: 0, width: dot, height: dot,
          borderRadius: dot / 2, backgroundColor: C.gold, borderColor: C.bgBase, borderWidth: 2,
        }} />
      )}
    </View>
  );
}

// ─── Check (checkbox) ──────────────────────────────────────
export function Check({ done = false, size = 22, onPress, style }: {
  done?: boolean; size?: number; onPress?: () => void; style?: ViewStyle;
}) {
  return (
    <Pressable onPress={onPress} style={[{
      width: size, height: size, borderRadius: 8,
      backgroundColor: done ? C.goldFaint : 'transparent',
      borderColor: done ? C.gold : C.borderMid, borderWidth: 1.5,
      alignItems: 'center', justifyContent: 'center',
    }, style]}>
      {done && <Text style={{ color: C.gold, fontSize: size * 0.55, fontFamily: F.sansBold, lineHeight: size * 0.65 }}>✓</Text>}
    </Pressable>
  );
}

// ─── BookCover (gradient placeholder) ──────────────────────
type CoverTone = keyof typeof G;
export function BookCover({
  width = 50, height = 70, tone = 'midnight', label, style,
}: { width?: number | string; height?: number; tone?: CoverTone; label?: string; style?: ViewStyle }) {
  return (
    <View style={[{ width: width as any, height, borderRadius: 6, overflow: 'hidden', ...S.md }, style]}>
      <LinearGradient colors={G[tone] as any} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={{ flex: 1, padding: 8, justifyContent: 'flex-end' }}>
        <View style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: 3, backgroundColor: 'rgba(0,0,0,0.25)' }} />
        {label && (
          <Text style={{ fontFamily: F.serifItalic, fontSize: 9, color: 'rgba(255,255,255,0.92)', lineHeight: 11 }}>
            {label}
          </Text>
        )}
      </LinearGradient>
    </View>
  );
}

// ─── Heatmap ───────────────────────────────────────────────
export function Heatmap({ cols = 26, rows = 5, seed = 1 }: { cols?: number; rows?: number; seed?: number }) {
  const cells: number[] = [];
  for (let i = 0; i < rows * cols; i++) {
    const x = Math.sin((seed + i) * 9301 + 49297);
    const v = x - Math.floor(x);
    cells.push(v > 0.78 ? 0.95 : v > 0.55 ? 0.6 : v > 0.32 ? 0.32 : v > 0.15 ? 0.14 : 0);
  }
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 3 }}>
      {cells.map((vl, i) => (
        <View key={i} style={{
          width: `${100 / cols - 0.5}%`, aspectRatio: 1, borderRadius: 3,
          backgroundColor: vl === 0 ? C.borderSubtle : `rgba(201,169,97,${vl})`,
        }} />
      ))}
    </View>
  );
}

// ─── Text helpers ──────────────────────────────────────────
export const Tx = {
  display: (s?: TextStyle) => ({ fontFamily: F.sansHeavy, fontSize: 36, color: C.textPrimary, letterSpacing: -0.7, ...s }),
  editorial: (s?: TextStyle) => ({ fontFamily: F.serifItalic, fontSize: 32, color: C.textPrimary, letterSpacing: -0.6, ...s }),
  h1: (s?: TextStyle) => ({ fontFamily: F.sansBold, fontSize: 22, color: C.textPrimary, letterSpacing: -0.3, ...s }),
  h2: (s?: TextStyle) => ({ fontFamily: F.sansBold, fontSize: 18, color: C.textPrimary, letterSpacing: -0.2, ...s }),
  body: (s?: TextStyle) => ({ fontFamily: F.sans, fontSize: 14, color: C.textSecondary, ...s }),
  small: (s?: TextStyle) => ({ fontFamily: F.sans, fontSize: 12, color: C.textMuted, ...s }),
  mono: (s?: TextStyle) => ({ fontFamily: F.mono, fontSize: 12, color: C.textSecondary, ...s }),
  label: (s?: TextStyle) => ({ fontFamily: F.sansBold, fontSize: 10, color: C.textMuted, letterSpacing: 2, textTransform: 'uppercase' as const, ...s }),
};
