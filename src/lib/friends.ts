import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase';
import { useAuth } from './auth';
import { listDemoFriends, lookupDemoByCode, addDemoFriend } from './demoFriends';

export type SafeProfile = {
  id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  friend_code: string;
};

export type IncomingRequest = {
  id: string;
  requester_id: string;
  created_at: string;
  requester: SafeProfile;
};

export type SentRequest = {
  id: string;
  receiver_id: string;
  created_at: string;
  receiver: SafeProfile;
};

export type Friend = SafeProfile & { friends_since: string; is_demo?: boolean };

const PROFILE_FIELDS = 'id, display_name, username, avatar_url, friend_code';

// 12-digit code → "8808 3349 0341"
export function formatFriendCode(code: string): string {
  const digits = code.replace(/\D/g, '');
  return digits.replace(/(.{4})(.{4})(.{4})/, '$1 $2 $3').trim();
}

// "8808 3349 0341" / "vyb://friend-code/8808...." → "880833490341"
export function normalizeFriendCode(input: string): string {
  const match = input.match(/(\d{4}\s*\d{4}\s*\d{4})|(\d{12})/);
  if (match) return match[0].replace(/\D/g, '');
  return input.replace(/\D/g, '').slice(0, 12);
}

export function friendCodeDeepLink(code: string): string {
  return `vyb://friend-code/${code}`;
}

// ─── Hook: my friend code ──────────────────────────────────────────────────
export function useMyFriendCode() {
  const { session } = useAuth();
  const [code, setCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session) return;
    (async () => {
      const { data } = await supabase
        .from('profiles')
        .select('friend_code')
        .eq('id', session.user.id)
        .maybeSingle();
      setCode((data?.friend_code as string) || null);
      setLoading(false);
    })();
  }, [session]);

  return { code, loading };
}

// ─── Hook: incoming/sent requests + friends list ───────────────────────────
export function useFriendData() {
  const { session } = useAuth();
  const [incoming, setIncoming] = useState<IncomingRequest[]>([]);
  const [sent, setSent] = useState<SentRequest[]>([]);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!session) return;
    const uid = session.user.id;
    const [inQ, outQ, friendshipsQ] = await Promise.all([
      supabase
        .from('friend_requests')
        .select(`id, requester_id, created_at, requester:profiles!friend_requests_requester_id_fkey(${PROFILE_FIELDS})`)
        .eq('receiver_id', uid).eq('status', 'pending')
        .order('created_at', { ascending: false }),
      supabase
        .from('friend_requests')
        .select(`id, receiver_id, created_at, receiver:profiles!friend_requests_receiver_id_fkey(${PROFILE_FIELDS})`)
        .eq('requester_id', uid).eq('status', 'pending')
        .order('created_at', { ascending: false }),
      supabase
        .from('friendships')
        .select(`id, user_a, user_b, created_at`)
        .or(`user_a.eq.${uid},user_b.eq.${uid}`),
    ]);

    setIncoming((inQ.data || []) as any);
    setSent((outQ.data || []) as any);

    const friendRows = (friendshipsQ.data || []) as { id: string; user_a: string; user_b: string; created_at: string }[];
    const otherIds = friendRows.map(r => r.user_a === uid ? r.user_b : r.user_a);

    let real: Friend[] = [];
    if (otherIds.length > 0) {
      const { data: profs } = await supabase
        .from('profiles')
        .select(PROFILE_FIELDS)
        .in('id', otherIds);
      const byId = new Map<string, SafeProfile>((profs || []).map(p => [p.id, p as SafeProfile]));
      real = friendRows
        .map(r => {
          const otherId = r.user_a === uid ? r.user_b : r.user_a;
          const prof = byId.get(otherId);
          if (!prof) return null;
          return { ...prof, friends_since: r.created_at };
        })
        .filter(Boolean) as Friend[];
    }

    // Merge in demo friends from local storage. They live alongside real
    // friends in the UI but are tagged so we can render a chip + block
    // real interactions cleanly.
    const demos = await listDemoFriends();
    const demoFriends: Friend[] = demos.map(d => ({
      id:           d.id,
      display_name: d.display_name,
      username:     d.username,
      avatar_url:   d.avatar_url,
      friend_code:  d.friend_code,
      friends_since: new Date(0).toISOString(),
      is_demo:      true,
    }));

    setFriends([...real, ...demoFriends]);
    setLoading(false);
  }, [session]);

  useEffect(() => { setLoading(true); load(); }, [load]);

  return { incoming, sent, friends, loading, refresh: load };
}

// ─── Actions ───────────────────────────────────────────────────────────────

export type SendRequestResult =
  | { ok: true; receiver: SafeProfile }
  | { ok: false; reason: 'self' | 'not_found' | 'already_friends' | 'duplicate' | 'unknown'; message: string };

export async function sendFriendRequest(rawCode: string): Promise<SendRequestResult> {
  // Demo codes (SOPHIE24, PABLO24, etc.) short-circuit into the local
  // demo-friends store — no Supabase round-trip, no auth.users FK issues.
  const demo = lookupDemoByCode(rawCode);
  if (demo) {
    await addDemoFriend(demo.friend_code);
    return {
      ok: true,
      receiver: {
        id: demo.id, display_name: demo.display_name,
        username: demo.username, avatar_url: demo.avatar_url,
        friend_code: demo.friend_code,
      },
    };
  }

  const code = normalizeFriendCode(rawCode);
  if (code.length !== 12) {
    return { ok: false, reason: 'not_found', message: 'Friend code must be 12 digits.' };
  }
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, reason: 'unknown', message: 'Not signed in.' };

  const { data: me } = await supabase.from('profiles').select('friend_code').eq('id', user.id).maybeSingle();
  if (me?.friend_code === code) {
    return { ok: false, reason: 'self', message: 'You can’t add yourself.' };
  }

  const { data: target } = await supabase
    .from('profiles').select(PROFILE_FIELDS).eq('friend_code', code).maybeSingle();
  if (!target) {
    return { ok: false, reason: 'not_found', message: 'No user found with that code.' };
  }
  const receiver = target as SafeProfile;

  // Already friends?
  const [aLow, bHigh] = user.id < receiver.id ? [user.id, receiver.id] : [receiver.id, user.id];
  const { data: existing } = await supabase
    .from('friendships').select('id')
    .eq('user_a', aLow).eq('user_b', bHigh).maybeSingle();
  if (existing) {
    return { ok: false, reason: 'already_friends', message: 'You are already friends.' };
  }

  // Existing pending request either direction?
  const { data: pendings } = await supabase
    .from('friend_requests').select('id, requester_id, receiver_id, status')
    .eq('status', 'pending')
    .or(`and(requester_id.eq.${user.id},receiver_id.eq.${receiver.id}),and(requester_id.eq.${receiver.id},receiver_id.eq.${user.id})`);
  if (pendings && pendings.length > 0) {
    return { ok: false, reason: 'duplicate', message: 'A pending request already exists.' };
  }

  const { error } = await supabase
    .from('friend_requests')
    .insert({ requester_id: user.id, receiver_id: receiver.id, status: 'pending' });
  if (error) {
    if (/duplicate|unique/i.test(error.message)) {
      return { ok: false, reason: 'duplicate', message: 'You already sent a request.' };
    }
    return { ok: false, reason: 'unknown', message: error.message };
  }
  return { ok: true, receiver };
}

export async function acceptFriendRequest(requestId: string): Promise<void> {
  const { error } = await supabase.rpc('accept_friend_request', { p_request_id: requestId });
  if (error) throw error;
}

export async function rejectFriendRequest(requestId: string): Promise<void> {
  const { error } = await supabase
    .from('friend_requests')
    .update({ status: 'rejected', updated_at: new Date().toISOString() })
    .eq('id', requestId);
  if (error) throw error;
}
