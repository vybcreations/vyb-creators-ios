import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, Alert, ScrollView, Keyboard } from 'react-native';
import { DraggableSheet, SheetHeader } from '../../components/DraggableSheet';
import { GoldButton } from '../../components/primitives';
import { colors as C, fonts as F } from '../../theme';
import { updateGoals } from '../../lib/reading';
import { useAuth } from '../../lib/auth';

export function GoalsSheet({
  visible, onDismiss, onSaved, year, month,
}: {
  visible: boolean;
  onDismiss: () => void;
  onSaved: () => void;
  year: number | null;
  month: number | null;
}) {
  const { session } = useAuth();
  const [y, setY] = useState(year ? String(year) : '');
  const [m, setM] = useState(month ? String(month) : '');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!visible) { Keyboard.dismiss(); return; }
    setY(year ? String(year) : '');
    setM(month ? String(month) : '');
  }, [visible, year, month]);

  const save = async () => {
    if (!session) return;
    setBusy(true);
    try {
      await updateGoals(session.user.id,
        y ? parseInt(y, 10) : null,
        m ? parseInt(m, 10) : null);
      onSaved();
      onDismiss();
    } catch (e: any) {
      Alert.alert('Could not save', e?.message || 'Unknown error');
    } finally { setBusy(false); }
  };

  return (
    <DraggableSheet visible={visible} onDismiss={onDismiss} maxHeightFraction={0.6} showClose={false}>
      <SheetHeader title="Reading goals" onClose={onDismiss} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20 }} keyboardShouldPersistTaps="handled">
        <Text style={{ fontFamily: F.sans, fontSize: 13, color: C.textMuted, marginBottom: 22, marginTop: -6 }}>
          Optional. Leave blank to skip a goal.
        </Text>

        <Goal label="This year"  value={y} onChange={setY} placeholder="12 books" />
        <Goal label="This month" value={m} onChange={setM} placeholder="1 book" />

        <View style={{ height: 12 }} />
        <GoldButton variant="complete" size="lg" onPress={save}
          style={{ alignSelf: 'stretch', justifyContent: 'center' }}>
          {busy ? '…' : 'Save goals'}
        </GoldButton>
      </ScrollView>
    </DraggableSheet>
  );
}

function Goal({ label, value, onChange, placeholder }: any) {
  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={{ fontFamily: F.sansBold, fontSize: 10, color: C.textMuted, letterSpacing: 2, marginBottom: 6 }}>
        {label.toUpperCase()}
      </Text>
      <TextInput
        value={value} onChangeText={onChange} placeholder={placeholder}
        placeholderTextColor={C.textFaint}
        keyboardType="number-pad" selectionColor={C.gold}
        style={{
          fontFamily: F.sans, fontSize: 15, color: C.textPrimary,
          borderBottomColor: C.borderMid, borderBottomWidth: 1, paddingVertical: 8,
        }}
      />
    </View>
  );
}
