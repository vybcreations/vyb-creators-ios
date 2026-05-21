// Page-count estimation — port of the web logic.
//
// Two entry points:
//   • extractPageCount(book) — pure helper that inspects a raw book object
//     (Google Books volume, Open Library doc/edition, or a normalized search
//     result) and returns the best candidate.
//   • resolvePageCount(book) — async cascade that falls back to the OL edition
//     endpoint and then to Google Books when the first result has no pages.

export type PageConfidence = 'high' | 'medium' | 'low' | 'none' | 'manual';

export type PageResult = {
  totalPages: number | '';
  source: string | null;
  confidence: PageConfidence;
  isEstimated: boolean;
};

const MAX_PAGES = 5000;
const TIMEOUT_MS = 4000;

const empty = (): PageResult => ({ totalPages: '', source: null, confidence: 'none', isEstimated: false });

function isValidPageCount(n: any): boolean {
  const v = Number(n);
  return Number.isInteger(v) && v > 0 && v < MAX_PAGES;
}

// Sources ranked by reliability (highest first).
const SOURCE_RANK: Record<string, number> = {
  open_library_edition: 100,
  google_books:          90,
  open_library_median:   60,
  page_count:            40,
  pages:                 30,
};

const SOURCE_CONFIDENCE: Record<string, PageConfidence> = {
  open_library_edition: 'high',
  google_books:         'high',
  open_library_median:  'low',
  page_count:           'low',
  pages:                'low',
};

type Candidate = { value: number; source: keyof typeof SOURCE_RANK };

function collectCandidates(book: any): Candidate[] {
  const out: Candidate[] = [];
  if (!book || typeof book !== 'object') return out;

  // Google Books volume shape: book.volumeInfo.pageCount
  if (book.volumeInfo?.pageCount && isValidPageCount(book.volumeInfo.pageCount)) {
    out.push({ value: Number(book.volumeInfo.pageCount), source: 'google_books' });
  }

  // Open Library edition shape: book.number_of_pages
  if (book.number_of_pages && isValidPageCount(book.number_of_pages)) {
    out.push({ value: Number(book.number_of_pages), source: 'open_library_edition' });
  }

  // Open Library search shape: book.number_of_pages_median
  if (book.number_of_pages_median && isValidPageCount(book.number_of_pages_median)) {
    out.push({ value: Number(book.number_of_pages_median), source: 'open_library_median' });
  }

  // Generic
  if (book.pageCount && isValidPageCount(book.pageCount)) {
    out.push({ value: Number(book.pageCount), source: 'page_count' });
  }
  if (book.pages && isValidPageCount(book.pages)) {
    out.push({ value: Number(book.pages), source: 'pages' });
  }

  // Already-normalized BookSearchResult shape
  if (book.total_pages && isValidPageCount(book.total_pages)) {
    const knownSource = (book.page_source && SOURCE_RANK[book.page_source]) ? book.page_source : 'page_count';
    out.push({ value: Number(book.total_pages), source: knownSource as any });
  }

  return out;
}

export function extractPageCount(book: any): PageResult {
  const cands = collectCandidates(book);
  if (cands.length === 0) return empty();
  cands.sort((a, b) => (SOURCE_RANK[b.source] || 0) - (SOURCE_RANK[a.source] || 0));
  const best = cands[0];
  const confidence = SOURCE_CONFIDENCE[best.source] || 'low';
  return {
    totalPages: best.value,
    source: best.source,
    confidence,
    isEstimated: confidence !== 'high',
  };
}

// ─── async resolution cascade ────────────────────────────

const cache = new Map<string, PageResult>();

function cacheKeyFor(book: any): string {
  if (book.editionKey) return `ek:${book.editionKey}`;
  if (book.external_source === 'open_library' && book.external_id) return `ek:${book.external_id}`;
  if (book.isbn) return `isbn:${book.isbn}`;
  return `t:${(book.title || '').toLowerCase()}|${(book.author || '').toLowerCase()}`;
}

async function fetchWithTimeout(url: string): Promise<Response | null> {
  const c = new AbortController();
  const timer = setTimeout(() => c.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { signal: c.signal });
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function lookupOpenLibraryEdition(editionKey: string): Promise<PageResult> {
  const key = editionKey.startsWith('/') ? editionKey.slice(1) : editionKey;
  const r = await fetchWithTimeout(`https://openlibrary.org/${key}.json`);
  if (!r || !r.ok) return empty();
  try {
    const data = await r.json();
    return extractPageCount(data);
  } catch { return empty(); }
}

async function lookupGoogleBooks(book: any): Promise<PageResult> {
  const q = book.isbn
    ? `isbn:${book.isbn}`
    : `${book.title || ''} ${book.author || ''}`.trim();
  if (!q) return empty();
  const url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}&maxResults=3&printType=books`;
  const r = await fetchWithTimeout(url);
  if (!r || !r.ok) return empty();
  try {
    const data = await r.json();
    const items: any[] = data.items || [];
    for (const it of items) {
      const got = extractPageCount(it);
      if (got.totalPages !== '') return got;
    }
    return empty();
  } catch { return empty(); }
}

export async function resolvePageCount(book: any): Promise<PageResult> {
  if (!book) return empty();

  // 1) direct extraction
  const direct = extractPageCount(book);
  if (direct.totalPages !== '') return direct;

  const key = cacheKeyFor(book);
  const cached = cache.get(key);
  if (cached) return cached;

  // 2) Open Library edition lookup
  const editionKey = book.editionKey ||
    (book.external_source === 'open_library' && book.external_id ? book.external_id : null);
  if (editionKey) {
    const ol = await lookupOpenLibraryEdition(editionKey);
    if (ol.totalPages !== '') { cache.set(key, ol); return ol; }
  }

  // 3) Google Books fallback (by ISBN or title+author)
  const gb = await lookupGoogleBooks(book);
  if (gb.totalPages !== '') { cache.set(key, gb); return gb; }

  // Negative cache so repeated taps don't refetch
  const result = empty();
  cache.set(key, result);
  return result;
}
