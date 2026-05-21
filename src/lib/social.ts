import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase';
import { useAuth } from './auth';
import type { SimpleProfile } from './challenges';

const PROFILE_FIELDS = 'id, display_name, username, avatar_url';

// ─── Types ────────────────────────────────────────────────────────────────

export type CheckinSocial = {
  checkin_id: string;
  like_count: number;
  i_liked: boolean;
  comment_count: number;
};

export type CommentRow = {
  id: string;
  checkin_id: string;
  user_id: string;
  body: string;
  created_at: string;
  profile: SimpleProfile;
};

export type ChallengeMessage = {
  id: string;
  challenge_id: string;
  user_id: string;
  body: string;
  created_at: string;
  profile: SimpleProfile;
};

// ─── Bulk-fetch likes + comment counts for a set of check-ins ─────────────
export function useCheckinsSocial(checkinIds: string[]) {
  const { session } = useAuth();
  const [byId, setById] = useState<Record<string, CheckinSocial>>({});
  const [loading, setLoading] = useState(true);

  const idsKey = checkinIds.join(',');

  const load = useCallback(async () => {
    if (!session || checkinIds.length === 0) {
      setById({}); setLoading(false); return;
    }
    const uid = session.user.id;

    const [likesQ, commentsQ] = await Promise.all([
      supabase.from('challenge_checkin_likes')
        .select('checkin_id, user_id')
        .in('checkin_id', checkinIds),
      supabase.from('challenge_checkin_comments')
        .select('checkin_id')
        .in('checkin_id', checkinIds),
    ]);

    const out: Record<string, CheckinSocial> = {};
    for (const id of checkinIds) {
      out[id] = { checkin_id: id, like_count: 0, i_liked: false, comment_count: 0 };
    }
    for (const row of (likesQ.data || []) as any[]) {
      const cur = out[row.checkin_id];
      if (!cur) continue;
      cur.like_count += 1;
      if (row.user_id === uid) cur.i_liked = true;
    }
    for (const row of (commentsQ.data || []) as any[]) {
      const cur = out[row.checkin_id];
      if (!cur) continue;
      cur.comment_count += 1;
    }
    setById(out);
    setLoading(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, idsKey]);

  useEffect(() => { setLoading(true); load(); }, [load]);
  return { byId, loading, refresh: load };
}

// ─── Like / unlike a checkin ──────────────────────────────────────────────
export async function toggleCheckinLike(checkinId: string, currentlyLiked: boolean): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not signed in');

  if (currentlyLiked) {
    const { error } = await supabase
      .from('challenge_checkin_likes')
      .delete()
      .eq('checkin_id', checkinId)
      .eq('user_id', user.id);
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from('challenge_checkin_likes')
      .insert({ checkin_id: checkinId, user_id: user.id });
    if (error && !/duplicate|unique/i.test(error.message)) throw error;
  }
}

// ─── Comments per checkin ─────────────────────────────────────────────────
export function useCheckinComments(checkinId: string | undefined) {
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!checkinId) { setComments([]); setLoading(false); return; }
    const { data } = await supabase
      .from('challenge_checkin_comments')
      .select(`id, checkin_id, user_id, body, created_at, profile:profiles(${PROFILE_FIELDS})`)
      .eq('checkin_id', checkinId)
      .order('created_at', { ascending: true });
    setComments((data || []) as any);
    setLoading(false);
  }, [checkinId]);

  useEffect(() => { setLoading(true); load(); }, [load]);
  return { comments, loading, refresh: load };
}

export async function addCheckinComment(checkinId: string, body: string): Promise<void> {
  const trimmed = body.trim();
  if (!trimmed) throw new Error('Comment cannot be empty');
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not signed in');
  const { error } = await supabase
    .from('challenge_checkin_comments')
    .insert({ checkin_id: checkinId, user_id: user.id, body: trimmed });
  if (error) throw error;
}

export async function deleteCheckinComment(commentId: string): Promise<void> {
  const { error } = await supabase
    .from('challenge_checkin_comments')
    .delete()
    .eq('id', commentId);
  if (error) throw error;
}

// ─── Challenge messages ───────────────────────────────────────────────────
export function useChallengeMessages(challengeId: string | undefined) {
  const [messages, setMessages] = useState<ChallengeMessage[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!challengeId) { setMessages([]); setLoading(false); return; }
    const { data } = await supabase
      .from('challenge_messages')
      .select(`id, challenge_id, user_id, body, created_at, profile:profiles(${PROFILE_FIELDS})`)
      .eq('challenge_id', challengeId)
      .order('created_at', { ascending: true })
      .limit(100);
    setMessages((data || []) as any);
    setLoading(false);
  }, [challengeId]);

  useEffect(() => { setLoading(true); load(); }, [load]);
  return { messages, loading, refresh: load };
}

export async function sendChallengeMessage(challengeId: string, body: string): Promise<void> {
  const trimmed = body.trim();
  if (!trimmed) throw new Error('Message cannot be empty');
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not signed in');
  const { error } = await supabase
    .from('challenge_messages')
    .insert({ challenge_id: challengeId, user_id: user.id, body: trimmed });
  if (error) throw error;
}

export async function deleteChallengeMessage(messageId: string): Promise<void> {
  const { error } = await supabase
    .from('challenge_messages')
    .delete()
    .eq('id', messageId);
  if (error) throw error;
}
