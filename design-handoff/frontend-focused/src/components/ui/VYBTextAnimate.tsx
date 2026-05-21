import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo, Animated, Easing,
  StyleProp, TextStyle, View, ViewStyle,
} from 'react-native';

/**
 * VYBTextAnimate — premium animated text for special moments.
 *
 * Use it for: onboarding titles, empty-state copy, profile identity lines,
 * success/feedback messages, reading + focus transitions. Do NOT use it for
 * every label, list row, task, habit, menu item, paragraph, or form text.
 *
 * Built natively for Expo with RN's `Animated` (not Reanimated), since
 * Reanimated v4 isn't shipped in Expo Go. Same modes/props as the original
 * spec — the call sites are unchanged.
 *
 * VYB brand tone: subtle motion, ~420ms timing, `cubic-bezier(0.22, 1, 0.36, 1)`,
 * tiny scale overshoot at most. No childish bounce.
 */

type TextAnimateType =
  | 'fadeIn'
  | 'fadeUp'
  | 'wordReveal'
  | 'letterReveal'
  | 'softRollIn'
  | 'softScale';

type SplitBy = 'word' | 'letter';

const VYB_EASE = Easing.bezier(0.22, 1, 0.36, 1);

export function VYBTextAnimate({
  text,
  type = 'fadeUp',
  splitBy,
  delay = 0,
  duration = 420,
  stagger = 42,
  textStyle,
  containerStyle,
  onComplete,
}: {
  text: string;
  type?: TextAnimateType;
  splitBy?: SplitBy;
  delay?: number;
  duration?: number;
  stagger?: number;
  textStyle?: StyleProp<TextStyle>;
  containerStyle?: StyleProp<ViewStyle>;
  onComplete?: () => void;
}) {
  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then(v => { if (mounted) setReduceMotion(!!v); });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', v => setReduceMotion(!!v));
    return () => { mounted = false; sub?.remove?.(); };
  }, []);

  const resolvedSplitBy: SplitBy =
    splitBy ?? (type === 'letterReveal' ? 'letter' : 'word');

  // Tokenize once per text/split-by change. Non-breaking spaces preserve
  // letter-mode whitespace inside the flex row.
  const tokens = useMemo(() => {
    if (resolvedSplitBy === 'letter') {
      return Array.from(text).map(c => (c === ' ' ? ' ' : c));
    }
    return text.trim().split(/\s+/).filter(Boolean);
  }, [resolvedSplitBy, text]);

  return (
    <View style={[
      { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' },
      containerStyle,
    ]}>
      {tokens.map((token, index) => {
        const isLast = index === tokens.length - 1;
        const needsSpace = resolvedSplitBy === 'word' && !isLast;
        return (
          <React.Fragment key={`${token}-${index}`}>
            <AnimatedToken
              token={token}
              index={index}
              isLast={isLast}
              type={type}
              delay={delay}
              duration={duration}
              stagger={stagger}
              reduceMotion={reduceMotion}
              textStyle={textStyle}
              onComplete={onComplete}
            />
            {needsSpace ? <Animated.Text style={textStyle}>{' '}</Animated.Text> : null}
          </React.Fragment>
        );
      })}
    </View>
  );
}

function AnimatedToken({
  token, index, isLast, type, delay, duration, stagger, reduceMotion, textStyle, onComplete,
}: {
  token: string;
  index: number;
  isLast: boolean;
  type: TextAnimateType;
  delay: number;
  duration: number;
  stagger: number;
  reduceMotion: boolean;
  textStyle?: StyleProp<TextStyle>;
  onComplete?: () => void;
}) {
  // One progress value drives every per-type interpolation below. JS-driven
  // would let us animate `color`, but we stay on the native driver for
  // smoother opacity/transform on real devices — the supported subset for
  // this component is opacity + translateY + scale + rotate.
  const progress = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;

  useEffect(() => {
    if (reduceMotion) {
      progress.setValue(1);
      if (isLast) onComplete?.();
      return;
    }
    progress.setValue(0);
    Animated.timing(progress, {
      toValue: 1,
      duration,
      delay: delay + index * stagger,
      easing: VYB_EASE,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished && isLast) onComplete?.();
    });
  }, [reduceMotion, delay, duration, stagger, index, isLast, type, token, onComplete, progress]);

  // Build the interpolated transform/opacity for the current type. Static
  // when reduce-motion is on — pinned to the resting state.
  const animatedStyle = (() => {
    if (reduceMotion) {
      return { opacity: 1, transform: [{ translateY: 0 }, { scale: 1 }] };
    }
    switch (type) {
      case 'fadeIn':
        return { opacity: progress };

      case 'fadeUp':
      case 'wordReveal':
      case 'letterReveal':
        return {
          opacity: progress,
          transform: [
            { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) },
            { scale:      progress.interpolate({ inputRange: [0, 0.7, 1], outputRange: [0.985, 1.01, 1] }) },
          ],
        };

      case 'softRollIn':
        return {
          opacity: progress,
          transform: [
            { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) },
            { rotateZ:    progress.interpolate({ inputRange: [0, 1], outputRange: ['18deg', '0deg'] }) },
            { scale:      progress.interpolate({ inputRange: [0, 0.7, 1], outputRange: [0.96, 1.015, 1] }) },
          ],
        };

      case 'softScale':
        return {
          opacity: progress,
          transform: [
            { scale: progress.interpolate({ inputRange: [0, 0.75, 1], outputRange: [0.94, 1.02, 1] }) },
          ],
        };

      default:
        return { opacity: progress };
    }
  })();

  return (
    <Animated.Text style={[textStyle, animatedStyle as any]}>
      {token}
    </Animated.Text>
  );
}

export default VYBTextAnimate;
