import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, TextInput, Pressable, Alert, ScrollView, ActivityIndicator, Keyboard,
} from 'react-native';
import { Search, X } from 'lucide-react-native';
import {
  VYBChip, VYBBookCover, VYBInput, VYBEmpty, VYBCard, VYBCreationSheet,
} from '../../components/ui';
import { GoldButton } from '../../components/primitives';
import { colors as C, fonts as F } from '../../theme';
import { searchBooks, BookSearchResult } from '../../lib/booksearch';
import { resolvePageCount } from '../../lib/books/pageCount';
import { createBook, pickCoverTone, BookStatus } from '../../lib/reading';
import { useAuth } from '../../lib/auth';
import { hSelection, hSuccess } from '../../lib/haptics';

/**
 * AddBookSheet — rebuilt from scratch on VYB Design System v2.
 *
 * Visual structure
 *   - DraggableSheet (keyboardAvoiding=false, near-full-screen, iPad max-width 560)
 *   - SheetHeader: editorial title + X (back arrow during preview/manual)
 *   - Pill search bar (VYBInput borderRadius=999)
 *   - Body switches by mode:
 *       'search'  → loading / results / empty / pre-search
 *       'preview' → selected book card + status + reading/finished extras
 *       'manual'  → manual title/author/pages + status + extras
 *
 * Logic
 *   Preserved as-is from previous implementation: search via booksearch,
 *   page-count resolver, createBook + post-create patch for current_page /
 *   finished_at. No data model changes.
 */

type Mode = 'search' | 'preview' | 'manual';
type ConfirmStatus = 'reading' | 'finished' | 'next';

export function AddBookSheet({
  visible, onDismiss, onSaved, defaultStatus = 'reading',
}: {
  visible: boolean;
  onDismiss: () => void;
  onSaved: () => void;
  defaultStatus?: ConfirmStatus;
}) {
  const { session } = useAuth();
  const [mode, setMode] = useState<Mode>('search');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<BookSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [providersDown, setProvidersDown] = useState(false);
  const [selected, setSelected] = useState<BookSearchResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [resolvingPages, setResolvingPages] = useState(false);
  const [pagesEdited, setPagesEdited] = useState(false);

  // Confirmation form
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [pages, setPages] = useState('');
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [year, setYear] = useState<string | null>(null);

  const [status, setStatus] = useState<ConfirmStatus>('reading');
  const [currentPage, setCurrentPage] = useState('0');
  const [finishedMonth, setFinishedMonth] = useState('');
  const [finishedYear, setFinishedYear] = useState('');

  const searchRef = useRef<TextInput>(null);
  const seqRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  // ─── Lifecycle ─────────────────────────────────────────────
  useEffect(() => {
    if (!visible) return;
    setMode('search'); setQuery(''); setResults([]); setSelected(null);
    setProvidersDown(false); setHasSearched(false); setSearching(false);
    setTitle(''); setAuthor(''); setPages(''); setCoverUrl(null); setYear(null);
    setStatus(defaultStatus); setCurrentPage('0');
    setFinishedMonth(''); setFinishedYear('');
    setResolvingPages(false); setPagesEdited(false);
    const t = setTimeout(() => searchRef.current?.focus(), 340);
    return () => clearTimeout(t);
  }, [visible, defaultStatus]);

  // ─── Logic (preserved) ─────────────────────────────────────
  const runSearch = async () => {
    const trimmed = query.trim();
    if (!trimmed) return;
    abortRef.current?.abort();
    const mine = ++seqRef.current;
    setSearching(true); setProvidersDown(false);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const outcome = await searchBooks(trimmed, controller.signal);
      if (mine !== seqRef.current) return;
      setResults(outcome.results);
      setProvidersDown(outcome.bothProvidersFailed);
      setHasSearched(true);
    } catch (e: any) {
      if (mine !== seqRef.current) return;
      if (e?.name !== 'AbortError') { setResults([]); setHasSearched(true); }
    } finally {
      if (mine === seqRef.current) setSearching(false);
    }
  };

  const clearQuery = () => {
    setQuery(''); setResults([]); setHasSearched(false); setProvidersDown(false);
  };

  const choose = async (r: BookSearchResult) => {
    Keyboard.dismiss();
    setSelected(r);
    setTitle(r.title);
    setAuthor(r.author || '');
    setPages(r.total_pages ? String(r.total_pages) : '');
    setCoverUrl(r.cover_url);
    setYear(r.published_date ? r.published_date.slice(0, 4) : null);
    setPagesEdited(false);
    setMode('preview');

    if (!r.total_pages) {
      setResolvingPages(true);
      try {
        const resolved = await resolvePageCount(r);
        if (resolved.totalPages !== '' && !pagesEdited) {
          setPages(String(resolved.totalPages));
          setSelected(prev => prev ? {
            ...prev,
            total_pages: Number(resolved.totalPages),
            page_source: resolved.source,
            page_confidence: resolved.confidence,
          } : prev);
        }
      } finally {
        setResolvingPages(false);
      }
    }
  };

  const onPagesChange = (v: string) => {
    setPages(v); setPagesEdited(true);
    setSelected(prev => prev ? { ...prev, page_confidence: 'manual', page_source: 'manual' } : prev);
  };

  const goManual = () => {
    setMode('manual');
    setTitle(query); setAuthor(''); setPages(''); setCoverUrl(null); setYear(null);
    setSelected(null);
  };

  const computeFinishedAt = (): string | null => {
    if (status !== 'finished') return null;
    if (!finishedMonth && !finishedYear) return new Date().toISOString();
    const y = parseInt(finishedYear, 10) || new Date().getFullYear();
    const m = Math.min(12, Math.max(1, parseInt(finishedMonth, 10) || 1));
    return new Date(Date.UTC(y, m - 1, 1)).toISOString();
  };

  const save = async () => {
    if (!session || !title.trim()) return;
    setBusy(true);
    try {
      const totalPages = pages ? parseInt(pages, 10) : null;
      const cur = status === 'reading'
        ? Math.max(0, Math.min(totalPages || 99999, parseInt(currentPage, 10) || 0))
        : status === 'finished'
          ? (totalPages || 0)
          : 0;
      const finishedAt = computeFinishedAt();
      await createBook(session.user.id, {
        title: title.trim(),
        author: author.trim() || null,
        cover_url: coverUrl,
        cover_tone: pickCoverTone(title),
        isbn: selected?.isbn || null,
        description: selected?.description || null,
        publisher: selected?.publisher || null,
        published_date: selected?.published_date || null,
        total_pages: totalPages,
        status: status as BookStatus,
        external_source: selected?.external_source || 'manual',
        external_id: selected?.external_id || null,
        page_source: selected?.page_source || null,
        page_confidence: selected?.page_confidence || 'none',
      } as any);
      if (cur > 0 || finishedAt) {
        const { supabase } = await import('../../lib/supabase');
        const { error } = await supabase
          .from('books')
          .update({ current_page: cur, finished_at: finishedAt })
          .eq('user_id', session.user.id)
          .eq('title', title.trim())
          .order('created_at', { ascending: false })
          .limit(1);
        if (error) console.warn('post-create update', error.message);
      }
      hSuccess();
      onSaved();
      onDismiss();
    } catch (e: any) {
      Alert.alert('Could not save', e?.message || 'Unknown error');
    } finally { setBusy(false); }
  };

  // ─── Render ────────────────────────────────────────────────
  const canSave = title.trim().length > 0 && (status !== 'reading' || pages.length > 0);
  const headerTitle =
    mode === 'search'  ? 'Add a book' :
    mode === 'preview' ? 'Confirm book' :
                         'Manual entry';

  return (
    <VYBCreationSheet
      visible={visible}
      onDismiss={onDismiss}
      title={headerTitle}
      onBack={mode !== 'search' ? () => setMode('search') : undefined}
    >
      {/* Dev-only proof marker — confirms the v2 build is what's rendering.
          Strip this once we no longer need verification. */}
      {__DEV__ && (
        <View pointerEvents="none" style={{
          position: 'absolute', top: 8, left: 0, right: 0, alignItems: 'center', zIndex: 50,
        }}>
          <Text style={{
            fontFamily: F.mono, fontSize: 9, color: 'rgba(232,194,117,0.7)',
            letterSpacing: 1.2, textTransform: 'uppercase',
          }}>
            AddBook v2
          </Text>
        </View>
      )}
      <View style={{ flex: 1, paddingHorizontal: 20, paddingBottom: 20 }}>
        {mode === 'search' ? (
          <SearchView
            searchRef={searchRef}
            query={query} onQueryChange={setQuery}
            onSubmit={runSearch} onClear={clearQuery}
            searching={searching} hasSearched={hasSearched}
            results={results} providersDown={providersDown}
            onChoose={choose} onManual={goManual}
          />
        ) : (
          <ConfirmView
            mode={mode}
            title={title} setTitle={setTitle}
            author={author} setAuthor={setAuthor}
            pages={pages} setPages={onPagesChange}
            currentPage={currentPage} setCurrentPage={setCurrentPage}
            finishedMonth={finishedMonth} setFinishedMonth={setFinishedMonth}
            finishedYear={finishedYear} setFinishedYear={setFinishedYear}
            coverUrl={coverUrl} year={year}
            status={status} setStatus={(s: ConfirmStatus) => { hSelection(); setStatus(s); }}
            resolvingPages={resolvingPages}
            isEstimated={!pagesEdited && (selected?.page_confidence === 'low' || selected?.page_confidence === 'medium')}
            canSave={canSave} busy={busy} onSave={save}
            onChooseAnother={() => setMode('search')}
          />
        )}
      </View>
    </VYBCreationSheet>
  );
}

// ─── Search view ─────────────────────────────────────────────
function SearchView({
  searchRef, query, onQueryChange, onSubmit, onClear,
  searching, hasSearched, results, providersDown, onChoose, onManual,
}: {
  searchRef: React.RefObject<TextInput | null>;
  query: string; onQueryChange: (v: string) => void;
  onSubmit: () => void; onClear: () => void;
  searching: boolean; hasSearched: boolean;
  results: BookSearchResult[]; providersDown: boolean;
  onChoose: (r: BookSearchResult) => void; onManual: () => void;
}) {
  const hasResults = results.length > 0;
  return (
    <>
      <View style={{ position: 'relative', marginBottom: 16 }}>
        <VYBInput
          ref={searchRef}
          value={query} onChangeText={onQueryChange}
          onSubmitEditing={onSubmit}
          placeholder="Search title, author or ISBN"
          autoCapitalize="none" autoCorrect={false}
          returnKeyType="search"
          selectionColor={C.gold}
          borderRadius={999}
          icon={
            <Pressable onPress={onSubmit} hitSlop={6}>
              <Search size={17} color={query.trim().length > 0 ? C.gold : C.textMuted} />
            </Pressable>
          }
        />
        {query.length > 0 && (
          <Pressable
            onPress={onClear} hitSlop={10}
            style={{ position: 'absolute', right: 18, top: 0, bottom: 0, justifyContent: 'center' }}
          >
            <X size={15} color={C.textMuted} />
          </Pressable>
        )}
      </View>

      <ScrollView
        style={{ flex: 1 }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        automaticallyAdjustKeyboardInsets
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
      >
        {searching && (
          <View style={{ paddingVertical: 36, alignItems: 'center', gap: 12 }}>
            <ActivityIndicator color={C.gold} />
            <Text style={{ fontFamily: F.sans, fontSize: 13, color: C.textMuted, letterSpacing: 0.2 }}>
              Searching books…
            </Text>
          </View>
        )}

        {!searching && hasSearched && providersDown && (
          <VYBEmpty
            variant="simple"
            title="Search is temporarily unavailable."
            body="You can add this book manually."
            actionLabel="Add manually"
            onAction={onManual}
          />
        )}

        {!searching && hasSearched && !providersDown && !hasResults && (
          <VYBEmpty
            variant="simple"
            title="No results found."
            body="Try a different keyword, or add it manually."
            actionLabel="Add manually"
            onAction={onManual}
          />
        )}

        {!searching && hasResults && (
          <View style={{ gap: 8 }}>
            {results.map(r => <ResultRow key={r.external_id} r={r} onPress={() => onChoose(r)} />)}
          </View>
        )}

        {!searching && !hasSearched && (
          <View style={{ paddingTop: 36, alignItems: 'center', paddingHorizontal: 12 }}>
            <Text style={{
              fontFamily: F.serifItalic, fontSize: 15, color: C.textSecondary,
              textAlign: 'center', lineHeight: 22,
            }}>
              Type a title, author or ISBN, then tap search.
            </Text>
            <Pressable onPress={onManual} hitSlop={6} style={{ marginTop: 18 }}>
              <Text style={{
                fontFamily: F.sansBold, fontSize: 11.5, color: C.gold,
                letterSpacing: 1.2, textTransform: 'uppercase',
              }}>
                Or add manually
              </Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </>
  );
}

function ResultRow({ r, onPress }: { r: BookSearchResult; onPress: () => void }) {
  return (
    <Pressable onPress={onPress}>
      <VYBCard level="list" padding={12}>
        <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
          <VYBBookCover coverUrl={r.cover_url} title={r.title} size="xs" width={46} height={66} />
          <View style={{ flex: 1 }}>
            <Text numberOfLines={2} style={{
              fontFamily: F.sansBold, fontSize: 13.5, color: C.textPrimary, letterSpacing: -0.1, lineHeight: 18,
            }}>
              {r.title}
            </Text>
            {r.author && (
              <Text numberOfLines={1} style={{
                fontFamily: F.serifItalic, fontSize: 12, color: C.textMuted, marginTop: 3,
              }}>
                {r.author}
              </Text>
            )}
            <View style={{ flexDirection: 'row', gap: 6, marginTop: 6 }}>
              {r.total_pages ? <MetaPill>{r.total_pages} pages</MetaPill> : null}
              {r.published_date ? <MetaPill>{r.published_date.slice(0, 4)}</MetaPill> : null}
            </View>
          </View>
        </View>
      </VYBCard>
    </Pressable>
  );
}

function MetaPill({ children }: { children: React.ReactNode }) {
  return (
    <View style={{
      paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999,
      backgroundColor: 'rgba(255,255,255,0.05)',
      borderColor: C.borderSubtle, borderWidth: 1,
    }}>
      <Text style={{ fontFamily: F.mono, fontSize: 10, color: C.textMuted }}>
        {children}
      </Text>
    </View>
  );
}

// ─── Confirm / Manual view ───────────────────────────────────
function ConfirmView({
  mode, title, setTitle, author, setAuthor, pages, setPages,
  currentPage, setCurrentPage, finishedMonth, setFinishedMonth, finishedYear, setFinishedYear,
  coverUrl, year, status, setStatus,
  resolvingPages, isEstimated, canSave, busy, onSave, onChooseAnother,
}: any) {
  return (
    <ScrollView
      style={{ flex: 1 }}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      automaticallyAdjustKeyboardInsets
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ paddingBottom: 32 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Header card — selected book preview (or manual editable) */}
      {mode === 'preview' ? (
        <VYBCard level="widget" accent="gold" padding={16} style={{ marginBottom: 18 }}>
          <View style={{ flexDirection: 'row', gap: 14 }}>
            <VYBBookCover coverUrl={coverUrl} title={title} size="md" width={84} height={126} />
            <View style={{ flex: 1, justifyContent: 'space-between' }}>
              <View>
                <Text numberOfLines={3} style={{
                  fontFamily: F.sansBold, fontSize: 16, color: C.textPrimary,
                  letterSpacing: -0.2, lineHeight: 21,
                }}>
                  {title}
                </Text>
                {author ? (
                  <Text numberOfLines={2} style={{
                    fontFamily: F.serifItalic, fontSize: 12.5, color: C.textMuted, marginTop: 3,
                  }}>
                    {author}
                  </Text>
                ) : null}
                <View style={{ flexDirection: 'row', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                  {year ? <MetaPill>{year}</MetaPill> : null}
                  {pages ? <MetaPill>{pages} pages</MetaPill> : null}
                </View>
              </View>
              <Pressable onPress={onChooseAnother} hitSlop={6} style={{ marginTop: 10 }}>
                <Text style={{
                  fontFamily: F.sansBold, fontSize: 10.5, color: C.gold, letterSpacing: 1.2,
                }}>
                  CHOOSE ANOTHER →
                </Text>
              </Pressable>
            </View>
          </View>
        </VYBCard>
      ) : (
        <View style={{ marginBottom: 18, gap: 12 }}>
          <Labeled label="Title">
            <VYBInput value={title} onChangeText={setTitle} placeholder="Book title" selectionColor={C.gold} />
          </Labeled>
          <Labeled label="Author">
            <VYBInput value={author} onChangeText={setAuthor} placeholder="Author name" selectionColor={C.gold} />
          </Labeled>
          <Labeled label="Pages">
            <VYBInput value={pages} onChangeText={setPages} placeholder="370" keyboardType="number-pad" selectionColor={C.gold} />
          </Labeled>
        </View>
      )}

      {/* Status */}
      <SectionLabel>STATUS</SectionLabel>
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 8, marginBottom: 22 }}>
        {(['reading', 'finished', 'next'] as const).map(s => (
          <View key={s} style={{ flex: 1 }}>
            <VYBChip
              label={s === 'reading' ? 'Reading' : s === 'finished' ? 'Finished' : 'Wishlist'}
              tone="gold"
              selected={status === s}
              size="lg"
              onPress={() => setStatus(s)}
              style={{ width: '100%', justifyContent: 'center' }}
            />
          </View>
        ))}
      </View>

      {/* Conditional fields */}
      {status === 'reading' && (
        <View style={{ marginBottom: 22, gap: 12 }}>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Labeled label="Current page">
                <VYBInput value={currentPage} onChangeText={setCurrentPage} placeholder="0" keyboardType="number-pad" selectionColor={C.gold} />
              </Labeled>
            </View>
            <View style={{ flex: 1 }}>
              <Labeled label="Total pages">
                <VYBInput
                  value={pages} onChangeText={setPages} placeholder="—"
                  keyboardType="number-pad" selectionColor={C.gold}
                  icon={resolvingPages ? <ActivityIndicator size="small" color={C.gold} /> : undefined}
                />
              </Labeled>
            </View>
          </View>
          {isEstimated && !!pages && !resolvingPages && (
            <Text style={{ fontFamily: F.mono, fontSize: 10.5, color: C.amber, marginLeft: 4 }}>
              Estimated · you can edit it
            </Text>
          )}
        </View>
      )}

      {status === 'finished' && (
        <View style={{ marginBottom: 22 }}>
          <SectionLabel>WHEN DID YOU FINISH IT?</SectionLabel>
          <Text style={{ fontFamily: F.sans, fontSize: 11.5, color: C.textMuted, marginTop: 6, marginBottom: 10 }}>
            Optional. Defaults to today if left empty.
          </Text>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Labeled label="Month">
                <VYBInput value={finishedMonth} onChangeText={setFinishedMonth} placeholder="1–12" keyboardType="number-pad" selectionColor={C.gold} />
              </Labeled>
            </View>
            <View style={{ flex: 1 }}>
              <Labeled label="Year">
                <VYBInput value={finishedYear} onChangeText={setFinishedYear} placeholder="2026" keyboardType="number-pad" selectionColor={C.gold} />
              </Labeled>
            </View>
          </View>
        </View>
      )}

      <GoldButton
        variant="complete" size="lg"
        onPress={canSave ? onSave : undefined}
        loading={busy}
        style={{ alignSelf: 'stretch', justifyContent: 'center', opacity: canSave ? 1 : 0.5 }}>
        Add book
      </GoldButton>

      {!canSave && status === 'reading' ? (
        <Text style={{ fontFamily: F.sans, fontSize: 11.5, color: C.textMuted, textAlign: 'center', marginTop: 10 }}>
          Add a total page count to start tracking.
        </Text>
      ) : null}
    </ScrollView>
  );
}

// ─── Tiny helpers ────────────────────────────────────────────
function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View>
      <SectionLabel style={{ marginBottom: 6 }}>{label.toUpperCase()}</SectionLabel>
      {children}
    </View>
  );
}

function SectionLabel({ children, style }: any) {
  return (
    <Text style={[{
      fontFamily: F.sansBold, fontSize: 10, color: C.textMuted,
      letterSpacing: 2, textTransform: 'uppercase',
    }, style]}>{children}</Text>
  );
}
