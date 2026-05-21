import React from 'react';
import { View, Text, Image, Pressable, StyleProp, ViewStyle } from 'react-native';
import { Crown } from 'lucide-react-native';
import { colors as C, fonts as F } from '../../theme';
import { VYBCard } from './VYBCard';
import { VYBPodium, PodiumEntry } from './VYBPodium';

/**
 * VYBLeaderboard — full leaderboard section.
 *
 * Renders the top-3 podium followed by the remaining participants. Pass an
 * `entries` array sorted by score DESC. Optional `title` + `subtitle` for
 * the header; `updatedLabel` for the "Updated 2h ago" line.
 *
 * Used by ChallengeDetail and any future challenge leaderboard surface.
 */

export type LeaderboardListEntry = PodiumEntry & {
  meta?: string;   // e.g. "Today ✓" for current-day check-in
};

export function VYBLeaderboard({
  entries,
  title,
  subtitle,
  updatedLabel,
  onOpenFull,
  style,
}: {
  entries: LeaderboardListEntry[];
  title?: string;
  subtitle?: string;
  updatedLabel?: string;
  onOpenFull?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const top3 = entries.slice(0, 3);
  const rest = entries.slice(3);

  return (
    <View style={style}>
      {(title || subtitle) && (
        <View style={{ alignItems: 'center', marginBottom: 4 }}>
          {title && (
            <Text style={{
              fontFamily: F.sansHeavy, fontSize: 18, color: C.textPrimary, letterSpacing: -0.3,
            }}>
              {title}
            </Text>
          )}
          {subtitle && (
            <Text style={{
              fontFamily: F.serifItalic, fontSize: 12.5, color: C.textMuted, marginTop: 2,
            }}>
              {subtitle}
            </Text>
          )}
        </View>
      )}

      {/* Top-3 podium — even if fewer than 3 entries, podium renders empty slots. */}
      <VYBPodium entries={[top3[0], top3[1], top3[2]]} />

      {updatedLabel && (
        <Text style={{
          fontFamily: F.mono, fontSize: 10, color: C.textFaint,
          textAlign: 'center', marginTop: 4, marginBottom: 14,
        }}>
          {updatedLabel}
        </Text>
      )}

      {/* Remaining participants */}
      {rest.length > 0 && (
        <VYBCard level="list">
          <View style={{
            paddingHorizontal: 14, paddingTop: 12, paddingBottom: 8,
            borderBottomColor: C.borderSubtle, borderBottomWidth: 1,
          }}>
            <Text style={{
              fontFamily: F.sansBold, fontSize: 10, color: C.textMuted,
              letterSpacing: 1.4, textTransform: 'uppercase',
            }}>
              Other Participants
            </Text>
          </View>
          {rest.map((e, i) => (
            <LeaderboardRow key={e.user_id ?? e.name + i} entry={e} rank={i + 4} />
          ))}
        </VYBCard>
      )}

      {onOpenFull && (
        <Pressable onPress={onOpenFull} hitSlop={4} style={{
          alignSelf: 'center', marginTop: 14,
          paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999,
          backgroundColor: 'rgba(255,255,255,0.04)',
          borderColor: C.borderSubtle, borderWidth: 1,
        }}>
          <Text style={{
            fontFamily: F.sansBold, fontSize: 11, color: C.textSecondary,
            letterSpacing: 0.4, textTransform: 'uppercase',
          }}>
            See full leaderboard
          </Text>
        </Pressable>
      )}
    </View>
  );
}

function LeaderboardRow({ entry, rank }: { entry: LeaderboardListEntry; rank: number }) {
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center', gap: 12,
      paddingHorizontal: 14, paddingVertical: 11,
      borderTopColor: C.borderSubtle, borderTopWidth: rank === 4 ? 0 : 1,
    }}>
      <View style={{ width: 22, alignItems: 'center' }}>
        {rank === 1 ? (
          <Crown size={14} color={C.gold} />
        ) : (
          <Text style={{ fontFamily: F.mono, fontSize: 11, color: C.textFaint }}>{rank}</Text>
        )}
      </View>
      <View style={{
        width: 30, height: 30, borderRadius: 15,
        backgroundColor: C.bgOverlay,
        borderColor: C.borderSubtle, borderWidth: 1,
        overflow: 'hidden', alignItems: 'center', justifyContent: 'center',
      }}>
        {entry.avatarUrl ? (
          <Image source={{ uri: entry.avatarUrl }} style={{ width: '100%', height: '100%' }} />
        ) : (
          <Text style={{ fontFamily: F.sansBold, fontSize: 12, color: C.textSecondary }}>
            {(entry.name[0] || '?').toUpperCase()}
          </Text>
        )}
      </View>
      <View style={{ flex: 1 }}>
        <Text numberOfLines={1} style={{
          fontFamily: F.sansBold, fontSize: 13, color: C.textPrimary,
        }}>
          {entry.name}
        </Text>
        {entry.meta && (
          <Text style={{
            fontFamily: F.sansBold, fontSize: 9.5, color: '#8FA88A',
            marginTop: 2, letterSpacing: 0.4, textTransform: 'uppercase',
          }}>
            {entry.meta}
          </Text>
        )}
      </View>
      <Text style={{ fontFamily: F.mono, fontSize: 12, color: C.textSecondary }}>
        {entry.unit ? `${entry.score} ${entry.unit}` : entry.score}
      </Text>
    </View>
  );
}
