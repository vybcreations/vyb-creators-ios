import React, { useEffect, useRef, useState } from 'react';
import {
  Animated, Easing, Pressable, View, Text, AccessibilityInfo, ActivityIndicator,
  ViewStyle, TextStyle, StyleProp, LayoutChangeEvent,
} from 'react-native';
import Svg, { Defs, RadialGradient, Stop, Rect, Circle } from 'react-native-svg';
import { useIsFocused } from '@react-navigation/native';
import { colors as C, fonts as F } from '../theme';
import { hLight } from '../lib/haptics';

/**
 * VYBBorderBeamButton — premium CTA with a soft *traveling reflection*
 * along the pill edge.
 *
 * Mental model: this is NOT a line snaking around the border. It is a
 * small, soft, blurred glow that drifts along the perimeter — clipped by
 * the button so only the half that overlaps the inside is visible,
 * producing the "light reflecting off the rim" look.
 *
 * Implementation:
 *   1. Pre-compute N=48 sample points along the pill perimeter.
 *   2. Drive a single Animated.Value with a slow linear loop.
 *   3. Interpolate the value into `cx` and `cy` for three stacked
 *      <Circle>s with radial-gradient fills (outer faint halo, mid glow,
 *      bright core). The circles are animated SVG elements — no
 *      strokeDasharray, no rotation, no chasing line.
 *   4. A static rounded-rect stroke keeps a faint full border at all
 *      times (and is the reduced-motion fallback).
 *
 * Use only for premium primary CTAs (Continue Reading, Upload Proof, …).
 */

// Global kill-switch for the animated beam effect. While we evaluate the
// premium feel and performance cost, the beam is disabled and the button
// falls back to its static dark glass surface + faint perimeter stroke.
// Flip this to `true` to re-enable the moving glow.
const ENABLE_BEAM_BUTTONS = false;

const BEAM_DURATION_MS = 5400;          // slow + calm

export type BeamVariant = 'reading' | 'proof' | 'primary' | 'subtle';
type Size = 'sm' | 'md' | 'lg';

const SIZES: Record<Size, { h: number; padH: number; fs: number }> = {
  sm: { h: 36, padH: 16, fs: 12 },
  md: { h: 44, padH: 22, fs: 13 },
  lg: { h: 52, padH: 28, fs: 14 },
};

type VariantPalette = {
  core: string;          // bright centre (high alpha)
  mid:  string;          // mid glow (medium alpha)
  halo: string;          // faint outer halo
  staticEdge: string;    // full-time border stroke
};

// Each variant stays inside a coherent warm-light family so the glow reads
// as ONE soft reflection, not stacked colours. Subtle teal/violet hints can
// live in the outer halo — that's where the colour variation lives.
const PALETTES: Record<BeamVariant, VariantPalette> = {
  reading: {
    core:       'rgba(255,239,205,0.95)',
    mid:        'rgba(255,212,148,0.55)',
    halo:       'rgba(160,130,90,0.16)',
    staticEdge: 'rgba(160,138,86,0.22)',
  },
  proof: {
    core:       'rgba(255,239,205,0.95)',
    mid:        'rgba(255,212,148,0.55)',
    halo:       'rgba(143,168,138,0.18)',  // sage hint outward
    staticEdge: 'rgba(201,169,97,0.24)',
  },
  primary: {
    core:       'rgba(255,235,190,0.95)',
    mid:        'rgba(255,205,135,0.50)',
    halo:       'rgba(170,140,100,0.16)',
    staticEdge: 'rgba(201,169,97,0.22)',
  },
  subtle: {
    core:       'rgba(244,240,232,0.85)',
    mid:        'rgba(220,210,190,0.35)',
    halo:       'rgba(200,200,200,0.10)',
    staticEdge: 'rgba(244,240,232,0.16)',
  },
};

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// ─── Public APIs ─────────────────────────────────────────────────────────

export function VYBBorderBeamButton({
  children, onPress, disabled, size = 'md', style, beamEnabled = true,
  hapticOnPress = true, variant = 'reading',
}: {
  children: React.ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  size?: Size;
  style?: StyleProp<ViewStyle>;
  beamEnabled?: boolean;
  hapticOnPress?: boolean;
  variant?: BeamVariant;
}) {
  return (
    <BeamBase
      size={size}
      onPress={onPress}
      disabled={disabled}
      style={style}
      active={beamEnabled}
      variant={variant}
      hapticOnPress={hapticOnPress}
    >
      {children}
    </BeamBase>
  );
}

export function VYBBeamButton({
  label, children, icon,
  onPress, disabled, loading, active = true,
  variant = 'primary', size = 'md', style, textStyle,
}: {
  label?: string;
  children?: React.ReactNode;
  icon?: React.ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  loading?: boolean;
  active?: boolean;
  variant?: BeamVariant;
  size?: Size;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}) {
  const s = SIZES[size];
  const palette = PALETTES[variant];
  const headColor = palette.core;
  const beamActive = active && !disabled && !loading;

  return (
    <BeamBase
      size={size}
      onPress={onPress}
      disabled={disabled || loading}
      style={style}
      active={beamActive}
      variant={variant}
    >
      {loading ? (
        <ActivityIndicator color={headColor} />
      ) : (
        <>
          {icon}
          {label && (
            <Text style={[{
              fontFamily: F.sansBold, fontSize: s.fs, color: C.textPrimary,
              letterSpacing: 0.6, textTransform: 'uppercase',
            }, textStyle]}>
              {label}
            </Text>
          )}
          {children}
        </>
      )}
    </BeamBase>
  );
}

// ─── Geometry: sample points along the pill perimeter ────────────────────

const SAMPLES = 48;

// Returns {x, y} at parameter t ∈ [0, 1] along a horizontal pill of size w×h.
// Path: top-left start of the top straight → right semicircle → bottom
// straight (right→left) → left semicircle → close.
function pillPoint(t: number, w: number, h: number): [number, number] {
  const r = h / 2;
  const straight = Math.max(0, w - h);
  const arc = Math.PI * r;
  const total = 2 * straight + 2 * arc;
  let d = t * total;
  if (d <= straight) return [r + d, 0];
  d -= straight;
  if (d <= arc) {
    const a = -Math.PI / 2 + (d / arc) * Math.PI;
    return [w - r + r * Math.cos(a), r + r * Math.sin(a)];
  }
  d -= arc;
  if (d <= straight) return [w - r - d, h];
  d -= straight;
  const a = Math.PI / 2 + (d / arc) * Math.PI;
  return [r + r * Math.cos(a), r + r * Math.sin(a)];
}

// ─── Base implementation ─────────────────────────────────────────────────

function BeamBase({
  children, onPress, disabled, size, style, active, variant, hapticOnPress = true,
}: {
  children: React.ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  size: Size;
  style?: StyleProp<ViewStyle>;
  active: boolean;
  variant: BeamVariant;
  hapticOnPress?: boolean;
}) {
  const s = SIZES[size];
  const radius = s.h / 2;
  const strokeW = 1.4;
  const palette = PALETTES[variant];

  const [dims, setDims] = useState<{ w: number; h: number } | null>(null);
  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (!dims || dims.w !== width || dims.h !== height) setDims({ w: width, h: height });
  };

  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => sub?.remove?.();
  }, []);

  // Pause the loop whenever the parent screen isn't focused — React
  // Navigation keeps tabs mounted, so without this gate every Continue
  // Reading / Upload Proof beam keeps animating in background tabs.
  const isFocused = useIsFocused();

  const t = useRef(new Animated.Value(0)).current;
  const animating = ENABLE_BEAM_BUTTONS && active && !!dims && !reduceMotion && isFocused;
  useEffect(() => {
    if (!animating) { t.setValue(0); return; }
    t.setValue(0);
    const loop = Animated.loop(
      Animated.timing(t, {
        toValue: 1, duration: BEAM_DURATION_MS,
        easing: Easing.linear, useNativeDriver: false,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [animating]);

  // Pre-compute interpolation input/output arrays so the Animated.Value
  // drives the (cx, cy) of the glow circles along the perimeter.
  const { inputRange, xRange, yRange } = React.useMemo(() => {
    if (!dims) return { inputRange: [0, 1], xRange: [0, 0], yRange: [0, 0] };
    const inp: number[] = [];
    const xs: number[] = [];
    const ys: number[] = [];
    for (let i = 0; i <= SAMPLES; i++) {
      const u = i / SAMPLES;
      inp.push(u);
      const [x, y] = pillPoint(u, dims.w, dims.h);
      xs.push(x); ys.push(y);
    }
    return { inputRange: inp, xRange: xs, yRange: ys };
  }, [dims]);

  const cx = t.interpolate({ inputRange, outputRange: xRange });
  const cy = t.interpolate({ inputRange, outputRange: yRange });

  // Three stacked glow circles — outer halo, mid glow, bright core.
  // Radii scale with the button height so it stays compact on small sizes.
  const haloR = s.h * 1.05;
  const midR  = s.h * 0.55;
  const coreR = s.h * 0.22;

  return (
    <Pressable
      onPress={() => { if (hapticOnPress && !disabled) hLight(); onPress?.(); }}
      disabled={disabled}
      onLayout={onLayout}
      style={({ pressed }) => [{
        height: s.h, borderRadius: radius,
        opacity: disabled ? 0.45 : pressed ? 0.92 : 1,
        transform: [{ scale: pressed ? 0.98 : 1 }],
        overflow: 'hidden',
        backgroundColor: 'rgba(20,20,26,0.96)',
      }, style]}>

      {dims && (
        <Svg width={dims.w} height={dims.h} style={{ position: 'absolute', top: 0, left: 0 }}>
          <Defs>
            <RadialGradient id={`vyb-halo-${variant}`} cx="50%" cy="50%" rx="50%" ry="50%">
              <Stop offset="0%"  stopColor={palette.halo} stopOpacity="1" />
              <Stop offset="60%" stopColor={palette.halo} stopOpacity="0.35" />
              <Stop offset="100%" stopColor={palette.halo} stopOpacity="0" />
            </RadialGradient>
            <RadialGradient id={`vyb-mid-${variant}`} cx="50%" cy="50%" rx="50%" ry="50%">
              <Stop offset="0%"  stopColor={palette.mid} stopOpacity="1" />
              <Stop offset="55%" stopColor={palette.mid} stopOpacity="0.45" />
              <Stop offset="100%" stopColor={palette.mid} stopOpacity="0" />
            </RadialGradient>
            <RadialGradient id={`vyb-core-${variant}`} cx="50%" cy="50%" rx="50%" ry="50%">
              <Stop offset="0%"  stopColor={palette.core} stopOpacity="1" />
              <Stop offset="50%" stopColor={palette.core} stopOpacity="0.65" />
              <Stop offset="100%" stopColor={palette.core} stopOpacity="0" />
            </RadialGradient>
          </Defs>

          {/* Static perimeter — always visible + reduce-motion fallback. */}
          <Rect
            x={strokeW / 2} y={strokeW / 2}
            width={dims.w - strokeW} height={dims.h - strokeW}
            rx={radius - 0.5} ry={radius - 0.5}
            fill="none"
            stroke={palette.staticEdge}
            strokeWidth={strokeW}
          />

          {animating && (
            <>
              {/* Outer halo — atmospheric colour wash, clipped by the pill. */}
              <AnimatedCircle cx={cx as any} cy={cy as any} r={haloR}
                fill={`url(#vyb-halo-${variant})`} />
              {/* Mid glow — the warmer body of the reflection. */}
              <AnimatedCircle cx={cx as any} cy={cy as any} r={midR}
                fill={`url(#vyb-mid-${variant})`} />
              {/* Bright core — the small highlight at the centre. */}
              <AnimatedCircle cx={cx as any} cy={cy as any} r={coreR}
                fill={`url(#vyb-core-${variant})`} />
            </>
          )}
        </Svg>
      )}

      {/* Content */}
      <View pointerEvents="none" style={{
        flex: 1, paddingHorizontal: s.padH,
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
      }}>
        {children}
      </View>
    </Pressable>
  );
}
