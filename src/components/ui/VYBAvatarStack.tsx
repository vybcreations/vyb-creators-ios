import React from 'react';
import { View, Text, Image, StyleProp, ViewStyle } from 'react-native';
import { colors as C, fonts as F } from '../../theme';

/**
 * VYBAvatarStack — overlapping mini avatars cluster.
 *
 * Reusable in: circle member previews, challenge participant strip, friends
 * row, leaderboard "other participants" preview.
 */

export type StackedAvatar = {
  url?: string | null;
  name?: string;
};

export function VYBAvatarStack({
  avatars, size = 26, overlap = 9, max = 5, extra = true, style,
}: {
  avatars: StackedAvatar[];
  size?: number;
  overlap?: number;
  max?: number;
  /** If true, show a "+N" disc when avatars.length > max. */
  extra?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const shown = avatars.slice(0, max);
  const remaining = avatars.length - shown.length;
  const ringColor = C.bgBase;

  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center' }, style]}>
      {shown.map((a, i) => {
        const initials = (a.name || '').match(/\b\w/g)?.slice(0, 1).join('').toUpperCase() || '?';
        return (
          <View
            key={i}
            style={{
              width: size, height: size, borderRadius: size / 2,
              marginLeft: i === 0 ? 0 : -overlap,
              backgroundColor: C.bgOverlay,
              borderColor: ringColor, borderWidth: 2,
              alignItems: 'center', justifyContent: 'center',
              overflow: 'hidden', zIndex: 100 - i,
            }}
          >
            {a.url ? (
              <Image source={{ uri: a.url }} style={{ width: '100%', height: '100%' }} />
            ) : (
              <Text style={{
                fontFamily: F.sansBold,
                fontSize: size * 0.42,
                color: C.textSecondary,
              }}>
                {initials}
              </Text>
            )}
          </View>
        );
      })}
      {extra && remaining > 0 && (
        <View
          style={{
            width: size, height: size, borderRadius: size / 2,
            marginLeft: -overlap,
            backgroundColor: C.bgElevated,
            borderColor: ringColor, borderWidth: 2,
            alignItems: 'center', justifyContent: 'center',
            zIndex: 0,
          }}
        >
          <Text style={{
            fontFamily: F.sansBold,
            fontSize: size * 0.36,
            color: C.textMuted, letterSpacing: 0,
          }}>
            +{remaining}
          </Text>
        </View>
      )}
    </View>
  );
}
