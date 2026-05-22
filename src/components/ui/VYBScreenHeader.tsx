import React from 'react';
import { View, Text, Pressable, Image, StyleProp, ViewStyle, ImageSourcePropType } from 'react-native';
import { ChevronLeft } from 'lucide-react-native';
import { colors as C, fonts as F } from '../../theme';

/**
 * VYBScreenHeader — shared screen-top header.
 *
 * Replaces the raw <View> headers each screen builds today (back button +
 * title + right action). Variants:
 *
 *   - default:   back + editorial title, optional subtitle, optional right action
 *   - dashboard: logo + greeting/subtitle, no back (used by Home)
 *   - detail:    back + status label centered + right action (Book/Challenge detail)
 *   - profile:   editorial heading, no chrome (Profile-style)
 *
 * Doesn't include SafeAreaView — screens already wrap their content in one,
 * so we keep this composable.
 */

type Variant = 'default' | 'dashboard' | 'detail' | 'profile';

export function VYBScreenHeader({
  title, subtitle, back, onBack, rightAction, logo, avatar,
  variant = 'default', style,
}: {
  title?: string;
  subtitle?: string;
  back?: boolean;
  onBack?: () => void;
  rightAction?: React.ReactNode;
  logo?: ImageSourcePropType;
  avatar?: React.ReactNode;
  variant?: Variant;
  style?: StyleProp<ViewStyle>;
}) {
  if (variant === 'dashboard') {
    return (
      <View style={[{
        paddingHorizontal: 20, paddingTop: 10, paddingBottom: 10,
        flexDirection: 'row', alignItems: 'center', gap: 16,
      }, style]}>
        {logo && (
          <Image source={logo} style={{ width: 84, height: 56 }} resizeMode="contain" />
        )}
        {(title || subtitle) && (
          <>
            <View style={{ width: 1, height: 46, backgroundColor: 'rgba(244,240,232,0.18)' }} />
            <View style={{ flex: 1 }}>
              {title && (
                <Text numberOfLines={1} style={{
                  fontFamily: F.serifItalic, fontSize: 22, color: C.textPrimary, letterSpacing: -0.4,
                }}>
                  {title}
                </Text>
              )}
              {subtitle && (
                <Text numberOfLines={2} style={{
                  fontFamily: F.serifItalic, fontSize: 12, color: C.textMuted,
                  marginTop: 3, lineHeight: 16,
                }}>
                  {subtitle}
                </Text>
              )}
            </View>
          </>
        )}
        {rightAction}
      </View>
    );
  }

  if (variant === 'detail') {
    // Absolute-centered title — guarantees the label sits at the true
    // screen midpoint, regardless of how wide the left back button or the
    // right action cluster end up being.
    return (
      <View style={[{
        paddingHorizontal: 8, paddingVertical: 4, height: 44,
        justifyContent: 'center',
      }, style]}>
        {title && (
          <View pointerEvents="none" style={{
            position: 'absolute', left: 0, right: 0, top: 0, bottom: 0,
            alignItems: 'center', justifyContent: 'center',
          }}>
            <Text style={{
              fontFamily: F.sansBold, fontSize: 10, color: C.textMuted,
              letterSpacing: 1.4, textTransform: 'uppercase',
            }}>
              {title}
            </Text>
          </View>
        )}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          {back ? (
            <Pressable onPress={onBack} hitSlop={8} style={{
              width: 36, height: 36, borderRadius: 18,
              alignItems: 'center', justifyContent: 'center',
            }}>
              <ChevronLeft size={18} color={C.textPrimary} />
            </Pressable>
          ) : <View style={{ width: 36 }} />}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            {rightAction}
          </View>
        </View>
      </View>
    );
  }

  if (variant === 'profile') {
    return (
      <View style={[{ paddingHorizontal: 22, paddingBottom: 14 }, style]}>
        {title && (
          <Text style={{
            fontFamily: F.serifItalic, fontSize: 30, color: C.textPrimary, letterSpacing: -0.6,
          }}>
            {title}
          </Text>
        )}
        {subtitle && (
          <Text style={{ fontFamily: F.serifItalic, fontSize: 13, color: C.textMuted, marginTop: 4 }}>
            {subtitle}
          </Text>
        )}
      </View>
    );
  }

  // default
  return (
    <View style={[{
      paddingHorizontal: 22, paddingBottom: 14,
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12,
    }, style]}>
      <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        {back && (
          <Pressable onPress={onBack} hitSlop={8} style={{
            width: 36, height: 36, borderRadius: 18,
            backgroundColor: C.bgElevated, borderColor: C.borderSubtle, borderWidth: 1,
            alignItems: 'center', justifyContent: 'center',
          }}>
            <ChevronLeft size={18} color={C.textPrimary} />
          </Pressable>
        )}
        {avatar}
        <View style={{ flex: 1 }}>
          {subtitle && (
            <Text style={{
              fontFamily: F.sansBold, fontSize: 10, color: C.textMuted,
              letterSpacing: 1.4, textTransform: 'uppercase',
            }}>
              {subtitle}
            </Text>
          )}
          {title && (
            <Text style={{
              fontFamily: F.serifItalic, fontSize: 30, color: C.textPrimary, letterSpacing: -0.6,
              marginTop: subtitle ? 4 : 0,
            }}>
              {title}
            </Text>
          )}
        </View>
      </View>
      {rightAction}
    </View>
  );
}
