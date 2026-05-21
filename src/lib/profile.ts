import { useCallback, useEffect, useState } from 'react';
import * as FileSystem from 'expo-file-system/legacy';
import { decode as decodeBase64 } from 'base64-arraybuffer';
import { supabase } from './supabase';
import { useAuth } from './auth';

export type Profile = {
  id: string;
  display_name: string | null;
  username: string | null;
  bio: string | null;
  avatar_url: string | null;
  cover_url: string | null;
  role: string | null;
  location: string | null;
  // Social links — null when empty so we can hide unfilled platforms.
  instagram_url: string | null;
  youtube_url:   string | null;
  twitter_url:   string | null;
  tiktok_url:    string | null;
  linkedin_url:  string | null;
};

export type SocialPlatform = 'instagram' | 'youtube' | 'twitter' | 'tiktok' | 'linkedin';

// Canonical URL builders per platform. Some platforms use an "@" in the path
// (YouTube, TikTok), most don't — we encode that here so the rest of the app
// doesn't have to remember.
const SOCIAL_URL: Record<SocialPlatform, (h: string) => string> = {
  instagram: h => `https://instagram.com/${h}`,
  youtube:   h => `https://youtube.com/@${h}`,
  twitter:   h => `https://x.com/${h}`,
  tiktok:    h => `https://tiktok.com/@${h}`,
  linkedin:  h => `https://linkedin.com/in/${h}`,
};

// Hostnames each platform owns. Used to detect "looks like a URL" when the
// user pastes a full link instead of typing a handle.
const SOCIAL_HOSTS: Record<SocialPlatform, string[]> = {
  instagram: ['instagram.com', 'www.instagram.com'],
  youtube:   ['youtube.com', 'www.youtube.com', 'youtu.be'],
  twitter:   ['x.com', 'www.x.com', 'twitter.com', 'www.twitter.com'],
  tiktok:    ['tiktok.com', 'www.tiktok.com', 'vm.tiktok.com'],
  linkedin:  ['linkedin.com', 'www.linkedin.com'],
};

// Build a public URL from either a handle (`luisdafilms`, `@luisdafilms`) or
// a full URL the user pasted. Returns null for empty/invalid input.
export function buildSocialUrl(platform: SocialPlatform, raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  // Looks like a URL → normalize and accept it as-is.
  if (/^https?:\/\//i.test(trimmed) || /\.[a-z]{2,}\//i.test(trimmed)) {
    const withProto = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    try {
      const u = new URL(withProto);
      if (!u.hostname.includes('.')) return null;
      return u.toString().replace(/\/+$/, '');
    } catch { return null; }
  }
  // Plain handle → strip @ + invalid chars, then construct the canonical URL.
  const handle = trimmed.replace(/^@+/, '').replace(/\s+/g, '');
  if (!handle) return null;
  return SOCIAL_URL[platform](handle);
}

// Reverse: given a stored URL, return the handle to pre-fill the Edit input.
// Returns the full URL untouched if the host doesn't match the platform (e.g.
// the user pasted something weird).
export function handleFromSocialUrl(platform: SocialPlatform, url: string | null): string {
  if (!url) return '';
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    if (!SOCIAL_HOSTS[platform].includes(host)) return url;
    // Path is "/something" or "/@something" — drop the leading "/" and "@".
    const path = u.pathname.replace(/^\/+/, '').replace(/\/+$/, '');
    if (!path) return '';
    // LinkedIn uses "in/{handle}"; drop that prefix when present.
    if (platform === 'linkedin' && path.startsWith('in/')) return path.slice(3);
    return path.replace(/^@/, '');
  } catch { return url; }
}

export type PeriodStats = { habits: number; tasks: number; pages: number; ideas: number };

export type ActivityItem = {
  id: string;
  kind: 'task' | 'habit' | 'reading' | 'idea' | 'book';
  label: string;
  ts: string;   // ISO timestamp for sorting
};

export type ProfileStats = {
  profile: Profile | null;
  todayHabitsDone: number;
  todayHabitsTotal: number;
  todayTasksDone: number;
  todayTasksOpen: number;
  readingStreak: number;
  focusStreak: number;
  writingStreak: number;
  currentBook: { id: string; title: string; author: string | null; current_page: number; total_pages: number | null; cover_tone: string; cover_url: string | null } | null;
  activeDays: Set<string>;            // YYYY-MM-DD set for the last 26 weeks
  // Per-day count of meaningful actions (habits + tasks + sessions + ideas).
  // Used by the activity heatmap to colour by intensity, not just on/off.
  activityIntensity: Map<string, number>;
  totalActiveDaysThisYear: number;

  // Lifetime totals — used by the Progress Summary + Milestones sections.
  totalTasksDone: number;
  totalIdeasCaptured: number;
  totalBooksFinished: number;
  totalHabitsDone: number;
  totalPagesRead: number;

  // Snapshots for the Day / Week / Month toggle.
  thisDay: PeriodStats;
  thisWeek: PeriodStats;
  thisMonth: PeriodStats;
  // How many days have elapsed in the current week / month — used by the
  // Aura Score so it stops penalizing for days that haven't happened.
  // "Effective" elapsed days respect the user's start date so someone who
  // joined mid-month isn't punished for the days before they existed.
  elapsedDaysInWeek: number;
  elapsedDaysInMonth: number;
  effectiveElapsedDaysInWeek: number;
  effectiveElapsedDaysInMonth: number;

  // How many habit instances were *scheduled* for today / this week / month.
  // Used by the Aura Score so extra unscheduled habits never block today's
  // score from reaching 100.
  plannedHabitsToday: number;
  plannedHabitsThisWeek: number;
  plannedHabitsThisMonth: number;

  // Real names + priorities so the Aura's Next Best Action can recommend a
  // specific habit/task instead of generic copy.
  incompleteHabitsToday: { id: string; name: string }[];
  openTasksByPriority: { id: string; text: string; pri: 'urgent' | 'important' | 'later' }[];

  // Latest 5 events across tasks/habits/reading/ideas/books-finished.
  recentActivity: ActivityItem[];
};

// Count consecutive days with activity ending at today (or yesterday if today empty).
function streakFromDates(dates: Set<string>): number {
  if (dates.size === 0) return 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  // Local date (toISOString is UTC and breaks streak math in negative offsets).
  const yyyymmdd = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };
  // Streak can start today OR yesterday (grace period — you haven't done today yet but you still have a streak)
  let cursor = new Date(today);
  if (!dates.has(yyyymmdd(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
    if (!dates.has(yyyymmdd(cursor))) return 0;
  }
  let count = 0;
  while (dates.has(yyyymmdd(cursor))) {
    count++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return count;
}

// Local-date helpers (no UTC). Using toISOString() to build YYYY-MM-DD shifts
// dates across midnight in non-UTC timezones — Tuesday's habit can land in
// "Wednesday" or vice versa. These helpers always reflect the user's local
// wall-clock, which is what Supabase rows are stored against.
function localDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function startOfWeek(d: Date): Date {
  const x = new Date(d);
  const dow = x.getDay();            // 0 = Sunday, 6 = Saturday
  const offset = dow === 0 ? 6 : dow - 1;   // Monday-based week
  x.setDate(x.getDate() - offset);
  x.setHours(0, 0, 0, 0);
  return x;
}
function startOfMonth(d: Date): Date {
  const x = new Date(d);
  x.setDate(1);
  x.setHours(0, 0, 0, 0);
  return x;
}

const today = () => localDateStr(new Date());

function truncate(s: string, max = 40): string {
  const t = s.trim();
  return t.length > max ? t.slice(0, max - 1) + '…' : t;
}

// Pull every profile field we care about for the Profile dashboard.
export function useProfile() {
  const { session } = useAuth();
  const [data, setData] = useState<ProfileStats | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!session) return;
    const uid = session.user.id;
    const now = new Date();
    const todayStr = localDateStr(now);

    // Rolling 26-week window for the heatmap.
    const yearStart = new Date(now); yearStart.setDate(now.getDate() - 26 * 7);
    const yearStartStr = localDateStr(yearStart);

    // Calendar-week + calendar-month boundaries (Monday-based). Elapsed days
    // = how many days have passed *including today*. The Aura score uses this
    // so we never compare against future days that haven't happened.
    const weekStartDate  = startOfWeek(now);
    const monthStartDate = startOfMonth(now);
    const weekStartStr   = localDateStr(weekStartDate);
    const monthStartStr  = localDateStr(monthStartDate);
    const elapsedDaysInWeek  = Math.floor((now.getTime() - weekStartDate.getTime()) / 86400000) + 1;
    const elapsedDaysInMonth = now.getDate();

    const [
      profileQ, habitsQ, checkinsTodayQ, tasksQ, bookQ,
      focusActivityQ, readingActivityQ, writingActivityQ,
      // New aggregates for the lower profile section:
      tasksYearQ, habitCheckinsYearQ, readingSessionsYearQ, booksFinishedQ,
      // Recent activity feed (last 5 of each source):
      recentTasksQ, recentHabitsQ, recentSessionsQ, recentIdeasQ, recentBooksQ,
    ] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', uid).maybeSingle(),
      supabase.from('habits').select('id, name, days_of_week, created_at').eq('user_id', uid).eq('archived', false),
      supabase.from('habit_checkins').select('habit_id, done').eq('user_id', uid).eq('date', todayStr),
      supabase.from('tasks').select('id, text, pri, done').eq('user_id', uid),
      supabase.from('books').select('id, title, author, current_page, total_pages, cover_tone, cover_url, updated_at').eq('user_id', uid).eq('status', 'reading').order('updated_at', { ascending: false }).limit(1),
      // focus streak: days with a focus_session
      supabase.from('focus_sessions').select('started_at').eq('user_id', uid).gte('started_at', yearStartStr),
      // reading streak: days with a reading note OR a book page update
      supabase.from('reading_notes').select('created_at').eq('user_id', uid).gte('created_at', yearStartStr),
      // writing streak: days with an idea created OR task in writing category done
      supabase.from('ideas').select('created_at').eq('user_id', uid).gte('created_at', yearStartStr),

      // Lifetime+period aggregates. We pull rows with timestamps so we can
      // bucket them into week/month locally without firing per-period queries.
      supabase.from('tasks').select('done_at').eq('user_id', uid).eq('done', true).gte('done_at', monthStartStr),
      supabase.from('habit_checkins').select('date, done').eq('user_id', uid).eq('done', true).gte('date', monthStartStr),
      supabase.from('reading_sessions').select('started_at, pages_read').eq('user_id', uid).gte('started_at', monthStartStr),
      supabase.from('books').select('id', { count: 'exact', head: true }).eq('user_id', uid).eq('status', 'finished'),

      // Recent activity feed — limit 5 each, merged client-side.
      supabase.from('tasks').select('id, text, done_at').eq('user_id', uid).eq('done', true).not('done_at', 'is', null).order('done_at', { ascending: false }).limit(5),
      supabase.from('habit_checkins').select('id, habit_id, date').eq('user_id', uid).eq('done', true).order('date', { ascending: false }).limit(5),
      supabase.from('reading_sessions').select('id, pages_read, started_at, book_id').eq('user_id', uid).order('started_at', { ascending: false }).limit(5),
      supabase.from('ideas').select('id, body, created_at').eq('user_id', uid).order('created_at', { ascending: false }).limit(5),
      supabase.from('books').select('id, title, finished_at').eq('user_id', uid).eq('status', 'finished').not('finished_at', 'is', null).order('finished_at', { ascending: false }).limit(5),
    ]);

    const profile = (profileQ.data as Profile) || null;
    const habitsRows = (habitsQ.data || []) as { id: string; name: string; days_of_week: number[]; created_at: string }[];
    // Count habits scheduled for today only (so unscheduled "extra" habits
    // can't drag the score down).
    const todayDow = now.getDay();
    const habitsTotal = habitsRows.filter(h => (h.days_of_week || [0,1,2,3,4,5,6]).includes(todayDow)).length;
    const habitsDone = (checkinsTodayQ.data || []).filter(c => c.done).length;

    // Effective period start respects user signup so early users aren't
    // punished for days before they existed.
    const userCreatedAt = session.user.created_at ? new Date(session.user.created_at) : weekStartDate;
    const effectiveWeekStart  = userCreatedAt > weekStartDate  ? userCreatedAt : weekStartDate;
    const effectiveMonthStart = userCreatedAt > monthStartDate ? userCreatedAt : monthStartDate;
    const dayMs = 86400000;
    const effectiveElapsedDaysInWeek  = Math.max(1, Math.floor((now.getTime() - effectiveWeekStart.getTime())  / dayMs) + 1);
    const effectiveElapsedDaysInMonth = Math.max(1, Math.floor((now.getTime() - effectiveMonthStart.getTime()) / dayMs) + 1);

    // Walk each day in the effective period and tally how many habits were
    // scheduled (using each habit's days_of_week + its own created_at).
    const countPlannedInstances = (from: Date, to: Date): number => {
      let total = 0;
      const cursor = new Date(from); cursor.setHours(0,0,0,0);
      const end = new Date(to); end.setHours(0,0,0,0);
      while (cursor.getTime() <= end.getTime()) {
        const dow = cursor.getDay();
        for (const h of habitsRows) {
          const days = h.days_of_week || [0,1,2,3,4,5,6];
          if (!days.includes(dow)) continue;
          if (h.created_at && new Date(h.created_at) > cursor) continue;
          total++;
        }
        cursor.setDate(cursor.getDate() + 1);
      }
      return total;
    };
    const plannedHabitsToday      = habitsTotal;
    const plannedHabitsThisWeek   = countPlannedInstances(effectiveWeekStart,  now);
    const plannedHabitsThisMonth  = countPlannedInstances(effectiveMonthStart, now);

    // Today's incomplete habits — scheduled for today and not yet checked in.
    const doneHabitIdsToday = new Set(
      (checkinsTodayQ.data || []).filter((c: any) => c.done).map((c: any) => c.habit_id as string)
    );
    const incompleteHabitsToday = habitsRows
      .filter(h => (h.days_of_week || [0,1,2,3,4,5,6]).includes(todayDow))
      .filter(h => !doneHabitIdsToday.has(h.id))
      .map(h => ({ id: h.id, name: h.name }));

    // Open tasks ordered urgent → important → later. Sliced to a small set —
    // the score's Next Best Action only needs the top one or two.
    const priRank: Record<string, number> = { urgent: 0, important: 1, later: 2 };
    const openTasksByPriority = ((tasksQ.data || []) as any[])
      .filter(t => !t.done)
      .sort((a, b) => (priRank[a.pri] ?? 3) - (priRank[b.pri] ?? 3))
      .slice(0, 5)
      .map(t => ({ id: t.id as string, text: t.text as string, pri: t.pri as 'urgent' | 'important' | 'later' }));
    const tasksDone = (tasksQ.data || []).filter(t => t.done).length;
    const tasksOpen = (tasksQ.data || []).filter(t => !t.done).length;
    const book = bookQ.data?.[0] || null;

    const focusDays = new Set((focusActivityQ.data || []).map(r => (r.started_at as string).slice(0, 10)));
    const readingDays = new Set((readingActivityQ.data || []).map(r => (r.created_at as string).slice(0, 10)));
    const writingDays = new Set((writingActivityQ.data || []).map(r => (r.created_at as string).slice(0, 10)));
    const habitDays = new Set((habitCheckinsYearQ.data || []).map((r: any) => (r.date as string).slice(0, 10)));
    const taskDays  = new Set(((tasksYearQ.data || []) as any[]).filter(r => r.done_at).map(r => (r.done_at as string).slice(0, 10)));
    const activeDays = new Set<string>([
      ...focusDays, ...readingDays, ...writingDays, ...habitDays, ...taskDays,
    ]);
    // Activity intensity = count of distinct sources active that day (1..4).
    const activityIntensity = new Map<string, number>();
    const bumpDay = (day: string) => activityIntensity.set(day, (activityIntensity.get(day) || 0) + 1);
    for (const d of habitDays)   bumpDay(d);
    for (const d of taskDays)    bumpDay(d);
    for (const d of readingDays) bumpDay(d);
    for (const d of writingDays) bumpDay(d);

    // Bucket period rows by date so the toggle can switch week ↔ month without
    // hitting the DB again. We pull "this month" worth and filter "this week"
    // locally.
    const inWeek = (d: string) => d >= weekStartStr;
    const tasksYear   = tasksYearQ.data || [];
    const habitsYear  = habitCheckinsYearQ.data || [];
    const sessionsYear = readingSessionsYearQ.data || [];
    const ideasYear   = (writingActivityQ.data || []).filter(r => (r.created_at as string) >= monthStartStr);

    const thisMonth: PeriodStats = {
      habits: habitsYear.length,
      tasks:  tasksYear.length,
      pages:  sessionsYear.reduce((s, r) => s + (r.pages_read || 0), 0),
      ideas:  ideasYear.length,
    };
    const thisWeek: PeriodStats = {
      habits: habitsYear.filter(r => inWeek(r.date as string)).length,
      tasks:  tasksYear.filter(r => inWeek((r.done_at as string).slice(0, 10))).length,
      pages:  sessionsYear.filter(r => inWeek((r.started_at as string).slice(0, 10))).reduce((s, r) => s + (r.pages_read || 0), 0),
      ideas:  ideasYear.filter(r => inWeek((r.created_at as string).slice(0, 10))).length,
    };
    // Daily slice — exact same shape, but filtered to today only.
    const isToday = (d: string) => d === todayStr;
    const thisDay: PeriodStats = {
      habits: habitsYear.filter(r => isToday(r.date as string)).length,
      tasks:  tasksYear.filter(r => isToday((r.done_at as string).slice(0, 10))).length,
      pages:  sessionsYear.filter(r => isToday((r.started_at as string).slice(0, 10))).reduce((s, r) => s + (r.pages_read || 0), 0),
      ideas:  ideasYear.filter(r => isToday((r.created_at as string).slice(0, 10))).length,
    };

    const habitNameById = new Map<string, string>(
      (habitsQ.data || []).map((h: any) => [h.id as string, h.name as string])
    );

    const activity: ActivityItem[] = [];
    for (const t of (recentTasksQ.data || [])) {
      if (!t.done_at) continue;
      activity.push({
        id: `task-${t.id}`, kind: 'task',
        label: `Completed task: ${truncate(t.text || '')}`,
        ts: t.done_at as string,
      });
    }
    for (const c of (recentHabitsQ.data || [])) {
      const name = habitNameById.get(c.habit_id as string);
      activity.push({
        id: `habit-${c.id}`, kind: 'habit',
        label: name ? `Checked in: ${name}` : 'Habit completed',
        ts: `${c.date}T12:00:00Z`,   // checkins only store date; midday for sort
      });
    }
    for (const s of (recentSessionsQ.data || [])) {
      activity.push({
        id: `read-${s.id}`, kind: 'reading',
        label: s.pages_read ? `Read ${s.pages_read} page${s.pages_read === 1 ? '' : 's'}` : 'Reading session',
        ts: s.started_at as string,
      });
    }
    for (const i of (recentIdeasQ.data || [])) {
      activity.push({
        id: `idea-${i.id}`, kind: 'idea',
        label: `Captured an idea${i.body ? `: ${truncate(i.body)}` : ''}`,
        ts: i.created_at as string,
      });
    }
    for (const b of (recentBooksQ.data || [])) {
      if (!b.finished_at) continue;
      activity.push({
        id: `book-${b.id}`, kind: 'book',
        label: `Finished ${b.title}`,
        ts: b.finished_at as string,
      });
    }
    activity.sort((a, b) => b.ts.localeCompare(a.ts));
    const recentActivity = activity.slice(0, 6);

    const totalPagesRead = sessionsYear.reduce((s, r) => s + (r.pages_read || 0), 0);

    setData({
      profile,
      todayHabitsDone: habitsDone,
      todayHabitsTotal: habitsTotal,
      todayTasksDone: tasksDone,
      todayTasksOpen: tasksOpen,
      readingStreak: streakFromDates(readingDays),
      focusStreak:   streakFromDates(focusDays),
      writingStreak: streakFromDates(writingDays),
      currentBook: book,
      activeDays,
      activityIntensity,
      totalActiveDaysThisYear: activeDays.size,
      totalTasksDone:    tasksDone,                    // lifetime via tasksQ above
      totalIdeasCaptured: ideasYear.length,            // last 30 days; we don't pull all-time
      totalBooksFinished: booksFinishedQ.count || 0,
      totalHabitsDone:   habitsYear.length,            // last 30 days
      totalPagesRead,                                  // last 30 days
      thisDay,
      thisWeek,
      thisMonth,
      elapsedDaysInWeek,
      elapsedDaysInMonth,
      effectiveElapsedDaysInWeek,
      effectiveElapsedDaysInMonth,
      plannedHabitsToday,
      plannedHabitsThisWeek,
      plannedHabitsThisMonth,
      incompleteHabitsToday,
      openTasksByPriority,
      recentActivity,
    });
    setLoading(false);
  }, [session]);

  useEffect(() => { setLoading(true); load(); }, [load]);

  return { data, loading, refresh: load };
}

// On first sign-in (especially Google), copy name + avatar from auth.user.user_metadata
// into the profiles row IF those fields are still null (don't overwrite user edits).
export async function syncProfileFromAuth(userId: string, meta: Record<string, any>) {
  const display_name = meta.full_name || meta.name || null;
  const avatar_url = meta.avatar_url || meta.picture || null;
  if (!display_name && !avatar_url) return;
  const { data: existing } = await supabase.from('profiles').select('display_name, avatar_url').eq('id', userId).maybeSingle();
  const patch: Record<string, any> = {};
  if (display_name && !existing?.display_name) patch.display_name = display_name;
  if (avatar_url && !existing?.avatar_url) patch.avatar_url = avatar_url;
  if (Object.keys(patch).length === 0) return;
  await supabase.from('profiles').update(patch).eq('id', userId);
}

// Upload a local file URI to a Supabase storage bucket under <userId>/<filename>.
// Returns the public URL. RN-safe (uses base64 → ArrayBuffer).
export async function uploadImage(uri: string, bucket: 'avatars' | 'covers', userId: string): Promise<string> {
  const ext = (uri.split('.').pop() || 'jpg').toLowerCase().replace(/\?.*/, '');
  const filename = `${Date.now()}.${ext === 'heic' ? 'jpg' : ext}`;
  const path = `${userId}/${filename}`;
  const contentType = ext === 'png' ? 'image/png' : 'image/jpeg';
  const base64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' as any });
  const { error } = await supabase.storage.from(bucket).upload(path, decodeBase64(base64), {
    contentType, upsert: true,
  });
  if (error) throw error;
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

export async function updateProfile(userId: string, patch: Partial<Profile>) {
  const { error } = await supabase.from('profiles').update(patch).eq('id', userId);
  if (error) throw error;
}
