import React, { useEffect, useRef, useState } from 'react';
import {
  View, Animated, Easing, AccessibilityInfo, StyleSheet,
  LayoutChangeEvent, ViewStyle, StyleProp,
} from 'react-native';
import Svg, { Line } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useIsFocused } from '@react-navigation/native';
import { colors as C } from '../../theme';

/**
 * VYBGridBeamCard — premium animated background for a single card.
 *
 * Three stacked layers:
 *   1. Dark glass surface (BlurView + borderGlass) — matches the bottom nav
 *      and `GlassCard` so the component feels native to the app.
 *   2. Static subtle grid drawn with `react-native-svg` <Line> elements.
 *   3. A single soft beam (LinearGradient rectangle) that translates across
 *      the card on a slight diagonal, looping ~6s. Native-driven via
 *      `translateX` so it stays smooth.
 *
 * Layers 1–3 sit behind the content with `pointerEvents="none"`, so any
 * button or Pressable inside the card keeps working untouched.
 *
 * Use sparingly — one per screen, for premium accents. Not for task/habit
 * rows or anything repetitive.
 */

type Variant = 'sand' | 'sage' | 'teal';
type Intensity = 'subtle' | 'normal' | 'strong';

const VARIANT_RGB: Record<Variant, string> = {
  sand: '160,138,86',
  sage: '94,117,88',
  teal: '40,76,85',
};

export function VYBGridBeamCard({
  rows = 5,
  cols = 7,
  active = true,
  variant = 'sand',
  intensity = 'subtle',
  borderRadius = 18,
  children,
  style,
}: {
  rows?: number;
  cols?: number;
  active?: boolean;
  variant?: Variant;
  intensity?: Intensity;
  borderRadius?: number;
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const [dims, setDims] = useState({ w: 0, h: 0 });
  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width !== dims.w || height !== dims.h) setDims({ w: width, h: height });
  };

  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => sub?.remove?.();
  }, []);

  // Beam translates left→right repeatedly. We sweep slightly off-screen on
  // both ends so the edges fade in/out naturally instead of popping.
  // Pause the loop when the parent screen isn't focused so badges on
  // Profile don't keep animating while the user is on Home/Reading/etc.
  const isFocused = useIsFocused();
  const beam = useRef(new Animated.Value(0)).current;
  const animating = active && !reduceMotion && dims.w > 0 && isFocused;
  useEffect(() => {
    if (!animating) { beam.setValue(0); return; }
    beam.setValue(0);
    const loop = Animated.loop(
      Animated.timing(beam, {
        toValue: 1, duration: 6500,
        easing: Easing.linear, useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [animating]);

  // Grid line opacities tuned for "texture, not pattern".
  const gridAlpha = intensity === 'subtle' ? 0.05 : intensity === 'strong' ? 0.13 : 0.09;
  const gridColor = `rgba(244,240,232,${gridAlpha})`;

  // Beam peak opacity sits low — feels like light through glass, not a CTA.
  const beamPeak = intensity === 'subtle' ? 0.14 : intensity === 'strong' ? 0.32 : 0.22;
  const rgb = VARIANT_RGB[variant];

  // Beam geometry: a tall narrow strip rotated ~18° so the sweep feels
  // cinematic, not mechanical. translateX covers a bit past both edges.
  const beamWidth = Math.max(80, dims.w * 0.35);
  const translateX = beam.interpolate({
    inputRange: [0, 1],
    outputRange: [-beamWidth - 40, dims.w + 40],
  });

  return (
    <View
      onLayout={onLayout}
      style={[{ borderRadius, overflow: 'hidden' }, style]}>
      {/* 1. Dark glass surface */}
      <BlurView
        intensity={38}
        tint="dark"
        style={[StyleSheet.absoluteFill, {
          backgroundColor: 'rgba(18,18,18,0.45)',
          borderColor: C.borderGlass,
          borderWidth: 1,
          borderRadius,
        }]}
      />

      {/* 2. Static grid lines */}
      {dims.w > 0 && (
        <Svg
          pointerEvents="none"
          width={dims.w} height={dims.h}
          style={StyleSheet.absoluteFill}>
          {/* horizontals */}
          {Array.from({ length: rows + 1 }).map((_, i) => {
            const y = (dims.h / rows) * i;
            return (
              <Line key={`h${i}`}
                x1={0} y1={y} x2={dims.w} y2={y}
                stroke={gridColor} strokeWidth={1}
              />
            );
          })}
          {/* verticals */}
          {Array.from({ length: cols + 1 }).map((_, i) => {
            const x = (dims.w / cols) * i;
            return (
              <Line key={`v${i}`}
                x1={x} y1={0} x2={x} y2={dims.h}
                stroke={gridColor} strokeWidth={1}
              />
            );
          })}
        </Svg>
      )}

      {/* 3. Animated beam — soft VYB-tinted light. Rendered only while
          the component has size + isn't in reduce-motion mode. */}
      {dims.w > 0 && animating && (
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: -dims.h * 0.4,
            left: 0,
            width: beamWidth,
            height: dims.h * 1.8,
            transform: [
              { rotate: '18deg' },
              { translateX },
            ],
          }}>
          <LinearGradient
            colors={[
              `rgba(${rgb},0)`,
              `rgba(${rgb},${beamPeak})`,
              `rgba(${rgb},0)`,
            ]}
            locations={[0, 0.5, 1]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      )}

      {/* 4. Content sits on top, fully interactive. */}
      {children}
    </View>
  );
}
