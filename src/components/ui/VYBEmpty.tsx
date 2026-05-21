import React from 'react';
import { View, Text, Pressable, StyleProp, ViewStyle } from 'react-native';
import { colors as C, fonts as F } from '../../theme';

/**
 * VYBEmpty — empty-state primitive.
 *
 * Replaces HomeScreen.EmptyCard, FriendDetailScreen.EmptyMini, and the
 * various inline dashed empty blocks across Habits/Reading/BookDetail.
 *
 * Variants:
 *   - simple: just text, no container (for inline list empties)
 *   - card:   filled rounded card (default — looks like other widgets)
 *   - dashed: dashed border container (for "tap to add" surfaces)
 *   - hero:   larger padding, centered, for full-screen empties
 */

type Variant = 'simple' | 'card' | 'dashed' | 'hero';
type Tone = 'neutral' | 'gold' | 'sage';

const TONE: Record<Tone, { bg: string; border: string; cta: string; ctaBg: string; ctaBorder: string }> = {
  neutral: {
    bg: 'rgba(255,255,255,0.025)', border: C.borderSubtle,
    cta: C.gold, ctaBg: C.goldFaint, ctaBorder: 'rgba(201,169,97,0.4)',
  },
  gold: {
    bg: 'rgba(201,169,97,0.06)', border: 'rgba(201,169,97,0.25)',
    cta: C.gold, ctaBg: C.goldFaint, ctaBorder: 'rgba(201,169,97,0.45)',
  },
  sage: {
    bg: 'rgba(143,168,138,0.06)', border: 'rgba(143,168,138,0.25)',
    cta: '#8FA88A', ctaBg: 'rgba(143,168,138,0.14)', ctaBorder: 'rgba(143,168,138,0.45)',
  },
};

export function VYBEmpty({
  title, body, icon, actionLabel, onAction,
  variant = 'card', tone = 'neutral', style,
}: {
  title: string;
  body?: string;
  icon?: React.ReactNode;
  actionLabel?: string;
  onAction?: () => void;
  variant?: Variant;
  tone?: Tone;
  style?: StyleProp<ViewStyle>;
}) {
  const t = TONE[tone];

  const content = (
    <>
      {icon && <View style={{ marginBottom: 10 }}>{icon}</View>}
      <Text style={{
        fontFamily: F.serifItalic, fontSize: variant === 'hero' ? 18 : 14,
        color: C.textSecondary, textAlign: 'center',
      }}>
        {title}
      </Text>
      {body && (
        <Text style={{
          fontFamily: F.sans, fontSize: 12, color: C.textMuted,
          marginTop: 6, textAlign: 'center', lineHeight: 17,
        }}>
          {body}
        </Text>
      )}
      {actionLabel && onAction && (
        <Pressable onPress={onAction} hitSlop={4} style={{
          marginTop: 14, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999,
          backgroundColor: t.ctaBg, borderColor: t.ctaBorder, borderWidth: 1,
        }}>
          <Text style={{
            fontFamily: F.sansBold, fontSize: 11, color: t.cta,
            letterSpacing: 0.5, textTransform: 'uppercase',
          }}>
            {actionLabel}
          </Text>
        </Pressable>
      )}
    </>
  );

  if (variant === 'simple') {
    return (
      <View style={[{ paddingVertical: 14, alignItems: 'center' }, style]}>
        {content}
      </View>
    );
  }

  const isDashed = variant === 'dashed';
  return (
    <View style={[{
      paddingVertical: variant === 'hero' ? 40 : 22,
      paddingHorizontal: 18, borderRadius: 14,
      backgroundColor: isDashed ? 'transparent' : t.bg,
      borderColor: t.border, borderWidth: 1,
      borderStyle: isDashed ? 'dashed' : 'solid',
      alignItems: 'center',
    }, style]}>
      {content}
    </View>
  );
}
