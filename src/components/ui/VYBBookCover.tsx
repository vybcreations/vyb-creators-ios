import React from 'react';
import { View, Text, Image, StyleProp, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path as SvgPath } from 'react-native-svg';
import { colors as C, fonts as F } from '../../theme';

/**
 * VYBBookCover — single book-cover component for every reading surface.
 *
 * Replaces: primitives.BookCover, ReadingScreen.Cover, HomeScreen.BookCoverThumb,
 * FriendDetailScreen.BookCoverMini, ProfileScreen.FavoriteCover,
 * FavoritePickerSheet.MiniCover, and is the static counterpart to BookCover3D
 * (which stays for the interactive 3D variant).
 *
 * Sizes are tuned to 2:3 cover ratio. `favorite` adds the subtle gold frame
 * + star badge used in the Reading library.
 */

type Size = 'xs' | 'sm' | 'md' | 'lg' | 'hero';

const DIMENSIONS: Record<Size, { w: number; h: number; radius: number }> = {
  xs:   { w: 40,  h: 60,  radius: 6  },
  sm:   { w: 64,  h: 92,  radius: 8  },
  md:   { w: 88,  h: 132, radius: 10 },
  lg:   { w: 110, h: 165, radius: 12 },
  hero: { w: 140, h: 210, radius: 14 },
};

export function VYBBookCover({
  coverUrl, title, author,
  size = 'md', favorite, fallback,
  width, height,
  showTitle = false, showAuthor = false, style,
}: {
  coverUrl?: string | null;
  title?: string;
  author?: string | null;
  size?: Size;
  favorite?: boolean;
  /** Custom fallback element when no coverUrl. Defaults to initials gradient. */
  fallback?: React.ReactNode;
  /** Override the preset width/height — useful for responsive grids. */
  width?: number;
  height?: number;
  showTitle?: boolean;
  showAuthor?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const preset = DIMENSIONS[size];
  const dims = {
    w: width ?? preset.w,
    h: height ?? preset.h,
    radius: preset.radius,
  };
  const frame = favorite
    ? { borderColor: 'rgba(201,169,97,0.65)', borderWidth: 1.5 }
    : { borderColor: 'rgba(201,169,97,0.20)', borderWidth: 1 };

  const initials = (title || '').match(/\b\w/g)?.slice(0, 2).join('').toUpperCase() || '—';

  const cover = (
    <View style={{ width: dims.w, height: dims.h, position: 'relative' }}>
      {coverUrl ? (
        <Image source={{ uri: coverUrl }} resizeMode="cover"
          style={{
            width: dims.w, height: dims.h, borderRadius: dims.radius,
            backgroundColor: C.bgOverlay, ...frame,
            shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 12, shadowOffset: { width: 0, height: 6 },
          }} />
      ) : (
        <View style={{
          width: dims.w, height: dims.h, borderRadius: dims.radius, overflow: 'hidden',
          backgroundColor: C.bgElevated, ...frame,
          shadowColor: '#000', shadowOpacity: 0.32, shadowRadius: 10, shadowOffset: { width: 0, height: 4 },
        }}>
          {fallback ?? (
            <LinearGradient
              colors={['rgba(201,169,97,0.22)', 'rgba(28,28,34,0.95)']}
              start={{ x: 0.2, y: 0 }} end={{ x: 1, y: 1 }}
              style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 6 }}
            >
              <Text style={{
                fontFamily: F.sansHeavy, fontSize: Math.max(16, dims.w * 0.32),
                color: 'rgba(244,240,232,0.85)', letterSpacing: -0.5,
              }}>
                {initials}
              </Text>
            </LinearGradient>
          )}
        </View>
      )}
      {favorite && (
        <View style={{
          position: 'absolute', top: 6, right: 6,
          width: 22, height: 22, borderRadius: 11,
          backgroundColor: 'rgba(13,12,11,0.7)',
          borderColor: 'rgba(201,169,97,0.5)', borderWidth: 1,
          alignItems: 'center', justifyContent: 'center',
        }}>
          <Svg width={10} height={10} viewBox="0 0 24 24">
            <SvgPath
              d="M12 2l3 7h7l-5.5 4 2 7L12 16l-6.5 4 2-7L2 9h7z"
              fill={C.gold} stroke={C.gold} strokeWidth={1.2}
            />
          </Svg>
        </View>
      )}
    </View>
  );

  if (!showTitle && !showAuthor) return <View style={style}>{cover}</View>;
  return (
    <View style={[{ width: dims.w }, style]}>
      {cover}
      {showTitle && title && (
        <Text numberOfLines={2} style={{
          fontFamily: F.sansBold, fontSize: Math.max(10, dims.w * 0.12),
          color: C.textPrimary, marginTop: 6, lineHeight: Math.max(13, dims.w * 0.15),
        }}>
          {title}
        </Text>
      )}
      {showAuthor && author && (
        <Text numberOfLines={1} style={{
          fontFamily: F.serifItalic, fontSize: Math.max(9, dims.w * 0.10),
          color: C.textMuted, marginTop: 1,
        }}>
          {author}
        </Text>
      )}
    </View>
  );
}
