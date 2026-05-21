/**
 * Local-date helpers. All "today" logic in the app must use these — using
 * `toISOString().slice(0,10)` produces a UTC date, which in negative-offset
 * timezones (e.g. Guatemala UTC-6) reports tomorrow's date late Friday.
 *
 * Date strings are kept in YYYY-MM-DD format so they sort lexicographically
 * and match what we store in Supabase columns like `habit_checkins.date`.
 */

export function localDateStr(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function localTodayStr(): string {
  return localDateStr(new Date());
}

export function localMinusDays(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return localDateStr(d);
}

// Local day-of-week (0=Sun..6=Sat) — matches Date#getDay().
export function localTodayDow(): number {
  return new Date().getDay();
}
