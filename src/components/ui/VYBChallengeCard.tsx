import React from 'react';
import { View, Text, Pressable, StyleProp, ViewStyle } from 'react-native';
import { Lock, Trophy, Camera, CheckCircle2, ChevronRight } from 'lucide-react-native';
import { colors as C, fonts as F } from '../../theme';
import { VYBCard } from './VYBCard';
import { VYBAvatarStack, StackedAvatar } from './VYBAvatarStack';

/**
 * VYBChallengeCard — premium card for an active challenge.
 *
 * Sizes:
 *   - compact: short row variant (Dashboard active-challenges list).
 *   - medium:  taller card for Circle Detail challenges list.
 *
 * `accent` color comes from the challenge type theme (e.g.
 * challengeTypeTheme(...).accent). Keeps the look type-aware without
 * locking the card to one tone.
 */

type Size = 'compact' | 'medium';

export function VYBChallengeCard({
  title,
  circleName,
  endsIn,
  checkedInToday,
  participants,
  accent = C.gold,
  size = 'compact',
  onPress,
  onUploadProof,
  style,
}: {
  title: string;
  circleName?: string;
  endsIn?: string;           // e.g. "Ends in 4 days"
  checkedInToday?: boolean;
  participants?: StackedAvatar[];
  accent?: string;
  size?: Size;
  onPress?: () => void;
  onUploadProof?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  if (size === 'compact') {
    return (
      <Pressable onPress={onPress} style={style}>
        <View style={{
          borderRadius: 14, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12,
          backgroundColor: 'rgba(255,255,255,0.025)',
          borderColor: `${accent}33`, borderWidth: 1,
        }}>
          <View style={{
            width: 38, height: 38, borderRadius: 12,
            backgroundColor: 'rgba(255,255,255,0.04)',
            borderColor: `${accent}55`, borderWidth: 1,
            alignItems: 'center', justifyContent: 'center',
          }}>
            <Trophy size={16} color={accent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text numberOfLines={1} style={{ fontFamily: F.sansBold, fontSize: 13.5, color: C.textPrimary }}>{title}</Text>
            {circleName && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                <Text style={{ fontFamily: F.sans, fontSize: 10.5, color: C.textMuted }}>{circleName}</Text>
                <Lock size={8} color={C.textFaint} />
              </View>
            )}
          </View>
          {checkedInToday ? (
            <View style={{
              paddingHorizontal: 10, paddingVertical: 7, borderRadius: 999,
              backgroundColor: 'rgba(143,168,138,0.18)',
              borderColor: 'rgba(143,168,138,0.45)', borderWidth: 1,
              flexDirection: 'row', alignItems: 'center', gap: 4,
            }}>
              <CheckCircle2 size={11} color="#8FA88A" />
              <Text style={{ fontFamily: F.sansBold, fontSize: 10, color: '#8FA88A', letterSpacing: 0.4, textTransform: 'uppercase' }}>
                Checked in
              </Text>
            </View>
          ) : onUploadProof ? (
            <Pressable onPress={(e) => { e.stopPropagation(); onUploadProof(); }} hitSlop={4} style={{
              paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999,
              backgroundColor: C.goldFaint,
              borderColor: 'rgba(201,169,97,0.4)', borderWidth: 1,
              flexDirection: 'row', alignItems: 'center', gap: 4,
            }}>
              <Camera size={11} color={C.gold} />
              <Text style={{ fontFamily: F.sansBold, fontSize: 10, color: C.gold, letterSpacing: 0.4, textTransform: 'uppercase' }}>
                Upload
              </Text>
            </Pressable>
          ) : (
            <ChevronRight size={14} color={C.textFaint} />
          )}
        </View>
      </Pressable>
    );
  }

  // medium
  return (
    <VYBCard level="widget" accent="gold" padding={16} onPress={onPress} style={style}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{
          width: 44, height: 44, borderRadius: 14,
          backgroundColor: 'rgba(255,255,255,0.04)',
          borderColor: `${accent}55`, borderWidth: 1,
          alignItems: 'center', justifyContent: 'center',
        }}>
          <Trophy size={20} color={accent} />
        </View>
        <View style={{ flex: 1 }}>
          <Text numberOfLines={1} style={{
            fontFamily: F.sansHeavy, fontSize: 16, color: C.textPrimary, letterSpacing: -0.3,
          }}>
            {title}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 }}>
            {circleName && (
              <Text style={{ fontFamily: F.sans, fontSize: 11.5, color: C.textMuted }}>{circleName}</Text>
            )}
            {circleName && endsIn ? (
              <Text style={{ fontFamily: F.mono, fontSize: 10, color: C.textFaint }}>·</Text>
            ) : null}
            {endsIn && (
              <Text style={{ fontFamily: F.mono, fontSize: 10.5, color: C.textFaint }}>{endsIn}</Text>
            )}
          </View>
        </View>
        {checkedInToday && (
          <CheckCircle2 size={18} color="#8FA88A" />
        )}
      </View>

      {participants && participants.length > 0 && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14 }}>
          <VYBAvatarStack avatars={participants} size={22} overlap={8} max={4} />
          <Text style={{ fontFamily: F.mono, fontSize: 10.5, color: C.textMuted }}>
            {participants.length} {participants.length === 1 ? 'participant' : 'participants'}
          </Text>
        </View>
      )}

      {onUploadProof && !checkedInToday && (
        <Pressable onPress={onUploadProof} hitSlop={4} style={{
          marginTop: 14, alignSelf: 'flex-start',
          paddingHorizontal: 14, paddingVertical: 10, borderRadius: 999,
          backgroundColor: C.goldFaint,
          borderColor: 'rgba(201,169,97,0.4)', borderWidth: 1,
          flexDirection: 'row', alignItems: 'center', gap: 6,
        }}>
          <Camera size={13} color={C.gold} />
          <Text style={{ fontFamily: F.sansBold, fontSize: 11.5, color: C.gold, letterSpacing: 0.4, textTransform: 'uppercase' }}>
            Upload proof
          </Text>
        </Pressable>
      )}
    </VYBCard>
  );
}
