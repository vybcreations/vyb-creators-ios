import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { Minus, Plus } from 'lucide-react-native';
import { DraggableSheet, SheetHeader } from '../../components/DraggableSheet';
import { GoldButton } from '../../components/primitives';
import { colors as C, fonts as F } from '../../theme';
import { hLight } from '../../lib/haptics';

export type ActiveSession = {
  startPage: number;
  endPage: number;
  targetSeconds: number;      // always countdown — required
  elapsedSeconds: number;
  running: boolean;
};

const PRESETS_MIN = [15, 30, 60];
const STEP = 5;
const MIN_MINUTES = 5;
const MAX_MINUTES = 180;

/**
 * SessionSheet is now configuration-only. Once a block is started, the screen
 * itself owns the active session and the bottom MiniSessionBar takes over all
 * live controls (timer, pages, save).
 */
export function SessionSheet({
  visible, onDismiss, bookCurrentPage, onStart,
}: {
  visible: boolean;
  onDismiss: () => void;
  bookCurrentPage: number;
  onStart: (targetSeconds: number) => void;
}) {
  const [minutes, setMinutes] = useState<number>(30);

  useEffect(() => { if (visible) setMinutes(30); }, [visible]);

  const inc = () => setMinutes(m => Math.min(MAX_MINUTES, m + STEP));
  const dec = () => setMinutes(m => Math.max(MIN_MINUTES, m - STEP));

  const handleStart = () => {
    hLight();
    onStart(minutes * 60);
  };

  return (
    <DraggableSheet visible={visible} onDismiss={onDismiss} showClose={false}>
      <SheetHeader title="Focus block" onClose={onDismiss} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20 }} keyboardShouldPersistTaps="handled">

        {/* Starting at page (info) */}
        <View style={{ alignItems: 'center', marginBottom: 22 }}>
          <Text style={Label}>STARTING AT PAGE</Text>
          <Text style={{ fontFamily: F.sansHeavy, fontSize: 36, color: C.textPrimary, marginTop: 4, letterSpacing: -1 }}>
            {bookCurrentPage}
          </Text>
        </View>

        {/* Big focus length with ± steppers */}
        <Text style={Label}>FOCUS LENGTH</Text>
        <View style={{
          marginTop: 8, marginBottom: 18,
          flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 18,
        }}>
          <Pressable onPress={dec} disabled={minutes <= MIN_MINUTES} style={[stepBtn, minutes <= MIN_MINUTES && { opacity: 0.35 }]}>
            <Minus size={16} color={C.textPrimary} />
          </Pressable>
          <View style={{ alignItems: 'center' }}>
            <Text style={{ fontFamily: F.sansHeavy, fontSize: 64, color: C.goldBright, letterSpacing: -2, lineHeight: 66 }}>
              {minutes}
            </Text>
            <Text style={{ fontFamily: F.sansBold, fontSize: 11, color: C.textMuted, letterSpacing: 1.6, marginTop: 2 }}>
              MINUTES
            </Text>
          </View>
          <Pressable onPress={inc} disabled={minutes >= MAX_MINUTES} style={[stepBtn, minutes >= MAX_MINUTES && { opacity: 0.35 }]}>
            <Plus size={16} color={C.textPrimary} />
          </Pressable>
        </View>

        {/* Presets */}
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 24 }}>
          {PRESETS_MIN.map(m => {
            const active = minutes === m;
            return (
              <Pressable key={m} onPress={() => setMinutes(m)} style={{
                flex: 1, height: 44, borderRadius: 12,
                backgroundColor: active ? C.goldFaint : C.bgOverlay,
                borderColor: active ? 'rgba(201,169,97,0.5)' : C.borderSubtle, borderWidth: 1,
                alignItems: 'center', justifyContent: 'center',
              }}>
                <Text style={{ fontFamily: F.sansBold, fontSize: 13, color: active ? C.gold : C.textSecondary, letterSpacing: 0.3 }}>
                  {m} min
                </Text>
              </Pressable>
            );
          })}
        </View>

        <GoldButton variant="complete" size="lg" onPress={handleStart}
          style={{ alignSelf: 'stretch', justifyContent: 'center' }}>
          Start {minutes} min focus
        </GoldButton>

        <Text style={{ fontFamily: F.sans, fontSize: 11.5, color: C.textMuted, textAlign: 'center', marginTop: 14, lineHeight: 17 }}>
          The timer keeps running as you move between book and entries.{'\n'}Save the session when you're done.
        </Text>
      </ScrollView>
    </DraggableSheet>
  );
}

const Label = { fontFamily: F.sansBold, fontSize: 10, color: C.textMuted, letterSpacing: 2 } as const;

const stepBtn = {
  width: 48, height: 48, borderRadius: 24,
  backgroundColor: C.bgOverlay, borderColor: C.borderMid, borderWidth: 1,
  alignItems: 'center' as const, justifyContent: 'center' as const,
};

// Helper used by the mini bar.
export function formatSessionDisplay(active: ActiveSession): { display: string; label: string; completed: boolean } {
  const remaining = Math.max(0, active.targetSeconds - active.elapsedSeconds);
  const completed = active.elapsedSeconds >= active.targetSeconds;
  const m = Math.floor(remaining / 60);
  const s = remaining % 60;
  const pad2 = (n: number) => String(n).padStart(2, '0');
  return {
    display: `${pad2(m)}:${pad2(s)}`,
    label: completed ? 'COMPLETE' : 'TIME LEFT',
    completed,
  };
}
