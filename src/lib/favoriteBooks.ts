import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase';
import { useAuth } from './auth';
import type { Book } from './reading';

/**
 * Favorite books — Letterboxd-style "top picks" capped at 5.
 *
 * The cap is enforced app-side (toggleFavorite throws FavoriteLimitError).
 * RLS only enforces ownership; the 5-max rule can evolve without a DB change.
 */

export const MAX_FAVORITES = 5;

export class FavoriteLimitError extends Error {
  constructor() {
    super('You can only feature 5 favorite books. Remove one to add another.');
    this.name = 'FavoriteLimitError';
  }
}

export type FavoriteBook = Book & { favorited_at: string };

// Hook: returns the current user's favorite books (joined with the books row)
// in the order they were favorited (newest first), plus quick lookup helpers.
export function useFavoriteBooks() {
  const { session } = useAuth();
  const [favorites, setFavorites] = useState<FavoriteBook[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!session) { setFavorites([]); setFavoriteIds(new Set()); setLoading(false); return; }
    const uid = session.user.id;
    const { data, error } = await supabase
      .from('user_book_favorites')
      .select('book_id, created_at, books(*)')
      .eq('user_id', uid)
      .order('created_at', { ascending: false });

    if (error || !data) { setFavorites([]); setFavoriteIds(new Set()); setLoading(false); return; }
    const rows: FavoriteBook[] = data
      .map((r: any) => r.books ? { ...(r.books as Book), favorited_at: r.created_at as string } : null)
      .filter(Boolean) as FavoriteBook[];
    setFavorites(rows);
    setFavoriteIds(new Set(rows.map(b => b.id)));
    setLoading(false);
  }, [session]);

  useEffect(() => { setLoading(true); load(); }, [load]);

  return { favorites, favoriteIds, loading, refresh: load, max: MAX_FAVORITES };
}

// Toggle: returns the new state (true = now favorite). Throws FavoriteLimitError
// if adding would exceed the 5-max.
export async function toggleFavoriteBook(userId: string, bookId: string): Promise<boolean> {
  const { data: existing } = await supabase
    .from('user_book_favorites')
    .select('id')
    .eq('user_id', userId)
    .eq('book_id', bookId)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from('user_book_favorites')
      .delete()
      .eq('id', existing.id);
    if (error) throw error;
    return false;
  }

  // Adding — enforce the cap before inserting so we don't rely on a unique
  // partial index / trigger. UNIQUE(user_id, book_id) still protects against
  // double-tap duplicates.
  const { count } = await supabase
    .from('user_book_favorites')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId);
  if ((count || 0) >= MAX_FAVORITES) throw new FavoriteLimitError();

  const { error } = await supabase
    .from('user_book_favorites')
    .insert({ user_id: userId, book_id: bookId });
  if (error) throw error;
  return true;
}

// Direct add / remove — for the picker where we already know the desired state.
export async function removeFavoriteBook(userId: string, bookId: string): Promise<void> {
  const { error } = await supabase
    .from('user_book_favorites')
    .delete()
    .eq('user_id', userId)
    .eq('book_id', bookId);
  if (error) throw error;
}
