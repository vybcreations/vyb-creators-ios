import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, Image, ActivityIndicator, RefreshControl, useWindowDimensions } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Plus, Target, ArrowRight, Star } from 'lucide-react-native';
import { useFavoriteBooks } from '../lib/favoriteBooks';
import { LinearGradient } from 'expo-linear-gradient';
import { Pill, IconButton, Tx, GoldButton } from '../components/primitives';
import { colors as C, fonts as F } from '../theme';
import { useLibrary, Book, BookStatus, bookProgressPct } from '../lib/reading';
import { AddBookSheet } from './reading/AddBookSheet';
import { GoalsSheet } from './reading/GoalsSheet';
import { BookCover3D } from '../components/BookCover3D';
import { hLight } from '../lib/haptics';
import { ScreenAtmosphere } from '../components/ScreenAtmosphere';
import { VYBTextAnimate } from '../components/ui/VYBTextAnimate';

// Responsive grid. Card width derives from live viewport width so iPad
// portrait/landscape get more columns than iPhone, and rotation re-flows.
const GRID_HPAD = 16;
const GRID_GAP  = 12;

function columnsFor(width: number) {
  if (width >= 1100) return 6;   // iPad landscape (12.9")
  if (width >= 900)  return 5;   // iPad landscape (11"/mini) or large tablet
  if (width >= 700)  return 4;   // iPad portrait
  if (width >= 520)  return 4;   // large phone / small tablet
  return 3;                       // phones
}

type Tab = 'all' | 'reading' | 'finished' | 'next';

export function ReadingScreen({ navigation }: any) {
  const { books, loading, goalsYear, goalsMonth, finishedThisYear, finishedThisMonth, refresh } = useLibrary();
  const { favoriteIds, refresh: refreshFavorites } = useFavoriteBooks();
  useFocusEffect(React.useCallback(() => { refreshFavorites(); }, [refreshFavorites]));
  const [tab, setTab] = useState<Tab>('all');
  const [addOpen, setAddOpen] = useState(false);
  const [goalsOpen, setGoalsOpen] = useState(false);
  const [coverActive, setCoverActive] = useState(false); // disables parent scroll while dragging the Reading Now cover

  // Responsive grid sizing — recalculated on rotation via useWindowDimensions.
  const { width: viewportW } = useWindowDimensions();
  const COLS    = columnsFor(viewportW);
  const CARD_W  = Math.floor((viewportW - GRID_HPAD * 2 - GRID_GAP * (COLS - 1)) / COLS);
  const COVER_H = Math.round(CARD_W * 1.5);

  useFocusEffect(React.useCallback(() => { refresh(); }, [refresh]));

  const currentBook = books.find(b => b.status === 'reading') || null;

  // Status priority for the All tab. `books` already comes sorted by updated_at
  // DESC, and Array.sort is stable, so a group-only sort gives us:
  //   Reading → Finished → Wishlist, recent-activity-first inside each group.
  const STATUS_RANK: Record<string, number> = {
    reading: 0, paused: 1, finished: 2, next: 3, abandoned: 4,
  };
  const sortedAll = [...books].sort((a, b) => (STATUS_RANK[a.status] ?? 99) - (STATUS_RANK[b.status] ?? 99));
  const filtered = tab === 'all' ? sortedAll : books.filter(b => b.status === tab);

  const openBook = (b: Book) => {
    hLight();
    navigation?.getParent()?.navigate('BookDetail', { bookId: b.id });
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bgBase }} edges={['top']}>
      <ScreenAtmosphere />
      <View style={{ paddingHorizontal: 22, paddingBottom: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <View>
          <Text style={Tx.label({ letterSpacing: 1.2 })}>
            {books.length === 0 ? 'your library' : `${books.length} ${books.length === 1 ? 'book' : 'books'}`}
          </Text>
          <Text style={[Tx.editorial(), { marginTop: 6, fontSize: 32 }]}>Reading</Text>
        </View>
        <IconButton size={38} variant="accent" onPress={() => setAddOpen(true)}>
          <Plus size={17} color={C.gold} />
        </IconButton>
      </View>

      {loading && books.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={C.gold} />
        </View>
      ) : books.length === 0 ? (
        <EmptyState onAdd={() => setAddOpen(true)} />
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingBottom: 140 }}
          scrollEnabled={!coverActive}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={C.gold} />}>

          {/* Currently reading hero — cover is the focal point, info + CTA on the right */}
          {currentBook && (
            <View style={{
              marginHorizontal: 16, marginBottom: 14,
              backgroundColor: C.bgElevated, borderColor: 'rgba(201,169,97,0.18)', borderWidth: 1,
              borderRadius: 24, padding: 18, overflow: 'hidden',
              flexDirection: 'row', gap: 18,
              shadowColor: '#C9A961', shadowOpacity: 0.18, shadowRadius: 22, shadowOffset: { width: 0, height: 10 },
            }}>
              {/* Subtle warm gold gradient wash + top inner highlight for depth. */}
              <LinearGradient pointerEvents="none"
                colors={['rgba(201,169,97,0.16)', 'rgba(201,169,97,0.04)', 'rgba(0,0,0,0)']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}
              />
              <LinearGradient pointerEvents="none"
                colors={['rgba(255,255,255,0.10)', 'rgba(255,255,255,0)']}
                start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
                style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 28 }}
              />
              <BookCover3D
                coverUrl={currentBook.cover_url} size="md" intensity="normal"
                fallbackTitle={currentBook.title}
                onTap={() => openBook(currentBook)}
                onActiveChange={setCoverActive}
              />
              <View style={{ flex: 1, justifyContent: 'space-between', paddingVertical: 2 }}>
                <View>
                  <Text style={Tx.label({ letterSpacing: 1.8 })}>READING NOW</Text>
                  <Text numberOfLines={3} style={{ fontFamily: F.serifItalic, fontSize: 19, color: C.textPrimary, letterSpacing: -0.4, lineHeight: 23, marginTop: 8 }}>
                    {currentBook.title}
                  </Text>
                  {currentBook.author && (
                    <Text numberOfLines={1} style={{ fontFamily: F.sans, fontSize: 11.5, color: C.textMuted, marginTop: 4 }}>
                      {currentBook.author}
                    </Text>
                  )}
                </View>

                <View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 10 }}>
                    <Text style={{ fontFamily: F.mono, fontSize: 10.5, color: C.textMuted }}>
                      {currentBook.current_page}{currentBook.total_pages ? ` / ${currentBook.total_pages}` : ''}
                    </Text>
                    <Text style={{ fontFamily: F.sansHeavy, fontSize: 14, color: C.goldBright, letterSpacing: -0.2 }}>
                      {bookProgressPct(currentBook)}%
                    </Text>
                  </View>
                  <View style={{ marginTop: 5, height: 2, backgroundColor: C.borderSubtle, borderRadius: 1, overflow: 'hidden' }}>
                    <View style={{ width: `${bookProgressPct(currentBook)}%`, height: '100%', backgroundColor: C.gold }} />
                  </View>

                  <GoldButton
                    size="sm" variant="complete"
                    onPress={() => openBook(currentBook)}
                    trailingIcon={<ArrowRight size={12} color={C.bgBase} strokeWidth={2.4} />}
                    style={{ marginTop: 12, alignSelf: 'flex-start' }}>
                    Continue
                  </GoldButton>
                </View>
              </View>
            </View>
          )}

          {/* Goals — compact strip, This Month first */}
          <Pressable onPress={() => setGoalsOpen(true)} style={{ marginHorizontal: 16, marginBottom: 14 }}>
            <View style={{
              borderColor: C.borderSubtle, borderWidth: 1,
              borderRadius: 14,
              paddingHorizontal: 14, paddingVertical: 12,
              flexDirection: 'row', alignItems: 'center', gap: 14,
            }}>
              <Target size={13} color={C.textMuted} />
              <GoalInline label="This month" done={finishedThisMonth} goal={goalsMonth} />
              <View style={{ width: 1, height: 28, backgroundColor: C.borderSubtle }} />
              <GoalInline label="This year"  done={finishedThisYear}  goal={goalsYear} />
              <Text style={{ fontFamily: F.sansBold, fontSize: 10, color: C.gold, letterSpacing: 1.2 }}>EDIT</Text>
            </View>
          </Pressable>

          {/* Library tabs */}
          <View style={{ paddingHorizontal: 22, marginTop: 8, marginBottom: 12 }}>
            <Text style={Tx.label({ marginBottom: 12, letterSpacing: 1.4 })}>MY LIBRARY · {books.length}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                {([
                  { id: 'all',      label: `All · ${books.length}` },
                  { id: 'reading',  label: `Reading · ${books.filter(b => b.status === 'reading').length}` },
                  { id: 'finished', label: `Finished · ${books.filter(b => b.status === 'finished').length}` },
                  { id: 'next',     label: `Wishlist · ${books.filter(b => b.status === 'next').length}` },
                ] as { id: Tab; label: string }[]).map(t => (
                  <Pill key={t.id} selected={tab === t.id} color="gold" size="md" onPress={() => setTab(t.id)}>
                    {t.label}
                  </Pill>
                ))}
              </View>
            </ScrollView>
          </View>

          {/* Library grid — 3 columns, 2:3 covers */}
          <View style={{ paddingHorizontal: GRID_HPAD, flexDirection: 'row', flexWrap: 'wrap',
            columnGap: GRID_GAP, rowGap: 20 }}>
            {filtered.map(b => (
              <Pressable key={b.id} onPress={() => openBook(b)} style={{ width: CARD_W }}>
                <Cover url={b.cover_url} title={b.title} width={CARD_W} height={COVER_H} favorite={favoriteIds.has(b.id)} />
                <Text numberOfLines={1} style={{ fontFamily: F.sansBold, fontSize: 11.5, color: C.textPrimary, marginTop: 8, letterSpacing: -0.1 }}>
                  {b.title}
                </Text>
                {b.author && (
                  <Text numberOfLines={1} style={{ fontFamily: F.serifItalic, fontSize: 10, color: C.textMuted, marginTop: 2 }}>
                    {b.author}
                  </Text>
                )}
                {b.status === 'reading' && b.total_pages ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 5 }}>
                    <View style={{ flex: 1, height: 2, backgroundColor: C.borderSubtle, borderRadius: 1, overflow: 'hidden' }}>
                      <View style={{ width: `${bookProgressPct(b)}%`, height: '100%', backgroundColor: C.gold }} />
                    </View>
                    <Text style={{ fontFamily: F.mono, fontSize: 9, color: C.textMuted }}>{bookProgressPct(b)}%</Text>
                  </View>
                ) : (
                  <Text style={{
                    fontFamily: F.sansBold, fontSize: 8.5, color: C.textMuted,
                    letterSpacing: 1.2, marginTop: 5,
                  }}>
                    {b.status.toUpperCase()}
                  </Text>
                )}
              </Pressable>
            ))}
          </View>
        </ScrollView>
      )}

      <AddBookSheet visible={addOpen} onDismiss={() => setAddOpen(false)} onSaved={refresh} />
      <GoalsSheet visible={goalsOpen} onDismiss={() => setGoalsOpen(false)} onSaved={refresh} year={goalsYear} month={goalsMonth} />
    </SafeAreaView>
  );
}

function GoalInline({ label, done, goal }: { label: string; done: number; goal: number | null }) {
  const pct = goal && goal > 0 ? Math.min(100, Math.round((done / goal) * 100)) : 0;
  return (
    <View style={{ flex: 1 }}>
      <Text style={{ fontFamily: F.sansBold, fontSize: 9, color: C.textMuted, letterSpacing: 1.2, textTransform: 'uppercase' }}>
        {label}
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: 4 }}>
        <Text style={{ fontFamily: F.sansBold, fontSize: 15, color: C.textPrimary, letterSpacing: -0.2 }}>{done}</Text>
        <Text style={{ fontFamily: F.mono, fontSize: 10.5, color: C.textMuted, marginLeft: 4 }}>
          / {goal ?? '—'}
        </Text>
      </View>
      {goal && goal > 0 && (
        <View style={{ marginTop: 6, height: 2, backgroundColor: C.borderSubtle, borderRadius: 1, overflow: 'hidden' }}>
          <View style={{ width: `${pct}%`, height: '100%', backgroundColor: C.gold }} />
        </View>
      )}
    </View>
  );
}

function Cover({ url, title, width, height, favorite }: { url: string | null; title: string; width: any; height: number; favorite?: boolean }) {
  // Favorite-only adornments: subtle gold frame + small star badge in the
  // top-right corner. Kept low-saturation per design (no glow, no animation).
  const favFrame = favorite
    ? { borderColor: 'rgba(201,169,97,0.65)', borderWidth: 1.5 }
    : { borderColor: 'rgba(201,169,97,0.20)', borderWidth: 1 };

  if (url) {
    return (
      <View style={{ width, height, position: 'relative' }}>
        <Image source={{ uri: url }} resizeMode="cover"
          style={{
            width, height, borderRadius: 10, backgroundColor: C.bgOverlay,
            ...favFrame,
            shadowColor: '#000', shadowOpacity: 0.45, shadowRadius: 14, shadowOffset: { width: 0, height: 6 },
          }} />
        {favorite && <FavoriteStarBadge />}
      </View>
    );
  }
  // Adaptive premium fallback — dark gold gradient with title initials.
  const w = typeof width === 'number' ? width : 100;
  const initials = (title.match(/\b\w/g) || []).slice(0, 2).join('').toUpperCase() || '—';
  return (
    <View style={{ width, height, position: 'relative' }}>
      <View style={{
        width, height, borderRadius: 10, overflow: 'hidden',
        backgroundColor: C.bgElevated, ...favFrame,
        shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 10, shadowOffset: { width: 0, height: 4 },
      }}>
        <LinearGradient
          colors={['rgba(201,169,97,0.22)', 'rgba(28,28,34,0.95)']}
          start={{ x: 0.2, y: 0 }} end={{ x: 1, y: 1 }}
          style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 8 }}
        >
          <Text style={{
            fontFamily: F.sansHeavy, fontSize: Math.max(20, w * 0.32),
            color: 'rgba(244,240,232,0.85)', letterSpacing: -0.5,
          }}>
            {initials}
          </Text>
          <Text numberOfLines={2} style={{
            fontFamily: F.serifItalic, fontSize: Math.max(9, w * 0.10),
            color: C.textMuted, marginTop: 4, textAlign: 'center',
            lineHeight: Math.max(12, w * 0.13),
          }}>
            {title || '—'}
          </Text>
        </LinearGradient>
      </View>
      {favorite && <FavoriteStarBadge />}
    </View>
  );
}

function FavoriteStarBadge() {
  return (
    <View style={{
      position: 'absolute', top: 6, right: 6,
      width: 22, height: 22, borderRadius: 11,
      backgroundColor: 'rgba(13,12,11,0.7)',
      borderColor: 'rgba(201,169,97,0.5)', borderWidth: 1,
      alignItems: 'center', justifyContent: 'center',
    }}>
      <Star size={10} color={C.gold} fill={C.gold} />
    </View>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  // paddingBottom compensates the floating tab bar (~110pt) so the message
  // sits in the *visual* center of the screen, not the layout center.
  return (
    <View style={{ flex: 1, paddingHorizontal: 28, paddingBottom: 110, alignItems: 'center', justifyContent: 'center' }}>
      <VYBTextAnimate
        text="Your library is empty."
        type="wordReveal"
        textStyle={{ fontFamily: F.serifItalic, fontSize: 26, color: C.textPrimary, letterSpacing: -0.4 }}
        containerStyle={{ justifyContent: 'center' }}
      />
      <Text style={{ fontFamily: F.sans, fontSize: 13, color: C.textMuted, textAlign: 'center', marginTop: 14, lineHeight: 20 }}>
        Add a book to start tracking pages, notes,{'\n'}and the quiet progress of reading.
      </Text>
      <GoldButton
        size="lg" variant="complete"
        onPress={onAdd}
        icon={<Plus size={16} color={C.bgBase} strokeWidth={2.4} />}
        style={{ marginTop: 28 }}>
        Add first book
      </GoldButton>
    </View>
  );
}
