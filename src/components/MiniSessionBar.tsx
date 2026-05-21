import React, { useState } from 'react';
import { View, Text, Pressable, TextInput, LayoutAnimation, Platform, UIManager, Alert } from 'react-native';
import { ChevronUp, ChevronDown, Pause, Play, RotateCcw, Timer as TimerIcon, Minus, Plus, X as XIcon } from 'lucide-react-native';
import { colors as C, fonts as F } from '../theme';
import { ActiveSession, formatSessionDisplay } from '../screens/reading/SessionSheet';
import { hLight } from '../lib/haptics';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

/**
 * MiniSessionBar — persistent active-session control surface at the bottom of
 * Book Detail. Two states:
 *
 *   Collapsed pill → time left + tap to expand
 *   Expanded card  → BIG pages-read, p.X → p.Y editor, save, time left below
 */
export function MiniSessionBar({
  active, expanded, onToggleExpand, onTogglePause, onReset, onCancel, onSave, onEndPageChange, totalPages,
}: {
  active: ActiveSession;
  expanded: boolean;
  onToggleExpand: () => void;
  onTogglePause: () => void;
  onReset: () => void;
  onCancel: () => void;
  onSave: () => void;
  onEndPageChange: (n: number) => void;
  totalPages: number | null;
}) {
  const { display, label, completed } = formatSessionDisplay(active);
  const pages = Math.max(0, active.endPage - active.startPage);

  const animatedToggle = () => {
    LayoutAnimation.configureNext({
      duration: 260,
      create: { type: 'easeInEaseOut', property: 'opacity' },
      update: { type: 'spring', springDamping: 0.85 },
      delete: { type: 'easeInEaseOut', property: 'opacity' },
    });
    hLight();
    onToggleExpand();
  };

  const handleCancel = () => {
    const meaningful = active.elapsedSeconds > 30 || pages > 0;
    if (meaningful) {
      Alert.alert('Cancel block?', "You'll lose this block's progress.", [
        { text: 'Keep going', style: 'cancel' },
        { text: 'Cancel block', style: 'destructive', onPress: onCancel },
      ]);
    } else onCancel();
  };

  const clamp = (n: number) =>
    Math.max(active.startPage, totalPages ? Math.min(totalPages, n) : n);

  if (!expanded) {
    return (
      <Pressable
        onPress={animatedToggle}
        style={{
          marginHorizontal: 14, marginBottom: 6,
          paddingHorizontal: 12, paddingVertical: 10,
          borderRadius: 999,
          backgroundColor: completed ? C.goldFaint : C.bgElevated,
          borderColor: completed ? 'rgba(201,169,97,0.55)' : C.borderSubtle, borderWidth: 1,
          flexDirection: 'row', alignItems: 'center', gap: 10,
          shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 14, shadowOffset: { width: 0, height: 4 },
        }}>
        <View style={{
          width: 32, height: 32, borderRadius: 16,
          backgroundColor: C.goldFaint, alignItems: 'center', justifyContent: 'center',
        }}>
          <TimerIcon size={14} color={C.gold} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: F.sansBold, fontSize: 9.5, color: C.textMuted, letterSpacing: 1.6 }}>
            {label}
          </Text>
          <Text style={{ fontFamily: F.monoBold, fontSize: 17, color: completed ? C.goldBright : C.textPrimary, letterSpacing: -0.5, marginTop: 1 }}>
            {display}
          </Text>
        </View>
        <Pressable onPress={() => { hLight(); onTogglePause(); }} hitSlop={10}
          style={{
            width: 36, height: 36, borderRadius: 18,
            backgroundColor: C.goldFaint, borderColor: 'rgba(201,169,97,0.5)', borderWidth: 1,
            alignItems: 'center', justifyContent: 'center',
          }}>
          {active.running
            ? <Pause size={13} color={C.gold} />
            : <Play  size={13} color={C.gold} />}
        </Pressable>
        <ChevronUp size={16} color={C.textMuted} />
      </Pressable>
    );
  }

  // Expanded
  return (
    <View style={{
      marginHorizontal: 12, marginBottom: 6,
      padding: 16, borderRadius: 22,
      backgroundColor: C.bgElevated, borderColor: C.borderMid, borderWidth: 1,
      shadowColor: '#000', shadowOpacity: 0.45, shadowRadius: 24, shadowOffset: { width: 0, height: 8 },
    }}>
      {/* Collapse handle */}
      <Pressable onPress={animatedToggle} hitSlop={10} style={{ alignSelf: 'center', paddingVertical: 4, paddingHorizontal: 24 }}>
        <ChevronDown size={18} color={C.textMuted} />
      </Pressable>

      {/* Pages read — DOMINANT */}
      <View style={{ alignItems: 'center', marginTop: 2 }}>
        <Text style={{ fontFamily: F.sansHeavy, fontSize: 64, color: C.goldBright, letterSpacing: -2.5, lineHeight: 66 }}>
          +{pages}
        </Text>
        <Text style={{ fontFamily: F.sansBold, fontSize: 11, color: C.textMuted, letterSpacing: 2, marginTop: -2 }}>
          PAGES
        </Text>
      </View>

      {/* Page range */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 14, marginTop: 16 }}>
        <View style={{ alignItems: 'center' }}>
          <Text style={{ fontFamily: F.sansBold, fontSize: 9.5, color: C.textMuted, letterSpacing: 1.4 }}>START</Text>
          <Text style={{ fontFamily: F.sansBold, fontSize: 22, color: C.textSecondary, marginTop: 2, letterSpacing: -0.4 }}>
            p. {active.startPage}
          </Text>
        </View>
        <Text style={{ fontFamily: F.mono, fontSize: 14, color: C.textMuted }}>→</Text>
        <View style={{ alignItems: 'center' }}>
          <Text style={{ fontFamily: F.sansBold, fontSize: 9.5, color: C.textMuted, letterSpacing: 1.4 }}>END</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
            <Pressable onPress={() => onEndPageChange(clamp(active.endPage - 1))} hitSlop={8} style={tinyBtn}>
              <Minus size={11} color={C.textPrimary} />
            </Pressable>
            <TextInput
              value={String(active.endPage)}
              onChangeText={t => onEndPageChange(clamp(parseInt(t.replace(/\D/g, ''), 10) || active.startPage))}
              keyboardType="number-pad" selectionColor={C.gold}
              style={{ fontFamily: F.sansBold, fontSize: 22, color: C.textPrimary, minWidth: 56, textAlign: 'center', letterSpacing: -0.4 }}
            />
            <Pressable onPress={() => onEndPageChange(clamp(active.endPage + 1))} hitSlop={8} style={tinyBtn}>
              <Plus size={11} color={C.textPrimary} />
            </Pressable>
          </View>
        </View>
      </View>

      {/* Save */}
      <Pressable
        onPress={onSave}
        disabled={pages <= 0}
        style={{
          marginTop: 18, height: 50, borderRadius: 999,
          backgroundColor: C.gold, opacity: pages <= 0 ? 0.45 : 1,
          alignItems: 'center', justifyContent: 'center',
          shadowColor: '#E8C275', shadowOpacity: 0.35, shadowRadius: 20,
        }}>
        <Text style={{ fontFamily: F.sansBold, fontSize: 14, color: C.bgBase, letterSpacing: 0.3 }}>
          Save session
        </Text>
      </Pressable>

      {/* Time + controls (secondary) */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14, paddingTop: 12, borderTopColor: C.borderSubtle, borderTopWidth: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <TimerIcon size={12} color={completed ? C.gold : C.textMuted} />
          <Text style={{ fontFamily: F.mono, fontSize: 12, color: completed ? C.gold : C.textSecondary }}>
            {display} {label === 'COMPLETE' ? '· done' : 'left'}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Pressable onPress={() => { hLight(); onReset(); }} hitSlop={8} style={circleBtn}>
            <RotateCcw size={12} color={C.textSecondary} />
          </Pressable>
          <Pressable onPress={() => { hLight(); onTogglePause(); }} hitSlop={8}
            style={[circleBtn, { backgroundColor: C.goldFaint, borderColor: 'rgba(201,169,97,0.5)' }]}>
            {active.running
              ? <Pause size={12} color={C.gold} />
              : <Play  size={12} color={C.gold} />}
          </Pressable>
          <Pressable onPress={handleCancel} hitSlop={8} style={circleBtn}>
            <XIcon size={12} color={C.clay} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const tinyBtn = {
  width: 24, height: 24, borderRadius: 12,
  backgroundColor: C.bgOverlay, borderColor: C.borderMid, borderWidth: 1,
  alignItems: 'center' as const, justifyContent: 'center' as const,
};

const circleBtn = {
  width: 32, height: 32, borderRadius: 16,
  backgroundColor: 'transparent',
  borderColor: C.borderMid, borderWidth: 1,
  alignItems: 'center' as const, justifyContent: 'center' as const,
};
