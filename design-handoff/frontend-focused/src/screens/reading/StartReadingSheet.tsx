import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, Alert, ScrollView } from 'react-native';
import { DraggableSheet, SheetHeader } from '../../components/DraggableSheet';
import { GoldButton } from '../../components/primitives';
import { colors as C, fonts as F } from '../../theme';
import { Book, updateBook } from '../../lib/reading';
import { hSuccess } from '../../lib/haptics';

/**
 * StartReadingSheet — promote a wishlist book to "reading".
 *
 * Collects total pages (if missing/estimated) + starting page, then flips status
 * to 'reading' and stamps started_at. Does NOT create a reading session.
 */
export function StartReadingSheet({
  visible, onDismiss, book, onStarted,
}: {
  visible: boolean;
  onDismiss: () => void;
  book: Book;
  onStarted: () => void;
}) {
  const [totalStr, setTotalStr] = useState<string>(book.total_pages ? String(book.total_pages) : '');
  const [startStr, setStartStr] = useState<string>(book.current_page ? String(book.current_page) : '0');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setTotalStr(book.total_pages ? String(book.total_pages) : '');
    setStartStr(book.current_page ? String(book.current_page) : '0');
  }, [visible, book.id]);

  const estimated = book.page_confidence === 'low' || book.page_confidence === 'estimated';

  const start = async () => {
    const total = parseInt(totalStr.replace(/\D/g, ''), 10);
    const startPage = parseInt(startStr.replace(/\D/g, ''), 10);
    const safeStart = Number.isFinite(startPage) ? Math.max(0, startPage) : 0;

    if (totalStr.trim() && !Number.isFinite(total)) {
      Alert.alert('Total pages', 'Enter a valid number or leave the field empty.');
      return;
    }
    if (Number.isFinite(total) && total > 0 && safeStart > total) {
      Alert.alert('Page out of range', `Starting page can’t exceed ${total}.`);
      return;
    }

    setBusy(true);
    try {
      await updateBook(book.id, {
        status: 'reading',
        current_page: safeStart,
        total_pages: Number.isFinite(total) && total > 0 ? total : (book.total_pages ?? null),
        started_at: book.started_at ?? new Date().toISOString(),
        page_confidence: Number.isFinite(total) && total > 0 && totalStr !== String(book.total_pages) ? 'manual' : (book.page_confidence ?? 'none'),
      } as any);
      hSuccess();
      onStarted();
      onDismiss();
    } catch (e: any) {
      Alert.alert('Could not start', e?.message || 'Unknown error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <DraggableSheet visible={visible} onDismiss={onDismiss} showClose={false}>
      <SheetHeader title="Start reading" onClose={onDismiss} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24 }} keyboardShouldPersistTaps="handled">

        {/* Book summary */}
        <View style={{
          backgroundColor: C.bgElevated, borderColor: C.borderSubtle, borderWidth: 1,
          borderRadius: 14, padding: 14, marginBottom: 18,
        }}>
          <Text numberOfLines={2} style={{ fontFamily: F.serifItalic, fontSize: 17, color: C.textPrimary, letterSpacing: -0.3, lineHeight: 22 }}>
            {book.title}
          </Text>
          {book.author && (
            <Text numberOfLines={1} style={{ fontFamily: F.sans, fontSize: 12, color: C.textMuted, marginTop: 3 }}>
              {book.author}
            </Text>
          )}
        </View>

        {/* Total pages */}
        <Text style={Label}>TOTAL PAGES</Text>
        <View style={inputWrap}>
          <TextInput
            value={totalStr}
            onChangeText={t => setTotalStr(t.replace(/\D/g, ''))}
            placeholder="e.g. 333"
            placeholderTextColor={C.textFaint}
            keyboardType="number-pad" selectionColor={C.gold}
            style={inputText}
          />
        </View>
        {estimated && book.total_pages ? (
          <Text style={{ fontFamily: F.mono, fontSize: 10, color: C.textFaint, marginTop: 6, marginLeft: 4 }}>
            Estimated · you can edit it.
          </Text>
        ) : null}

        {/* Starting page */}
        <Text style={[Label, { marginTop: 16 }]}>WHAT PAGE ARE YOU ON?</Text>
        <View style={inputWrap}>
          <TextInput
            value={startStr}
            onChangeText={t => setStartStr(t.replace(/\D/g, ''))}
            placeholder="0"
            placeholderTextColor={C.textFaint}
            keyboardType="number-pad" selectionColor={C.gold}
            style={inputText}
          />
        </View>
        <Pressable
          onPress={() => setStartStr('0')}
          hitSlop={6}
          style={{
            alignSelf: 'flex-start', marginTop: 8,
            paddingHorizontal: 12, height: 28, borderRadius: 999,
            backgroundColor: C.bgOverlay, borderColor: C.borderSubtle, borderWidth: 1,
            justifyContent: 'center',
          }}>
          <Text style={{ fontFamily: F.sansBold, fontSize: 10.5, color: C.textSecondary, letterSpacing: 0.4 }}>
            Start from 0
          </Text>
        </Pressable>

        <GoldButton variant="complete" size="lg" onPress={start}
          style={{ alignSelf: 'stretch', justifyContent: 'center', marginTop: 22 }}>
          {busy ? '…' : 'Start'}
        </GoldButton>
      </ScrollView>
    </DraggableSheet>
  );
}

const Label = { fontFamily: F.sansBold, fontSize: 10, color: C.textMuted, letterSpacing: 1.6, marginLeft: 4, marginBottom: 6 } as const;
const inputWrap = {
  backgroundColor: C.bgElevated, borderColor: C.borderSubtle, borderWidth: 1,
  borderRadius: 14, paddingHorizontal: 14, height: 50, justifyContent: 'center' as const,
};
const inputText = { fontFamily: F.sansHeavy, fontSize: 22, color: C.textPrimary, letterSpacing: -0.4, padding: 0 } as const;
