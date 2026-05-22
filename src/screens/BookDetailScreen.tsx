import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, ScrollView, FlatList, Pressable, ActivityIndicator, Alert,
  NativeScrollEvent, NativeSyntheticEvent, useWindowDimensions,
  KeyboardAvoidingView, Platform, Keyboard, Animated,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Plus, Sparkles, Quote, FileText, MoreHorizontal,
  Minus, Trash2, Timer as TimerIcon, PlusSquare, Star,
} from 'lucide-react-native';
import { useFavoriteBooks, toggleFavoriteBook, FavoriteLimitError } from '../lib/favoriteBooks';
import { IconButton, GoldButton, Tx } from '../components/primitives';
import { VYBCard, VYBScreenHeader, VYBEmpty } from '../components/ui';
import { BookCover3D } from '../components/BookCover3D';
import { ActionMenu } from '../components/ActionMenu';
import { colors as C, fonts as F, KEYBOARD_GAP } from '../theme';
import { useAuth } from '../lib/auth';
import {
  useBook, updateBook, deleteEntry, restoreEntry, deleteSession,
  bookProgressPct, formatDuration, logReadingSession,
  ReadingEntry, ReadingSession,
} from '../lib/reading';
import { useUndoToast } from '../components/UndoToast';
import { hLight, hSelection, hSuccess, hWarning, hMedium } from '../lib/haptics';
import { SessionSheet, ActiveSession } from './reading/SessionSheet';
import { AddPagesSheet } from './reading/AddPagesSheet';
import { EditBookSheet } from './reading/EditBookSheet';
import { StartReadingSheet } from './reading/StartReadingSheet';
import { EntryComposer } from './reading/EntryComposer';
import { MiniSessionBar } from '../components/MiniSessionBar';

type EntryFilter = 'all' | 'idea' | 'quote' | 'note';

export function BookDetailScreen({ navigation, route }: any) {
  const { session } = useAuth();
  const bookId: string = route?.params?.bookId;
  const { book, sessions, entries, loading, refresh } = useBook(bookId);
  const { requestUndo } = useUndoToast();

  // Entry delete is hoisted here so we can pair it with the global undo toast.
  // EntryRow only handles the local confirm UX + calls back here on tap-2.
  const handleConfirmedDeleteEntry = async (entry: ReadingEntry) => {
    try {
      await deleteEntry(entry.id);
      refresh();
      requestUndo({
        label: 'Entry deleted · Tap to undo',
        onUndo: async () => {
          try { await restoreEntry(entry); refresh(); }
          catch (e: any) { Alert.alert('Could not undo', e?.message || 'Please try again.'); }
        },
      });
    } catch (e: any) {
      Alert.alert('Could not delete', e?.message || 'Please try again.');
    }
  };
  // Live viewport width — pager panel width must match exactly so each swipe
  // travels one full screen. Also recomputed on iPad rotation.
  const { width: SCREEN_W } = useWindowDimensions();

  const [sessionOpen, setSessionOpen] = useState(false);
  const [pagesSheetOpen, setPagesSheetOpen] = useState(false);
  const [chooserOpen, setChooserOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [startOpen, setStartOpen] = useState(false);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [page, setPage] = useState(0); // 0 = Book, 1 = Entries
  // Composer enter/exit animation. Mounted is held true through the fade-out so
  // the controls slide out smoothly before unmounting (otherwise the height
  // collapse would clip the animation).
  const composerAnim = useRef(new Animated.Value(0)).current;
  const [composerMounted, setComposerMounted] = useState(false);
  useEffect(() => {
    if (page === 1) {
      setComposerMounted(true);
      Animated.timing(composerAnim, { toValue: 1, duration: 220, useNativeDriver: true }).start();
    } else {
      Animated.timing(composerAnim, { toValue: 0, duration: 180, useNativeDriver: true })
        .start(({ finished }) => { if (finished) setComposerMounted(false); });
    }
  }, [page]);
  // Mini session bar fades + collapses while the keyboard is open so the
  // composer owns the screen. Timer keeps ticking — only the visual is hidden.
  const barAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.timing(barAnim, {
      toValue: keyboardOpen ? 0 : 1,
      duration: keyboardOpen ? 160 : 220,
      useNativeDriver: false, // animating height too
    }).start();
  }, [keyboardOpen]);
  const [entryFilter, setEntryFilter] = useState<EntryFilter>('all');
  const [coverActive, setCoverActive] = useState(false); // true while the user is touching the cover
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const confirmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (confirmTimerRef.current) { clearTimeout(confirmTimerRef.current); confirmTimerRef.current = null; }
    if (confirmDeleteId) {
      confirmTimerRef.current = setTimeout(() => setConfirmDeleteId(null), 2500);
    }
    return () => { if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current); };
  }, [confirmDeleteId]);

  // ─── Active reading session (lives at this screen so it survives panel
  // switches, modal closes, and entries flow.) ────────────────────────────
  const [active, setActive] = useState<ActiveSession | null>(null);
  const [barExpanded, setBarExpanded] = useState(false);
  const completedFiredRef = useRef(false);

  // Tick — single interval, paused when not running.
  useEffect(() => {
    if (!active?.running) return;
    const id = setInterval(() => {
      setActive(s => s ? { ...s, elapsedSeconds: s.elapsedSeconds + 1 } : null);
    }, 1000);
    return () => clearInterval(id);
  }, [active?.running]);

  // Countdown completion → subtle haptic + auto-pause (once)
  useEffect(() => {
    if (!active) { completedFiredRef.current = false; return; }
    if (active.elapsedSeconds >= active.targetSeconds && active.running && !completedFiredRef.current) {
      completedFiredRef.current = true;
      hSuccess();
      setActive(s => s ? { ...s, running: false } : null);
    }
  }, [active?.elapsedSeconds, active?.running, active?.targetSeconds]);

  const startSession = (targetSeconds: number) => {
    setActive({
      startPage: book?.current_page ?? 0,
      endPage:   book?.current_page ?? 0,
      targetSeconds,
      elapsedSeconds: 0,
      running: true,
    });
    completedFiredRef.current = false;
    setBarExpanded(false);
    setSessionOpen(false);
  };

  const togglePauseResume = () => setActive(s => s ? { ...s, running: !s.running } : null);
  const resetTimer = () => { completedFiredRef.current = false; setActive(s => s ? { ...s, elapsedSeconds: 0, running: true } : null); };
  const cancelSession = () => { setActive(null); setBarExpanded(false); setSessionOpen(false); };
  const setActiveEndPage = (n: number) => setActive(s => s ? { ...s, endPage: n } : null);

  const saveActiveSession = async () => {
    if (!session || !active || !book) return;
    const pages = Math.max(0, active.endPage - active.startPage);
    if (pages <= 0) {
      Alert.alert('Pages read', 'Enter the page you stopped at — it must be greater than the start page.');
      return;
    }
    try {
      await logReadingSession(session.user.id, book.id, {
        start_page: active.startPage,
        end_page: active.endPage,
        elapsedSeconds: active.elapsedSeconds > 0 ? active.elapsedSeconds : null,
        note: null,
      });
      hSuccess();
      setActive(null);
      setBarExpanded(false);
      setSessionOpen(false);
      refresh();
    } catch (e: any) {
      Alert.alert('Could not save', e?.message || 'Unknown error');
    }
  };

  const hScrollRef = useRef<ScrollView>(null);

  // On rotation (SCREEN_W changes) the pager needs to re-anchor to the active
  // panel — otherwise the offset is stale and the next swipe lands mid-page.
  useEffect(() => {
    hScrollRef.current?.scrollTo({ x: page * SCREEN_W, animated: false });
  }, [SCREEN_W]);

  useFocusEffect(React.useCallback(() => { refresh(); }, [refresh]));

  // Track keyboard visibility so we can hide the bottom Book/Entries switcher
  // while the user is typing in the entry composer.
  useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const s = Keyboard.addListener(showEvt, () => setKeyboardOpen(true));
    const h = Keyboard.addListener(hideEvt, () => setKeyboardOpen(false));
    return () => { s.remove(); h.remove(); };
  }, []);

  if (loading || !book) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bgBase, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={C.gold} />
      </SafeAreaView>
    );
  }

  const pct = bookProgressPct(book);
  const isWishlist = book.status === 'next';

  const adjustPage = async (delta: number) => {
    const newPage = Math.max(0, Math.min(book.total_pages || 99999, book.current_page + delta));
    await updateBook(book.id, { current_page: newPage } as any);
    refresh();
  };

  // Sessions arrive sorted started_at DESC. sessions[0] is the latest and is
  // the only one that can be deleted without breaking sequential history.
  const handleDeleteSession = (s: ReadingSession, isLatest: boolean) => {
    if (!isLatest) {
      Alert.alert('Locked', 'Only the latest session can be edited or deleted.');
      return;
    }
    const next = sessions[1];  // next-newest after this one
    const rollback = next ? next.end_page : s.start_page;
    Alert.alert(
      'Delete latest session?',
      `Pages will roll back to ${rollback}.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: async () => {
          await deleteSession(s.id);
          await updateBook(book.id, { current_page: rollback } as any);
          refresh();
        } },
      ],
    );
  };

  const onMomentumEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.round(e.nativeEvent.contentOffset.x / SCREEN_W);
    if (next !== page) hSelection();
    setPage(next);
  };
  const goToPage = (p: number) => {
    hSelection();
    hScrollRef.current?.scrollTo({ x: p * SCREEN_W, animated: true });
  };

  const filteredEntries = entryFilter === 'all'
    ? entries
    : entries.filter(e => e.kind === entryFilter);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bgBase }} edges={['top', 'bottom']}>
      {/* Header — back · centered status · favorite + menu.
          variant="detail" gives a fixed 3-column layout so the status label is
          always centered on the screen, not pushed by the right-side actions. */}
      <VYBScreenHeader
        variant="detail"
        back
        onBack={() => navigation.goBack()}
        title={book.status.toUpperCase()}
        rightAction={
          <>
            <FavoriteStarButton bookId={book.id} />
            <IconButton size={36} onPress={() => setEditOpen(true)}><MoreHorizontal size={16} color={C.textPrimary} /></IconButton>
          </>
        }
      />

      {/* Swipeable panels — flex:1 so panels fill the viewport. No root vertical
          scroll. Pager is disabled while the user is interacting with the cover.
          bounces=true gives iOS-native rubber-band resistance at the edges
          (Book swiping outward, Entries swiping outward) — the user can pull a
          little, feels the resistance, and snaps back. They never reach an
          empty panel because pagingEnabled snaps to the nearest valid page. */}
      <ScrollView
        ref={hScrollRef}
        horizontal pagingEnabled
        scrollEnabled={!coverActive}
        bounces={true}
        alwaysBounceHorizontal={false}
        decelerationRate="fast"
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onMomentumEnd}
        scrollEventThrottle={16}
        style={{ flex: 1 }}>

        {/* ── Panel 1 — Book ────────────────────────────────── */}
        <View style={{ width: SCREEN_W, flex: 1 }}>
          {/* Fixed top: hero + title */}
          <View style={{ alignItems: 'center', paddingTop: 10, paddingBottom: 6 }}>
            <BookCover3D
              coverUrl={book.cover_url} size="md" intensity="strong"
              fallbackTitle={book.title}
              onActiveChange={setCoverActive}
            />
            <Text numberOfLines={2} style={{ fontFamily: F.serifItalic, fontSize: 22, color: C.textPrimary, marginTop: 18, textAlign: 'center', letterSpacing: -0.5, paddingHorizontal: 22 }}>
              {book.title}
            </Text>
            {book.author && (
              <Text style={{ fontFamily: F.sans, fontSize: 13, color: C.textMuted, marginTop: 2 }}>{book.author}</Text>
            )}
          </View>

          {/* Progress card — hidden for wishlist books (not active reading) */}
          {!isWishlist && (
            <View style={{ marginHorizontal: 16, marginTop: 14 }}>
              <VYBCard level="widget" accent="gold" padding={16}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 10 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6 }}>
                    <Text style={{ fontFamily: F.sansHeavy, fontSize: 36, color: C.goldBright, letterSpacing: -1.2, lineHeight: 36 }}>{pct}</Text>
                    <Text style={{ fontFamily: F.sansHeavy, fontSize: 18, color: C.goldBright, marginBottom: 4 }}>%</Text>
                  </View>
                  <Text style={{ fontFamily: F.mono, fontSize: 12, color: C.textMuted }}>
                    {book.current_page}{book.total_pages ? ` / ${book.total_pages}` : ''}
                  </Text>
                </View>

                <View style={{ height: 4, backgroundColor: C.borderSubtle, borderRadius: 2, overflow: 'hidden' }}>
                  <View style={{ width: `${pct}%`, height: '100%', backgroundColor: C.gold }} />
                </View>

                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14 }}>
                  <Pressable onPress={() => adjustPage(-1)} style={stepBtn}><Minus size={14} color={C.textPrimary} /></Pressable>
                  <Pressable onPress={() => adjustPage(1)} style={stepBtn}><Plus size={14} color={C.textPrimary} /></Pressable>
                  <View style={{ flex: 1 }} />
                  <GoldButton variant="complete" size="md" onPress={() => active ? setBarExpanded(true) : setChooserOpen(true)}>
                    {active ? 'Open block' : '+ Session'}
                  </GoldButton>
                </View>
              </VYBCard>
            </View>
          )}

          {/* Wishlist state — calm CTA, no progress / sessions */}
          {isWishlist && (
            <View style={{ marginHorizontal: 16, marginTop: 14 }}>
              <VYBCard level="widget" padding={22}>
                <View style={{ alignItems: 'center' }}>
                  <Text style={Tx.label({ letterSpacing: 2 })}>WISHLIST</Text>
                  <Text style={{ fontFamily: F.serifItalic, fontSize: 15, color: C.textMuted, textAlign: 'center', marginTop: 10, lineHeight: 20 }}>
                    Not yet started. Set your starting page when you're ready.
                  </Text>
                  <GoldButton variant="complete" size="lg" onPress={() => setStartOpen(true)}
                    style={{ marginTop: 18, paddingHorizontal: 28 }}>
                    Start reading
                  </GoldButton>
                </View>
              </VYBCard>
            </View>
          )}

          {/* Sessions — internal scroll. flex:1 → fills remaining vertical space.
              Hidden for wishlist books since they have no reading sessions yet. */}
          {!isWishlist && (
          <View style={{ flex: 1, marginTop: 18, marginHorizontal: 16 }}>
            <Text style={Tx.label({ marginLeft: 4, marginBottom: 8, letterSpacing: 1.4 })}>
              SESSIONS · {sessions.length}
            </Text>
            {sessions.length === 0 ? (
              <VYBEmpty
                variant="dashed"
                title="No sessions yet. Start a session above."
              />
            ) : (
              <View style={{ flex: 1, backgroundColor: C.bgElevated, borderColor: C.borderSubtle, borderWidth: 1, borderRadius: 18, overflow: 'hidden' }}>
                <FlatList
                  data={sessions}
                  keyExtractor={s => s.id}
                  showsVerticalScrollIndicator={false}
                  renderItem={({ item: s, index }) => {
                    const isLatest = index === 0;
                    return (
                      <View style={{
                        flexDirection: 'row', alignItems: 'center',
                        paddingHorizontal: 14, paddingVertical: 12,
                        borderBottomColor: C.borderSubtle, borderBottomWidth: index < sessions.length - 1 ? 1 : 0,
                      }}>
                        <View style={{ flex: 1 }}>
                          {/* Pages dominate visually */}
                          <Text style={{ fontFamily: F.sansHeavy, fontSize: 20, color: C.goldBright, letterSpacing: -0.6 }}>
                            +{s.pages_read} <Text style={{ fontFamily: F.sansBold, fontSize: 10, color: C.gold, letterSpacing: 1.4 }}>PAGES</Text>
                          </Text>
                          <Text style={{ fontFamily: F.sans, fontSize: 12, color: C.textSecondary, marginTop: 4 }}>
                            p. {s.start_page} → p. {s.end_page}
                          </Text>
                          <Text style={{ fontFamily: F.mono, fontSize: 10, color: C.textMuted, marginTop: 2 }}>
                            {formatRelative(s.started_at)}
                            {formatDuration(s.duration_seconds) ? ` · ${formatDuration(s.duration_seconds)} read` : ''}
                          </Text>
                        </View>
                        <Pressable
                          onPress={() => handleDeleteSession(s, isLatest)}
                          hitSlop={8}
                          style={{ padding: 4, opacity: isLatest ? 1 : 0.28 }}>
                          <Trash2 size={14} color={isLatest ? C.clay : C.textFaint} />
                        </Pressable>
                      </View>
                    );
                  }}
                />
              </View>
            )}
          </View>
          )}
        </View>

        {/* ── Panel 2 — Entries (composer lives outside the pager) ── */}
        <View style={{ width: SCREEN_W, flex: 1 }}>
          {/* Header + filter chips (fixed) */}
          <View style={{ paddingHorizontal: 22, paddingTop: 8, paddingBottom: 10 }}>
            <Text style={Tx.label({ letterSpacing: 1.6 })}>FOR THIS BOOK</Text>
            <Text style={{ fontFamily: F.serifItalic, fontSize: 22, color: C.textPrimary, marginTop: 4, letterSpacing: -0.4 }}>
              Ideas, quotes & notes
            </Text>
            <View style={{ flexDirection: 'row', gap: 6, marginTop: 12 }}>
              <FilterChip label={`All · ${entries.length}`}                              active={entryFilter === 'all'}   onPress={() => setEntryFilter('all')} />
              <FilterChip label={`Ideas · ${entries.filter(e=>e.kind==='idea').length}`}  active={entryFilter === 'idea'}  onPress={() => setEntryFilter('idea')} />
              <FilterChip label={`Quotes · ${entries.filter(e=>e.kind==='quote').length}`} active={entryFilter === 'quote'} onPress={() => setEntryFilter('quote')} />
              <FilterChip label={`Notes · ${entries.filter(e=>e.kind==='note').length}`}  active={entryFilter === 'note'}  onPress={() => setEntryFilter('note')} />
            </View>
          </View>

          {/* Entries feed — internal scroll, newest at top */}
          <View style={{ flex: 1, paddingHorizontal: 16 }}>
            {filteredEntries.length === 0 ? (
              <View style={{
                padding: 22, borderRadius: 16, borderColor: C.borderSubtle, borderWidth: 1, borderStyle: 'dashed',
                alignItems: 'center',
              }}>
                <Text style={{ fontFamily: F.serifItalic, fontSize: 13, color: C.textMuted, textAlign: 'center', lineHeight: 19 }}>
                  {entries.length === 0
                    ? `Nothing captured yet.\nUse the composer to save the first idea.`
                    : `No ${entryFilter}s yet.`}
                </Text>
              </View>
            ) : (
              <FlatList
                data={filteredEntries}
                keyExtractor={e => e.id}
                showsVerticalScrollIndicator={false}
                renderItem={({ item }) => (
                  <EntryRow
                    entry={item}
                    confirming={confirmDeleteId === item.id}
                    onRequestConfirm={() => setConfirmDeleteId(item.id)}
                    onCancelConfirm={() => setConfirmDeleteId(null)}
                    onConfirmedDelete={() => { setConfirmDeleteId(null); handleConfirmedDeleteEntry(item); }}
                  />
                )}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={{ paddingBottom: 8 }}
              />
            )}
          </View>
        </View>
      </ScrollView>

      {/* Bottom area — composer (entries only) + mini bar + switcher.
          Wrapped in KeyboardAvoidingView so the composer lifts above the
          keyboard when the user taps the input. */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={-KEYBOARD_GAP}
      >
        {/* Composer — fades + slides in/out with the Entries panel */}
        {composerMounted && (
          <Animated.View
            pointerEvents={page === 1 ? 'auto' : 'none'}
            style={{
              opacity: composerAnim,
              transform: [{
                translateY: composerAnim.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }),
              }],
            }}>
            <EntryComposer
              bookId={book.id}
              currentBookPage={book.current_page ?? null}
              onSent={refresh}
            />
          </Animated.View>
        )}

        {active && (
          <Animated.View
            pointerEvents={keyboardOpen ? 'none' : 'auto'}
            style={{
              opacity: barAnim,
              transform: [{ translateY: barAnim.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }],
              maxHeight: barAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 400] }),
              overflow: 'hidden',
            }}>
            <MiniSessionBar
              active={active}
              expanded={barExpanded}
              onToggleExpand={() => setBarExpanded(e => !e)}
              onTogglePause={togglePauseResume}
              onReset={resetTimer}
              onCancel={cancelSession}
              onSave={saveActiveSession}
              onEndPageChange={setActiveEndPage}
              totalPages={book.total_pages}
            />
          </Animated.View>
        )}

        {/* Switcher — hidden while keyboard is open so it doesn't ride up with the composer */}
        {!keyboardOpen && (
          <View style={{ paddingHorizontal: 22, paddingTop: 6, paddingBottom: 4, alignItems: 'center' }}>
            <View style={{
              flexDirection: 'row', backgroundColor: C.bgElevated,
              borderColor: C.borderSubtle, borderWidth: 1,
              borderRadius: 999, padding: 4,
            }}>
              <PanelPill label="Book"    active={page === 0} onPress={() => goToPage(0)} />
              <PanelPill label="Entries" active={page === 1} onPress={() => goToPage(1)} />
            </View>
          </View>
        )}
      </KeyboardAvoidingView>

      <SessionSheet
        visible={sessionOpen}
        onDismiss={() => setSessionOpen(false)}
        bookCurrentPage={book.current_page}
        onStart={startSession}
      />
      <AddPagesSheet
        visible={pagesSheetOpen}
        onDismiss={() => setPagesSheetOpen(false)}
        onSaved={refresh}
        bookId={book.id}
        bookCurrentPage={book.current_page}
        totalPages={book.total_pages}
      />

      {/* Session chooser — Add pages, in-book block (page-tracking), or
          full-screen Focus Mode (uses the app's existing FocusScreen). */}
      <ActionMenu
        visible={chooserOpen}
        onDismiss={() => setChooserOpen(false)}
        title="Reading session"
        options={[
          {
            label: 'Add pages',
            icon: <PlusSquare size={16} color={C.textPrimary} />,
            onPress: () => setPagesSheetOpen(true),
          },
          {
            label: 'Start reading block',
            icon: <TimerIcon size={16} color={C.textPrimary} />,
            onPress: () => setSessionOpen(true),
          },
          {
            label: 'Open Focus Mode',
            icon: <TimerIcon size={16} color={C.gold} />,
            onPress: () => navigation.getParent()?.navigate('Focus', {
              task: book.title,
              minutes: 25,
            }),
          },
        ]}
      />

      <EditBookSheet
        visible={editOpen}
        onDismiss={() => setEditOpen(false)}
        book={book}
        onSaved={refresh}
        onDeleted={() => navigation.goBack()}
        onStartReading={() => { setEditOpen(false); setStartOpen(true); }}
      />

      <StartReadingSheet
        visible={startOpen}
        onDismiss={() => setStartOpen(false)}
        book={book}
        onStarted={refresh}
      />
    </SafeAreaView>
  );
}

function PanelPill({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={{
      paddingHorizontal: 22, height: 36, borderRadius: 999,
      backgroundColor: active ? C.goldFaint : 'transparent',
      alignItems: 'center', justifyContent: 'center',
    }}>
      <Text style={{ fontFamily: F.sansBold, fontSize: 12.5, color: active ? C.gold : C.textMuted, letterSpacing: 0.4 }}>
        {label}
      </Text>
    </Pressable>
  );
}

function FilterChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={{
      paddingHorizontal: 12, height: 28, borderRadius: 999,
      backgroundColor: active ? C.goldFaint : C.bgOverlay,
      borderColor: active ? 'rgba(201,169,97,0.45)' : C.borderSubtle, borderWidth: 1,
      alignItems: 'center', justifyContent: 'center',
    }}>
      <Text style={{ fontFamily: F.sansBold, fontSize: 11, color: active ? C.gold : C.textSecondary, letterSpacing: 0.3 }}>
        {label}
      </Text>
    </Pressable>
  );
}

function EntryRow({
  entry, confirming, onRequestConfirm, onCancelConfirm, onConfirmedDelete,
}: {
  entry: ReadingEntry;
  confirming: boolean;
  onRequestConfirm: () => void;
  onCancelConfirm: () => void;
  onConfirmedDelete: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const handleTrash = () => {
    if (!confirming) {
      hWarning();
      onRequestConfirm();
      return;
    }
    if (busy) return;
    setBusy(true);
    hMedium();
    // Parent handles the actual delete + undo toast. We just trigger it.
    onConfirmedDelete();
    setBusy(false);
  };
  const Icon = entry.kind === 'idea' ? Sparkles : entry.kind === 'quote' ? Quote : FileText;
  return (
    <View style={{
      backgroundColor: C.bgElevated,
      borderColor: confirming ? 'rgba(201,169,97,0.55)' : C.borderSubtle, borderWidth: 1,
      borderRadius: 14, padding: 14, marginBottom: 8,
    }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        <Icon size={12} color={C.gold} />
        <Text style={{ fontFamily: F.sansBold, fontSize: 10, color: C.gold, letterSpacing: 1.4 }}>
          {entry.kind.toUpperCase()}
        </Text>
        {entry.page && <Text style={{ fontFamily: F.mono, fontSize: 10, color: C.textMuted }}>· p. {entry.page}</Text>}
        <View style={{ flex: 1 }} />
        <Text style={{ fontFamily: F.mono, fontSize: 9.5, color: C.textFaint }}>{formatRelative(entry.created_at)}</Text>
      </View>
      <Text style={{
        fontFamily: entry.kind === 'quote' ? F.serifItalic : F.sans,
        fontSize: entry.kind === 'quote' ? 14 : 13,
        color: C.textPrimary, lineHeight: 20,
      }}>
        {entry.kind === 'quote' ? `"${entry.body}"` : entry.body}
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginTop: 10, gap: 8 }}>
        {confirming && (
          <Text style={{ fontFamily: F.sansBold, fontSize: 10, color: C.gold, letterSpacing: 1.2 }}>
            TAP AGAIN TO DELETE
          </Text>
        )}
        <Pressable
          onPress={handleTrash}
          hitSlop={10}
          disabled={busy}
          style={{
            width: 28, height: 28, borderRadius: 14,
            backgroundColor: confirming ? C.goldFaint : 'transparent',
            borderColor: confirming ? 'rgba(201,169,97,0.5)' : C.borderSubtle, borderWidth: 1,
            alignItems: 'center', justifyContent: 'center',
            opacity: busy ? 0.5 : 1,
          }}>
          <Trash2 size={13} color={confirming ? C.gold : C.textMuted} />
        </Pressable>
      </View>
    </View>
  );
}

function formatRelative(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString();
}

/**
 * FavoriteStarButton — header-level toggle. Reads + writes user_book_favorites
 * via the favoriteBooks hooks so the star state stays in sync with Profile /
 * Library without prop-drilling.
 */
function FavoriteStarButton({ bookId }: { bookId: string }) {
  const { session } = useAuth();
  const { favoriteIds, refresh } = useFavoriteBooks();
  const [busy, setBusy] = useState(false);
  const isFav = favoriteIds.has(bookId);
  const onPress = async () => {
    if (!session || busy) return;
    setBusy(true);
    try {
      const now = await toggleFavoriteBook(session.user.id, bookId);
      now ? hSuccess() : hLight();
      await refresh();
    } catch (e: any) {
      if (e instanceof FavoriteLimitError) {
        hWarning();
        Alert.alert('Favorite limit', e.message);
      } else {
        Alert.alert('Could not update favorite', e?.message || 'Try again.');
      }
    } finally {
      setBusy(false);
    }
  };
  return (
    <Pressable onPress={onPress} hitSlop={8} disabled={busy} style={{
      width: 36, height: 36, borderRadius: 18,
      alignItems: 'center', justifyContent: 'center',
      backgroundColor: isFav ? C.goldFaint : 'transparent',
      borderColor: isFav ? 'rgba(201,169,97,0.45)' : 'transparent', borderWidth: 1,
      opacity: busy ? 0.5 : 1,
    }}>
      <Star size={16} color={isFav ? C.gold : C.textMuted} fill={isFav ? C.gold : 'transparent'} />
    </Pressable>
  );
}

const stepBtn = {
  width: 36, height: 36, borderRadius: 18,
  backgroundColor: C.bgOverlay, borderColor: C.borderMid, borderWidth: 1,
  alignItems: 'center' as const, justifyContent: 'center' as const,
};
