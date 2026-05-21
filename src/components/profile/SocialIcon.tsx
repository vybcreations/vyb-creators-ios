import React from 'react';
import { View, Text, Pressable, Linking, Alert } from 'react-native';
import Svg, { Path, Rect, Circle, Line } from 'react-native-svg';
import { colors as C, fonts as F } from '../../theme';
import { hLight } from '../../lib/haptics';

/**
 * Premium social pill: real brand glyph (SVG) + handle.
 * Used on both user profile and friend profile.
 *
 * We draw the glyphs inline with react-native-svg (already a dep) instead of
 * pulling a brand-icon font package — keeps bundle slim and we control the
 * stroke weight to match the rest of the UI.
 */

export type SocialPlatform = 'instagram' | 'youtube' | 'twitter' | 'tiktok' | 'linkedin';

export function SocialGlyph({
  platform, size = 14, color = C.textPrimary,
}: { platform: SocialPlatform; size?: number; color?: string }) {
  switch (platform) {
    case 'instagram':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Rect x="3" y="3" width="18" height="18" rx="5" stroke={color} strokeWidth="1.8" />
          <Circle cx="12" cy="12" r="4" stroke={color} strokeWidth="1.8" />
          <Circle cx="17.5" cy="6.5" r="1.1" fill={color} />
        </Svg>
      );
    case 'youtube':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Rect x="2" y="5" width="20" height="14" rx="4" stroke={color} strokeWidth="1.8" />
          <Path d="M10.5 9.5 L15 12 L10.5 14.5 Z" fill={color} />
        </Svg>
      );
    case 'twitter':
      // X (current logo) — two diagonal strokes.
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Line x1="4" y1="4" x2="20" y2="20" stroke={color} strokeWidth="2.2" strokeLinecap="round" />
          <Line x1="20" y1="4" x2="4" y2="20" stroke={color} strokeWidth="2.2" strokeLinecap="round" />
        </Svg>
      );
    case 'tiktok':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path
            d="M14 3 V14.5 a3.5 3.5 0 1 1 -3.5 -3.5"
            stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
          />
          <Path d="M14 3 c0.5 2.5 2.5 4 5 4" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
        </Svg>
      );
    case 'linkedin':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Rect x="3" y="3" width="18" height="18" rx="3" stroke={color} strokeWidth="1.8" />
          <Rect x="6.5" y="10" width="2" height="7.5" fill={color} />
          <Circle cx="7.5" cy="7" r="1.2" fill={color} />
          <Path d="M11 17.5 V10 h2 v1 c0.6 -0.8 1.6 -1.2 2.6 -1.2 c2 0 2.9 1.3 2.9 3.3 V17.5 h-2 V13.5 c0 -1.1 -0.5 -1.8 -1.5 -1.8 c-1.1 0 -1.7 0.8 -1.7 1.9 V17.5 Z"
            fill={color} />
        </Svg>
      );
  }
}

/**
 * Compact icon-only social button — the default profile presentation.
 * Removed the handle text per design pass: repeating the same handle across
 * platforms reads as visual noise. The platform glyph alone is enough.
 *
 * `handle` is still accepted (and used as the accessibility label) so callers
 * upstream can keep passing the data even when not rendered.
 */
export function SocialPill({
  platform, handle, url,
}: { platform: SocialPlatform; handle?: string; url: string }) {
  const onPress = () => {
    hLight();
    Linking.openURL(url).catch(() => Alert.alert('Could not open', url));
  };
  return (
    <Pressable
      onPress={onPress} hitSlop={6}
      accessibilityRole="link"
      accessibilityLabel={handle ? `${platform} — ${handle}` : platform}
      style={{
        width: 38, height: 38, borderRadius: 19,
        alignItems: 'center', justifyContent: 'center',
        backgroundColor: C.bgElevated,
        borderColor: C.borderSubtle, borderWidth: 1,
      }}>
      <SocialGlyph platform={platform} size={15} color={C.textSecondary} />
    </Pressable>
  );
}
