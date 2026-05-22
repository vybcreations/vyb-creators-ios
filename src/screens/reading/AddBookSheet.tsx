import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, Pressable, Alert, ScrollView, ActivityIndicator, Keyboard } from 'react-native';
import { Search, X, ArrowLeft } from 'lucide-react-native';
import { DraggableSheet, SheetHeader } from '../../components/DraggableSheet';
import { GoldButton } from '../../components/primitives';
import { VYBChip, VYBBookCover, VYBInput, VYBEmpty } from '../../components/ui';
import { colors as C, fonts as F } from '../../theme';
import { searchBooks, BookSearchResult } from '../../lib/booksearch';
import { resolvePageCount } from '../../lib/books/pageCount';
import { createBook, pickCoverTone, BookStatus } from '../../lib/reading';
import { useAuth } from '../../lib/auth';
import { hSelection, hSuccess } from '../../lib/haptics';

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

  // Confirmation form state
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

  // Explicit search — fires on submit / search-icon tap. No auto-search on
  // every keystroke.
  const runSearch = async () => {
    const trimmed = query.trim();
    if (!trimmed) return;

    abortRef.current?.abort();
    const mine = ++seqRef.current;
    setSearching(true);
    setProvidersDown(false);

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
      if (e?.name !== 'AbortError') {
        setResults([]);
        setHasSearched(true);
      }
    } finally {
      if (mine === seqRef.current) setSearching(false);
    }
  };

  const clearQuery = () => {
    setQuery('');
    setResults([]);
    setHasSearched(false);
    setProvidersDown(false);
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
        // Don't clobber if the user already started editing
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

  // Manual edit overrides any estimation flag
  const onPagesChange = (v: string) => {
    setPages(v);
    setPagesEdited(true);
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
    const iso = new Date(Date.UTC(y, m - 1, 1)).toISOString();
    return iso;
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
      // Patch current_page + finished_at after create (createBook doesn't take them)
      if (cur > 0 || finishedAt) {
        const { supabase } = await import('../../lib/supabase');
        const { error } = await supabase
          .from('books')
          .update({
            current_page: cur,
            finished_at: finishedAt,
          })
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

  const trimmed = query.trim();
  const canSave = title.trim().length > 0
    && (status !== 'reading' || (pages.length > 0));

  return (
    <DraggableSheet
      visible={visible}
      onDismiss={onDismiss}
      showClose={false}
      maxHeightFraction={0.95}
      keyboardAvoiding={false}
    >
      <SheetHeader
        title={mode === 'search' ? 'Add a book' : mode === 'preview' ? 'Confirm book' : 'Manual entry'}
        onClose={onDismiss}
        leftAccessory={mode !== 'search' ? (
          <Pressable onPress={() => setMode('search')} hitSlop={10}>
            <ArrowLeft size={20} color={C.textPrimary} />
          </Pressable>
        ) : undefined}
      />
      {/* The sheet's parent (DraggableSheet Animated.View) sizes to content
          (it has maxHeight, not flex). So flex:1 alone collapses to 0 —
          minHeight gives the sheet enough natural height to actually render
          the search/form, and the inner ScrollViews then own their own
          keyboard insets via automaticallyAdjustKeyboardInsets. */}
      <View style={{ minHeight: 560, paddingHorizontal: 20, paddingBottom: 20 }}>

        {mode === 'search' && (
          <SearchMode
            searchRef={searchRef}
            query={query} setQuery={setQuery}
            onSubmit={runSearch} onClear={clearQuery}
            searching={searching} hasSearched={hasSearched}
            results={results} providersDown={providersDown}
            onChoose={choose} onManual={goManual}
          />
        )}

        {(mode === 'preview' || mode === 'manual') && (
          <ConfirmMode
            mode={mode}
            title={title} setTitle={setTitle}
            author={author} setAuthor={setAuthor}
            pages={pages} setPages={onPagesChange}
            resolvingPages={resolvingPages}
            isEstimated={!pagesEdited && (selected?.page_confidence === 'low' || selected?.page_confidence === 'medium')}
            coverUrl={coverUrl} year={year}
            status={status} setStatus={setStatus}
            currentPage={currentPage} setCurrentPage={setCurrentPage}
            finishedMonth={finishedMonth} setFinishedMonth={setFinishedMonth}
            finishedYear={finishedYear} setFinishedYear={setFinishedYear}
            canSave={canSave} busy={busy} onSave={save}
            onChooseAnother={() => setMode('search')}
          />
        )}
      </View>
    </DraggableSheet>
  );
}

// ─── Search ──────────────────────────────────────────────
function SearchMode({
  searchRef, query, setQuery, onSubmit, onClear,
  searching, hasSearched, results, providersDown,
  onChoose, onManual,
}: any) {
  const hasResults = results.length > 0;
  return (
    <>
      <View style={{ marginBottom: 12 }}>
        <VYBInput
          ref={searchRef}
          value={query} onChangeText={setQuery}
          onSubmitEditing={onSubmit}
          placeholder="Search title, author, ISBN…"
          autoCapitalize="none" autoCorrect={false}
          returnKeyType="search"
          selectionColor={C.gold}
          icon={
            <Pressable onPress={onSubmit} hitSlop={6}>
              <Search size={16} color={query.trim().length > 0 ? C.gold : C.textMuted} />
            </Pressable>
          }
        />
        {query.length > 0 && (
          <Pressable onPress={onClear} hitSlop={10} style={{ position: 'absolute', right: 14, top: 14 }}>
            <X size={14} color={C.textMuted} />
          </Pressable>
        )}
      </View>

      <ScrollView
        style={{ maxHeight: 480 }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        automaticallyAdjustKeyboardInsets
        contentInsetAdjustmentBehavior="automatic"
      >
        {searching && (
          <View style={{ paddingVertical: 32, alignItems: 'center', gap: 12 }}>
            <ActivityIndicator color={C.gold} />
            <Text style={{ fontFamily: F.sans, fontSize: 13, color: C.textMuted, letterSpacing: 0.2 }}>
              Searching books…
            </Text>
          </View>
        )}

        {/* Both providers actually errored out */}
        {!searching && hasSearched && providersDown && (
          <VYBEmpty
            variant="simple"
            title="Search is temporarily unavailable."
            body="You can add this book manually."
            actionLabel="Add manually"
            onAction={onManual}
          />
        )}

        {/* APIs answered but returned nothing */}
        {!searching && hasSearched && !providersDown && !hasResults && (
          <VYBEmpty
            variant="simple"
            title="No results found."
            body="Try a different keyword, or add it manually."
            actionLabel="Add manually"
            onAction={onManual}
          />
        )}

        {/* Results — trust the API ordering, no client-side filtering */}
        {!searching && hasResults && results.map((r: BookSearchResult) => (
          <ResultRow key={r.external_id} r={r} onChoose={onChoose} />
        ))}

        {/* Pre-search prompt */}
        {!searching && !hasSearched && (
          <VYBEmpty
            variant="simple"
            title="Type a title or author, then press search."
            actionLabel="Or add manually"
            onAction={onManual}
          />
        )}
      </ScrollView>
    </>
  );
}

// ─── Confirm / Manual ────────────────────────────────────
function ConfirmMode({
  mode, title, setTitle, author, setAuthor, pages, setPages,
  resolvingPages, isEstimated,
  coverUrl, year,
  status, setStatus, currentPage, setCurrentPage,
  finishedMonth, setFinishedMonth, finishedYear, setFinishedYear,
  canSave, busy, onSave, onChooseAnother,
}: any) {
  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      automaticallyAdjustKeyboardInsets
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ paddingBottom: 24 }}
    >
      {/* Book summary — horizontal */}
      {mode === 'preview' ? (
        <View style={{ flexDirection: 'row', gap: 16, marginBottom: 22 }}>
          <VYBBookCover coverUrl={coverUrl} title={title} size="md" width={94} height={140} />
          <View style={{ flex: 1, justifyContent: 'space-between' }}>
            <View>
              <Text numberOfLines={3} style={{ fontFamily: F.sansBold, fontSize: 17, color: C.textPrimary, letterSpacing: -0.2, lineHeight: 22 }}>
                {title}
              </Text>
              {author ? (
                <Text numberOfLines={2} style={{ fontFamily: F.serifItalic, fontSize: 13, color: C.textMuted, marginTop: 4 }}>
                  {author}
                </Text>
              ) : null}
              <View style={{ flexDirection: 'row', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                {year ? <Tag>{year}</Tag> : null}
                {pages ? <Tag>{pages} pages</Tag> : null}
              </View>
            </View>
            <Pressable onPress={onChooseAnother} style={{ marginTop: 10 }}>
              <Text style={{ fontFamily: F.sansBold, fontSize: 11, color: C.gold, letterSpacing: 1.2 }}>
                CHOOSE ANOTHER BOOK
              </Text>
            </Pressable>
          </View>
        </View>
      ) : (
        // Manual mode: editable inputs at the top
        <View style={{ marginBottom: 18 }}>
          <Field label="Title"  value={title}  onChange={setTitle}  placeholder="Book title" />
          <Field label="Author" value={author} onChange={setAuthor} placeholder="Author name" />
          <Field label="Pages"  value={pages}  onChange={setPages}  placeholder="370" keyboardType="number-pad" />
        </View>
      )}

      {/* Status */}
      <SectionLabel>STATUS</SectionLabel>
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 8, marginBottom: 18 }}>
        {(['reading', 'finished', 'next'] as const).map(s => (
          <View key={s} style={{ flex: 1 }}>
            <VYBChip
              label={s === 'reading' ? 'Reading' : s === 'finished' ? 'Finished' : 'Wishlist'}
              tone="gold"
              selected={status === s}
              size="lg"
              onPress={() => { hSelection(); setStatus(s); }}
              style={{ width: '100%', justifyContent: 'center' }}
            />
          </View>
        ))}
      </View>

      {/* Conditional fields */}
      {status === 'reading' && (
        <View style={{ marginBottom: 18 }}>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Field label="Current page" value={currentPage} onChange={setCurrentPage} placeholder="0" keyboardType="number-pad" />
            </View>
            <View style={{ flex: 1 }}>
              <FieldWithAdornment
                label="Total pages" value={pages} onChange={setPages} placeholder="—"
                keyboardType="number-pad"
                adornment={resolvingPages ? <ActivityIndicator size="small" color={C.gold} /> : null}
              />
            </View>
          </View>
          {isEstimated && !!pages && !resolvingPages && (
            <Text style={{ fontFamily: F.mono, fontSize: 10.5, color: C.amber, marginLeft: 4, marginTop: -8 }}>
              Estimated · you can edit it
            </Text>
          )}
        </View>
      )}

      {status === 'finished' && (
        <View style={{ marginBottom: 18 }}>
          <SectionLabel>WHEN DID YOU FINISH IT?</SectionLabel>
          <Text style={{ fontFamily: F.sans, fontSize: 11, color: C.textMuted, marginTop: 4, marginBottom: 10 }}>
            Optional. Defaults to today if left empty.
          </Text>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Field label="Month" value={finishedMonth} onChange={setFinishedMonth} placeholder="1–12" keyboardType="number-pad" />
            </View>
            <View style={{ flex: 1 }}>
              <Field label="Year" value={finishedYear} onChange={setFinishedYear} placeholder="2026" keyboardType="number-pad" />
            </View>
          </View>
        </View>
      )}

      <GoldButton
        variant="complete" size="lg" onPress={canSave ? onSave : undefined}
        style={{ alignSelf: 'stretch', justifyContent: 'center', opacity: canSave ? 1 : 0.5 }}>
        {busy ? '…' : 'Add book'}
      </GoldButton>
      {!canSave && status === 'reading' ? (
        <Text style={{ fontFamily: F.sans, fontSize: 11, color: C.textMuted, textAlign: 'center', marginTop: 8 }}>
          Add a total page count to start tracking.
        </Text>
      ) : null}
    </ScrollView>
  );
}

// ─── Small helpers ────────────────────────────────────────
function ResultRow({ r, onChoose }: { r: BookSearchResult; onChoose: (r: BookSearchResult) => void }) {
  return (
    <Pressable onPress={() => onChoose(r)} style={{
      flexDirection: 'row', gap: 12, paddingVertical: 10,
      borderBottomColor: C.borderSubtle, borderBottomWidth: 1,
    }}>
      <VYBBookCover coverUrl={r.cover_url} title={r.title} size="xs" width={44} height={62} />
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <Text numberOfLines={2} style={{ fontFamily: F.sansBold, fontSize: 14, color: C.textPrimary, letterSpacing: -0.1 }}>{r.title}</Text>
        {r.author && <Text numberOfLines={1} style={{ fontFamily: F.serifItalic, fontSize: 12, color: C.textMuted, marginTop: 2 }}>{r.author}</Text>}
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
          {r.total_pages && <Tag>{r.total_pages} p.</Tag>}
          {r.published_date && <Tag>{r.published_date.slice(0, 4)}</Tag>}
        </View>
      </View>
    </Pressable>
  );
}

function FieldWithAdornment({ label, value, onChange, placeholder, keyboardType, adornment }: any) {
  return (
    <View style={{ marginBottom: 14 }}>
      <SectionLabel style={{ marginBottom: 6 }}>{String(label).toUpperCase()}</SectionLabel>
      <VYBInput
        value={value} onChangeText={onChange} placeholder={placeholder}
        keyboardType={keyboardType} selectionColor={C.gold}
        icon={adornment ? <View>{adornment}</View> : undefined}
      />
    </View>
  );
}

function Field({ label, value, onChange, placeholder, keyboardType }: any) {
  return (
    <View style={{ marginBottom: 14 }}>
      <SectionLabel style={{ marginBottom: 6 }}>{String(label).toUpperCase()}</SectionLabel>
      <VYBInput
        value={value} onChangeText={onChange} placeholder={placeholder}
        keyboardType={keyboardType} selectionColor={C.gold}
      />
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

function Tag({ children }: any) {
  return (
    <Text style={{
      fontFamily: F.mono, fontSize: 10, color: C.textMuted,
      backgroundColor: C.bgOverlay, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5,
    }}>{children}</Text>
  );
}

