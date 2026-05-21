import React from 'react';
import { View, Text, Image, Pressable, StyleProp, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Lock, Users } from 'lucide-react-native';
import { colors as C, fonts as F } from '../../theme';
import { VYBAvatarStack, StackedAvatar } from './VYBAvatarStack';

/**
 * VYBCircleCard — visual card for a circle / private group.
 *
 * Two sizes:
 *   - `grid`   (default) used in a 2-column grid — taller, cover-led.
 *   - `wide`   for a full-width featured row (used on Circle Detail headers).
 *
 * Backdrop: cover image when present, otherwise a premium sage gradient
 * with the circle's initial. Title sits on a left-fade dark gradient so it
 * stays readable over any image.
 */

type Size = 'grid' | 'wide';

export function VYBCircleCard({
  name,
  imageUrl,
  description,
  memberCount,
  purposeLabel,
  members,
  size = 'grid',
  isPrivate = true,
  onPress,
  style,
}: {
  name: string;
  imageUrl?: string | null;
  description?: string | null;
  memberCount: number;
  purposeLabel?: string | null;
  members?: StackedAvatar[];
  size?: Size;
  isPrivate?: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const isGrid = size === 'grid';
  const HEIGHT = isGrid ? 200 : 156;
  const initials =
    (name.match(/\b\w/g) || []).slice(0, 2).join('').toUpperCase() || 'C';

  return (
    <Pressable onPress={onPress} hitSlop={2} style={style}>
      <View style={{
        height: HEIGHT, borderRadius: 24, overflow: 'hidden',
        backgroundColor: C.bgElevated,
        borderColor: 'rgba(143,168,138,0.20)', borderWidth: 1,
        shadowColor: '#000', shadowOpacity: 0.32, shadowRadius: 16, shadowOffset: { width: 0, height: 8 },
      }}>
        {/* Cover */}
        {imageUrl ? (
          <Image source={{ uri: imageUrl }}
            style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}
            resizeMode="cover" />
        ) : (
          <LinearGradient
            colors={['rgba(143,168,138,0.55)', 'rgba(50,72,58,0.95)', 'rgba(28,34,30,1)']}
            start={{ x: 0.9, y: 0 }} end={{ x: 0.1, y: 1 }}
            style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0,
                     alignItems: 'flex-end', justifyContent: 'center', paddingRight: 18 }}>
            <Text style={{
              fontFamily: F.sansHeavy, fontSize: isGrid ? 84 : 64,
              color: 'rgba(244,240,232,0.30)', letterSpacing: -1.5,
            }}>
              {initials}
            </Text>
          </LinearGradient>
        )}

        {/* Bottom dark gradient — keeps text legible */}
        <LinearGradient pointerEvents="none"
          colors={['rgba(8,8,10,0)', 'rgba(8,8,10,0.55)', 'rgba(8,8,10,0.92)']}
          locations={[0, 0.45, 1]}
          start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
          style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: '70%' }}
        />

        {/* Private lock */}
        {isPrivate && (
          <View style={{
            position: 'absolute', top: 12, right: 12,
            width: 28, height: 28, borderRadius: 14,
            backgroundColor: 'rgba(13,12,11,0.55)',
            borderColor: 'rgba(244,240,232,0.18)', borderWidth: 1,
            alignItems: 'center', justifyContent: 'center',
          }}>
            <Lock size={11} color="rgba(244,240,232,0.85)" />
          </View>
        )}

        {/* Purpose chip — top-left */}
        {purposeLabel && (
          <View style={{
            position: 'absolute', top: 12, left: 12,
            paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999,
            backgroundColor: 'rgba(13,12,11,0.55)',
            borderColor: 'rgba(143,168,138,0.45)', borderWidth: 1,
          }}>
            <Text style={{
              fontFamily: F.sansBold, fontSize: 9, color: '#A8C0A2',
              letterSpacing: 0.7, textTransform: 'uppercase',
            }}>
              {purposeLabel}
            </Text>
          </View>
        )}

        {/* Bottom text block */}
        <View style={{
          position: 'absolute', left: 14, right: 14, bottom: 12,
        }}>
          <Text numberOfLines={1} style={{
            fontFamily: F.sansHeavy, fontSize: isGrid ? 17 : 22,
            color: '#F4F0E8', letterSpacing: -0.3,
            textShadowColor: 'rgba(0,0,0,0.35)', textShadowRadius: 6, textShadowOffset: { width: 0, height: 2 },
          }}>
            {name}
          </Text>
          {description && !isGrid && (
            <Text numberOfLines={1} style={{
              fontFamily: F.serifItalic, fontSize: 12.5,
              color: 'rgba(244,240,232,0.78)', marginTop: 3,
            }}>
              {description}
            </Text>
          )}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 }}>
            {members && members.length > 0 ? (
              <VYBAvatarStack avatars={members} size={20} overlap={7} max={4} extra={false} />
            ) : (
              <Users size={11} color="rgba(244,240,232,0.65)" />
            )}
            <Text style={{
              fontFamily: F.mono, fontSize: 10.5, color: 'rgba(244,240,232,0.75)',
            }}>
              {memberCount} {memberCount === 1 ? 'member' : 'members'}
            </Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}
