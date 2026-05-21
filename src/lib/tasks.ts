import { useCallback, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import { useAuth } from './auth';

export type Pri = 'urgent' | 'important' | 'later';

export type Task = {
  id: string;
  user_id: string;
  text: string;
  pri: Pri;
  project: string | null;
  done: boolean;
  done_at: string | null;
  due_date: string | null;
  due_kind: string | null;
  scheduled_for: string | null;
  position: number | null;
  created_at: string;
  updated_at: string;
};

export const PRIS: Pri[] = ['urgent', 'important', 'later'];
export const INBOX_LABEL = 'Inbox';

// Project names compare case-insensitively with trimmed whitespace. We keep
// the *first* casing the user typed as the canonical display value.
export function normalizeProjectKey(name: string | null | undefined): string {
  return (name ?? '').trim().toLowerCase();
}
export function cleanProjectInput(name: string): string {
  return name.trim();
}

const STORE_LAST_PRI       = 'tasks:lastPri';
const STORE_LAST_PROJECT   = 'tasks:lastProject';
const STORE_RECENT_PROJECTS = 'tasks:recentProjects';
const RECENT_PROJECT_LIMIT = 5;

export async function loadDefaults(): Promise<{ pri: Pri; project: string | null }> {
  try {
    const [p, pr] = await Promise.all([
      AsyncStorage.getItem(STORE_LAST_PRI),
      AsyncStorage.getItem(STORE_LAST_PROJECT),
    ]);
    const pri: Pri = (p === 'urgent' || p === 'important' || p === 'later') ? p : 'important';
    return { pri, project: pr || null };
  } catch {
    return { pri: 'important', project: null };
  }
}
export async function saveDefaults(pri: Pri, project: string | null) {
  try {
    await AsyncStorage.setItem(STORE_LAST_PRI, pri);
    if (project) await AsyncStorage.setItem(STORE_LAST_PROJECT, project);
    else await AsyncStorage.removeItem(STORE_LAST_PROJECT);
  } catch {}
}

// Recent projects: a sticky in-app list so freshly-created or selected
// projects keep showing in the quick selector even after the user deselects
// them, or after every task that uses them gets archived/deleted.
export async function loadRecentProjects(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(STORE_RECENT_PROJECTS);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.filter((x: any) => typeof x === 'string') : [];
  } catch { return []; }
}
export async function saveRecentProjects(list: string[]): Promise<void> {
  try { await AsyncStorage.setItem(STORE_RECENT_PROJECTS, JSON.stringify(list)); } catch {}
}
export function touchRecentProject(list: string[], name: string): string[] {
  const cleaned = cleanProjectInput(name);
  if (!cleaned) return list;
  const key = normalizeProjectKey(cleaned);
  const without = list.filter(p => normalizeProjectKey(p) !== key);
  return [cleaned, ...without].slice(0, RECENT_PROJECT_LIMIT);
}

// Merge sticky recents with task-derived projects, dedupe by normalized key,
// cap at RECENT_PROJECT_LIMIT — used by the composer's quick selector.
export function mergeProjects(recent: string[], tasks: Task[]): string[] {
  const fromTasks = quickProjects(tasks);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of [...recent, ...fromTasks]) {
    const key = normalizeProjectKey(p);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(p);
    if (out.length >= RECENT_PROJECT_LIMIT) break;
  }
  return out;
}

// Dedupe-on-create: if a project with the same normalized key already exists
// (in tasks or recents), return its canonical label so we don't fork casings.
export function canonicalProjectLabel(typed: string, recent: string[], tasks: Task[]): string {
  const key = normalizeProjectKey(typed);
  if (!key) return cleanProjectInput(typed);
  const all = [...recent, ...quickProjects(tasks), ...tasks.map(t => t.project).filter(Boolean) as string[]];
  for (const p of all) if (normalizeProjectKey(p) === key) return p;
  return cleanProjectInput(typed);
}

// ─── Hook ──────────────────────────────────────────────────
export function useTasks() {
  const { session } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!session) return;
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('user_id', session.user.id)
      .order('done', { ascending: true })
      .order('position', { ascending: true, nullsFirst: false })
      .order('updated_at', { ascending: false });
    if (!error && data) setTasks(data as Task[]);
    setLoading(false);
  }, [session]);

  useEffect(() => { setLoading(true); load(); }, [load]);

  return { tasks, loading, setTasks, refresh: load };
}

// ─── Project quick-list (sorted by usage + recency, stale-aware) ─────────
const STALE_DAYS = 4;

export function quickProjects(tasks: Task[]): string[] {
  const cutoff = Date.now() - STALE_DAYS * 24 * 60 * 60 * 1000;
  const byKey = new Map<string, { label: string; count: number; recent: number }>();
  for (const t of tasks) {
    if (!t.project) continue;
    const key = normalizeProjectKey(t.project);
    if (!key) continue;
    const ts = new Date(t.updated_at || t.created_at).getTime();
    const cur = byKey.get(key);
    if (cur) {
      cur.count += 1;
      if (ts > cur.recent) { cur.recent = ts; cur.label = t.project; }
    } else {
      byKey.set(key, { label: t.project, count: 1, recent: ts });
    }
  }
  return Array.from(byKey.values())
    .filter(p => p.recent >= cutoff)
    .sort((a, b) => b.recent - a.recent || b.count - a.count)
    .map(p => p.label);
}

// ─── Mutations ─────────────────────────────────────────────

export async function createTask(userId: string, input: {
  text: string;
  pri: Pri;
  project: string | null;
}): Promise<Task> {
  const payload: any = {
    user_id: userId,
    text: input.text,
    title: input.text, // mirror for web compat
    pri: input.pri,
    project: input.project ? cleanProjectInput(input.project) : null,
    done: false,
  };
  const { data, error } = await supabase.from('tasks').insert(payload).select().single();
  if (error) throw error;
  return data as Task;
}

export async function updateTask(id: string, patch: Partial<Task>): Promise<void> {
  const payload: any = { ...patch };
  if (typeof patch.text === 'string') payload.title = patch.text; // mirror to web column
  if (patch.project !== undefined) {
    payload.project = patch.project ? cleanProjectInput(patch.project) : null;
  }
  const { error } = await supabase.from('tasks').update(payload).eq('id', id);
  if (error) throw error;
}

export async function deleteTask(id: string): Promise<void> {
  const { error } = await supabase.from('tasks').delete().eq('id', id);
  if (error) throw error;
}

// Re-insert a previously-deleted task. Preserves the original id + metadata
// so the row "comes back where it was". Used by the global undo toast.
export async function restoreTask(t: Task): Promise<void> {
  const { error } = await supabase.from('tasks').insert({
    id: t.id,
    user_id: t.user_id,
    text: t.text,
    title: t.text,             // web-compat mirror column
    pri: t.pri,
    project: t.project,
    done: t.done,
    done_at: t.done_at,
    due_date: t.due_date,
    due_kind: t.due_kind,
    scheduled_for: t.scheduled_for,
    position: t.position,
    created_at: t.created_at,
  });
  if (error) throw error;
}

export async function toggleDone(id: string, done: boolean): Promise<void> {
  const { error } = await supabase.from('tasks').update({
    done,
    done_at: done ? new Date().toISOString() : null,
  }).eq('id', id);
  if (error) throw error;
}

// Compute a new fractional position that sits between two neighbors so we
// don't have to rewrite the whole list on every reorder.
export function midpointPosition(prev: number | null, next: number | null): number {
  if (prev == null && next == null) return Date.now();
  if (prev == null) return (next as number) - 1;
  if (next == null) return prev + 1;
  return (prev + next) / 2;
}

// ─── Grouping helpers ──────────────────────────────────────

export type TaskGroup = { project: string | null; label: string; tasks: Task[] };

export function groupByProject(list: Task[]): TaskGroup[] {
  const byKey = new Map<string, TaskGroup>();
  for (const t of list) {
    const key = normalizeProjectKey(t.project);
    if (!byKey.has(key)) {
      byKey.set(key, {
        project: t.project,
        label: t.project ? t.project : INBOX_LABEL,
        tasks: [],
      });
    }
    byKey.get(key)!.tasks.push(t);
  }
  // Real projects first by most recent activity; Inbox last so the user’s
  // labeled work doesn’t get buried under loose captures.
  const groups = Array.from(byKey.values());
  groups.sort((a, b) => {
    if (!a.project && b.project) return 1;
    if (a.project && !b.project) return -1;
    const aRecent = Math.max(...a.tasks.map(t => new Date(t.updated_at).getTime()));
    const bRecent = Math.max(...b.tasks.map(t => new Date(t.updated_at).getTime()));
    return bRecent - aRecent;
  });
  return groups;
}
