import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, Pressable, Keyboard, Alert } from 'react-native';
import { BlurView } from 'expo-blur';
import { ArrowUp, Sparkles, Quote, FileText } from 'lucide-react-native';
import { colors as C, fonts as F } from '../../theme';
import { addEntry } from '../../lib/reading';
import { useAuth } from '../../lib/auth';
import { hLight } from '../../lib/haptics';
import { VoiceDictationButton, appendTranscript } from '../../components/VoiceDictationButton';

type Kind = 'idea' | 'quote' | 'note';

/**
 * EntryComposer — chat-style capture bar for the Entries panel.
 *
 * Top row: Idea / Quote / Note type pills.
 * Bottom row: page chip · text input · send button.
 *
 * Send keeps the keyboard open so the user can fire off many entries fast.
 */
export function EntryComposer({
  bookId, currentBookPage, onSent,
}: {
  bookId: string;
  currentBookPage: number | null;
  onSent?: () => void;
}) {
  const { session } = useAuth();
  const [kind, setKind] = useState<Kind>('idea');
  const [text, setText] = useState('');
  const [page, setPage] = useState<number | null>(currentBookPage ?? null);
  const [busy, setBusy] = useState(false);
  const [pageStr, setPageStr] = useState<string>(currentBookPage != null ? String(currentBookPage) : '');
  const [editingPage, setEditingPage] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const pageInputRef = useRef<TextInput>(null);

  // Mirror current book page until the user manually overrides it.
  // Manual edits set `page` to a value; we don't blow that away unless
  // `currentBookPage` changes again (book page changed externally).
  const lastSyncedBookPageRef = useRef<number | null>(currentBookPage ?? null);
  useEffect(() => {
    if (currentBookPage !== lastSyncedBookPageRef.current) {
      lastSyncedBookPageRef.current = currentBookPage;
      setPage(currentBookPage ?? null);
      setPageStr(currentBookPage != null ? String(currentBookPage) : '');
    }
  }, [currentBookPage]);

  const commitPage = () => {
    const n = parseInt(pageStr.replace(/\D/g, ''), 10);
    if (!isFinite(n) || n <= 0) {
      setPage(null);
      setPageStr('');
    } else {
      setPage(n);
      setPageStr(String(n));
    }
    setEditingPage(false);
  };

  const send = async () => {
    const body = text.trim();
    if (!body || !session) return;
    setBusy(true);
    try {
      await addEntry(session.user.id, bookId, { kind, body, page: page ?? null });
      hLight();
      setText('');
      // Keep keyboard up + cursor focused for rapid capture
      inputRef.current?.focus();
      onSent?.();
    } catch (e: any) {
      Alert.alert('Could not save', e?.message || 'Unknown error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View>
      {/* Type pills */}
      <View style={{ flexDirection: 'row', gap: 6, paddingHorizontal: 12, paddingBottom: 8 }}>
        <TypePill label="Idea"  Icon={Sparkles}  active={kind === 'idea'}  onPress={() => setKind('idea')} />
        <TypePill label="Quote" Icon={Quote}     active={kind === 'quote'} onPress={() => setKind('quote')} />
        <TypePill label="Note"  Icon={FileText}  active={kind === 'note'}  onPress={() => setKind('note')} />
      </View>

      {/* Composer bar — blurred pill */}
      <BlurView intensity={50} tint="dark" style={{
        marginHorizontal: 12, marginBottom: 6,
        borderRadius: 28, overflow: 'hidden',
        borderColor: C.borderMid, borderWidth: 1,
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', padding: 8, paddingLeft: 10, gap: 8 }}>
          {/* Page chip / inline editor */}
          {editingPage ? (
            <View style={{
              height: 32, paddingHorizontal: 10, borderRadius: 999,
              backgroundColor: C.goldFaint, borderColor: 'rgba(201,169,97,0.5)', borderWidth: 1,
              flexDirection: 'row', alignItems: 'center', gap: 4,
            }}>
              <Text style={{ fontFamily: F.mono, fontSize: 11, color: C.gold }}>p.</Text>
              <TextInput
                ref={pageInputRef}
                value={pageStr} onChangeText={setPageStr}
                keyboardType="number-pad" selectionColor={C.gold}
                onBlur={commitPage} onSubmitEditing={commitPage}
                returnKeyType="done"
                autoFocus
                style={{ fontFamily: F.mono, fontSize: 12, color: C.textPrimary, minWidth: 32, padding: 0, textAlign: 'center' }}
              />
            </View>
          ) : (
            <Pressable
              onPress={() => { setEditingPage(true); setTimeout(() => pageInputRef.current?.focus(), 0); }}
              hitSlop={6}
              style={{
                height: 32, paddingHorizontal: 12, borderRadius: 999,
                backgroundColor: page != null ? C.goldFaint : C.bgOverlay,
                borderColor: page != null ? 'rgba(201,169,97,0.4)' : C.borderSubtle, borderWidth: 1,
                alignItems: 'center', justifyContent: 'center',
              }}>
              <Text style={{
                fontFamily: F.mono, fontSize: 11,
                color: page != null ? C.gold : C.textMuted,
                letterSpacing: 0.4,
              }}>
                {page != null ? `p. ${page}` : 'no page'}
              </Text>
            </Pressable>
          )}

          {/* Main input */}
          <TextInput
            ref={inputRef}
            value={text}
            onChangeText={setText}
            onSubmitEditing={send}
            placeholder={kind === 'quote' ? 'Save a quote…' : kind === 'note' ? 'Jot a note…' : 'Capture an idea…'}
            placeholderTextColor={C.textMuted}
            returnKeyType="send"
            multiline={false}
            blurOnSubmit={false}
            selectionColor={C.gold}
            style={{
              flex: 1,
              fontFamily: kind === 'quote' ? F.serifItalic : F.sans,
              fontSize: 14, color: C.textPrimary,
              paddingVertical: 8,
            }}
          />

          <VoiceDictationButton size={34}
            onTranscript={(t) => setText(cur => appendTranscript(cur, t))}
          />

          {/* Send */}
          <Pressable
            onPress={send}
            disabled={!text.trim() || busy}
            style={{
              width: 36, height: 36, borderRadius: 18,
              backgroundColor: C.gold,
              opacity: !text.trim() || busy ? 0.35 : 1,
              alignItems: 'center', justifyContent: 'center',
              shadowColor: '#E8C275',
              shadowOpacity: text.trim() ? 0.45 : 0,
              shadowRadius: 16, shadowOffset: { width: 0, height: 0 },
            }}>
            <ArrowUp size={16} color={C.bgBase} strokeWidth={2.4} />
          </Pressable>
        </View>
      </BlurView>
    </View>
  );
}

function TypePill({ label, Icon, active, onPress }: { label: string; Icon: any; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={{
      paddingHorizontal: 12, height: 28, borderRadius: 999,
      backgroundColor: active ? C.goldFaint : C.bgOverlay,
      borderColor: active ? 'rgba(201,169,97,0.5)' : C.borderSubtle, borderWidth: 1,
      flexDirection: 'row', alignItems: 'center', gap: 6,
    }}>
      <Icon size={11} color={active ? C.gold : C.textMuted} />
      <Text style={{ fontFamily: F.sansBold, fontSize: 11, color: active ? C.gold : C.textSecondary, letterSpacing: 0.4 }}>
        {label}
      </Text>
    </Pressable>
  );
}
