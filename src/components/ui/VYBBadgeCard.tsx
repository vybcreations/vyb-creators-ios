import React from 'react';
import { View, Text, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { LucideIcon } from 'lucide-react-native';
import { BlurView } from 'expo-blur';
import { colors as C, fonts as F } from '../../theme';
import { VYBGridBeamCard } from './VYBGridBeamCard';

/**
 * VYBBadgeCard — tiered achievement card. Same proportions as the
 * "Current Highlight" card on Profile, but the visual treatment scales with
 * tier so rarer badges feel more alive.
 *
 * Tiers (from quiet → loud):
 *   - locked    → glass surface, muted icon, no animation. Greyed.
 *   - common    → glass surface, faint sand border. Static.
 *   - rare      → VYBGridBeamCard with subtle sand beam.
 *   - epic      → VYBGridBeamCard sage/normal — beam more present.
 *   - legendary → strongest VYBGridBeamCard + brighter gold border.
 *
 * The card content is always the same shape: icon · name · description ·
 * progress count · progress bar. That way the user reads them as a single
 * family — the *tier* is what changes brightness and color, not the layout.
 */

export type BadgeTier = 'locked' | 'common' | 'rare' | 'epic' | 'legendary';

export function VYBBadgeCard({
  name, description, icon: Icon, have, goal, tier, style,
}: {
  name: string;
  description: string;
  icon: LucideIcon;
  have: number;
  goal: number;
  tier: BadgeTier;
  style?: StyleProp<ViewStyle>;
}) {
  const pct = Math.min(100, Math.round((have / goal) * 100));
  const done = have >= goal;

  // Tier-specific color and emphasis tokens. Keep the layout identical so
  // the family feels cohesive — only color/glow changes.
  const palette = {
    locked:    { iconColor: C.textFaint,     nameColor: C.textMuted,    countColor: C.textMuted,    barColor: C.borderSubtle, beamOpacity: 0 },
    common:    { iconColor: C.textMuted,     nameColor: C.textPrimary,  countColor: C.textPrimary,  barColor: 'rgba(201,169,97,0.45)', beamOpacity: 0 },
    rare:      { iconColor: C.gold,          nameColor: C.textPrimary,  countColor: C.textPrimary,  barColor: C.gold, beamOpacity: 1 },
    epic:      { iconColor: C.goldBright,    nameColor: C.goldBright,   countColor: C.goldBright,   barColor: C.goldBright, beamOpacity: 1 },
    legendary: { iconColor: C.goldBright,    nameColor: C.goldBright,   countColor: C.goldBright,   barColor: C.goldBright, beamOpacity: 1 },
  }[tier];

  const inner = (
    <View style={{ padding: 14 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Icon size={13} color={palette.iconColor} />
        <Text style={{ fontFamily: F.sansBold, fontSize: 12, color: palette.nameColor, letterSpacing: 0.2 }}>
          {name}
        </Text>
      </View>
      <Text style={{ fontFamily: F.sans, fontSize: 10.5, color: C.textMuted, marginTop: 4 }}>
        {description}
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: 10 }}>
        <Text style={{ fontFamily: F.sansHeavy, fontSize: 18, color: palette.countColor, letterSpacing: -0.3 }}>
          {Math.min(have, goal)}
        </Text>
        <Text style={{ fontFamily: F.mono, fontSize: 11, color: C.textMuted, marginLeft: 3 }}>
          / {goal}
        </Text>
        {done && (
          <Text style={{
            fontFamily: F.sansBold, fontSize: 9, color: palette.iconColor,
            marginLeft: 'auto', letterSpacing: 1.2, textTransform: 'uppercase',
          }}>
            {tier === 'legendary' ? '★ ★ ★' : tier === 'epic' ? '★ ★' : '★'}
          </Text>
        )}
      </View>
      <View style={{
        height: 3, backgroundColor: C.borderSubtle, borderRadius: 2,
        overflow: 'hidden', marginTop: 8, alignSelf: 'stretch',
      }}>
        <View style={{ width: `${pct}%`, height: '100%', backgroundColor: palette.barColor }} />
      </View>
    </View>
  );

  // ─── Render shell varies by tier ────────────────────────────────────────
  switch (tier) {
    case 'locked':
      return (
        <View style={[styles.shell, { backgroundColor: C.bgElevated, borderColor: C.borderSubtle, opacity: 0.55 }, style]}>
          {inner}
        </View>
      );

    case 'common':
      return (
        <View style={[styles.shell, { backgroundColor: C.bgElevated, borderColor: 'rgba(201,169,97,0.18)' }, style]}>
          {inner}
        </View>
      );

    case 'rare':
      return (
        <VYBGridBeamCard variant="sand" intensity="subtle" borderRadius={14} style={style}>
          {inner}
        </VYBGridBeamCard>
      );

    case 'epic':
      return (
        <VYBGridBeamCard variant="sand" intensity="normal" borderRadius={14} style={style}>
          {inner}
        </VYBGridBeamCard>
      );

    case 'legendary':
      // Highest tier — strongest grid beam + bright gold border so it reads
      // as the apex of the family even without the (removed) liquid layer.
      return (
        <VYBGridBeamCard variant="sand" intensity="strong" borderRadius={14}
          style={[{ borderColor: 'rgba(232,194,117,0.55)', borderWidth: 1.5 }, style] as any}>
          {inner}
        </VYBGridBeamCard>
      );
  }
}

const styles = StyleSheet.create({
  shell: {
    borderRadius: 14,
    borderWidth: 1,
  },
});
