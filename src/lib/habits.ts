import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase';
import { useAuth } from './auth';

export type HabitColor = 'gold' | 'forest' | 'midnight' | 'amber' | 'clay';

export type HabitArea = {
  id: string;
  user_id: string;
  name: string;
  icon: string | null;
  color: HabitColor;
  sort_order: number;
};

export type Habit = {
  id: string;
  user_id: string;
  area_id: string | null;
  name: string;
  category: string | null;
  time_of_day: string | null;
  archived: boolean;
  frequency: 'daily' | 'custom';
  days_of_week: number[];          // 0=Sun..6=Sat
  icon: string | null;
  color: HabitColor;
  sort_order: number;
  created_at: string;
};

export type Checkin = { habit_id: string; date: string; done: boolean };

export type HabitWithStatus = Habit & {
  todayScheduled: boolean;
  todayDone: boolean;
  streak: number;
  weekDone: boolean[];             // M T W T F S S — done flags for current week
};

export type AreaWithHabits = HabitArea & { habits: HabitWithStatus[] };

import { localDateStr, localTodayStr, localMinusDays } from './dates';

// All date keys use LOCAL device timezone so the user's "today" matches
// their wall clock (toISOString is UTC and reports tomorrow late evening in
// negative-offset zones like Guatemala).
const todayStr = () => localTodayStr();
const dowOfStr = (s: string) => new Date(s + 'T00:00:00').getDay();
const minusDays = (n: number) => localMinusDays(n);

function computeStreak(habit: Habit, doneSet: Set<string>): number {
  let count = 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  // Walk back day by day, only counting scheduled days. Grace period for today.
  let cursor = new Date(today);
  // If today is scheduled and not done, allow yesterday as the start
  const yyyymmdd = (d: Date) => localDateStr(d);
  if (habit.days_of_week.includes(cursor.getDay()) && !doneSet.has(yyyymmdd(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
  }
  // Walk back up to 365 days max
  for (let i = 0; i < 365; i++) {
    const dow = cursor.getDay();
    const key = yyyymmdd(cursor);
    if (habit.days_of_week.includes(dow)) {
      if (doneSet.has(key)) count++;
      else break;
    }
    cursor.setDate(cursor.getDate() - 1);
  }
  return count;
}

function weekDone(doneSet: Set<string>): boolean[] {
  // Returns 7 flags for the current week, Mon..Sun (visual order M T W T F S S).
  // We map: index 0 = Monday, ..., index 6 = Sunday.
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const day = today.getDay();                  // 0=Sun..6=Sat
  const mondayOffset = day === 0 ? -6 : 1 - day; // shift to Monday of current week
  const monday = new Date(today);
  monday.setDate(today.getDate() + mondayOffset);
  const out: boolean[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    out.push(doneSet.has(localDateStr(d)));
  }
  return out;
}

export function useHabits() {
  const { session } = useAuth();
  const [areas, setAreas] = useState<AreaWithHabits[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!session) return;
    const uid = session.user.id;
    const since = minusDays(60);

    const [areasQ, habitsQ, checkinsQ] = await Promise.all([
      supabase.from('habit_areas').select('*').eq('user_id', uid).order('sort_order'),
      supabase.from('habits').select('*').eq('user_id', uid).eq('archived', false).order('sort_order'),
      supabase.from('habit_checkins').select('habit_id, date, done').eq('user_id', uid).gte('date', since),
    ]);

    const areasRaw = (areasQ.data || []) as HabitArea[];
    const habitsRaw = (habitsQ.data || []) as Habit[];
    const checkins = (checkinsQ.data || []) as Checkin[];

    // Build map: habit_id -> Set of done dates
    const doneByHabit = new Map<string, Set<string>>();
    for (const c of checkins) {
      if (!c.done) continue;
      if (!doneByHabit.has(c.habit_id)) doneByHabit.set(c.habit_id, new Set());
      doneByHabit.get(c.habit_id)!.add(c.date);
    }

    const t = todayStr();
    const todayDow = new Date().getDay();

    const enriched: HabitWithStatus[] = habitsRaw.map(h => {
      const done = doneByHabit.get(h.id) || new Set<string>();
      return {
        ...h,
        todayScheduled: h.days_of_week.includes(todayDow),
        todayDone: done.has(t),
        streak: computeStreak(h, done),
        weekDone: weekDone(done),
      };
    });

    // Group by area; unattached habits go in a synthetic "Unsorted" bucket
    const byArea = new Map<string | null, HabitWithStatus[]>();
    for (const h of enriched) {
      const k = h.area_id;
      if (!byArea.has(k)) byArea.set(k, []);
      byArea.get(k)!.push(h);
    }

    const result: AreaWithHabits[] = areasRaw.map(a => ({ ...a, habits: byArea.get(a.id) || [] }));
    const orphan = byArea.get(null) || [];
    if (orphan.length > 0) {
      result.push({
        id: '__orphan__', user_id: uid, name: 'Unsorted',
        icon: 'inbox', color: 'gold', sort_order: 9999,
        habits: orphan,
      });
    }

    setAreas(result);
    setLoading(false);
  }, [session]);

  useEffect(() => { setLoading(true); load(); }, [load]);

  return { areas, loading, refresh: load };
}

// ─── Mutations ──────────────────────────────────────────────

export async function toggleCheckin(habitId: string, userId: string, done: boolean, date = todayStr()) {
  if (done) {
    // upsert
    const { error } = await supabase.from('habit_checkins').upsert(
      { habit_id: habitId, user_id: userId, date, done: true },
      { onConflict: 'habit_id,date' }
    );
    if (error) throw error;
  } else {
    // delete the row (cleaner than setting done=false)
    const { error } = await supabase.from('habit_checkins').delete().eq('habit_id', habitId).eq('date', date);
    if (error) throw error;
  }
}

export async function createArea(userId: string, patch: Partial<HabitArea> & { name: string }) {
  const { data, error } = await supabase.from('habit_areas')
    .insert({ user_id: userId, name: patch.name, icon: patch.icon || null, color: patch.color || 'gold' })
    .select().single();
  if (error) throw error;
  return data as HabitArea;
}

export async function updateArea(id: string, patch: Partial<HabitArea>) {
  const { error } = await supabase.from('habit_areas').update(patch).eq('id', id);
  if (error) throw error;
}

export async function deleteArea(id: string) {
  const { error } = await supabase.from('habit_areas').delete().eq('id', id);
  if (error) throw error;
}

export async function createHabit(userId: string, patch: Partial<Habit> & { name: string }) {
  const { data, error } = await supabase.from('habits').insert({
    user_id: userId,
    name: patch.name,
    area_id: patch.area_id || null,
    frequency: patch.frequency || 'daily',
    days_of_week: patch.days_of_week || [0, 1, 2, 3, 4, 5, 6],
    icon: patch.icon || null,
    color: patch.color || 'gold',
  }).select().single();
  if (error) throw error;
  return data as Habit;
}

export async function updateHabit(id: string, patch: Partial<Habit>) {
  const { error } = await supabase.from('habits').update(patch).eq('id', id);
  if (error) throw error;
}

export async function deleteHabit(id: string) {
  const { error } = await supabase.from('habits').update({ archived: true }).eq('id', id);
  if (error) throw error;
}

// ─── Presets ────────────────────────────────────────────────
// Suggested starter areas (with icon + color)
export const AREA_PRESETS: { name: string; icon: string; color: HabitColor }[] = [
  { name: 'Health',          icon: 'heart-pulse',   color: 'forest' },
  { name: 'Mind',            icon: 'brain',         color: 'midnight' },
  { name: 'Personal Growth', icon: 'sparkles',      color: 'gold' },
  { name: 'Business',        icon: 'briefcase',     color: 'midnight' },
  { name: 'Finance',         icon: 'wallet',        color: 'amber' },
  { name: 'Creative',        icon: 'palette',       color: 'amber' },
  { name: 'Relationships',   icon: 'users',         color: 'clay' },
  { name: 'Spiritual',       icon: 'flame',         color: 'gold' },
];

// Expanded preset library — researched, popular, achievable.
// days[] absent = every day. days[] present = custom days (0=Sun..6=Sat).
export const HABIT_PRESETS: { name: string; areaHint: string; days?: number[] }[] = [
  // ─── HEALTH (physical) ──────────────────────────────────────────
  { name: 'Drink 2L water',           areaHint: 'Health' },
  { name: 'Walk 30 min',              areaHint: 'Health' },
  { name: '10k steps',                areaHint: 'Health' },
  { name: 'Gym 4x a week',            areaHint: 'Health', days: [1, 2, 4, 5] },
  { name: 'Strength training',        areaHint: 'Health', days: [1, 3, 5] },
  { name: 'Cardio 3x a week',         areaHint: 'Health', days: [2, 4, 6] },
  { name: 'Stretch 10 min',           areaHint: 'Health' },
  { name: 'Yoga',                     areaHint: 'Health', days: [1, 3, 5] },
  { name: 'Sleep before 12',          areaHint: 'Health', days: [0, 1, 2, 3, 4] },
  { name: 'Sleep 7+ hours',           areaHint: 'Health' },
  { name: 'Cold shower',              areaHint: 'Health' },
  { name: 'Take vitamins',            areaHint: 'Health' },
  { name: 'Real breakfast',           areaHint: 'Health' },
  { name: 'Protein with every meal',  areaHint: 'Health' },
  { name: 'No alcohol weekdays',      areaHint: 'Health', days: [1, 2, 3, 4] },
  { name: 'No screens 30 min before bed', areaHint: 'Health' },
  { name: 'Stand up every hour',      areaHint: 'Health', days: [1, 2, 3, 4, 5] },
  { name: 'Skincare routine',         areaHint: 'Health' },

  // ─── MIND ───────────────────────────────────────────────────────
  { name: 'Meditate 10 min',          areaHint: 'Mind' },
  { name: 'Breathwork 5 min',         areaHint: 'Mind' },
  { name: 'Morning pages',            areaHint: 'Mind', days: [1, 2, 3, 4, 5] },
  { name: 'Journal at night',         areaHint: 'Mind' },
  { name: 'Read 20 min',              areaHint: 'Mind' },
  { name: 'No phone before 11am',     areaHint: 'Mind', days: [1, 2, 3, 4, 5] },
  { name: 'No social media before noon', areaHint: 'Mind', days: [1, 2, 3, 4, 5] },
  { name: 'Gratitude — 3 things',     areaHint: 'Mind' },
  { name: 'Digital detox 1 hour',     areaHint: 'Mind' },
  { name: 'Reflect on the day',       areaHint: 'Mind' },
  { name: 'Therapy session',          areaHint: 'Mind', days: [3] },

  // ─── PERSONAL GROWTH ────────────────────────────────────────────
  { name: 'Read non-fiction 20 min',  areaHint: 'Personal Growth' },
  { name: 'Learn 30 min',             areaHint: 'Personal Growth' },
  { name: 'Online course progress',   areaHint: 'Personal Growth', days: [1, 2, 3, 4, 5] },
  { name: 'Listen to a podcast',      areaHint: 'Personal Growth', days: [1, 2, 3, 4, 5] },
  { name: 'Practice a skill',         areaHint: 'Personal Growth' },
  { name: 'Take notes on what I learn', areaHint: 'Personal Growth' },
  { name: 'Read 1 article a day',     areaHint: 'Personal Growth' },
  { name: 'Watch a documentary',      areaHint: 'Personal Growth', days: [0] },

  // ─── BUSINESS / WORK ────────────────────────────────────────────
  { name: 'Deep work block (90m)',    areaHint: 'Business', days: [1, 2, 3, 4, 5] },
  { name: 'One hard thing first',     areaHint: 'Business', days: [1, 2, 3, 4, 5] },
  { name: 'Inbox zero by 5pm',        areaHint: 'Business', days: [1, 2, 3, 4, 5] },
  { name: 'Reach out to 3 people',    areaHint: 'Business', days: [1, 2, 3, 4, 5] },
  { name: 'Plan tomorrow',            areaHint: 'Business', days: [1, 2, 3, 4, 5] },
  { name: 'Review weekly goals',      areaHint: 'Business', days: [0] },
  { name: 'Time-block calendar',      areaHint: 'Business', days: [1, 2, 3, 4, 5] },
  { name: 'No meetings before 10am',  areaHint: 'Business', days: [1, 2, 3, 4, 5] },
  { name: 'Track my time',            areaHint: 'Business', days: [1, 2, 3, 4, 5] },
  { name: 'Post on socials',          areaHint: 'Business', days: [1, 3, 5] },
  { name: 'Update CRM',               areaHint: 'Business', days: [1, 2, 3, 4, 5] },
  { name: 'Customer outreach',        areaHint: 'Business', days: [1, 2, 3, 4, 5] },
  { name: 'Ship one thing',           areaHint: 'Business', days: [1, 2, 3, 4, 5] },

  // ─── FINANCE ────────────────────────────────────────────────────
  { name: 'Track expenses',           areaHint: 'Finance' },
  { name: 'No impulse purchases',     areaHint: 'Finance' },
  { name: 'Save before spending',     areaHint: 'Finance' },
  { name: 'Review bank statements',   areaHint: 'Finance', days: [0] },
  { name: 'Invest weekly',            areaHint: 'Finance', days: [0] },
  { name: 'Review portfolio',         areaHint: 'Finance', days: [0] },
  { name: 'Learn about money 15 min', areaHint: 'Finance' },
  { name: 'Read 1 finance article',   areaHint: 'Finance', days: [1, 2, 3, 4, 5] },
  { name: 'Budget the week',          areaHint: 'Finance', days: [0] },
  { name: 'No spending day',          areaHint: 'Finance', days: [1, 3] },

  // ─── CREATIVE ───────────────────────────────────────────────────
  { name: 'Write 500 words',          areaHint: 'Creative' },
  { name: 'Sketch 10 min',            areaHint: 'Creative' },
  { name: 'Create something daily',   areaHint: 'Creative' },
  { name: 'Practice instrument',      areaHint: 'Creative' },
  { name: 'Take a photo a day',       areaHint: 'Creative' },
  { name: 'Voice memo ideas',         areaHint: 'Creative' },
  { name: 'Watch a film for inspiration', areaHint: 'Creative', days: [0] },
  { name: 'Edit photos',              areaHint: 'Creative', days: [6] },

  // ─── RELATIONSHIPS ──────────────────────────────────────────────
  { name: 'Call a friend',            areaHint: 'Relationships', days: [0, 6] },
  { name: 'Date night',               areaHint: 'Relationships', days: [5] },
  { name: 'Check in with family',     areaHint: 'Relationships', days: [0] },
  { name: 'Family dinner',            areaHint: 'Relationships', days: [0] },
  { name: 'Send a thoughtful message', areaHint: 'Relationships' },
  { name: 'Compliment someone',       areaHint: 'Relationships' },
  { name: 'Quality time with partner', areaHint: 'Relationships' },
  { name: 'No phone at meals',        areaHint: 'Relationships' },
  { name: 'Plan something together',  areaHint: 'Relationships', days: [0] },
  { name: 'Vulnerable conversation',  areaHint: 'Relationships', days: [0] },

  // ─── SPIRITUAL ──────────────────────────────────────────────────
  { name: 'Gratitude — 3 things',     areaHint: 'Spiritual' },
  { name: 'Pray / reflect',           areaHint: 'Spiritual' },
  { name: 'Read scripture / philosophy', areaHint: 'Spiritual' },
  { name: 'Nature walk',              areaHint: 'Spiritual' },
  { name: 'Silent time 10 min',       areaHint: 'Spiritual' },
  { name: 'Sunday reflection',        areaHint: 'Spiritual', days: [0] },
];

// Curated cross-area "popular" set, shown when no area is selected.
export const POPULAR_PRESETS: string[] = [
  'Drink 2L water',
  'Meditate 10 min',
  'Read 20 min',
  'Gym 4x a week',
  'Sleep before 12',
  'Walk 30 min',
  'Morning pages',
  'Deep work block (90m)',
  'No phone before 11am',
  'Gratitude — 3 things',
  'Track expenses',
  'Call a friend',
];

export function colorToHex(c: HabitColor): { primary: string; faint: string; border: string } {
  switch (c) {
    case 'gold':     return { primary: '#C9A961', faint: 'rgba(201,169,97,0.14)', border: 'rgba(201,169,97,0.45)' };
    case 'forest':   return { primary: '#6B8F70', faint: 'rgba(74,107,82,0.18)', border: 'rgba(107,143,112,0.5)' };
    case 'midnight': return { primary: '#4F6A8E', faint: 'rgba(44,62,92,0.22)', border: 'rgba(79,106,142,0.55)' };
    case 'amber':    return { primary: '#E8B547', faint: 'rgba(232,181,71,0.14)', border: 'rgba(232,181,71,0.45)' };
    case 'clay':     return { primary: '#B8643C', faint: 'rgba(184,100,60,0.18)', border: 'rgba(184,100,60,0.55)' };
  }
}
