import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, Pressable, Alert, ScrollView, Keyboard } from 'react-native';
import { DraggableSheet, SheetHeader } from '../../components/DraggableSheet';
import { GoldButton } from '../../components/primitives';
import { VYBInput, VYBChip, VYBToggle } from '../../components/ui';
import { colors as C, fonts as F } from '../../theme';
import { Habit, HabitArea, HabitColor, colorToHex, createHabit, updateHabit, HABIT_PRESETS, POPULAR_PRESETS } from '../../lib/habits';
import { useAuth } from '../../lib/auth';

const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const DAY_DOWS  = [1, 2, 3, 4, 5, 6, 0];

export function HabitEditorSheet({
  visible, onDismiss, onSaved, existing, defaultAreaId, areas,
}: {
  visible: boolean;
  onDismiss: () => void;
  onSaved: () => void;
  existing?: Habit;
  defaultAreaId?: string | null;
  areas: HabitArea[];
}) {
  const { session } = useAuth();
  const [name, setName] = useState('');
  const [areaId, setAreaId] = useState<string | null>(null);
  const [frequency, setFrequency] = useState<'daily' | 'custom'>('daily');
  const [days, setDays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<TextInput>(null);

  // Auto-focus the name input (and open the keyboard) once the sheet's slide-in
  // finishes. Works for both new and edit flows.
  useEffect(() => {
    if (!visible) {
      Keyboard.dismiss();
      return;
    }
    const t = setTimeout(() => inputRef.current?.focus(), 340);
    return () => clearTimeout(t);
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    if (existing) {
      setName(existing.name);
      setAreaId(existing.area_id);
      setFrequency(existing.frequency);
      setDays(existing.days_of_week);
    } else {
      setName('');
      setAreaId(defaultAreaId ?? null);
      setFrequency('daily');
      setDays([0, 1, 2, 3, 4, 5, 6]);
    }
  }, [visible, existing, defaultAreaId]);

  const toggleDay = (dow: number) => {
    setDays(d => d.includes(dow) ? d.filter(x => x !== dow) : [...d, dow].sort());
  };

  // Preset filtering:
  //   - Typing in the name field → match by name across all presets
  //   - No name + area selected → all presets for that area
  //   - No name + no area → curated popular set
  const presetsToShow = (() => {
    if (existing) return [];
    const q = name.trim().toLowerCase();
    if (q.length > 0) {
      return HABIT_PRESETS.filter(p => p.name.toLowerCase().includes(q)).slice(0, 30);
    }
    const area = areas.find(a => a.id === areaId);
    if (area) {
      return HABIT_PRESETS.filter(p => p.areaHint.toLowerCase() === area.name.toLowerCase());
    }
    return POPULAR_PRESETS
      .map(name => HABIT_PRESETS.find(p => p.name === name))
      .filter(Boolean) as typeof HABIT_PRESETS;
  })();

  const applyPreset = (p: typeof HABIT_PRESETS[0]) => {
    setName(p.name);
    if (p.days) { setDays(p.days); setFrequency('custom'); }
    else { setDays([0, 1, 2, 3, 4, 5, 6]); setFrequency('daily'); }
    // Match area by name hint
    const a = areas.find(x => x.name.toLowerCase() === p.areaHint.toLowerCase());
    if (a) setAreaId(a.id);
  };

  // Color is always inherited from the selected area.
  const colorFromArea: HabitColor = areas.find(a => a.id === areaId)?.color || 'gold';
  const tint = colorToHex(colorFromArea);

  const save = async () => {
    if (!session || !name.trim()) return;
    setBusy(true);
    try {
      const patch = {
        name: name.trim(),
        area_id: areaId,
        color: colorFromArea,
        frequency,
        days_of_week: frequency === 'daily' ? [0, 1, 2, 3, 4, 5, 6] : days,
      };
      if (existing) await updateHabit(existing.id, patch);
      else await createHabit(session.user.id, patch);
      onSaved();
      onDismiss();
    } catch (e: any) {
      Alert.alert('Could not save', e?.message || 'Unknown error');
    } finally { setBusy(false); }
  };

  return (
    <DraggableSheet visible={visible} onDismiss={onDismiss} showClose={false}>
      <SheetHeader title={existing ? 'Edit habit' : 'New habit'} onClose={onDismiss} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20 }} keyboardShouldPersistTaps="handled">

        <Label>NAME</Label>
        <VYBInput
          ref={inputRef}
          value={name} onChangeText={setName}
          placeholder="Sleep before 12, Gym 4x a week…"
          selectionColor={C.gold}
          returnKeyType="done"
          onSubmitEditing={() => Keyboard.dismiss()}
        />

        {presetsToShow.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" style={{ marginTop: 10 }}>
            <View style={{ flexDirection: 'row', gap: 6, paddingVertical: 4 }}>
              {presetsToShow.map(p => (
                <VYBChip
                  key={p.name}
                  label={p.name}
                  tone="neutral"
                  selected={false}
                  size="sm"
                  onPress={() => applyPreset(p)}
                />
              ))}
            </View>
          </ScrollView>
        )}

        <Label style={{ marginTop: 18 }}>AREA</Label>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <View style={{ flexDirection: 'row', gap: 6, paddingVertical: 6 }}>
            <AreaPill name="None" selected={areaId === null} onPress={() => setAreaId(null)} />
            {areas.map(a => (
              <AreaPill key={a.id} name={a.name} selected={areaId === a.id} color={a.color} onPress={() => setAreaId(a.id)} />
            ))}
          </View>
        </ScrollView>

        <Label style={{ marginTop: 18 }}>FREQUENCY</Label>
        <VYBToggle
          tone="gold"
          variant="subtle"
          size="md"
          value={frequency}
          onChange={(v) => setFrequency(v as 'daily' | 'custom')}
          options={[
            { label: 'Every day',  value: 'daily' },
            { label: 'Custom days', value: 'custom' },
          ]}
          style={{ marginTop: 6 }}
        />

        {frequency === 'custom' && (
          <View style={{ flexDirection: 'row', gap: 6, marginTop: 14 }}>
            {DAY_LABELS.map((lbl, i) => {
              const dow = DAY_DOWS[i];
              const on = days.includes(dow);
              return (
                <View key={i} style={{ flex: 1 }}>
                  <VYBChip
                    label={lbl}
                    tone="gold"
                    selected={on}
                    size="md"
                    onPress={() => toggleDay(dow)}
                    style={{ width: '100%', justifyContent: 'center' }}
                  />
                </View>
              );
            })}
          </View>
        )}

        <View style={{ height: 24 }} />

        <GoldButton variant="complete" size="lg" onPress={save}
          style={{ alignSelf: 'stretch', justifyContent: 'center' }}>
          {busy ? '…' : existing ? 'Save changes' : 'Create habit'}
        </GoldButton>
      </ScrollView>
    </DraggableSheet>
  );
}

function Label({ children, style }: any) {
  return <Text style={[{ fontFamily: F.sansBold, fontSize: 10, color: C.textMuted, letterSpacing: 2, marginBottom: 6 }, style]}>{children}</Text>;
}

function AreaPill({ name, selected, color = 'gold', onPress }: { name: string; selected: boolean; color?: HabitColor; onPress: () => void }) {
  const tint = colorToHex(color);
  return (
    <Pressable onPress={onPress} style={{
      paddingHorizontal: 14, height: 32, borderRadius: 999,
      backgroundColor: selected ? tint.faint : C.bgOverlay,
      borderColor: selected ? tint.border : C.borderSubtle, borderWidth: 1,
      alignItems: 'center', justifyContent: 'center',
    }}>
      <Text style={{ fontFamily: F.sansBold, fontSize: 12, color: selected ? tint.primary : C.textSecondary, letterSpacing: 0.3 }}>{name}</Text>
    </Pressable>
  );
}

