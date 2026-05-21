import { useCallback, useEffect, useState } from 'react';
import * as FileSystem from 'expo-file-system/legacy';
import { decode as decodeBase64 } from 'base64-arraybuffer';
import { supabase } from './supabase';
import { useAuth } from './auth';

export type CirclePurpose = 'workout' | 'reading' | 'hydration' | 'general' | 'custom' | null;

export type Circle = {
  id: string;
  owner_id: string;
  name: string;
  description: string | null;
  purpose: CirclePurpose;
  invite_code: string;
  visibility: 'private';
  image_url: string | null;
  created_at: string;
  updated_at: string;
};

export type CircleListItem = Circle & {
  member_count: number;
  is_owner: boolean;
};

export type CircleMember = {
  id: string;
  user_id: string;
  role: 'owner' | 'admin' | 'member';
  status: 'active' | 'left' | 'removed';
  joined_at: string;
  profile: {
    id: string;
    display_name: string | null;
    username: string | null;
    avatar_url: string | null;
  };
};

export function normalizeCircleCode(input: string): string {
  return input.replace(/\s+/g, '').toUpperCase();
}

// ─── List my circles ──────────────────────────────────────────────────────
export function useCircles() {
  const { session } = useAuth();
  const [circles, setCircles] = useState<CircleListItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!session) return;
    const uid = session.user.id;

    // Active memberships for this user → circle ids.
    const { data: myMemberships } = await supabase
      .from('circle_members')
      .select('circle_id')
      .eq('user_id', uid).eq('status', 'active');

    const circleIds = (myMemberships || []).map(m => m.circle_id as string);
    if (circleIds.length === 0) { setCircles([]); setLoading(false); return; }

    const [circlesQ, memberCountsQ] = await Promise.all([
      supabase.from('circles').select('*').in('id', circleIds),
      supabase.from('circle_members')
        .select('circle_id, user_id')
        .in('circle_id', circleIds).eq('status', 'active'),
    ]);

    const counts = new Map<string, number>();
    for (const row of memberCountsQ.data || []) {
      counts.set(row.circle_id as string, (counts.get(row.circle_id as string) || 0) + 1);
    }

    const rows = (circlesQ.data || []) as Circle[];
    setCircles(rows.map(c => ({
      ...c,
      member_count: counts.get(c.id) || 0,
      is_owner: c.owner_id === uid,
    })));
    setLoading(false);
  }, [session]);

  useEffect(() => { setLoading(true); load(); }, [load]);
  return { circles, loading, refresh: load };
}

// ─── Single circle + members ──────────────────────────────────────────────
export function useCircleDetail(circleId: string | undefined) {
  const [circle, setCircle] = useState<Circle | null>(null);
  const [members, setMembers] = useState<CircleMember[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!circleId) return;
    const [circleQ, membersQ] = await Promise.all([
      supabase.from('circles').select('*').eq('id', circleId).maybeSingle(),
      supabase.from('circle_members')
        .select(`id, user_id, role, status, joined_at,
                 profile:profiles(id, display_name, username, avatar_url)`)
        .eq('circle_id', circleId).eq('status', 'active')
        .order('joined_at', { ascending: true }),
    ]);
    setCircle((circleQ.data as Circle) || null);
    setMembers((membersQ.data || []) as any);
    setLoading(false);
  }, [circleId]);

  useEffect(() => { setLoading(true); load(); }, [load]);
  return { circle, members, loading, refresh: load };
}

// ─── Actions ──────────────────────────────────────────────────────────────

export async function createCircle(input: {
  name: string;
  description?: string;
  purpose?: CirclePurpose;
}): Promise<Circle> {
  const { data, error } = await supabase.rpc('create_circle', {
    p_name: input.name,
    p_description: input.description ?? null,
    p_purpose: input.purpose ?? null,
  });
  if (error) throw error;
  return data as Circle;
}

export type JoinCircleResult =
  | { ok: true; circle: Circle }
  | { ok: false; reason: 'not_found' | 'already_member' | 'unavailable' | 'unknown'; message: string };

export async function joinCircleByCode(rawCode: string): Promise<JoinCircleResult> {
  const code = normalizeCircleCode(rawCode);
  if (!code) return { ok: false, reason: 'not_found', message: 'Enter an invite code.' };
  const { data, error } = await supabase.rpc('join_circle_by_code', { p_code: code });
  if (error) {
    const msg = error.message || '';
    if (/no circle/i.test(msg))    return { ok: false, reason: 'not_found',     message: 'No circle found with that code.' };
    if (/already/i.test(msg))      return { ok: false, reason: 'already_member', message: 'You are already in this circle.' };
    return { ok: false, reason: 'unknown', message: msg || 'Could not join.' };
  }
  return { ok: true, circle: data as Circle };
}

export type LeaveCircleResult =
  | { ok: true }
  | { ok: false; reason: 'transfer_required' | 'unknown'; message: string };

export async function leaveCircle(circleId: string): Promise<LeaveCircleResult> {
  const { error } = await supabase.rpc('leave_circle', { p_circle_id: circleId });
  if (error) {
    const msg = error.message || '';
    if (/transfer/i.test(msg)) return { ok: false, reason: 'transfer_required', message: 'Transfer ownership before leaving.' };
    return { ok: false, reason: 'unknown', message: msg || 'Could not leave.' };
  }
  return { ok: true };
}

// Owner-only metadata edit. RLS (`circles_update`) restricts this to the owner.
export async function updateCircle(
  circleId: string,
  patch: Partial<Pick<Circle, 'name' | 'description' | 'purpose' | 'image_url'>>,
): Promise<void> {
  const { error } = await supabase.from('circles').update(patch).eq('id', circleId);
  if (error) throw error;
}

// Owner-only. Cascades members via FK.
export async function deleteCircle(circleId: string): Promise<void> {
  const { error } = await supabase.rpc('delete_circle', { p_circle_id: circleId });
  if (error) throw error;
}

// Upload a local image URI to the circle-images bucket under <circleId>/<filename>.
// Returns the public URL.
export async function uploadCircleImage(uri: string, circleId: string): Promise<string> {
  const ext = (uri.split('.').pop() || 'jpg').toLowerCase().replace(/\?.*/, '');
  const filename = `${Date.now()}.${ext === 'heic' ? 'jpg' : ext}`;
  const path = `${circleId}/${filename}`;
  const contentType = ext === 'png' ? 'image/png' : 'image/jpeg';
  const base64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' as any });
  const { error } = await supabase.storage.from('circle-images').upload(path, decodeBase64(base64), {
    contentType, upsert: true,
  });
  if (error) throw error;
  const { data } = supabase.storage.from('circle-images').getPublicUrl(path);
  return data.publicUrl;
}
