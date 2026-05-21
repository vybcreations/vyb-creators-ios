import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, Pressable, Alert, ScrollView, Keyboard } from 'react-native';
import { Minus, Plus } from 'lucide-react-native';
import { DraggableSheet, SheetHeader } from '../../components/DraggableSheet';
import { GoldButton } from '../../components/primitives';
import { colors as C, fonts as F } from '../../theme';
import { logReadingSession } from '../../lib/reading';
import { useAuth } from '../../lib/auth';
import { hSuccess } from '../../lib/haptics';

/**
 * AddPagesSheet — quick log of pages already read, no timer.
 *
 * Start page is locked from the book's current page. End page editable.
 * Saved session has duration_seconds = null so the list shows time as absent.
 */
export function AddPagesSheet({
  visible, onDismiss, onSaved, bookId, bookCurrentPage, totalPages,
}: {
  visible: boolean;
  onDismiss: () => void;
  onSaved: () => void;
  bookId: string;
  bookCurrentPage: number;
  totalPages: number | null;
}) {
  const { session } = useAuth();
  const startRef = useRef<number>(bookCurrentPage);
  const [endPage, setEndPage] = useState<number>(bookCurrentPage);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!visible) { Keyboard.dismiss(); return; }
    startRef.current = bookCurrentPage;
    setEndPage(bookCurrentPage);
  }, [visible, bookCurrentPage]);

  const start = startRef.current;
  const clampEnd = (n: number) => Math.max(start, totalPages ? Math.min(totalPages, n) : n);
  const setEnd = (n: number) => setEndPage(clampEnd(n));
  const pages = Math.max(0, endPage - start);

  const save = async () => {
    if (!session || pages <= 0) {
      Alert.alert('Pages read', 'End page must be greater than the start page.');
      return;
    }
    setBusy(true);
    try {
      await logReadingSession(session.user.id, bookId, {
        start_page: start,
        end_page: endPage,
        elapsedSeconds: null,
        note: null,
      });
      hSuccess();
      onSaved();
      onDismiss();
    } catch (e: any) {
      Alert.alert('Could not save', e?.message || 'Unknown error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <DraggableSheet visible={visible} onDismiss={onDismiss} showClose={false}>
      <SheetHeader title="Add pages" onClose={onDismiss} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20 }} keyboardShouldPersistTaps="handled">
        <Text style={{ fontFamily: F.sans, fontSize: 13, color: C.textMuted, textAlign: 'center', marginBottom: 18, marginTop: -6 }}>
          Log pages you already read — no timer.
        </Text>

        {/* Start / End */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 18 }}>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={Label}>START</Text>
            <Text style={{ fontFamily: F.sansHeavy, fontSize: 30, color: C.textSecondary, letterSpacing: -0.5, marginTop: 6 }}>{start}</Text>
            <Text style={{ fontFamily: F.mono, fontSize: 10, color: C.textFaint, marginTop: 4 }}>fixed</Text>
          </View>
          <Text style={{ fontFamily: F.mono, fontSize: 18, color: C.textMuted }}>→</Text>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={Label}>END</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 }}>
              <Pressable onPress={() => setEnd(endPage - 1)} hitSlop={8} style={btnSmall}>
                <Minus size={14} color={C.textPrimary} />
              </Pressable>
              <TextInput
                value={String(endPage)}
                onChangeText={t => setEnd(parseInt(t.replace(/\D/g, ''), 10) || start)}
                keyboardType="number-pad" selectionColor={C.gold}
                style={{ fontFamily: F.sansHeavy, fontSize: 30, color: C.textPrimary, minWidth: 64, textAlign: 'center', letterSpacing: -0.5 }}
              />
              <Pressable onPress={() => setEnd(endPage + 1)} hitSlop={8} style={btnSmall}>
                <Plus size={14} color={C.textPrimary} />
              </Pressable>
            </View>
            <Text style={{ fontFamily: F.mono, fontSize: 10, color: C.textFaint, marginTop: 4 }}>
              {totalPages ? `max ${totalPages}` : 'editable'}
            </Text>
          </View>
        </View>

        {/* Pages read summary */}
        <View style={{
          paddingVertical: 14, paddingHorizontal: 16, borderRadius: 14,
          backgroundColor: C.goldFaint, borderColor: 'rgba(201,169,97,0.3)', borderWidth: 1,
          flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22,
        }}>
          <Text style={{ fontFamily: F.sansBold, fontSize: 11, color: C.gold, letterSpacing: 2 }}>PAGES READ</Text>
          <Text style={{ fontFamily: F.sansHeavy, fontSize: 26, color: C.textPrimary, letterSpacing: -0.6 }}>{pages}</Text>
        </View>

        <GoldButton variant="complete" size="lg" onPress={save}
          style={{ alignSelf: 'stretch', justifyContent: 'center' }}>
          {busy ? '…' : 'Save'}
        </GoldButton>
      </ScrollView>
    </DraggableSheet>
  );
}

const Label = { fontFamily: F.sansBold, fontSize: 10, color: C.textMuted, letterSpacing: 2 } as const;
const btnSmall = {
  width: 28, height: 28, borderRadius: 14,
  backgroundColor: C.bgOverlay, borderColor: C.borderMid, borderWidth: 1,
  alignItems: 'center' as const, justifyContent: 'center' as const,
};
