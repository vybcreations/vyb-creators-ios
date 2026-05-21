import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase';
import { useAuth } from './auth';

export type BookStatus = 'reading' | 'finished' | 'paused' | 'abandoned' | 'next';

export type Book = {
  id: string;
  user_id: string;
  title: string;
  author: string | null;
  cover_url: string | null;
  cover_tone: string;
  isbn: string | null;
  description: string | null;
  publisher: string | null;
  published_date: string | null;
  total_pages: number | null;
  current_page: number;
  status: BookStatus;
  external_source: string | null;
  external_id: string | null;
  page_source: string | null;
  page_confidence: string | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ReadingSession = {
  id: string;
  book_id: string;
  user_id: string;
  start_page: number;
  end_page: number;
  pages_read: number;
  duration_seconds: number | null;
  minutes: number | null;
  note: string | null;
  started_at: string;
  created_at: string;
};

export type ReadingEntry = {
  id: string;
  book_id: string;
  user_id: string;
  body: string;
  kind: 'idea' | 'quote' | 'note';
  page: number | null;
  created_at: string;
};

// ─── Library hook ─────────────────────────────────────────
export function useLibrary() {
  const { session } = useAuth();
  const [books, setBooks] = useState<Book[]>([]);
  const [goalsYear, setGoalsYear] = useState<number | null>(null);
  const [goalsMonth, setGoalsMonth] = useState<number | null>(null);
  const [finishedThisYear, setFinishedThisYear] = useState(0);
  const [finishedThisMonth, setFinishedThisMonth] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!session) return;
    const uid = session.user.id;
    const yearStart = new Date(); yearStart.setMonth(0); yearStart.setDate(1); yearStart.setHours(0,0,0,0);
    const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0,0,0,0);

    const [booksQ, profileQ, yearQ, monthQ] = await Promise.all([
      supabase.from('books').select('*').eq('user_id', uid).order('updated_at', { ascending: false }),
      supabase.from('profiles').select('reading_year_goal, reading_month_goal').eq('id', uid).maybeSingle(),
      supabase.from('books').select('id', { count: 'exact', head: true }).eq('user_id', uid).eq('status', 'finished').gte('finished_at', yearStart.toISOString()),
      supabase.from('books').select('id', { count: 'exact', head: true }).eq('user_id', uid).eq('status', 'finished').gte('finished_at', monthStart.toISOString()),
    ]);

    setBooks((booksQ.data || []) as Book[]);
    setGoalsYear(profileQ.data?.reading_year_goal ?? null);
    setGoalsMonth(profileQ.data?.reading_month_goal ?? null);
    setFinishedThisYear(yearQ.count || 0);
    setFinishedThisMonth(monthQ.count || 0);
    setLoading(false);
  }, [session]);

  useEffect(() => { setLoading(true); load(); }, [load]);

  return {
    books, loading,
    goalsYear, goalsMonth,
    finishedThisYear, finishedThisMonth,
    refresh: load,
  };
}

// ─── Book detail hook ─────────────────────────────────────
export function useBook(bookId: string | undefined) {
  const { session } = useAuth();
  const [book, setBook] = useState<Book | null>(null);
  const [sessions, setSessions] = useState<ReadingSession[]>([]);
  const [entries, setEntries] = useState<ReadingEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!session || !bookId) return;
    const [bookQ, sessionsQ, entriesQ] = await Promise.all([
      supabase.from('books').select('*').eq('id', bookId).maybeSingle(),
      supabase.from('reading_sessions').select('*').eq('book_id', bookId).order('started_at', { ascending: false }),
      supabase.from('reading_notes').select('*').eq('book_id', bookId).order('created_at', { ascending: false }),
    ]);
    setBook((bookQ.data as Book) || null);
    setSessions((sessionsQ.data || []) as ReadingSession[]);
    setEntries((entriesQ.data || []) as ReadingEntry[]);
    setLoading(false);
  }, [session, bookId]);

  useEffect(() => { setLoading(true); load(); }, [load]);

  return { book, sessions, entries, loading, refresh: load };
}

// ─── Mutations ────────────────────────────────────────────

export async function createBook(userId: string, b: Partial<Book> & { title: string }) {
  const { data, error } = await supabase.from('books').insert({
    user_id: userId,
    title: b.title,
    author: b.author || null,
    cover_url: b.cover_url || null,
    cover_tone: b.cover_tone || 'midnight',
    isbn: b.isbn || null,
    description: b.description || null,
    publisher: b.publisher || null,
    published_date: b.published_date || null,
    total_pages: b.total_pages || null,
    current_page: 0,
    status: b.status || 'reading',
    external_source: b.external_source || 'manual',
    external_id: b.external_id || null,
    page_source: b.page_source || null,
    page_confidence: b.page_confidence || 'none',
    started_at: (b.status || 'reading') === 'reading' ? new Date().toISOString() : null,
  }).select().single();
  if (error) throw error;
  return data as Book;
}

export async function updateBook(id: string, patch: Partial<Book>) {
  // Always bump updated_at so the library list (sorted by updated_at DESC) and
  // the "Reading Now" pick reflect the latest activity even if the DB has no
  // moddatetime trigger.
  const { error } = await supabase
    .from('books')
    .update({ ...patch, updated_at: new Date().toISOString() } as any)
    .eq('id', id);
  if (error) throw error;
}

export async function deleteBook(id: string) {
  const { error } = await supabase.from('books').delete().eq('id', id);
  if (error) throw error;
}

export async function markBookFinished(id: string, totalPages: number | null) {
  await updateBook(id, {
    status: 'finished',
    finished_at: new Date().toISOString(),
    current_page: totalPages || undefined,
  } as any);
}

export async function logReadingSession(userId: string, bookId: string, opts: {
  start_page: number;
  end_page: number;
  elapsedSeconds?: number | null;     // raw timer value (preferred)
  minutes?: number | null;            // legacy
  note?: string | null;
}) {
  const seconds = opts.elapsedSeconds ?? (opts.minutes ? opts.minutes * 60 : null);
  const minutes = seconds ? Math.max(1, Math.round(seconds / 60)) : opts.minutes ?? null;
  const { error: sErr } = await supabase.from('reading_sessions').insert({
    user_id: userId,
    book_id: bookId,
    start_page: opts.start_page,
    end_page: opts.end_page,
    duration_seconds: seconds,
    minutes,
    note: opts.note ?? null,
  });
  if (sErr) throw sErr;
  // Advance current_page (only if new end_page > current_page)
  const { data: cur } = await supabase.from('books').select('current_page').eq('id', bookId).maybeSingle();
  const newPage = Math.max((cur?.current_page || 0), opts.end_page);
  await updateBook(bookId, { current_page: newPage } as any);
}

// Format a duration in seconds for inline display: "12m 30s", "45s", "1h 5m".
export function formatDuration(s: number | null | undefined): string | null {
  if (!s || s <= 0) return null;
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) {
    const rem = s % 60;
    return rem > 0 ? `${m}m ${rem}s` : `${m}m`;
  }
  const h = Math.floor(m / 60);
  const rm = m % 60;
  return rm > 0 ? `${h}h ${rm}m` : `${h}h`;
}

export async function deleteSession(id: string) {
  const { error } = await supabase.from('reading_sessions').delete().eq('id', id);
  if (error) throw error;
}

export async function addEntry(userId: string, bookId: string, opts: { kind: 'idea' | 'quote' | 'note'; body: string; page?: number | null }) {
  const { error } = await supabase.from('reading_notes').insert({
    user_id: userId, book_id: bookId,
    body: opts.body, kind: opts.kind, page: opts.page ?? null,
  });
  if (error) throw error;
}

export async function deleteEntry(id: string) {
  const { error } = await supabase.from('reading_notes').delete().eq('id', id);
  if (error) throw error;
}

// Re-insert a previously-deleted entry, preserving its id + timestamp so it
// re-appears in the same chronological slot. Powers the global undo toast.
export async function restoreEntry(e: ReadingEntry) {
  const { error } = await supabase.from('reading_notes').insert({
    id: e.id,
    user_id: e.user_id,
    book_id: e.book_id,
    body: e.body,
    kind: e.kind,
    page: e.page,
    created_at: e.created_at,
  });
  if (error) throw error;
}

export async function updateGoals(userId: string, yearGoal: number | null, monthGoal: number | null) {
  const { error } = await supabase.from('profiles').update({
    reading_year_goal: yearGoal,
    reading_month_goal: monthGoal,
  }).eq('id', userId);
  if (error) throw error;
}

// ─── Helpers ──────────────────────────────────────────────
export function bookProgressPct(b: Pick<Book, 'current_page' | 'total_pages'>): number {
  if (!b.total_pages || b.total_pages <= 0) return 0;
  return Math.min(100, Math.round((b.current_page / b.total_pages) * 100));
}

export function pickCoverTone(seed: string): 'midnight' | 'forest' | 'gold' | 'dusk' | 'aurora' {
  const tones: any = ['midnight', 'forest', 'gold', 'dusk', 'aurora'];
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return tones[h % tones.length];
}
