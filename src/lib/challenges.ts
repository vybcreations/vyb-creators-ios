import { useCallback, useEffect, useState } from 'react';
import * as FileSystem from 'expo-file-system/legacy';
import { decode as decodeBase64 } from 'base64-arraybuffer';
import { supabase } from './supabase';
import { useAuth } from './auth';
import { localTodayStr } from './dates';
import { uploadProofMedia } from './proofMedia';

export type ChallengeType = 'workout_photo' | 'meal_photo' | 'reading_checkin' | 'custom_photo';
export type ProofType = 'photo' | 'checkin' | 'note';
export type Frequency = 'daily' | 'weekly' | 'anytime';

export type Challenge = {
  id: string;
  circle_id: string;
  created_by: string;
  title: string;
  description: string | null;
  challenge_type: ChallengeType;
  start_date: string;
  end_date: string;
  frequency: Frequency;
  proof_required: boolean;
  proof_type: ProofType;
  max_checkins_per_day: number;
  rule: string | null;
  status: 'active' | 'ended' | 'archived';
  created_at: string;
  updated_at: string;
};

export type ChallengeListItem = Challenge & {
  total_checkins: number;
  member_count: number;        // active members joined
  i_am_joined: boolean;
  i_checked_in_today: boolean;
};

export type CircleActivityItem = {
  id: string;
  ts: string;                  // ISO timestamp
  text: string;
  kind: 'challenge_created' | 'checkin';
};

export type SimpleProfile = {
  id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
};

export type LeaderboardEntry = {
  user_id: string;
  count: number;
  checked_in_today: boolean;
  profile: SimpleProfile;
};

export type CheckinRow = {
  id: string;
  challenge_id: string;
  circle_id: string;
  user_id: string;
  proof_url: string | null;          // optimized full image storage path
  proof_thumb_url: string | null;    // small thumbnail storage path (for feeds)
  note: string | null;
  checkin_date: string;
  created_at: string;
  profile: SimpleProfile;
};

// ─── List challenges in a circle ──────────────────────────────────────────
export function useCircleChallenges(circleId: string | undefined) {
  const { session } = useAuth();
  const [challenges, setChallenges] = useState<ChallengeListItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!circleId || !session) return;
    const uid = session.user.id;
    const { data: chs } = await supabase
      .from('challenges')
      .select('*')
      .eq('circle_id', circleId)
      .eq('status', 'active')
      .order('created_at', { ascending: false });

    const rows = (chs || []) as Challenge[];
    if (rows.length === 0) { setChallenges([]); setLoading(false); return; }

    const ids = rows.map(r => r.id);
    const today = todayISO();
    const [memberQ, checkinQ, myCheckinQ] = await Promise.all([
      supabase.from('challenge_members').select('challenge_id, user_id, status').in('challenge_id', ids).eq('status', 'active'),
      supabase.from('challenge_checkins').select('challenge_id').in('challenge_id', ids),
      supabase.from('challenge_checkins').select('challenge_id').in('challenge_id', ids).eq('user_id', uid).eq('checkin_date', today),
    ]);

    const memberCounts = new Map<string, number>();
    const joinedByMe = new Set<string>();
    for (const m of memberQ.data || []) {
      memberCounts.set(m.challenge_id as string, (memberCounts.get(m.challenge_id as string) || 0) + 1);
      if (m.user_id === uid) joinedByMe.add(m.challenge_id as string);
    }
    const checkinCounts = new Map<string, number>();
    for (const c of checkinQ.data || []) {
      checkinCounts.set(c.challenge_id as string, (checkinCounts.get(c.challenge_id as string) || 0) + 1);
    }
    const myCheckinToday = new Set<string>((myCheckinQ.data || []).map(r => r.challenge_id as string));

    setChallenges(rows.map(r => ({
      ...r,
      member_count: memberCounts.get(r.id) || 0,
      total_checkins: checkinCounts.get(r.id) || 0,
      i_am_joined: joinedByMe.has(r.id),
      i_checked_in_today: myCheckinToday.has(r.id),
    })));
    setLoading(false);
  }, [circleId, session]);

  useEffect(() => { setLoading(true); load(); }, [load]);
  return { challenges, loading, refresh: load };
}

export type ActiveChallengeCard = Challenge & {
  circle_name: string;
  my_checkin_count: number;
  i_checked_in_today: boolean;
};

export type JoinableChallengeCard = Challenge & {
  circle_name: string;
  joined_count: number;
};

// ─── My active joined challenges (across all my circles) ─────────────────
// Use this as the home of the Challenges tab — drives the quick check-in
// flow. Includes today's status so the card can show Upload proof vs
// Checked in today without opening Challenge Detail.
export function useMyActiveChallenges() {
  const { session } = useAuth();
  const [items, setItems] = useState<ActiveChallengeCard[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!session) return;
    const uid = session.user.id;
    const today = todayISO();

    // Joined active memberships → challenge ids.
    const { data: mems } = await supabase
      .from('challenge_members')
      .select('challenge_id')
      .eq('user_id', uid).eq('status', 'active');
    const ids = (mems || []).map(m => m.challenge_id as string);
    if (ids.length === 0) { setItems([]); setLoading(false); return; }

    const [chQ, myCheckinQ] = await Promise.all([
      supabase
        .from('challenges')
        .select(`*, circle:circles(name)`)
        .in('id', ids)
        .eq('status', 'active')
        .gte('end_date', today)
        .order('end_date', { ascending: true }),
      supabase
        .from('challenge_checkins')
        .select('challenge_id, checkin_date')
        .in('challenge_id', ids)
        .eq('user_id', uid),
    ]);

    const myCount = new Map<string, number>();
    const myToday = new Set<string>();
    for (const r of (myCheckinQ.data || []) as any[]) {
      myCount.set(r.challenge_id, (myCount.get(r.challenge_id) || 0) + 1);
      if (r.checkin_date === today) myToday.add(r.challenge_id);
    }

    const rows: ActiveChallengeCard[] = ((chQ.data || []) as any[]).map(c => ({
      ...c,
      circle_name: c.circle?.name || '',
      my_checkin_count: myCount.get(c.id) || 0,
      i_checked_in_today: myToday.has(c.id),
    }));
    setItems(rows);
    setLoading(false);
  }, [session]);

  useEffect(() => { setLoading(true); load(); }, [load]);
  return { items, loading, refresh: load };
}

// ─── Joinable challenges in my circles (not yet joined) ──────────────────
export function useJoinableChallenges() {
  const { session } = useAuth();
  const [items, setItems] = useState<JoinableChallengeCard[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!session) return;
    const uid = session.user.id;
    const today = todayISO();

    // My active circles.
    const { data: circleRows } = await supabase
      .from('circle_members').select('circle_id')
      .eq('user_id', uid).eq('status', 'active');
    const circleIds = (circleRows || []).map(r => r.circle_id as string);
    if (circleIds.length === 0) { setItems([]); setLoading(false); return; }

    // Active challenges in those circles.
    const { data: chRows } = await supabase
      .from('challenges')
      .select(`*, circle:circles(name)`)
      .in('circle_id', circleIds)
      .eq('status', 'active')
      .gte('end_date', today);

    const challenges = (chRows || []) as any[];
    if (challenges.length === 0) { setItems([]); setLoading(false); return; }

    // Filter out ones I'm already an active member of.
    const ids = challenges.map(c => c.id);
    const { data: myMembers } = await supabase
      .from('challenge_members')
      .select('challenge_id').eq('user_id', uid).eq('status', 'active').in('challenge_id', ids);
    const joinedSet = new Set((myMembers || []).map(m => m.challenge_id as string));

    // Members count per challenge.
    const { data: allMembers } = await supabase
      .from('challenge_members')
      .select('challenge_id').in('challenge_id', ids).eq('status', 'active');
    const counts = new Map<string, number>();
    for (const m of allMembers || []) {
      counts.set(m.challenge_id as string, (counts.get(m.challenge_id as string) || 0) + 1);
    }

    const out: JoinableChallengeCard[] = challenges
      .filter(c => !joinedSet.has(c.id))
      .map(c => ({
        ...c,
        circle_name: c.circle?.name || '',
        joined_count: counts.get(c.id) || 0,
      }));
    setItems(out);
    setLoading(false);
  }, [session]);

  useEffect(() => { setLoading(true); load(); }, [load]);
  return { items, loading, refresh: load };
}

// ─── Circle-level activity feed (derived) ─────────────────────────────────
// Merges recent challenge creations + check-ins into a private text-only
// timeline. No proof photos are exposed here — those live in Challenge Detail.
export function useCircleActivity(circleId: string | undefined, limit = 8) {
  const [items, setItems] = useState<CircleActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!circleId) return;
    const [challengeQ, checkinQ] = await Promise.all([
      supabase
        .from('challenges')
        .select(`id, title, created_at, creator:profiles!challenges_created_by_fkey(display_name, username)`)
        .eq('circle_id', circleId)
        .order('created_at', { ascending: false })
        .limit(limit),
      supabase
        .from('challenge_checkins')
        .select(`id, created_at, proof_url,
                 user:profiles(display_name, username),
                 challenge:challenges(title)`)
        .eq('circle_id', circleId)
        .order('created_at', { ascending: false })
        .limit(limit),
    ]);

    const events: CircleActivityItem[] = [];
    for (const c of (challengeQ.data || []) as any[]) {
      const name = c.creator?.display_name || c.creator?.username || 'A member';
      events.push({
        id: `ch-${c.id}`, ts: c.created_at, kind: 'challenge_created',
        text: `${name} created ${c.title}.`,
      });
    }
    for (const r of (checkinQ.data || []) as any[]) {
      const name = r.user?.display_name || r.user?.username || 'A member';
      const verb = r.proof_url ? 'uploaded proof' : 'checked in';
      const title = r.challenge?.title ? ` in ${r.challenge.title}` : '';
      events.push({
        id: `ck-${r.id}`, ts: r.created_at, kind: 'checkin',
        text: `${name} ${verb}${title}.`,
      });
    }
    events.sort((a, b) => b.ts.localeCompare(a.ts));
    setItems(events.slice(0, limit));
    setLoading(false);
  }, [circleId, limit]);

  useEffect(() => { setLoading(true); load(); }, [load]);
  return { items, loading, refresh: load };
}

// ─── Single challenge detail + leaderboard + recent check-ins ─────────────
const PROFILE_FIELDS = 'id, display_name, username, avatar_url';

export function useChallengeDetail(challengeId: string | undefined) {
  const { session } = useAuth();
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [recentCheckins, setRecentCheckins] = useState<CheckinRow[]>([]);
  const [myCheckinToday, setMyCheckinToday] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!challengeId || !session) return;
    const uid = session.user.id;
    const today = localTodayStr(); // local day, not UTC

    const [chQ, membersQ, checkinsQ, recentQ] = await Promise.all([
      supabase.from('challenges').select('*').eq('id', challengeId).maybeSingle(),
      supabase.from('challenge_members')
        .select(`user_id, profile:profiles(${PROFILE_FIELDS})`)
        .eq('challenge_id', challengeId).eq('status', 'active'),
      supabase.from('challenge_checkins')
        .select('user_id, checkin_date')
        .eq('challenge_id', challengeId),
      supabase.from('challenge_checkins')
        .select(`id, challenge_id, circle_id, user_id, proof_url, proof_thumb_url, note, checkin_date, created_at,
                 profile:profiles(${PROFILE_FIELDS})`)
        .eq('challenge_id', challengeId)
        .order('created_at', { ascending: false })
        .limit(20),
    ]);

    setChallenge((chQ.data as Challenge) || null);

    // Build leaderboard.
    const counts = new Map<string, number>();
    const todayDone = new Set<string>();
    for (const row of (checkinsQ.data || []) as any[]) {
      counts.set(row.user_id, (counts.get(row.user_id) || 0) + 1);
      if (row.checkin_date === today) todayDone.add(row.user_id);
    }
    const lb: LeaderboardEntry[] = ((membersQ.data || []) as any[]).map(m => ({
      user_id: m.user_id,
      count: counts.get(m.user_id) || 0,
      checked_in_today: todayDone.has(m.user_id),
      profile: m.profile,
    }));
    lb.sort((a, b) => b.count - a.count);
    setLeaderboard(lb);
    setMyCheckinToday(todayDone.has(uid));
    setRecentCheckins(((recentQ.data || []) as any));
    setLoading(false);
  }, [challengeId, session]);

  useEffect(() => { setLoading(true); load(); }, [load]);
  return { challenge, leaderboard, recentCheckins, myCheckinToday, loading, refresh: load };
}

// ─── Actions ──────────────────────────────────────────────────────────────

export async function createChallenge(input: {
  circleId: string;
  title: string;
  description?: string;
  type: ChallengeType;
  startDate: string;   // YYYY-MM-DD
  endDate: string;     // YYYY-MM-DD
  frequency?: Frequency;
  proofType?: ProofType;
  maxPerDay?: number;
  rule?: string;
}): Promise<Challenge> {
  const { data, error } = await supabase.rpc('create_challenge', {
    p_circle_id:      input.circleId,
    p_title:          input.title,
    p_description:    input.description ?? null,
    p_challenge_type: input.type,
    p_start_date:     input.startDate,
    p_end_date:       input.endDate,
    p_frequency:      input.frequency ?? 'anytime',
    p_proof_type:     input.proofType ?? 'photo',
    p_max_per_day:    input.maxPerDay ?? 1,
    p_rule:           input.rule ?? null,
  });
  if (error) throw error;
  return data as Challenge;
}

export type SubmitCheckinResult =
  | { ok: true; checkin: CheckinRow }
  | { ok: false; reason: 'not_active' | 'duplicate' | 'unknown'; message: string };

export async function submitCheckin(args: {
  challengeId: string;
  proofUrl?: string | null;
  proofThumbUrl?: string | null;
  note?: string | null;
}): Promise<SubmitCheckinResult> {
  const { data, error } = await supabase.rpc('submit_checkin', {
    p_challenge_id: args.challengeId,
    p_proof_url:    args.proofUrl ?? null,
    p_note:         args.note ?? null,
    p_thumb_url:    args.proofThumbUrl ?? null,
  });
  if (error) {
    const msg = error.message || '';
    if (/already checked in/i.test(msg)) return { ok: false, reason: 'duplicate', message: 'You already checked in today.' };
    if (/not active/i.test(msg))         return { ok: false, reason: 'not_active', message: 'Challenge is not active today.' };
    return { ok: false, reason: 'unknown', message: msg || 'Could not submit check-in.' };
  }
  return { ok: true, checkin: data as CheckinRow };
}

export type JoinChallengeResult =
  | { ok: true }
  | { ok: false; reason: 'already_joined' | 'ended' | 'inactive' | 'unknown'; message: string };

export async function joinChallenge(challengeId: string): Promise<JoinChallengeResult> {
  const { error } = await supabase.rpc('join_challenge', { p_challenge_id: challengeId });
  if (error) {
    const msg = error.message || '';
    if (/already joined/i.test(msg)) return { ok: false, reason: 'already_joined', message: 'You already joined this challenge.' };
    if (/already ended/i.test(msg))  return { ok: false, reason: 'ended',         message: 'Challenge already ended.' };
    if (/not active/i.test(msg))     return { ok: false, reason: 'inactive',      message: 'Challenge is not active.' };
    return { ok: false, reason: 'unknown', message: msg || 'Could not join.' };
  }
  return { ok: true };
}

export async function leaveChallenge(challengeId: string): Promise<void> {
  const { error } = await supabase.rpc('leave_challenge', { p_challenge_id: challengeId });
  if (error) throw error;
}

export async function deleteChallenge(challengeId: string): Promise<void> {
  const { error } = await supabase.rpc('delete_challenge', { p_challenge_id: challengeId });
  if (error) throw error;
}

// Edit challenge metadata. RLS restricts this to the creator or circle owner.
export async function updateChallenge(
  challengeId: string,
  patch: Partial<Pick<Challenge, 'title' | 'description' | 'rule'>>,
): Promise<void> {
  const { error } = await supabase.from('challenges').update(patch).eq('id', challengeId);
  if (error) throw error;
}

// Upload to private bucket. Returns the storage path (not a public URL).
export async function uploadProofImage(args: {
  uri: string; circleId: string; challengeId: string; userId: string;
}): Promise<string> {
  const ext = (args.uri.split('.').pop() || 'jpg').toLowerCase().replace(/\?.*/, '');
  const filename = `${Date.now()}.${ext === 'heic' ? 'jpg' : ext}`;
  const path = `${args.circleId}/${args.challengeId}/${args.userId}/${filename}`;
  const contentType = ext === 'png' ? 'image/png' : 'image/jpeg';
  const base64 = await FileSystem.readAsStringAsync(args.uri, { encoding: 'base64' as any });
  const { error } = await supabase.storage
    .from('challenge-proofs')
    .upload(path, decodeBase64(base64), { contentType, upsert: false });
  if (error) throw error;
  return path;
}

// Full pick-image → upload → submit-checkin flow. Reused by all proof CTAs.
// Verbose console logs throughout — they are the eyes for the upload chain
// when something silently fails on device.
import * as ImagePicker from 'expo-image-picker';
export async function pickAndUploadProof(args: {
  source: 'camera' | 'library';
  circleId: string;
  challengeId: string;
  userId: string;
}): Promise<
  | { ok: true; checkin: CheckinRow }
  | { ok: false; reason: 'permission' | 'cancelled' | 'duplicate' | 'storage' | 'db' | 'unknown'; message: string; step?: string }
> {
  console.log('[proof] pickAndUploadProof start', { source: args.source, challengeId: args.challengeId });

  // ─── 1. Permission ───────────────────────────────────────────────────
  let perm;
  try {
    perm = args.source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    console.log('[proof] permission result', { granted: perm.granted, status: perm.status, canAskAgain: perm.canAskAgain });
  } catch (e: any) {
    console.log('[proof] permission ERROR', e?.message);
    return { ok: false, reason: 'permission', message: e?.message || 'Permission request failed.', step: 'permission' };
  }
  if (!perm.granted) {
    return {
      ok: false, reason: 'permission', step: 'permission',
      message: args.source === 'camera'
        ? 'Camera permission is required to take proof photos.'
        : 'Gallery permission is required to upload proof.',
    };
  }

  // ─── 2. Launch picker ────────────────────────────────────────────────
  let r;
  try {
    console.log('[proof] launching picker', args.source);
    // SDK 54+ uses `mediaTypes: ['images']` (string array). The legacy
    // `MediaTypeOptions.Images` shape is deprecated and triggers the picker
    // to return canceled immediately on some devices.
    r = args.source === 'camera'
      ? await ImagePicker.launchCameraAsync({
          mediaTypes: ['images'] as any,
          quality: 0.85, allowsEditing: true,
        })
      : await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'] as any,
          quality: 0.85, allowsEditing: true,
          selectionLimit: 1,
        });
    console.log('[proof] picker result', { canceled: r.canceled, hasAsset: !!r.assets?.[0]?.uri });
  } catch (e: any) {
    console.log('[proof] picker ERROR', e?.message);
    return { ok: false, reason: 'unknown', message: e?.message || 'Could not open picker.', step: 'picker' };
  }
  if (r.canceled || !r.assets?.[0]?.uri) {
    return { ok: false, reason: 'cancelled', message: '', step: 'picker' };
  }

  // ─── 3. Optimize + upload full + thumbnail to storage ──────────────
  let media: { fullPath: string; thumbPath: string };
  try {
    console.log('[proof] uploading media (optimized + thumb)');
    media = await uploadProofMedia({
      uri: r.assets[0].uri,
      circleId: args.circleId,
      challengeId: args.challengeId,
      userId: args.userId,
    });
    console.log('[proof] storage upload OK', media);
  } catch (e: any) {
    console.log('[proof] storage ERROR', e?.message);
    return { ok: false, reason: 'storage', message: e?.message || 'Storage upload failed.', step: 'storage' };
  }

  // ─── 4. Insert challenge_checkins via RPC ────────────────────────────
  let sub;
  try {
    console.log('[proof] submitting checkin');
    sub = await submitCheckin({
      challengeId: args.challengeId,
      proofUrl: media.fullPath,
      proofThumbUrl: media.thumbPath,
    });
    console.log('[proof] submitCheckin result', sub);
  } catch (e: any) {
    console.log('[proof] submitCheckin ERROR', e?.message);
    // Best-effort cleanup: orphan files in storage are harmless but wasteful.
    try {
      await supabase.storage.from('challenge-proofs').remove([media.fullPath, media.thumbPath]);
    } catch {}
    return { ok: false, reason: 'db', message: e?.message || 'Check-in insert failed.', step: 'db' };
  }
  if (!sub.ok) {
    // DB rejected → clean up uploaded files.
    try {
      await supabase.storage.from('challenge-proofs').remove([media.fullPath, media.thumbPath]);
    } catch {}
    if (sub.reason === 'duplicate') return { ok: false, reason: 'duplicate', message: sub.message, step: 'db' };
    return { ok: false, reason: 'db', message: sub.message, step: 'db' };
  }
  console.log('[proof] full chain OK', { checkinId: sub.checkin.id });
  return { ok: true, checkin: sub.checkin };
}

// Sign a private bucket path for display (1h validity).
export async function getSignedProofUrl(path: string): Promise<string | null> {
  if (!path) return null;
  const { data } = await supabase.storage.from('challenge-proofs').createSignedUrl(path, 60 * 60);
  return data?.signedUrl || null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────

export function daysLeft(endDate: string): number {
  const end = new Date(endDate + 'T23:59:59');
  const ms = end.getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / 86400000));
}

export function challengeTypeLabel(t: ChallengeType): string {
  switch (t) {
    case 'workout_photo':   return 'Workout photo';
    case 'meal_photo':      return 'Meal photo';
    case 'reading_checkin': return 'Reading check-in';
    case 'custom_photo':    return 'Custom photo';
  }
}

export function challengeTypeTheme(t: ChallengeType): {
  variant: 'sage' | 'gold' | 'coral' | 'violet';
  accent: string;
} {
  switch (t) {
    case 'workout_photo':   return { variant: 'sage',   accent: '#8FA88A' };
    case 'meal_photo':      return { variant: 'coral',  accent: '#D27050' };
    case 'reading_checkin': return { variant: 'gold',   accent: '#C9A961' };
    case 'custom_photo':    return { variant: 'violet', accent: '#9F8FD4' };
  }
}

// Lucide icon name string per type. Screens import the actual Lucide
// component to keep this module dep-free.
export function challengeTypeIconName(t: ChallengeType): 'Dumbbell' | 'Utensils' | 'BookOpen' | 'Sparkles' {
  switch (t) {
    case 'workout_photo':   return 'Dumbbell';
    case 'meal_photo':      return 'Utensils';
    case 'reading_checkin': return 'BookOpen';
    case 'custom_photo':    return 'Sparkles';
  }
}

export function challengeTitlePlaceholder(t: ChallengeType): string {
  const month = new Date().toLocaleString('en-US', { month: 'long' });
  switch (t) {
    case 'workout_photo':   return `Workout ${month}`;
    case 'meal_photo':      return 'Meal Check-ins';
    case 'reading_checkin': return 'Reading Challenge';
    case 'custom_photo':    return 'Custom Challenge';
  }
}

export function challengeTypePrompt(t: ChallengeType): string {
  switch (t) {
    case 'workout_photo':   return 'Check in every time you work out or run.';
    case 'meal_photo':      return 'Check in with a meal photo.';
    case 'reading_checkin': return 'Check in after a reading session.';
    case 'custom_photo':    return 'Check in when you complete the challenge action.';
  }
}

export function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export function isoDaysFromToday(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
