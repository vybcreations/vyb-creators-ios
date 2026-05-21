import React, { useMemo, useState } from 'react';
import { View, Text, TextInput, Pressable, Image, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { Search, Star } from 'lucide-react-native';
import { DraggableSheet, SheetHeader } from '../../components/DraggableSheet';
import { colors as C, fonts as F } from '../../theme';
import { LinearGradient } from 'expo-linear-gradient';
import { useLibrary, type Book } from '../../lib/reading';
import {
  useFavoriteBooks, toggleFavoriteBook, FavoriteLimitError, MAX_FAVORITES,
} from '../../lib/favoriteBooks';
import { useAuth } from '../../lib/auth';
import { hLight, hSuccess, hWarning } from '../../lib/haptics';

/**
 * FavoritePickerSheet — pick up to MAX_FAVORITES books from the user's
 * existing Reading library. Search filters by title/author; star toggles
 * favorite state. Enforces the 5-max and surfaces a clear message when hit.
 */
export function FavoritePickerSheet({
  visible, onDismiss, onChanged,
}: {
  visible: boolean;
  onDismiss: () => void;
  onChanged?: () => void;
}) {
  const { session } = useAuth();
  const { books, loading: libLoading } = useLibrary();
  const { favoriteIds, refresh: refreshFavs, loading: favLoading } = useFavoriteBooks();
  const [query, setQuery] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return books;
    return books.filter(b =>
      (b.title || '').toLowerCase().includes(q) ||
      (b.author || '').toLowerCase().includes(q)
    );
  }, [books, query]);

  const onToggle = async (book: Book) => {
    if (!session || busyId) return;
    setBusyId(book.id);
    try {
      const nowFavorite = await toggleFavoriteBook(session.user.id, book.id);
      nowFavorite ? hSuccess() : hLight();
      await refreshFavs();
      onChanged?.();
    } catch (e: any) {
      if (e instanceof FavoriteLimitError) {
        hWarning();
        Alert.alert('Favorite limit', e.message);
      } else {
        Alert.alert('Could not update favorite', e?.message || 'Try again.');
      }
    } finally {
      setBusyId(null);
    }
  };

  return (
    <DraggableSheet visible={visible} onDismiss={onDismiss} showClose={false}>
      <SheetHeader title="Favorite books" onClose={onDismiss} />

      <View style={{ paddingHorizontal: 18, paddingBottom: 10 }}>
        <Text style={{ fontFamily: F.serifItalic, fontSize: 13, color: C.textMuted, marginBottom: 12 }}>
          Pick up to {MAX_FAVORITES} to feature on your profile. {favoriteIds.size}/{MAX_FAVORITES} selected.
        </Text>

        {/* Search */}
        <View style={{
          flexDirection: 'row', alignItems: 'center', gap: 8,
          backgroundColor: C.bgElevated, borderColor: C.borderSubtle, borderWidth: 1,
          borderRadius: 14, paddingHorizontal: 12, height: 42,
        }}>
          <Search size={14} color={C.textMuted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search your library"
            placeholderTextColor={C.textFaint}
            style={{ flex: 1, color: C.textPrimary, fontFamily: F.sans, fontSize: 14 }}
          />
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 32 }}
        keyboardShouldPersistTaps="handled">
        {libLoading || favLoading ? (
          <View style={{ paddingVertical: 40, alignItems: 'center' }}>
            <ActivityIndicator color={C.gold} />
          </View>
        ) : books.length === 0 ? (
          <View style={{ paddingVertical: 30 }}>
            <Text style={{ fontFamily: F.serifItalic, fontSize: 14, color: C.textMuted, textAlign: 'center' }}>
              Your library is empty. Add a book first to feature it as a favorite.
            </Text>
          </View>
        ) : filtered.length === 0 ? (
          <Text style={{ fontFamily: F.serifItalic, fontSize: 13, color: C.textMuted, textAlign: 'center', paddingVertical: 24 }}>
            No matches.
          </Text>
        ) : (
          filtered.map(b => {
            const isFav = favoriteIds.has(b.id);
            const busy = busyId === b.id;
            return (
              <Pressable
                key={b.id}
                onPress={() => onToggle(b)}
                disabled={busy}
                style={{
                  flexDirection: 'row', alignItems: 'center', gap: 12,
                  paddingVertical: 10, paddingHorizontal: 10, borderRadius: 14,
                  backgroundColor: isFav ? 'rgba(201,169,97,0.08)' : 'transparent',
                  borderColor: isFav ? 'rgba(201,169,97,0.30)' : 'transparent',
                  borderWidth: 1, marginBottom: 6, opacity: busy ? 0.5 : 1,
                }}>
                <MiniCover book={b} />
                <View style={{ flex: 1 }}>
                  <Text numberOfLines={1} style={{
                    fontFamily: F.sansBold, fontSize: 13.5, color: C.textPrimary, letterSpacing: -0.2,
                  }}>
                    {b.title}
                  </Text>
                  {b.author && (
                    <Text numberOfLines={1} style={{
                      fontFamily: F.serifItalic, fontSize: 11.5, color: C.textMuted, marginTop: 1,
                    }}>
                      {b.author}
                    </Text>
                  )}
                </View>
                <View style={{
                  width: 32, height: 32, borderRadius: 16,
                  backgroundColor: isFav ? C.goldFaint : 'transparent',
                  borderColor: isFav ? 'rgba(201,169,97,0.55)' : C.borderSubtle, borderWidth: 1,
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <Star size={14} color={isFav ? C.gold : C.textMuted} fill={isFav ? C.gold : 'transparent'} />
                </View>
              </Pressable>
            );
          })
        )}
      </ScrollView>
    </DraggableSheet>
  );
}

function MiniCover({ book }: { book: Book }) {
  const W = 40, H = 60;
  if (book.cover_url) {
    return (
      <Image source={{ uri: book.cover_url }}
        style={{ width: W, height: H, borderRadius: 6, backgroundColor: C.bgOverlay }} />
    );
  }
  const initials = (book.title.match(/\b\w/g) || []).slice(0, 2).join('').toUpperCase() || '—';
  return (
    <View style={{
      width: W, height: H, borderRadius: 6, overflow: 'hidden',
      backgroundColor: C.bgElevated,
      borderColor: 'rgba(201,169,97,0.18)', borderWidth: 1,
    }}>
      <LinearGradient
        colors={['rgba(201,169,97,0.22)', 'rgba(28,28,34,0.95)']}
        start={{ x: 0.2, y: 0 }} end={{ x: 1, y: 1 }}
        style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontFamily: F.sansHeavy, fontSize: 13, color: 'rgba(244,240,232,0.85)' }}>{initials}</Text>
      </LinearGradient>
    </View>
  );
}
