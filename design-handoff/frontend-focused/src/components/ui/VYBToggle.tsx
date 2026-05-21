import React, { useEffect, useRef } from 'react';
import { View, Text, Pressable, Animated, Easing, StyleProp, ViewStyle, LayoutChangeEvent } from 'react-native';
import { colors as C, fonts as F, motion as M } from '../../theme';

/**
 * VYBToggle — segmented pill control.
 *
 * Source of truth for every Today/Week, Day/Week/Month, Friends/Circles,
 * Book/Entries, filter toggle. Replaces:
 *   - HomeScreen.HabitsViewToggle
 *   - ProfileScreen Aura toggle + PeriodSummary toggle
 *   - BookDetailScreen.PanelPill + FilterChip
 *   - FriendsScreen.SegmentedTabs
 *
 * Lightweight sliding indicator (LayoutAnimation-free), JS-driven so we can
 * interpolate color/translate together.
 */

export type VYBToggleOption<V extends string = string> = {
  label: string;
  value: V;
  icon?: React.ReactNode;
};

type Tone = 'gold' | 'sage' | 'neutral';
type Variant = 'filled' | 'subtle' | 'glass';
type Size = 'sm' | 'md' | 'lg';

const TONE_BG: Record<Tone, string> = {
  gold:    'rgba(201,169,97,0.18)',
  sage:    'rgba(143,168,138,0.18)',
  neutral: 'rgba(255,255,255,0.08)',
};
const TONE_FG: Record<Tone, string> = {
  gold:    C.gold,
  sage:    '#8FA88A',
  neutral: C.textPrimary,
};

const SIZE_H: Record<Size, number> = { sm: 24, md: 28, lg: 34 };
const SIZE_FS: Record<Size, number> = { sm: 10, md: 11, lg: 12 };
const SIZE_PX: Record<Size, number> = { sm: 12, md: 14, lg: 16 };

export function VYBToggle<V extends string>({
  options, value, onChange,
  size = 'md', tone = 'gold', variant = 'subtle',
  disabled, style,
}: {
  options: VYBToggleOption<V>[];
  value: V;
  onChange: (v: V) => void;
  size?: Size;
  tone?: Tone;
  variant?: Variant;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const h = SIZE_H[size];
  const idx = Math.max(0, options.findIndex(o => o.value === value));
  const [segW, setSegW] = React.useState(0);
  const indicatorX = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(indicatorX, {
      toValue: idx * segW,
      duration: M.duration.normal,
      easing: Easing.bezier(...M.easing.standard),
      useNativeDriver: false,
    }).start();
  }, [idx, segW]);

  const onTrackLayout = (e: LayoutChangeEvent) => {
    const w = (e.nativeEvent.layout.width - 4) / options.length; // padding 2*2
    if (w !== segW) setSegW(w);
  };

  const trackBg =
    variant === 'filled' ? C.bgElevated :
    variant === 'glass'  ? C.bgGlass :
                           C.bgOverlay;

  return (
    <View
      onLayout={onTrackLayout}
      style={[{
        flexDirection: 'row', padding: 2, borderRadius: 999, height: h + 4,
        backgroundColor: trackBg,
        borderColor: C.borderSubtle, borderWidth: 1,
        position: 'relative', opacity: disabled ? 0.5 : 1,
      }, style]}
    >
      {segW > 0 && (
        <Animated.View pointerEvents="none" style={{
          position: 'absolute', top: 2, left: 2,
          width: segW, height: h, borderRadius: 999,
          backgroundColor: TONE_BG[tone],
          transform: [{ translateX: indicatorX }],
        }} />
      )}
      {options.map(o => {
        const active = o.value === value;
        return (
          <Pressable key={o.value} onPress={() => !disabled && onChange(o.value)} hitSlop={4}
            style={{
              flex: 1, height: h, borderRadius: 999,
              flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
              paddingHorizontal: SIZE_PX[size],
            }}>
            {o.icon}
            <Text style={{
              fontFamily: F.sansBold, fontSize: SIZE_FS[size],
              color: active ? TONE_FG[tone] : C.textMuted,
              letterSpacing: 0.6, textTransform: 'uppercase',
            }}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
