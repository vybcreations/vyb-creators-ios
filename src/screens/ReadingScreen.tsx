import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, RefreshControl, useWindowDimensions } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Plus, ArrowRight } from 'lucide-react-native';
import { useFavoriteBooks } from '../lib/favoriteBooks';
import { IconButton, Tx, GoldButton } from '../components/primitives';
import { colors as C, fonts as F } from '../theme';
import { useLibrary, Book, bookProgressPct } from '../lib/reading';
import { AddBookSheet } from './reading/AddBookSheet';
import { BookCover3D } from '../components/BookCover3D';
import { hLight } from '../lib/haptics';
import { ScreenAtmosphere } from '../components/ScreenAtmosphere';
import {
  VYBCard, VYBChip, VYBBookCover, VYBEmpty, VYBScreenHeader, VYBTextAnimate,
} from '../components/ui';

// Responsive grid. Card width derives from live viewport width so iPad
// portrait/landscape get more columns than iPhone, and rotation re-flows.
const GRID_HPAD = 16;
const GRID_GAP  = 12;

function columnsFor(width: number) {
  if (width >= 1100) return 6;
  if (width >= 900)  return 5;
  if (width >= 700)  return 4;
  if (width >= 520)  return 4;
  return 3;
}

type Tab = 'all' | 'reading' | 'finished' | 'next';

export function ReadingScreen({ navigation }: any) {
  const { books, loading, refresh } = useLibrary();
  const { favoriteIds, refresh: refreshFavorites } = useFavoriteBooks();
  useFocusEffect(React.useCallback(() => { refreshFavorites(); }, [refreshFavorites]));
  const [tab, setTab] = useState<Tab>('all');
  const [addOpen, setAddOpen] = useState(false);
  const [coverActive, setCoverActive] = useState(false);

  const { width: viewportW } = useWindowDimensions();
  const COLS    = columnsFor(viewportW);
  const CARD_W  = Math.floor((viewportW - GRID_HPAD * 2 - GRID_GAP * (COLS - 1)) / COLS);
  const COVER_H = Math.round(CARD_W * 1.5);

  useFocusEffect(React.useCallback(() => { refresh(); }, [refresh]));

  const currentBook = books.find(b => b.status === 'reading') || null;

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

      <VYBScreenHeader
        title="Reading"
        subtitle={books.length === 0 ? 'your library' : `${books.length} ${books.length === 1 ? 'book' : 'books'}`}
        rightAction={
          <IconButton size={38} variant="accent" onPress={() => setAddOpen(true)}>
            <Plus size={17} color={C.gold} />
          </IconButton>
        }
      />

      {loading && books.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={C.gold} />
        </View>
      ) : books.length === 0 ? (
        <ReadingEmpty onAdd={() => setAddOpen(true)} />
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingBottom: 140 }}
          scrollEnabled={!coverActive}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={C.gold} />}>

          {/* Currently reading hero — uses VYBCard hero w/ gold glow. */}
          {currentBook && (
            <View style={{ paddingHorizontal: 16, marginBottom: 14 }}>
              <VYBCard level="hero" accent="gold" padding={18}>
                <View style={{ flexDirection: 'row', gap: 18 }}>
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
              </VYBCard>
            </View>
          )}

          {/* Library tabs (filters) — VYBChip */}
          <View style={{ paddingHorizontal: 22, marginTop: 4, marginBottom: 12 }}>
            <Text style={Tx.label({ marginBottom: 12, letterSpacing: 1.4 })}>MY LIBRARY · {books.length}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                {([
                  { id: 'all',      label: `All · ${books.length}` },
                  { id: 'reading',  label: `Reading · ${books.filter(b => b.status === 'reading').length}` },
                  { id: 'finished', label: `Finished · ${books.filter(b => b.status === 'finished').length}` },
                  { id: 'next',     label: `Wishlist · ${books.filter(b => b.status === 'next').length}` },
                ] as { id: Tab; label: string }[]).map(t => (
                  <VYBChip key={t.id}
                    label={t.label}
                    tone="gold"
                    selected={tab === t.id}
                    size="md"
                    onPress={() => setTab(t.id)}
                  />
                ))}
              </View>
            </ScrollView>
          </View>

          {/* Library grid — covers use VYBBookCover (auto favorite frame + star). */}
          <View style={{ paddingHorizontal: GRID_HPAD, flexDirection: 'row', flexWrap: 'wrap',
            columnGap: GRID_GAP, rowGap: 20 }}>
            {filtered.map(b => (
              <Pressable key={b.id} onPress={() => openBook(b)} style={{ width: CARD_W }}>
                <VYBBookCover
                  coverUrl={b.cover_url}
                  title={b.title}
                  size="md"
                  width={CARD_W}
                  height={COVER_H}
                  favorite={favoriteIds.has(b.id)}
                />
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
    </SafeAreaView>
  );
}

function ReadingEmpty({ onAdd }: { onAdd: () => void }) {
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
