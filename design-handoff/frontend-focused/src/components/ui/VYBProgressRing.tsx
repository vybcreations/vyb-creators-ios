import React, { useEffect, useRef } from 'react';
import { View, StyleProp, ViewStyle, Animated, Easing } from 'react-native';
import Svg, { Circle as SvgCircle } from 'react-native-svg';
import { colors as C, motion as M, state as ST } from '../../theme';

const AnimatedCircle = Animated.createAnimatedComponent(SvgCircle);

/**
 * VYBProgressRing — single SVG progress ring used app-wide.
 *
 * Replaces: primitives.Ring, HomeScreen.ProgressRing (and is the base
 * AuraCircle can layer on top of).
 *
 * Pass either `progress` (0..1) or `done/total`. State derives automatically:
 *   - empty (track only) → muted gray
 *   - progress → sage by default
 *   - complete → gold by default
 * Override colors via `color`/`backgroundColor` if a screen needs a specific tone.
 */

type State = 'empty' | 'progress' | 'complete';

export function VYBProgressRing({
  progress, done, total,
  size = 96, strokeWidth = 8,
  state: stateProp, animated = true,
  color, backgroundColor = 'rgba(255,255,255,0.10)',
  children, style,
}: {
  progress?: number;          // 0..1
  done?: number;
  total?: number;
  size?: number;
  strokeWidth?: number;
  state?: State;
  animated?: boolean;
  color?: string;             // override the auto-picked fill color
  backgroundColor?: string;   // track color
  children?: React.ReactNode; // centered overlay (count, etc.)
  style?: StyleProp<ViewStyle>;
}) {
  const pct = progress !== undefined
    ? Math.max(0, Math.min(1, progress))
    : (total && total > 0 ? Math.max(0, Math.min(1, (done || 0) / total)) : 0);
  const complete = pct >= 1;
  const derived: State = stateProp ?? (complete ? 'complete' : pct > 0 ? 'progress' : 'empty');

  const r = (size - strokeWidth) / 2;
  const circ = 2 * Math.PI * r;

  const ringColor =
    color ??
    (derived === 'complete' ? ST.complete :
     derived === 'progress' ? ST.inProgress :
                              backgroundColor);

  const animValue = useRef(new Animated.Value(pct)).current;
  useEffect(() => {
    if (!animated) { animValue.setValue(pct); return; }
    Animated.timing(animValue, {
      toValue: pct, duration: M.duration.slow,
      easing: Easing.bezier(...M.easing.standard),
      useNativeDriver: false,
    }).start();
  }, [pct, animated]);

  const strokeDashoffset = animValue.interpolate({
    inputRange: [0, 1], outputRange: [circ, 0],
  });

  return (
    <View style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, style]}>
      <Svg width={size} height={size}>
        <SvgCircle cx={size/2} cy={size/2} r={r} stroke={backgroundColor} strokeWidth={strokeWidth} fill="none" />
        <AnimatedCircle
          cx={size/2} cy={size/2} r={r}
          stroke={ringColor as any} strokeWidth={strokeWidth} fill="none"
          strokeDasharray={`${circ} ${circ}`}
          strokeDashoffset={animated ? (strokeDashoffset as any) : circ - circ * pct}
          strokeLinecap="round"
          transform={`rotate(-90 ${size/2} ${size/2})`}
        />
      </Svg>
      {children !== undefined && (
        <View style={{ position: 'absolute', alignItems: 'center', justifyContent: 'center' }}>
          {children}
        </View>
      )}
    </View>
  );
}
