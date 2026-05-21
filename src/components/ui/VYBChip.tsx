import React from 'react';
import { Pressable, Text, View, StyleProp, ViewStyle } from 'react-native';
import { colors as C, fonts as F, state as ST } from '../../theme';

/**
 * VYBChip — unified pill/chip primitive.
 *
 * Replaces: primitives.Pill, PriPill, SmallPill, ProjectPill, FilterChip,
 * PanelPill, ChipButton — all the tiny rounded "selectable label" surfaces
 * scattered across screens.
 *
 * Tones map to semantic state colors so callers don't hardcode hex.
 */

export type VYBChipTone = 'neutral' | 'gold' | 'sage' | 'urgent' | 'important' | 'later' | 'muted';
type Size = 'xs' | 'sm' | 'md' | 'lg';

const SIZE_H: Record<Size, number> = { xs: 22, sm: 26, md: 30, lg: 34 };
const SIZE_PX: Record<Size, number> = { xs: 8, sm: 10, md: 12, lg: 14 };
const SIZE_FS: Record<Size, number> = { xs: 9.5, sm: 10.5, md: 11.5, lg: 12 };

function paletteFor(tone: VYBChipTone, active: boolean) {
  // Inactive is always neutral so unselected chips read calm; active state
  // pulls the tone color forward.
  if (!active) return { bg: 'rgba(255,255,255,0.04)', border: C.borderSubtle, fg: C.textSecondary, dot: C.borderMid };
  switch (tone) {
    case 'gold':      return { bg: 'rgba(201,169,97,0.14)', border: 'rgba(201,169,97,0.45)', fg: C.gold, dot: C.gold };
    case 'sage':      return { bg: 'rgba(143,168,138,0.18)', border: 'rgba(143,168,138,0.5)', fg: ST.later, dot: ST.later };
    case 'urgent':    return { bg: 'rgba(210,112,80,0.16)', border: 'rgba(210,112,80,0.48)', fg: ST.urgent, dot: ST.urgent };
    case 'important': return { bg: 'rgba(201,169,97,0.14)', border: 'rgba(201,169,97,0.45)', fg: ST.important, dot: ST.important };
    case 'later':     return { bg: 'rgba(143,168,138,0.16)', border: 'rgba(143,168,138,0.45)', fg: ST.later, dot: ST.later };
    case 'muted':     return { bg: 'rgba(255,255,255,0.05)', border: C.borderSubtle, fg: C.textMuted, dot: C.textFaint };
    case 'neutral':
    default:          return { bg: C.bgOverlay, border: C.borderMid, fg: C.textPrimary, dot: C.textSecondary };
  }
}

export function VYBChip({
  label, selected = true, tone = 'neutral', size = 'sm',
  icon, dot, onPress, disabled, style,
}: {
  label: string;
  /** Whether the chip is in its active state. Defaults true so single-use
   *  badges (project tag, status) read correctly without extra props. */
  selected?: boolean;
  tone?: VYBChipTone;
  size?: Size;
  icon?: React.ReactNode;
  /** Show a small colored dot using the tone color. */
  dot?: boolean;
  onPress?: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const p = paletteFor(tone, selected);
  const Wrap: any = onPress ? Pressable : View;
  return (
    <Wrap
      onPress={onPress && !disabled ? onPress : undefined}
      hitSlop={onPress ? 4 : undefined}
      style={[{
        height: SIZE_H[size], paddingHorizontal: SIZE_PX[size], borderRadius: 999,
        backgroundColor: p.bg, borderColor: p.border, borderWidth: 1,
        flexDirection: 'row', alignItems: 'center', gap: 6,
        opacity: disabled ? 0.5 : 1,
      }, style]}
    >
      {dot && <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: p.dot }} />}
      {icon}
      <Text style={{ fontFamily: F.sansBold, fontSize: SIZE_FS[size], color: p.fg, letterSpacing: 0.3 }}>
        {label}
      </Text>
    </Wrap>
  );
}
