import React from 'react';
import { Animated, Easing, View, AccessibilityInfo, LayoutChangeEvent, TextStyle } from 'react-native';
import { colors as C } from '../theme';

/**
 * AnimatedHabitTitle — habit name with a completion strikethrough that
 * animates ONLY across the measured text width (never the full row).
 *
 * Shared by the Habits screen and the Dashboard so check/uncheck feels
 * identical everywhere. Owns its own progress value driven by `done`, so
 * callers just flip the boolean.
 *
 * The strike width is measured in pixels via onLayout (percentage widths
 * resolve against the row, which caused the full-width line bug).
 */
/**
 * AnimatedHabitCheck — gold completion circle with the same fill + check
 * pop the Habits screen uses, so Dashboard check/uncheck feels identical.
 */
export function AnimatedHabitCheck({ done, size = 26 }: { done: boolean; size?: number }) {
  const [reduceMotion, setReduceMotion] = React.useState(false);
  React.useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => sub?.remove?.();
  }, []);

  const progress = React.useRef(new Animated.Value(done ? 1 : 0)).current;
  const prevDone = React.useRef(done);
  React.useEffect(() => {
    if (prevDone.current === done) return;
    prevDone.current = done;
    if (reduceMotion) { progress.setValue(done ? 1 : 0); return; }
    Animated.timing(progress, {
      toValue: done ? 1 : 0,
      duration: done ? 200 : 180,
      easing: Easing.bezier(0.22, 1, 0.36, 1),
      useNativeDriver: false,
    }).start();
  }, [done, reduceMotion]);

  const bg     = progress.interpolate({ inputRange: [0, 1], outputRange: ['rgba(201,169,97,0)', C.gold] });
  const border = progress.interpolate({ inputRange: [0, 1], outputRange: [C.borderMid, C.gold] });
  const ckOp   = progress.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, 0, 1] });
  const ckSc   = progress.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0.4, 0.4, 1] });

  return (
    <Animated.View style={{
      width: size, height: size, borderRadius: size / 2,
      backgroundColor: bg as any, borderColor: border as any, borderWidth: 1.5,
      alignItems: 'center', justifyContent: 'center',
    }}>
      <Animated.Text style={{
        color: C.bgBase, fontFamily: 'System', fontWeight: '700',
        fontSize: size * 0.54, lineHeight: size * 0.62,
        opacity: ckOp, transform: [{ scale: ckSc }],
      }}>✓</Animated.Text>
    </Animated.View>
  );
}

export function AnimatedHabitTitle({
  name, done, textStyle, lineColor = C.textSecondary,
}: {
  name: string;
  done: boolean;
  textStyle?: TextStyle;
  lineColor?: string;
}) {
  const [reduceMotion, setReduceMotion] = React.useState(false);
  React.useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => sub?.remove?.();
  }, []);

  const progress = React.useRef(new Animated.Value(done ? 1 : 0)).current;
  const prevDone = React.useRef(done);
  React.useEffect(() => {
    if (prevDone.current === done) return;
    prevDone.current = done;
    if (reduceMotion) { progress.setValue(done ? 1 : 0); return; }
    Animated.timing(progress, {
      toValue: done ? 1 : 0,
      duration: done ? 200 : 180,
      easing: Easing.bezier(0.22, 1, 0.36, 1),
      useNativeDriver: false,
    }).start();
  }, [done, reduceMotion]);

  const [textW, setTextW] = React.useState(0);
  const onTextLayout = (e: LayoutChangeEvent) => {
    const w = Math.round(e.nativeEvent.layout.width);
    if (w !== textW) setTextW(w);
  };

  const textOpacity = progress.interpolate({ inputRange: [0, 1], outputRange: [1, 0.55] });
  const strikeWidth = progress.interpolate({ inputRange: [0, 1], outputRange: [0, textW] });

  return (
    // alignSelf:flex-start keeps the wrapper at text width so the absolute
    // line can never exceed the glyphs even before onLayout resolves.
    <View style={{ alignSelf: 'flex-start', maxWidth: '100%' }}>
      <Animated.Text
        onLayout={onTextLayout}
        numberOfLines={2}
        style={[textStyle, { opacity: textOpacity }]}
      >
        {name}
      </Animated.Text>
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute', left: 0, top: '50%',
          height: 1.2, backgroundColor: lineColor,
          width: strikeWidth,
        }}
      />
    </View>
  );
}
