import React, { useRef, useState } from 'react';
import { View, Text, Pressable, Animated, Modal, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  BookOpen, Flame, Trophy, Camera, Users, Sparkles, X,
} from 'lucide-react-native';
import { colors as C, fonts as F } from '../../theme';
import type { Achievement, AchievementType } from '../../lib/demoFriends';

/**
 * AchievementCard — a single collectible-feel achievement chip.
 *
 * Interaction: on press-in we do a subtle scale-down + tiny rotation, on
 * press-out it springs back. Tap opens a lightweight detail sheet.
 * No reanimated/gesture-handler dependency — just RN Animated, so it stays
 * cheap on lower-end devices.
 */

const ICON_MAP: Record<AchievementType, typeof Flame> = {
  reading:        BookOpen,
  streak:         Flame,
  challenge_win:  Trophy,
  proof:          Camera,
  circle:         Users,
  general:        Sparkles,
};

// Per-type accent so different achievement kinds feel distinct without the
// whole grid turning gold. Gold for streaks/wins, sage for circles, etc.
const ACCENT: Record<AchievementType, string> = {
  reading:        '#C9A961',
  streak:         '#E8A87A',
  challenge_win:  '#E8C878',
  proof:          '#5DA3C9',
  circle:         '#8FA88A',
  general:        '#9F8FD4',
};

export function AchievementCard({ a }: { a: Achievement }) {
  const Icon = ICON_MAP[a.type] || Sparkles;
  const accent = ACCENT[a.type] || C.gold;
  const [open, setOpen] = useState(false);

  // Light tilt: scale + small rotation on press. Keeps the "premium item"
  // feel without going full 3D parallax.
  const scale = useRef(new Animated.Value(1)).current;
  const tilt  = useRef(new Animated.Value(0)).current;

  const onPressIn = () => {
    Animated.parallel([
      Animated.spring(scale, { toValue: 0.96, useNativeDriver: true, speed: 30, bounciness: 6 }),
      Animated.spring(tilt,  { toValue: 1,    useNativeDriver: true, speed: 30, bounciness: 4 }),
    ]).start();
  };
  const onPressOut = () => {
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 28, bounciness: 8 }),
      Animated.spring(tilt,  { toValue: 0, useNativeDriver: true, speed: 28, bounciness: 8 }),
    ]).start();
  };

  const rotateZ = tilt.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-1.5deg'] });

  return (
    <>
      <Pressable onPressIn={onPressIn} onPressOut={onPressOut} onPress={() => setOpen(true)}>
        <Animated.View style={{
          width: 168, padding: 14, borderRadius: 18,
          backgroundColor: 'rgba(255,255,255,0.035)',
          borderColor: 'rgba(255,255,255,0.08)', borderWidth: 1,
          overflow: 'hidden',
          transform: [{ scale }, { rotateZ }],
          shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 10, shadowOffset: { width: 0, height: 6 },
        }}>
          {/* Soft accent gradient — gives the card a faint medallion glow. */}
          <LinearGradient
            colors={[`${accent}26`, 'rgba(13,12,11,0)'] as any}
            start={{ x: 0.2, y: 0 }} end={{ x: 1, y: 1 }}
            style={{ position: 'absolute', inset: 0 as any }}
          />

          {/* Emblem disc */}
          <View style={{
            width: 36, height: 36, borderRadius: 18,
            backgroundColor: 'rgba(13,12,11,0.5)',
            borderColor: `${accent}80`, borderWidth: 1,
            alignItems: 'center', justifyContent: 'center', marginBottom: 12,
            shadowColor: accent, shadowOpacity: 0.45, shadowRadius: 8, shadowOffset: { width: 0, height: 0 },
          }}>
            <Icon size={16} color={accent} />
          </View>

          <Text numberOfLines={1} style={{
            fontFamily: F.sansBold, fontSize: 12.5, color: C.textPrimary, letterSpacing: -0.2,
          }}>
            {a.title}
          </Text>
          {a.subtitle && (
            <Text numberOfLines={1} style={{
              fontFamily: F.serifItalic, fontSize: 11, color: C.textSecondary, marginTop: 2,
            }}>
              {a.subtitle}
            </Text>
          )}
          <Text style={{
            fontFamily: F.sansBold, fontSize: 9, color: C.textFaint,
            marginTop: 10, letterSpacing: 0.7, textTransform: 'uppercase',
          }}>
            {a.date_label}
          </Text>
        </Animated.View>
      </Pressable>

      <AchievementDetailSheet
        visible={open}
        onClose={() => setOpen(false)}
        achievement={a}
        accent={accent}
        Icon={Icon}
      />
    </>
  );
}

function AchievementDetailSheet({
  visible, onClose, achievement, accent, Icon,
}: {
  visible: boolean; onClose: () => void; achievement: Achievement;
  accent: string; Icon: typeof Flame;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', padding: 22 }}>
        <Pressable onPress={onClose} style={{ position: 'absolute', inset: 0 as any }} />
        <View style={{
          borderRadius: 24, padding: 24,
          backgroundColor: '#16151A',
          borderColor: 'rgba(255,255,255,0.08)', borderWidth: 1,
          overflow: 'hidden',
        }}>
          <LinearGradient
            colors={[`${accent}33`, 'rgba(13,12,11,0)'] as any}
            start={{ x: 0.2, y: 0 }} end={{ x: 1, y: 1 }}
            style={{ position: 'absolute', inset: 0 as any }}
          />
          <Pressable onPress={onClose} hitSlop={10} style={{
            position: 'absolute', top: 12, right: 12,
            width: 30, height: 30, borderRadius: 15,
            backgroundColor: 'rgba(255,255,255,0.06)',
            alignItems: 'center', justifyContent: 'center',
          }}>
            <X size={14} color={C.textSecondary} />
          </Pressable>

          {/* Big emblem */}
          <View style={{ alignItems: 'center', marginTop: 8 }}>
            <View style={{
              width: 96, height: 96, borderRadius: 48,
              backgroundColor: 'rgba(13,12,11,0.55)',
              borderColor: `${accent}80`, borderWidth: 2,
              alignItems: 'center', justifyContent: 'center',
              shadowColor: accent, shadowOpacity: 0.65, shadowRadius: 20, shadowOffset: { width: 0, height: 0 },
            }}>
              <Icon size={40} color={accent} />
            </View>
          </View>

          <Text style={{
            fontFamily: F.sansHeavy, fontSize: 22, color: C.textPrimary,
            textAlign: 'center', marginTop: 18, letterSpacing: -0.4,
          }}>
            {achievement.title}
          </Text>
          {achievement.subtitle && (
            <Text style={{
              fontFamily: F.serifItalic, fontSize: 14, color: C.textSecondary,
              textAlign: 'center', marginTop: 4,
            }}>
              {achievement.subtitle}
            </Text>
          )}
          <Text style={{
            fontFamily: F.sansBold, fontSize: 10, color: accent,
            textAlign: 'center', marginTop: 14, letterSpacing: 1.2, textTransform: 'uppercase',
          }}>
            {achievement.date_label}
          </Text>
        </View>
      </View>
    </Modal>
  );
}

/**
 * Section wrapper: horizontal scroller of AchievementCards.
 * Shared between user profile and friend profile.
 */
export function RecentAchievementsSection({ achievements }: { achievements: Achievement[] }) {
  if (achievements.length === 0) return null;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 4, gap: 10 }}>
      {achievements.map((a, i) => <AchievementCard key={i} a={a} />)}
    </ScrollView>
  );
}
