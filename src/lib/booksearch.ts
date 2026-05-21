// Book search — Open Library primary, Google Books fallback.
//
// Behaviour matches the web app:
//   1. Search Open Library with the query exactly as the user typed it.
//   2. If OL returns at least one result, that's the result set. Trust API order.
//   3. If OL returns zero (and only then), fall back to Google Books.
//   4. No client-side scoring, aliasing, or confidence filtering.
//   5. Page-count resolution is a separate concern (see books/pageCount.ts).

export type BookSearchResult = {
  title: string;
  author: string | null;
  cover_url: string | null;
  isbn: string | null;
  total_pages: number | null;
  publisher: string | null;
  published_date: string | null;
  description: string | null;
  external_source: 'open_library' | 'google_books' | 'manual';
  external_id: string;
  page_source: string | null;
  page_confidence: 'high' | 'medium' | 'low' | 'none' | 'manual';
};

export type SearchOutcome = {
  results: BookSearchResult[];
  bothProvidersFailed: boolean;
};

const OL_SEARCH = 'https://openlibrary.org/search.json';
const OL_COVER  = (cover_i: number) => `https://covers.openlibrary.org/b/id/${cover_i}-L.jpg`;
const GB_SEARCH = 'https://www.googleapis.com/books/v1/volumes';

const PROVIDER_TIMEOUT_MS = 5500;
const RETRY_DELAY_MS = 500;
const CACHE_TTL_MS = 5 * 60 * 1000;

function fetchWithTimeout(input: string, ms = PROVIDER_TIMEOUT_MS, signal?: AbortSignal): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  if (signal) signal.addEventListener('abort', () => controller.abort(), { once: true });
  return fetch(input, { signal: controller.signal }).finally(() => clearTimeout(timer));
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

// One transient-error retry — Google Books / Open Library return 503/504
// occasionally from mobile IPs, and a single retry usually clears it.
async function fetchResilient(url: string, signal?: AbortSignal): Promise<Response> {
  let lastErr: any;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const r = await fetchWithTimeout(url, PROVIDER_TIMEOUT_MS, signal);
      if (r.status === 503 || r.status === 504) {
        lastErr = new Error(`${r.status}`);
        if (attempt === 0 && !signal?.aborted) { await sleep(RETRY_DELAY_MS); continue; }
        throw lastErr;
      }
      return r;
    } catch (e: any) {
      if (e?.name === 'AbortError') throw e;
      lastErr = e;
      if (attempt === 0 && !signal?.aborted) { await sleep(RETRY_DELAY_MS); continue; }
      throw e;
    }
  }
  throw lastErr;
}

const cache = new Map<string, { outcome: SearchOutcome; ts: number }>();

// ─── Providers ────────────────────────────────────────────

async function searchOpenLibrary(q: string, signal?: AbortSignal): Promise<BookSearchResult[]> {
  const url = `${OL_SEARCH}?q=${encodeURIComponent(q)}&limit=10`;
  const r = await fetchResilient(url, signal);
  if (!r.ok) throw new Error(`OL ${r.status}`);
  const data = await r.json();
  const docs: any[] = data.docs || [];
  return docs.map((d): BookSearchResult => {
    const pages = d.number_of_pages_median ?? null;
    const editionKey: string | undefined = d.cover_edition_key || d.edition_key?.[0];
    return {
      title:           d.title || 'Untitled',
      author:          d.author_name?.join(', ') || null,
      cover_url:       d.cover_i ? OL_COVER(d.cover_i) : null,
      isbn:            d.isbn?.[0] || null,
      total_pages:     pages,
      publisher:       d.publisher?.[0] || null,
      published_date:  d.first_publish_year ? String(d.first_publish_year) : null,
      description:     null,
      external_source: 'open_library',
      external_id:     editionKey || d.key || `ol-${d.cover_i || Math.random()}`,
      page_source:     pages ? 'open_library_median' : null,
      page_confidence: pages ? 'low' : 'none',
    };
  });
}

async function searchGoogleBooks(q: string, signal?: AbortSignal): Promise<BookSearchResult[]> {
  const url = `${GB_SEARCH}?q=${encodeURIComponent(q)}&maxResults=10&printType=books`;
  const r = await fetchResilient(url, signal);
  if (!r.ok) throw new Error(`GB ${r.status}`);
  const data = await r.json();
  const items: any[] = data.items || [];
  return items.map((it): BookSearchResult => {
    const vi = it.volumeInfo || {};
    const cover: string | undefined = (vi.imageLinks?.thumbnail || vi.imageLinks?.smallThumbnail);
    const isbn13 = vi.industryIdentifiers?.find((i: any) => i.type === 'ISBN_13')?.identifier;
    const isbn10 = vi.industryIdentifiers?.find((i: any) => i.type === 'ISBN_10')?.identifier;
    return {
      title:           vi.title || 'Untitled',
      author:          vi.authors?.join(', ') || null,
      cover_url:       cover ? cover.replace(/^http:/, 'https:').replace(/&edge=curl/g, '') : null,
      isbn:            isbn13 || isbn10 || null,
      total_pages:     vi.pageCount || null,
      publisher:       vi.publisher || null,
      published_date:  vi.publishedDate || null,
      description:     vi.description || null,
      external_source: 'google_books',
      external_id:     it.id,
      page_source:     vi.pageCount ? 'google_books' : null,
      page_confidence: vi.pageCount ? 'high' : 'none',
    };
  });
}

// ─── Public ───────────────────────────────────────────────

export async function searchBooks(query: string, signal?: AbortSignal): Promise<SearchOutcome> {
  const q = query.trim();
  if (!q) return { results: [], bothProvidersFailed: false };

  const cacheKey = q.toLowerCase();
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) return cached.outcome;

  // 1) Open Library first
  let olResults: BookSearchResult[] = [];
  let olFailed = false;
  try {
    olResults = await searchOpenLibrary(q, signal);
  } catch (e: any) {
    if (e?.name === 'AbortError') return { results: [], bothProvidersFailed: false };
    olFailed = true;
    if (__DEV__) console.warn('[OL] rejected', e?.message);
  }
  if (signal?.aborted) return { results: [], bothProvidersFailed: false };

  if (olResults.length > 0) {
    const outcome: SearchOutcome = { results: olResults, bothProvidersFailed: false };
    cache.set(cacheKey, { outcome, ts: Date.now() });
    return outcome;
  }

  // 2) Google Books fallback only when OL returns empty
  let gbResults: BookSearchResult[] = [];
  let gbFailed = false;
  try {
    gbResults = await searchGoogleBooks(q, signal);
  } catch (e: any) {
    if (e?.name === 'AbortError') return { results: [], bothProvidersFailed: false };
    gbFailed = true;
    if (__DEV__) console.warn('[GB] rejected', e?.message);
  }
  if (signal?.aborted) return { results: [], bothProvidersFailed: false };

  const outcome: SearchOutcome = {
    results: gbResults,
    bothProvidersFailed: olFailed && gbFailed,
  };
  if (gbResults.length > 0) cache.set(cacheKey, { outcome, ts: Date.now() });
  return outcome;
}
