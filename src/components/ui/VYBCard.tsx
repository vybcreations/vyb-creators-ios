import React, { ReactNode } from 'react';
import { View, Pressable, StyleProp, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors as C, radius as R } from '../../theme';

/**
 * VYBCard — single card primitive that codifies the app's three card levels.
 *
 *   Level 1 — "hero"    Used for the most important card on a screen.
 *                       Stronger gradient, more depth, more presence.
 *                       Examples: Aura State, Circle header, Featured
 *                       Highlight, Reading Now, active Challenge hero.
 *
 *   Level 2 — "widget"  Used for compact modules with progress / action.
 *                       Soft gradient, top inner highlight, warm shadow,
 *                       optional accent tint via `accent`.
 *                       Examples: Dashboard widgets, reading card on Home,
 *                       challenge cards, circle preview cards.
 *
 *   Level 3 — "list"    Used for clean rows / utility containers.
 *                       Faint surface, subtle border, no gradient noise.
 *                       Examples: members lists, proof feed rows, task
 *                       lists, habit lists, settings rows, recent activity.
 *
 *   Level "flat"        Background-only container with no decoration.
 *                       For grouping without visual weight.
 *
 * Use `level` to pick the visual treatment. Use `accent` (any level) to
 * tint the surface with a brand color — keeps the look cohesive without
 * inventing one-off card styles per screen.
 *
 * Migration plan (Phase 2+):
 *   - Replace ad-hoc `<View style={{ backgroundColor: 'rgba(255,255,255,...
 *     borderColor: C.borderSubtle, borderWidth: 1 }}>` with `<VYBCard level="list">`.
 *   - Replace the inline WidgetCard helper in HomeScreen with `<VYBCard level="widget">`.
 *   - Hero usage: keep VYBGlowCard for now where it already shines; can
 *     migrate to `<VYBCard level="hero">` if we want a calmer hero variant.
 */

export type VYBCardLevel = 'hero' | 'widget' | 'list' | 'flat';
export type VYBCardAccent = 'gold' | 'sage' | 'coral' | 'blue' | 'violet' | 'cream' | 'none';

const ACCENT_RGB: Record<Exclude<VYBCardAccent, 'none'>, string> = {
  gold:   '201,169,97',
  sage:   '143,168,138',
  coral:  '210,112,80',
  blue:   '93,163,201',
  violet: '159,143,212',
  cream:  '244,240,232',
};

export function VYBCard({
  children,
  level = 'list',
  accent = 'none',
  glow,
  padding,
  style,
  contentStyle,
  onPress,
  disabled,
}: {
  children: ReactNode;
  level?: VYBCardLevel;
  accent?: VYBCardAccent;
  /** Alias for `accent` — kept so call-sites can read more naturally
   *  ("a gold glow widget"). Wins over `accent` when both are passed. */
  glow?: VYBCardAccent;
  padding?: number;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  /** When provided, the card renders inside a Pressable. */
  onPress?: () => void;
  disabled?: boolean;
}) {
  const resolvedAccent = glow ?? accent;
  const accentRGB = resolvedAccent !== 'none' ? ACCENT_RGB[resolvedAccent] : null;

  // Visual scale per level. Tweak in one place — every card in the app
  // re-styles itself.
  // VYB v2 radii: organic and rounded, never sharp. Hero = generous;
  // utility lists still rounded, never visually square.
  const VISUALS = {
    hero:   { bg: 'rgba(255,255,255,0.045)', radius: R.lg, padding: 18, shadow: 0.25, highlight: 0.12, highlightH: 26 },
    widget: { bg: 'rgba(255,255,255,0.035)', radius: R.md, padding: 14, shadow: 0.18, highlight: 0.10, highlightH: 22 },
    list:   { bg: 'rgba(255,255,255,0.025)', radius: R.md, padding: 0,  shadow: 0.10, highlight: 0,    highlightH: 0  },
    flat:   { bg: 'transparent',             radius: R.sm, padding: 0,  shadow: 0,    highlight: 0,    highlightH: 0  },
  }[level];

  const containerStyle: ViewStyle = {
    borderRadius: VISUALS.radius,
    overflow: 'hidden',
    backgroundColor: VISUALS.bg,
    borderColor: accentRGB ? `rgba(${accentRGB},0.18)` : C.borderSubtle,
    borderWidth: level === 'flat' ? 0 : 1,
    ...(VISUALS.shadow > 0 ? {
      shadowColor: accentRGB ? `rgb(${accentRGB})` : '#000',
      shadowOpacity: accentRGB ? Math.min(0.12, VISUALS.shadow * 0.6) : VISUALS.shadow,
      shadowRadius: level === 'hero' ? 20 : 14,
      shadowOffset: { width: 0, height: level === 'hero' ? 10 : 6 },
    } : {}),
  };

  const Wrap: any = onPress ? Pressable : View;
  const wrapProps = onPress
    ? { onPress: disabled ? undefined : onPress, disabled, style: ({ pressed }: any) => [
        containerStyle, style, pressed && !disabled ? { opacity: 0.94 } : null,
      ] }
    : { style: [containerStyle, style] };

  return (
    <Wrap {...wrapProps}>
      {/* Accent tint wash — very faint, only when accent is set. */}
      {accentRGB && level !== 'flat' && (
        <LinearGradient
          pointerEvents="none"
          colors={[`rgba(${accentRGB},${level === 'hero' ? 0.10 : 0.06})`, 'rgba(0,0,0,0)']}
          start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
          style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}
        />
      )}
      {/* Top inner highlight — light-from-above. Hero + widget only. */}
      {VISUALS.highlightH > 0 && (
        <LinearGradient
          pointerEvents="none"
          colors={[`rgba(255,255,255,${VISUALS.highlight})`, 'rgba(255,255,255,0)']}
          start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
          style={{ position: 'absolute', left: 0, right: 0, top: 0, height: VISUALS.highlightH }}
        />
      )}
      <View style={[{ padding: padding ?? VISUALS.padding }, contentStyle]}>
        {children}
      </View>
    </Wrap>
  );
}
