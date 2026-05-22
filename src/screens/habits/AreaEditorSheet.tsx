import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, Pressable, Alert, ScrollView, Keyboard } from 'react-native';
import * as L from 'lucide-react-native';
import { GoldButton } from '../../components/primitives';
import { VYBInput, VYBChip, VYBCreationSheet } from '../../components/ui';
import { colors as C, fonts as F } from '../../theme';
import { HabitArea, HabitColor, colorToHex, createArea, updateArea, AREA_PRESETS } from '../../lib/habits';
import { useAuth } from '../../lib/auth';

const ICONS = ['heart-pulse', 'sparkles', 'briefcase', 'brain', 'dumbbell', 'palette', 'users', 'flame', 'book-open', 'leaf', 'sun', 'moon'];
const COLORS: HabitColor[] = ['gold', 'forest', 'midnight', 'amber', 'clay'];

function toComponent(name: string): any {
  const pascal = name.split('-').map(w => w[0].toUpperCase() + w.slice(1)).join('');
  return (L as any)[pascal] || L.Sparkles;
}

export function AreaEditorSheet({
  visible, onDismiss, onSaved, existing,
}: {
  visible: boolean;
  onDismiss: () => void;
  onSaved: () => void;
  existing?: HabitArea;
}) {
  const { session } = useAuth();
  const [name, setName] = useState('');
  const [icon, setIcon] = useState<string>('sparkles');
  const [color, setColor] = useState<HabitColor>('gold');
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (!visible) { Keyboard.dismiss(); return; }
    const t = setTimeout(() => inputRef.current?.focus(), 340);
    return () => clearTimeout(t);
  }, [visible]);

  useEffect(() => {
    if (visible) {
      setName(existing?.name || '');
      setIcon(existing?.icon || 'sparkles');
      setColor(existing?.color || 'gold');
    }
  }, [visible, existing]);

  const save = async () => {
    if (!session || !name.trim()) return;
    setBusy(true);
    try {
      if (existing) await updateArea(existing.id, { name: name.trim(), icon, color });
      else await createArea(session.user.id, { name: name.trim(), icon, color });
      onSaved();
      onDismiss();
    } catch (e: any) {
      Alert.alert('Could not save', e?.message || 'Unknown error');
    } finally { setBusy(false); }
  };

  const tint = colorToHex(color);

  return (
    <VYBCreationSheet
      visible={visible} onDismiss={onDismiss}
      title={existing ? 'Edit area' : 'New area'}
      variant="creation"
    >
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32 }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        automaticallyAdjustKeyboardInsets
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
      >

        <Label>NAME</Label>
        <VYBInput
          ref={inputRef}
          value={name} onChangeText={setName}
          placeholder="Health, Business, Mind…"
          selectionColor={C.gold}
          returnKeyType="done"
          onSubmitEditing={() => Keyboard.dismiss()}
        />

        {!existing && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" style={{ marginTop: 10 }}>
            <View style={{ flexDirection: 'row', gap: 6, paddingVertical: 4 }}>
              {AREA_PRESETS.map(p => (
                <VYBChip
                  key={p.name}
                  label={p.name}
                  tone="neutral"
                  selected={false}
                  size="sm"
                  onPress={() => { setName(p.name); setIcon(p.icon); setColor(p.color); }}
                />
              ))}
            </View>
          </ScrollView>
        )}

        <Label style={{ marginTop: 18 }}>ICON</Label>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 }}>
          {ICONS.map(n => {
            const selected = icon === n;
            const Comp = toComponent(n);
            return (
              <Pressable key={n} onPress={() => setIcon(n)}
                style={{
                  width: 44, height: 44, borderRadius: 22,
                  backgroundColor: selected ? tint.faint : C.bgOverlay,
                  borderColor: selected ? tint.border : C.borderSubtle, borderWidth: 1,
                  alignItems: 'center', justifyContent: 'center',
                }}>
                <Comp size={18} color={selected ? tint.primary : C.textSecondary} />
              </Pressable>
            );
          })}
        </View>

        <Label style={{ marginTop: 18 }}>COLOR</Label>
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 6, marginBottom: 22 }}>
          {COLORS.map(c => {
            const t = colorToHex(c);
            const selected = color === c;
            return (
              <Pressable key={c} onPress={() => setColor(c)}
                style={{
                  width: 36, height: 36, borderRadius: 18,
                  backgroundColor: t.primary,
                  borderColor: selected ? C.textPrimary : 'transparent', borderWidth: 2,
                }}/>
            );
          })}
        </View>

        <GoldButton variant="complete" size="lg" onPress={save}
          style={{ alignSelf: 'stretch', justifyContent: 'center' }}>
          {busy ? '…' : existing ? 'Save changes' : 'Create area'}
        </GoldButton>
      </ScrollView>
    </VYBCreationSheet>
  );
}

function Label({ children, style }: any) {
  return <Text style={[{ fontFamily: F.sansBold, fontSize: 10, color: C.textMuted, letterSpacing: 2, marginBottom: 6 }, style]}>{children}</Text>;
}

