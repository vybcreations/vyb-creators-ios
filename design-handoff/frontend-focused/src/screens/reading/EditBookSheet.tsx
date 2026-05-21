import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, Pressable, ScrollView, Alert, Animated, PanResponder, LayoutChangeEvent,
} from 'react-native';
import { Check, Trash2, BookOpen, Bookmark, PauseCircle, Play } from 'lucide-react-native';
import { DraggableSheet, SheetHeader } from '../../components/DraggableSheet';
import { GoldButton } from '../../components/primitives';
import { colors as C, fonts as F } from '../../theme';
import { Book, updateBook, deleteBook, markBookFinished } from '../../lib/reading';
import { hLight, hSelection, hSuccess } from '../../lib/haptics';

/**
 * EditBookSheet — quick edits for a book.
 *
 * Holds: current-page slider, status moves, mark finished, delete.
 * Manual page edits update only `books.current_page` — past sessions are untouched.
 */
export function EditBookSheet({
  visible, onDismiss, book, onSaved, onDeleted, onStartReading,
}: {
  visible: boolean;
  onDismiss: () => void;
  book: Book;
  onSaved: () => void;
  onDeleted: () => void;
  onStartReading?: () => void;
}) {
  const isWishlist = book.status === 'next';
  // Normalize total + current page so the rest of the sheet never sees
  // null / NaN / negative values regardless of what the DB row looks like.
  const total = safeInt(book.total_pages, 0);
  const initialPage = clamp(safeInt(book.current_page, 0), 0, total > 0 ? total : Number.MAX_SAFE_INTEGER);
  const [page, setPage] = useState<number>(initialPage);
  const [busy, setBusy] = useState(false);
  const [sliderActive, setSliderActive] = useState(false);

  // Reset local state every time the sheet re-opens so we don't leak stale values
  // from a previous book.
  useEffect(() => {
    if (visible) setPage(initialPage);
  }, [visible, book.id]);

  const pct = total > 0 ? Math.round((page / total) * 100) : 0;
  const dirty = page !== initialPage;

  const savePage = async () => {
    if (!dirty) { onDismiss(); return; }
    const safe = clamp(safeInt(page, 0), 0, total > 0 ? total : Number.MAX_SAFE_INTEGER);
    setBusy(true);
    try {
      await updateBook(book.id, { current_page: safe } as any);
      hSuccess();
      onSaved();
      onDismiss();
    } catch (e: any) {
      Alert.alert('Could not save', e?.message || 'Unknown error');
    } finally {
      setBusy(false);
    }
  };

  const handleFinish = () => {
    Alert.alert('Mark as finished?', 'Progress will jump to 100%.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Mark finished', onPress: async () => {
        await markBookFinished(book.id, total || null);
        hSuccess(); onSaved(); onDismiss();
      } },
    ]);
  };

  const setStatus = async (status: 'reading' | 'next' | 'paused') => {
    await updateBook(book.id, { status } as any);
    hLight(); onSaved(); onDismiss();
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete book?',
      'This removes it from your library along with its sessions and notes.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: async () => {
          await deleteBook(book.id);
          onDeleted();
          onDismiss();
        } },
      ],
    );
  };

  return (
    <DraggableSheet visible={visible} onDismiss={onDismiss} showClose={false}>
      <SheetHeader title="Edit book" onClose={onDismiss} />
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24 }}
        keyboardShouldPersistTaps="handled"
        scrollEnabled={!sliderActive}>

        {/* Wishlist short-circuit — offer Start Reading instead of progress editing */}
        {isWishlist && onStartReading && (
          <Pressable
            onPress={onStartReading}
            style={{
              backgroundColor: C.bgElevated, borderColor: 'rgba(201,169,97,0.45)', borderWidth: 1,
              borderRadius: 18, padding: 16, marginBottom: 16,
              flexDirection: 'row', alignItems: 'center', gap: 12,
            }}>
            <View style={{
              width: 36, height: 36, borderRadius: 18,
              backgroundColor: C.goldFaint, alignItems: 'center', justifyContent: 'center',
            }}>
              <Play size={14} color={C.gold} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: F.sansBold, fontSize: 13, color: C.textPrimary, letterSpacing: 0.2 }}>
                Start reading
              </Text>
              <Text style={{ fontFamily: F.sans, fontSize: 11, color: C.textMuted, marginTop: 2 }}>
                Set total pages and your starting page.
              </Text>
            </View>
          </Pressable>
        )}

        {/* Page slider — only when actively reading */}
        {!isWishlist && (total > 0 ? (
          <View style={{
            backgroundColor: C.bgElevated, borderColor: C.borderSubtle, borderWidth: 1,
            borderRadius: 18, padding: 16, marginBottom: 16,
          }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 12 }}>
              <View>
                <Text style={{ fontFamily: F.sansBold, fontSize: 10, color: C.textMuted, letterSpacing: 1.6 }}>CURRENT PAGE</Text>
                <Text style={{ fontFamily: F.mono, fontSize: 13, color: C.textPrimary, marginTop: 6 }}>
                  Page {page} / {total}
                </Text>
              </View>
              <Text style={{ fontFamily: F.sansHeavy, fontSize: 26, color: C.goldBright, letterSpacing: -0.6 }}>
                {pct}%
              </Text>
            </View>

            <PageSlider value={page} max={total} onChange={setPage} onActiveChange={setSliderActive} />

            <Text style={{ fontFamily: F.mono, fontSize: 10, color: C.textFaint, marginTop: 12, textAlign: 'center' }}>
              Drag to update. Past sessions stay unchanged.
            </Text>

            <GoldButton
              variant="complete" size="md" onPress={savePage}
              style={{ alignSelf: 'stretch', justifyContent: 'center', marginTop: 14, opacity: dirty ? 1 : 0.5 }}>
              {busy ? '…' : dirty ? 'Save page' : 'No changes'}
            </GoldButton>
          </View>
        ) : (
          <View style={{
            padding: 14, borderRadius: 14, borderColor: C.borderSubtle, borderWidth: 1, borderStyle: 'dashed',
            marginBottom: 16,
          }}>
            <Text style={{ fontFamily: F.sans, fontSize: 12, color: C.textMuted, textAlign: 'center' }}>
              No page count for this book — slider unavailable.
            </Text>
          </View>
        ))}

        {/* Status actions */}
        <Text style={{ fontFamily: F.sansBold, fontSize: 10, color: C.textMuted, letterSpacing: 1.6, marginBottom: 8, marginLeft: 4 }}>
          STATUS
        </Text>
        <View style={{ borderRadius: 14, backgroundColor: C.bgElevated, borderColor: C.borderSubtle, borderWidth: 1, overflow: 'hidden', marginBottom: 16 }}>
          {book.status !== 'finished' && (
            <Row icon={<Check size={16} color={C.gold} />} label="Mark as finished" onPress={handleFinish} />
          )}
          {book.status !== 'reading' && (
            <Row icon={<BookOpen size={16} color={C.textPrimary} />} label="Move to Reading" onPress={() => setStatus('reading')} />
          )}
          {book.status !== 'next' && (
            <Row icon={<Bookmark size={16} color={C.textPrimary} />} label="Move to Wishlist" onPress={() => setStatus('next')} />
          )}
          {book.status !== 'paused' && book.status !== 'finished' && (
            <Row icon={<PauseCircle size={16} color={C.textPrimary} />} label="Pause" onPress={() => setStatus('paused')} />
          )}
        </View>

        {/* Danger */}
        <Pressable onPress={handleDelete} style={{
          flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
          paddingVertical: 14, borderRadius: 14,
          borderColor: 'rgba(192,86,67,0.4)', borderWidth: 1,
        }}>
          <Trash2 size={14} color={C.clay} />
          <Text style={{ fontFamily: F.sansBold, fontSize: 13, color: C.clay, letterSpacing: 0.3 }}>
            Delete book
          </Text>
        </Pressable>
      </ScrollView>
    </DraggableSheet>
  );
}

function Row({ icon, label, onPress }: { icon: React.ReactNode; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={{
      flexDirection: 'row', alignItems: 'center', gap: 12,
      paddingHorizontal: 14, paddingVertical: 14,
      borderBottomColor: C.borderSubtle, borderBottomWidth: 0,
    }}>
      {icon}
      <Text style={{ fontFamily: F.sansBold, fontSize: 13, color: C.textPrimary, letterSpacing: 0.2 }}>{label}</Text>
    </Pressable>
  );
}

function safeInt(v: any, fallback: number): number {
  const n = typeof v === 'number' ? v : parseInt(v, 10);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

function clamp(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}

/**
 * PageSlider — custom slider with PanResponder.
 *
 * Why refs everywhere: PanResponder.create captures its handlers once. If we
 * read `trackW` / `max` / `onChange` directly from closure, the first render
 * (where trackW=0) is frozen forever → every drag computes `(x / 0) * max` and
 * the value snaps to 0. Mirroring live state into refs is what fixes it.
 *
 * Also: we use `pageX - trackPageX` (screen-absolute touch minus the track's
 * absolute origin) instead of `locationX`, which is unreliable across moves.
 */
function PageSlider({ value, max, onChange, onActiveChange }: {
  value: number; max: number; onChange: (n: number) => void;
  onActiveChange?: (active: boolean) => void;
}) {
  const [trackW, setTrackW] = useState(0);
  const trackRef = useRef<View>(null);
  const trackWRef = useRef(0);
  const trackPageXRef = useRef(0);
  const maxRef = useRef(max);
  const onChangeRef = useRef(onChange);
  const lastValRef = useRef(value);

  // Mirror live props/state into refs so the PanResponder closures see fresh values.
  useEffect(() => { trackWRef.current = trackW; }, [trackW]);
  useEffect(() => { maxRef.current = max; }, [max]);
  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);

  const xToVal = (x: number) => {
    const w = trackWRef.current;
    const m = maxRef.current;
    if (w <= 0 || m <= 0) return 0;
    const clamped = Math.max(0, Math.min(w, x));
    const v = Math.round((clamped / w) * m);
    return Number.isFinite(v) ? v : 0;
  };

  const handleTouch = (pageX: number) => {
    const x = pageX - trackPageXRef.current;
    const v = xToVal(x);
    if (v !== lastValRef.current) { lastValRef.current = v; hSelection(); }
    onChangeRef.current(v);
  };

  const onActiveRef = useRef(onActiveChange);
  useEffect(() => { onActiveRef.current = onActiveChange; }, [onActiveChange]);

  // Aggressive responder claim:
  //  - capture both phases so ancestor ScrollViews / the DraggableSheet
  //    drag-to-dismiss (which fires on dy>2) can't snatch the gesture mid-drag.
  //  - never release on termination request, so vertical wobble doesn't hand
  //    the move responder over to the sheet.
  //  - signal active state up so the parent can disable ScrollView scrolling.
  const responder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onStartShouldSetPanResponderCapture: () => true,
    onMoveShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponderCapture: () => true,
    onPanResponderTerminationRequest: () => false,
    onShouldBlockNativeResponder: () => true,
    onPanResponderGrant: (e) => {
      onActiveRef.current?.(true);
      handleTouch(e.nativeEvent.pageX);
    },
    onPanResponderMove: (e) => handleTouch(e.nativeEvent.pageX),
    onPanResponderRelease: () => { onActiveRef.current?.(false); },
    onPanResponderTerminate: () => { onActiveRef.current?.(false); },
  })).current;

  const onLayout = (e: LayoutChangeEvent) => {
    setTrackW(e.nativeEvent.layout.width);
    // Capture the track's absolute screen X so pageX math works regardless of
    // where the sheet ends up on screen (and after orientation changes).
    trackRef.current?.measureInWindow((x) => { trackPageXRef.current = x; });
  };

  const valToX = (v: number) => {
    if (trackW <= 0 || max <= 0) return 0;
    const safe = Number.isFinite(v) ? v : 0;
    return Math.max(0, Math.min(trackW, (safe / max) * trackW));
  };
  const thumbX = valToX(value);

  return (
    <View
      ref={trackRef}
      onLayout={onLayout}
      {...responder.panHandlers}
      style={{ height: 36, justifyContent: 'center' }}>
      {/* Track */}
      <View style={{ height: 4, borderRadius: 2, backgroundColor: C.borderSubtle, overflow: 'hidden' }}>
        <View style={{ width: thumbX, height: '100%', backgroundColor: C.gold }} />
      </View>
      {/* Thumb */}
      <View pointerEvents="none" style={{
        position: 'absolute', left: thumbX - 12, top: 6,
        width: 24, height: 24, borderRadius: 12,
        backgroundColor: C.goldBright,
        borderColor: '#fff', borderWidth: 0,
        shadowColor: '#E8C275', shadowOpacity: 0.5, shadowRadius: 8, shadowOffset: { width: 0, height: 0 },
      }} />
    </View>
  );
}
