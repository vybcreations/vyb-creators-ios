import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, Pressable, Alert, ScrollView, Keyboard } from 'react-native';
import { Sparkles, Quote, FileText } from 'lucide-react-native';
import { DraggableSheet, SheetHeader } from '../../components/DraggableSheet';
import { GoldButton } from '../../components/primitives';
import { colors as C, fonts as F } from '../../theme';
import { addEntry } from '../../lib/reading';
import { useAuth } from '../../lib/auth';

type Kind = 'idea' | 'quote' | 'note';

export function EntrySheet({
  visible, onDismiss, onSaved, bookId, currentPage = 0,
}: {
  visible: boolean;
  onDismiss: () => void;
  onSaved: () => void;
  bookId: string;
  currentPage?: number;
}) {
  const { session } = useAuth();
  const [kind, setKind] = useState<Kind>('idea');
  const [body, setBody] = useState('');
  const [page, setPage] = useState('');
  const [busy, setBusy] = useState(false);
  const ref = useRef<TextInput>(null);

  useEffect(() => {
    if (!visible) { Keyboard.dismiss(); return; }
    setKind('idea'); setBody(''); setPage(currentPage ? String(currentPage) : '');
    const t = setTimeout(() => ref.current?.focus(), 340);
    return () => clearTimeout(t);
  }, [visible, currentPage]);

  const save = async () => {
    if (!session || !body.trim()) return;
    setBusy(true);
    try {
      await addEntry(session.user.id, bookId, {
        kind, body: body.trim(),
        page: page ? parseInt(page, 10) : null,
      });
      onSaved();
      onDismiss();
    } catch (e: any) {
      Alert.alert('Could not save', e?.message || 'Unknown error');
    } finally { setBusy(false); }
  };

  const tabs: { id: Kind; Icon: any; label: string }[] = [
    { id: 'idea',  Icon: Sparkles, label: 'Idea' },
    { id: 'quote', Icon: Quote,    label: 'Quote' },
    { id: 'note',  Icon: FileText, label: 'Note' },
  ];

  return (
    <DraggableSheet visible={visible} onDismiss={onDismiss} showClose={false}>
      <SheetHeader title="Add entry" onClose={onDismiss} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20 }} keyboardShouldPersistTaps="handled">

        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
          {tabs.map(t => {
            const active = t.id === kind;
            return (
              <Pressable key={t.id} onPress={() => setKind(t.id)} style={{
                flex: 1, height: 44, borderRadius: 12,
                backgroundColor: active ? C.goldFaint : C.bgOverlay,
                borderColor: active ? 'rgba(201,169,97,0.5)' : C.borderSubtle, borderWidth: 1,
                flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}>
                <t.Icon size={14} color={active ? C.gold : C.textSecondary} />
                <Text style={{ fontFamily: F.sansBold, fontSize: 13, color: active ? C.gold : C.textSecondary, letterSpacing: 0.3 }}>
                  {t.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <TextInput
          ref={ref}
          value={body} onChangeText={setBody}
          placeholder={
            kind === 'idea'  ? 'A thought, connection, or insight…'
          : kind === 'quote' ? 'A passage worth keeping…'
          :                    'Just a note for your future self.'
          }
          placeholderTextColor={C.textFaint}
          multiline selectionColor={C.gold}
          style={{
            fontFamily: kind === 'quote' ? F.serifItalic : F.sans,
            fontSize: kind === 'quote' ? 15 : 14,
            color: C.textPrimary, lineHeight: 22,
            backgroundColor: C.bgOverlay, borderColor: C.borderSubtle, borderWidth: 1,
            borderRadius: 14, padding: 14, minHeight: 140, textAlignVertical: 'top', marginBottom: 14,
          }}
        />

        <Text style={{ fontFamily: F.sansBold, fontSize: 10, color: C.textMuted, letterSpacing: 2, marginBottom: 6 }}>PAGE (OPTIONAL)</Text>
        <TextInput
          value={page} onChangeText={setPage}
          placeholder="—" placeholderTextColor={C.textFaint}
          keyboardType="number-pad" selectionColor={C.gold}
          style={{
            fontFamily: F.sans, fontSize: 15, color: C.textPrimary,
            borderBottomColor: C.borderMid, borderBottomWidth: 1, paddingVertical: 8, marginBottom: 24,
          }}
        />

        <GoldButton variant="complete" size="lg" onPress={save}
          style={{ alignSelf: 'stretch', justifyContent: 'center' }}>
          {busy ? '…' : 'Save entry'}
        </GoldButton>
      </ScrollView>
    </DraggableSheet>
  );
}
