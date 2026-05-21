import React, { useEffect, useRef, useState } from 'react';
import { View, Image, Animated, PanResponder, AccessibilityInfo, StyleProp, ViewStyle, Text as RNText } from 'react-native';
import { Gyroscope } from 'expo-sensors';
import * as Haptics from 'expo-haptics';
import Svg, { Defs, RadialGradient as SvgRadialGradient, Stop, Rect } from 'react-native-svg';
import { colors as C, fonts as F } from '../theme';

// Native-driver-animated rect so the shine can fade in/out at 60fps.
const AnimatedSvgRect = Animated.createAnimatedComponent(Rect);

/**
 * BookCover3D — premium tilt + soft shine on a book cover.
 *
 *   • Touch & drag → finger-driven tilt + subtle shine (clipped to the cover)
 *   • Gyroscope (iPhone) → parallax when idle
 *   • Captures the gesture so it doesn't fight with the parent ScrollView
 *   • Reduce-motion → effects disabled
 *
 * Use selectively (Book Detail hero, Reading Now). Library grid stays static.
 */

const SIZES = {
  sm: { w: 80,  h: 120 },
  md: { w: 140, h: 210 },
  lg: { w: 190, h: 285 },
} as const;

type Intensity = 'subtle' | 'normal' | 'strong';

// Configurable intensity profiles — tweak these to retune the whole component.
// rotX/rotY = clamp ceilings (degrees).
// gyroX/gyroY = sensitivity multipliers from device tilt to cover rotation.
// touchX/touchY = sensitivity multipliers from finger position to cover rotation.
const PROFILES: Record<Intensity, { rotX: number; rotY: number; gyroX: number; gyroY: number; touchX: number; touchY: number }> = {
  subtle: { rotX: 10, rotY: 14, gyroX: 12, gyroY: 16, touchX: 20, touchY: 28 },
  normal: { rotX: 16, rotY: 22, gyroX: 18, gyroY: 24, touchX: 32, touchY: 44 },
  strong: { rotX: 20, rotY: 26, gyroX: 26, gyroY: 32, touchX: 40, touchY: 56 },
};

const TILT_SCALE = 1.07;

function clamp(n: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, n));
}

export function BookCover3D({
  coverUrl, size = 'md', disabled, style, fallbackTitle, intensity = 'strong', onTap, onActiveChange,
}: {
  coverUrl: string | null;
  size?: keyof typeof SIZES;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  fallbackTitle?: string;
  intensity?: Intensity;
  onTap?: () => void;
  /** Fires true while the user is touching the cover, false on release/cancel/unmount.
   *  Lets the parent disable competing gestures (page scroll, pager swipe). */
  onActiveChange?: (active: boolean) => void;
}) {
  const { w, h } = SIZES[size];
  const P = PROFILES[intensity];

  const rotateX = useRef(new Animated.Value(0)).current;
  const rotateY = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(1)).current;
  const shineOpacity = useRef(new Animated.Value(0)).current;
  // Shine center is a fraction [0..1] of the cover. React state because
  // react-native-svg gradient attrs aren't natively animatable.
  const [shineCx, setShineCx] = useState(0.5);
  const [shineCy, setShineCy] = useState(0.5);

  const [reduceMotion, setReduceMotion] = useState(false);
  const draggingRef = useRef(false);
  const movedRef = useRef(false); // becomes true after any real movement during a touch

  // Notify parent of touch lifecycle once on mount and on unmount cleanup.
  useEffect(() => {
    return () => {
      // Guarantee the parent never gets stuck with active=true if we unmount mid-gesture.
      if (draggingRef.current) onActiveChange?.(false);
      // Reset all animated state so the shine can't survive a remount.
      shineOpacity.setValue(0);
      rotateX.setValue(0);
      rotateY.setValue(0);
      scale.setValue(1);
      setShineCx(0.5);
      setShineCy(0.5);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion).catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => { sub?.remove?.(); };
  }, []);

  // Gyroscope parallax (idle only — yields to touch)
  useEffect(() => {
    if (disabled || reduceMotion) return;
    let sub: any;
    let cancelled = false;

    (async () => {
      try {
        const available = await Gyroscope.isAvailableAsync();
        if (!available || cancelled) return;
        Gyroscope.setUpdateInterval(60); // ~16 Hz — responsive but smooth
        sub = Gyroscope.addListener(({ x, y }) => {
          if (draggingRef.current) return;
          // Slightly snappier spring than before — feels more "alive" without jittering.
          Animated.spring(rotateX, {
            toValue: clamp(x * P.gyroX, -P.rotX, P.rotX),
            useNativeDriver: true, friction: 9, tension: 50,
          }).start();
          Animated.spring(rotateY, {
            toValue: clamp(-y * P.gyroY, -P.rotY, P.rotY),
            useNativeDriver: true, friction: 9, tension: 50,
          }).start();
        });
      } catch { /* fallback: touch only */ }
    })();

    return () => {
      cancelled = true;
      sub?.remove?.();
      rotateX.setValue(0); rotateY.setValue(0);
    };
  }, [disabled, reduceMotion, rotateX, rotateY, P.gyroX, P.gyroY, P.rotX, P.rotY]);

  // Touch — claims the gesture aggressively so parent ScrollView doesn't steal it
  const panResponder = useRef(
    PanResponder.create({
      // Claim on start *and* during capture phase so we beat the ScrollView
      // before it ever sees the touch.
      onStartShouldSetPanResponder: () => !disabled && !reduceMotion,
      onStartShouldSetPanResponderCapture: () => !disabled && !reduceMotion,
      onMoveShouldSetPanResponder: () => !disabled && !reduceMotion,
      onMoveShouldSetPanResponderCapture: () => !disabled && !reduceMotion,
      // Refuse to give the gesture back to the ScrollView once we own it.
      onPanResponderTerminationRequest: () => false,
      onShouldBlockNativeResponder: () => true,

      onPanResponderGrant: (e) => {
        draggingRef.current = true;
        movedRef.current = false;
        onActiveChange?.(true);
        applyFromTouch(e.nativeEvent.locationX, e.nativeEvent.locationY);
        // Only animate scale on grant — the shine fades in once we know it's a drag,
        // so taps never flash a circle.
        Animated.spring(scale, { toValue: TILT_SCALE, useNativeDriver: true, friction: 7, tension: 80 }).start();
        try { Haptics.selectionAsync(); } catch {}
      },
      onPanResponderMove: (e, g) => {
        applyFromTouch(e.nativeEvent.locationX, e.nativeEvent.locationY);
        // First detected movement → reveal shine (drags only).
        // useNativeDriver:false because the value drives an SVG Rect opacity
        // (SVG props can only be updated from the JS thread).
        if (!movedRef.current && (Math.abs(g.dx) > 3 || Math.abs(g.dy) > 3)) {
          movedRef.current = true;
          Animated.timing(shineOpacity, { toValue: 1, duration: 140, useNativeDriver: false }).start();
        }
      },
      onPanResponderRelease: (_, g) => {
        if (onTap && Math.abs(g.dx) < 12 && Math.abs(g.dy) < 12) onTap();
        settle();
      },
      onPanResponderTerminate: () => settle(),
    })
  ).current;

  const applyFromTouch = (lx: number, ly: number) => {
    const px = clamp(lx / w, 0, 1);
    const py = clamp(ly / h, 0, 1);
    rotateX.setValue(clamp((0.5 - py) * P.touchY, -P.rotX, P.rotX));
    rotateY.setValue(clamp((px - 0.5) * P.touchX, -P.rotY, P.rotY));
    setShineCx(px);
    setShineCy(py);
  };

  const settle = () => {
    draggingRef.current = false;
    movedRef.current = false;
    onActiveChange?.(false);
    // Spring the transforms with native driver, but fade the SVG-bound shine
    // opacity on the JS thread (separate animation) so it actually reaches 0.
    Animated.parallel([
      Animated.spring(rotateX, { toValue: 0, useNativeDriver: true, friction: 7, tension: 60 }),
      Animated.spring(rotateY, { toValue: 0, useNativeDriver: true, friction: 7, tension: 60 }),
      Animated.spring(scale,   { toValue: 1, useNativeDriver: true, friction: 7, tension: 60 }),
    ]).start();
    Animated.timing(shineOpacity, { toValue: 0, duration: 180, useNativeDriver: false })
      .start(() => {
        // Hard reset regardless of `finished` so a follow-up gesture can't
        // start from a non-zero opacity.
        shineOpacity.setValue(0);
        setShineCx(0.5);
        setShineCy(0.5);
      });
  };

  const transform: any[] = [
    { perspective: 800 },
    { scale },
    { rotateX: rotateX.interpolate({ inputRange: [-P.rotX, P.rotX], outputRange: [`${-P.rotX}deg`, `${P.rotX}deg`] }) },
    { rotateY: rotateY.interpolate({ inputRange: [-P.rotY, P.rotY], outputRange: [`${-P.rotY}deg`, `${P.rotY}deg`] }) },
  ];

  // Unique-per-instance gradient id so multiple covers (e.g. Reading Now +
  // any future side-by-side) don't collide on a shared <defs>.
  const shineId = useRef(`vyb-shine-${Math.random().toString(36).slice(2, 8)}`).current;

  return (
    <View style={[{ width: w, height: h }, style]} {...panResponder.panHandlers}>
      {/* Outer wrapper carries shadow + transform — no clipping here or the
          shadow would be cut off. */}
      <Animated.View style={{
        width: w, height: h,
        transform,
        shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 18, shadowOffset: { width: 0, height: 14 },
        elevation: 12,
      }}>
        {/* Inner clip wrapper — clips the shine inside the cover. */}
        <View style={{ width: w, height: h, borderRadius: 6, overflow: 'hidden', backgroundColor: C.bgOverlay }}>
          {coverUrl ? (
            <Image source={{ uri: coverUrl }} resizeMode="cover" style={{ width: w, height: h }} />
          ) : (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 12,
              borderColor: C.borderSubtle, borderWidth: 1 }}>
              <RNText style={{
                fontFamily: F.serifItalic,
                fontSize: Math.max(11, w * 0.11),
                color: C.textMuted, textAlign: 'center', lineHeight: Math.max(15, w * 0.14),
              }} numberOfLines={4}>
                {fallbackTitle || '—'}
              </RNText>
            </View>
          )}

          {/* Spine edge — feels like a real book */}
          <View pointerEvents="none" style={{
            position: 'absolute', top: 0, bottom: 0, left: 0, width: 3,
            backgroundColor: 'rgba(0,0,0,0.22)',
          }} />
          <View pointerEvents="none" style={{
            position: 'absolute', top: 0, bottom: 0, left: 3, width: 1,
            backgroundColor: 'rgba(255,255,255,0.06)',
          }} />

          {/* Soft radial shine — real radial gradient via SVG.
              The Rect's opacity fades in/out via Animated.Value (native driver);
              the gradient center follows the touch via React state. Soft, broad,
              and never reads as a "dot". */}
          {/* Soft radial shine — big, diffused, follows the touch.
              rx/ry > 0.5 makes the gradient extend toward (and past) the rect's
              edges, giving a much broader reflection than a tight halo. The
              stops are tuned so the center reads as luminous white without
              forming a tight bright dot. */}
          <Svg
            width={w} height={h}
            pointerEvents="none"
            style={{ position: 'absolute', left: 0, top: 0 }}>
            <Defs>
              <SvgRadialGradient
                id={shineId}
                cx={shineCx.toFixed(3)}
                cy={shineCy.toFixed(3)}
                rx="0.95" ry="0.95"
              >
                <Stop offset="0"    stopColor="white" stopOpacity="0.55" />
                <Stop offset="0.18" stopColor="white" stopOpacity="0.34" />
                <Stop offset="0.42" stopColor="white" stopOpacity="0.15" />
                <Stop offset="0.75" stopColor="white" stopOpacity="0.04" />
                <Stop offset="1"    stopColor="white" stopOpacity="0" />
              </SvgRadialGradient>
            </Defs>
            <AnimatedSvgRect
              width={w} height={h}
              fill={`url(#${shineId})`}
              opacity={shineOpacity}
            />
          </Svg>
        </View>
      </Animated.View>
    </View>
  );
}
