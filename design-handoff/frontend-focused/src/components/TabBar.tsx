import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, LayoutAnimation, Platform, UIManager, AccessibilityInfo } from 'react-native';
import { Home, CheckSquare, Flame, BookOpen, Users, User } from 'lucide-react-native';
import { BlurView } from 'expo-blur';
import { colors as C, fonts as F, radius as R } from '../theme';

// Smooth width/position morph for the active tab bubble + icon labels.
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}
const BUBBLE_ANIM = LayoutAnimation.create(
  220,
  LayoutAnimation.Types.easeInEaseOut,
  LayoutAnimation.Properties.opacity,
);

export type TabId = 'home' | 'habits' | 'tasks' | 'reading' | 'friends' | 'profile';

const TABS: { id: TabId; Icon: any; label: string }[] = [
  { id: 'home',    Icon: Home,        label: 'Home' },
  { id: 'habits',  Icon: Flame,       label: 'Habits' },
  { id: 'tasks',   Icon: CheckSquare, label: 'Tasks' },
  { id: 'reading', Icon: BookOpen,    label: 'Reading' },
  { id: 'friends', Icon: Users,       label: 'Friends' },
  { id: 'profile', Icon: User,        label: 'You' },
];

export function TabBar({ active, onChange }: { active: TabId; onChange: (id: TabId) => void }) {
  // Wrap the layout change so the active tab grows/shrinks and the inactive
  // ones reflow with a single morphing animation. The "bubble" is just the
  // active tab's background — animating widths makes it feel like the same
  // pill is sliding to the new tab.
  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => sub?.remove?.();
  }, []);

  const prevActive = useRef(active);
  useEffect(() => {
    if (prevActive.current === active) return;
    if (!reduceMotion) LayoutAnimation.configureNext(BUBBLE_ANIM);
    prevActive.current = active;
  }, [active, reduceMotion]);

  const handlePress = (id: TabId) => {
    if (id === active) return;
    if (!reduceMotion) LayoutAnimation.configureNext(BUBBLE_ANIM);
    onChange(id);
  };

  return (
    <View style={{ position: 'absolute', left: 16, right: 16, bottom: 24, alignItems: 'center' }} pointerEvents="box-none">
      <BlurView intensity={50} tint="dark" style={{
        borderRadius: R.pill, overflow: 'hidden',
        borderColor: C.borderMid, borderWidth: 1,
      }}>
        <View style={{ flexDirection: 'row', padding: 6, gap: 4 }}>
          {TABS.map(({ id, Icon, label }) => {
            const a = id === active;
            return (
              <Pressable key={id} onPress={() => handlePress(id)} style={{
                height: 42, paddingHorizontal: a ? 14 : 0, width: a ? undefined : 50,
                borderRadius: R.pill, backgroundColor: a ? C.forest : 'transparent',
                flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}>
                <Icon size={18} color={a ? C.textPrimary : 'rgba(250,250,248,0.5)'} strokeWidth={a ? 2 : 1.6} />
                {a && <Text style={{ fontFamily: F.sansBold, fontSize: 11, color: C.textPrimary, letterSpacing: 0.5 }}>{label}</Text>}
              </Pressable>
            );
          })}
        </View>
      </BlurView>
    </View>
  );
}
