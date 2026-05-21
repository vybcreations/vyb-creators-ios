import React from 'react';
import { View, Text, Image, StyleProp, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Crown } from 'lucide-react-native';
import { colors as C, fonts as F } from '../../theme';

/**
 * VYBPodium — top-3 leaderboard pattern.
 *
 * #1 sits taller / centered with a crown; #2 is shorter on the left, #3
 * shorter on the right. Each step is a gold-tinted block (column) with the
 * avatar floating above. Designed for the leaderboard header inside
 * ChallengeDetail and any future leaderboard screen.
 */

export type PodiumEntry = {
  user_id?: string;
  name: string;
  avatarUrl?: string | null;
  score: number;
  unit?: string;   // e.g. "steps", "check-ins"
};

export function VYBPodium({
  entries, style,
}: {
  /** Order: #1 #2 #3 (positionally). Pass at most 3 entries. */
  entries: (PodiumEntry | null | undefined)[];
  style?: StyleProp<ViewStyle>;
}) {
  const first  = entries[0];
  const second = entries[1];
  const third  = entries[2];

  // Layout order on screen: 2nd · 1st · 3rd
  const COLS = [
    { entry: second, rank: 2, height: 76, avatar: 52, accent: 'rgba(255,255,255,0.12)' },
    { entry: first,  rank: 1, height: 104, avatar: 64, accent: 'rgba(201,169,97,0.5)' },
    { entry: third,  rank: 3, height: 58, avatar: 48, accent: 'rgba(184,100,60,0.4)' },
  ];

  return (
    <View style={[{
      flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center',
      gap: 14, paddingTop: 28, paddingBottom: 8,
    }, style]}>
      {COLS.map((col, idx) => {
        const e = col.entry;
        return (
          <View key={idx} style={{ flex: 1, alignItems: 'center' }}>
            {/* Avatar with optional crown */}
            <View style={{ position: 'relative', marginBottom: 10 }}>
              {col.rank === 1 && (
                <View style={{
                  position: 'absolute', top: -22, alignSelf: 'center', left: 0, right: 0,
                  alignItems: 'center',
                }}>
                  <Crown size={20} color={C.goldBright} />
                </View>
              )}
              <View style={{
                width: col.avatar, height: col.avatar, borderRadius: col.avatar / 2,
                backgroundColor: C.bgOverlay,
                borderColor: col.rank === 1 ? C.goldBright : col.accent,
                borderWidth: col.rank === 1 ? 2 : 1.5,
                overflow: 'hidden', alignItems: 'center', justifyContent: 'center',
                shadowColor: col.rank === 1 ? '#E8C275' : '#000',
                shadowOpacity: col.rank === 1 ? 0.45 : 0.3,
                shadowRadius: col.rank === 1 ? 16 : 8,
                shadowOffset: { width: 0, height: col.rank === 1 ? 4 : 2 },
              }}>
                {e?.avatarUrl ? (
                  <Image source={{ uri: e.avatarUrl }} style={{ width: '100%', height: '100%' }} />
                ) : (
                  <Text style={{
                    fontFamily: F.sansBold,
                    fontSize: col.avatar * 0.42,
                    color: C.textSecondary,
                  }}>
                    {((e?.name?.[0]) || '?').toUpperCase()}
                  </Text>
                )}
              </View>
            </View>

            {/* Name + score */}
            <Text numberOfLines={1} style={{
              fontFamily: F.sansBold, fontSize: col.rank === 1 ? 13 : 12,
              color: e ? C.textPrimary : C.textFaint, letterSpacing: -0.1,
              textAlign: 'center', maxWidth: col.avatar + 12,
            }}>
              {e?.name || '—'}
            </Text>
            <Text style={{
              fontFamily: F.mono, fontSize: 11,
              color: col.rank === 1 ? C.goldBright : C.textMuted,
              marginTop: 2,
            }}>
              {e ? formatScore(e.score, e.unit) : ''}
            </Text>

            {/* Podium column */}
            <View style={{
              marginTop: 10, width: '100%', height: col.height, borderRadius: 16,
              overflow: 'hidden',
              borderColor: col.rank === 1 ? 'rgba(201,169,97,0.4)' : C.borderSubtle,
              borderWidth: 1,
              backgroundColor: 'rgba(255,255,255,0.025)',
              alignItems: 'center', justifyContent: 'center',
            }}>
              {col.rank === 1 ? (
                <LinearGradient
                  colors={['rgba(232,194,117,0.22)', 'rgba(140,115,64,0.10)', 'rgba(0,0,0,0)']}
                  start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
                  style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}
                />
              ) : null}
              <Text style={{
                fontFamily: F.sansHeavy,
                fontSize: col.rank === 1 ? 22 : 18,
                color: col.rank === 1 ? C.goldBright : C.textMuted,
                letterSpacing: -0.4,
              }}>
                {col.rank}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

function formatScore(n: number, unit?: string): string {
  if (!unit) return String(n);
  return `${n} ${unit}`;
}
