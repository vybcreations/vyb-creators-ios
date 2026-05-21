import React from 'react';
import { View, Text } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors as C, fonts as F } from '../../theme';

/**
 * FeaturedBadge — a single highlight chip a profile features near the top.
 * Replaces the bare "DEMO" chip on friend profiles and shows the user's
 * current marquee accomplishment on their own profile.
 *
 * Placeholder visuals for now: emoji + label inside a soft gold-tinted pill
 * with a subtle gradient. The real badge artwork system lands later.
 */

export type FeaturedBadgeData = {
  emoji: string;       // placeholder visual until real emblem art exists
  label: string;       // short title — "Momentum", "18-day streak", etc.
  sublabel?: string;   // optional supporting line — "writing every day"
};

export function FeaturedBadge({ badge }: { badge: FeaturedBadgeData }) {
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center', gap: 10,
      paddingLeft: 6, paddingRight: 14, paddingVertical: 6,
      borderRadius: 999,
      borderColor: 'rgba(201,169,97,0.45)', borderWidth: 1,
      backgroundColor: 'rgba(201,169,97,0.10)',
      overflow: 'hidden',
    }}>
      <LinearGradient
        colors={['rgba(232,200,120,0.30)', 'rgba(201,169,97,0.10)'] as any}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={{ position: 'absolute', inset: 0 as any }}
      />
      {/* Emblem disc */}
      <View style={{
        width: 26, height: 26, borderRadius: 13,
        backgroundColor: 'rgba(13,12,11,0.55)',
        borderColor: 'rgba(232,200,120,0.55)', borderWidth: 1,
        alignItems: 'center', justifyContent: 'center',
      }}>
        <Text style={{ fontSize: 13 }}>{badge.emoji}</Text>
      </View>
      <View>
        <Text style={{
          fontFamily: F.sansBold, fontSize: 11, color: '#E8C878',
          letterSpacing: 0.6, textTransform: 'uppercase',
        }}>
          {badge.label}
        </Text>
        {badge.sublabel && (
          <Text style={{
            fontFamily: F.serifItalic, fontSize: 10, color: C.textMuted, marginTop: 1,
          }}>
            {badge.sublabel}
          </Text>
        )}
      </View>
    </View>
  );
}
