import React, { useEffect, useRef } from 'react';
import { Pressable, Animated, Easing, View, AccessibilityInfo, StyleProp, ViewStyle } from 'react-native';
import { colors as C, motion as M } from '../../theme';

/**
 * VYBCheckCircle — generic checkbox circle for habits, tasks, favorites,
 * proof check-ins, etc.
 *
 * Generalizes AnimatedHabitCheck so any screen can use the same fill +
 * check-pop animation. Default tone is gold (the completion color);
 * switch to sage for soft state, neutral for outline-only.
 */

type Tone = 'gold' | 'sage' | 'neutral';

const TONE: Record<Tone, { fill: string; border: string }> = {
  gold:    { fill: C.gold,         border: C.gold },
  sage:    { fill: '#8FA88A',      border: '#8FA88A' },
  neutral: { fill: 'rgba(255,255,255,0.85)', border: C.borderStrong },
};

export function VYBCheckCircle({
  checked, size = 26, tone = 'gold',
  animated = true, disabled, onPress, style,
}: {
  checked: boolean;
  size?: number;
  tone?: Tone;
  animated?: boolean;
  disabled?: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const palette = TONE[tone];

  const [reduceMotion, setReduceMotion] = React.useState(false);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => sub?.remove?.();
  }, []);

  const progress = useRef(new Animated.Value(checked ? 1 : 0)).current;
  const prev = useRef(checked);
  useEffect(() => {
    if (prev.current === checked) return;
    prev.current = checked;
    if (!animated || reduceMotion) { progress.setValue(checked ? 1 : 0); return; }
    Animated.timing(progress, {
      toValue: checked ? 1 : 0,
      duration: checked ? M.duration.normal : M.duration.fast,
      easing: Easing.bezier(...M.easing.standard),
      useNativeDriver: false,
    }).start();
  }, [checked, animated, reduceMotion]);

  const bg     = progress.interpolate({ inputRange: [0, 1], outputRange: ['rgba(201,169,97,0)', palette.fill] });
  const border = progress.interpolate({ inputRange: [0, 1], outputRange: [C.borderMid, palette.border] });
  const ckOp   = progress.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, 0, 1] });
  const ckSc   = progress.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0.4, 0.4, 1] });

  const Inner = (
    <Animated.View style={{
      width: size, height: size, borderRadius: size / 2,
      backgroundColor: bg as any, borderColor: border as any, borderWidth: 1.5,
      alignItems: 'center', justifyContent: 'center',
      opacity: disabled ? 0.5 : 1,
    }}>
      <Animated.Text style={{
        color: C.bgBase, fontWeight: '700',
        fontSize: size * 0.54, lineHeight: size * 0.62,
        opacity: ckOp, transform: [{ scale: ckSc }],
      }}>✓</Animated.Text>
    </Animated.View>
  );

  if (!onPress) return <View style={style}>{Inner}</View>;
  return (
    <Pressable onPress={onPress} disabled={disabled} hitSlop={10} style={style}>
      {Inner}
    </Pressable>
  );
}
