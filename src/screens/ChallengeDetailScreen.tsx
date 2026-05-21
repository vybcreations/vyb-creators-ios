import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, Pressable, Alert, ActivityIndicator, Image, Modal,
  TextInput, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect } from '@react-navigation/native';
import {
  ArrowLeft, Lock, Camera, Image as ImageIcon, Trophy, Crown, Check, X,
  MoreVertical, LogOut, Trash2, Edit3, Dumbbell, Utensils, BookOpen, Sparkles,
  Heart, MessageCircle, Send,
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Avatar, SectionLabel, Tx, GoldButton } from '../components/primitives';
import {
  useCheckinsSocial, useCheckinComments, useChallengeMessages,
  toggleCheckinLike, addCheckinComment, sendChallengeMessage,
} from '../lib/social';
import { colors as C, fonts as F } from '../theme';
import { ScreenAtmosphere } from '../components/ScreenAtmosphere';
import {
  useChallengeDetail, submitCheckin, uploadProofImage, getSignedProofUrl,
  leaveChallenge, deleteChallenge, updateChallenge, pickAndUploadProof,
  daysLeft, challengeTypeLabel, challengeTypeTheme,
  type LeaderboardEntry, type CheckinRow, type ChallengeType,
} from '../lib/challenges';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';

export function ChallengeDetailScreen({ route, navigation }: any) {
  const challengeId: string = route?.params?.challengeId;
  const { session } = useAuth();
  const { challenge, leaderboard, recentCheckins, myCheckinToday, loading, refresh } = useChallengeDetail(challengeId);
  const checkinIds = React.useMemo(() => recentCheckins.map(r => r.id), [recentCheckins]);
  const { byId: socialById, refresh: refreshSocial } = useCheckinsSocial(checkinIds);
  const [busy, setBusy] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [isCircleOwner, setIsCircleOwner] = useState(false);

  useFocusEffect(React.useCallback(() => { refresh(); }, [refresh]));

  // Determine if current user owns the circle (to surface delete action).
  useEffect(() => {
    if (!challenge || !session) return;
    let alive = true;
    (async () => {
      const { data } = await supabase
        .from('circles').select('owner_id').eq('id', challenge.circle_id).maybeSingle();
      if (alive) setIsCircleOwner(data?.owner_id === session.user.id);
    })();
    return () => { alive = false; };
  }, [challenge, session]);

  if (loading || !challenge || !session) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bgBase }} edges={['top']}>
        <ScreenAtmosphere />
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10 }}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={8}
            style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}>
            <ArrowLeft size={20} color={C.textSecondary} />
          </Pressable>
        </View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={C.gold} />
        </View>
      </SafeAreaView>
    );
  }

  const isPhoto = challenge.proof_type === 'photo';
  const days = daysLeft(challenge.end_date);

  const doSubmit = async (proofUrl?: string) => {
    setBusy(true);
    const r = await submitCheckin({ challengeId: challenge.id, proofUrl: proofUrl ?? null });
    setBusy(false);
    if (!r.ok) {
      Alert.alert('Could not check in', r.message);
      return;
    }
    refresh();
    Alert.alert('Proof uploaded.', 'Your check-in was added to the circle.');
  };

  const pickAndUpload = async (source: 'camera' | 'library') => {
    console.log('[proof] ChallengeDetail pickAndUpload tapped', { source });
    if (!challenge) { Alert.alert('Missing challenge'); return; }
    if (!session) { Alert.alert('Sign-in required'); return; }
    setPickerOpen(false);
    // Wait for the modal to fully dismiss before launching the native picker.
    await new Promise(r => setTimeout(r, 600));
    setBusy(true);
    try {
      const r = await pickAndUploadProof({
        source,
        circleId: challenge.circle_id,
        challengeId: challenge.id,
        userId: session.user.id,
      });
      console.log('[proof] ChallengeDetail result', r);
      setBusy(false);
      if (r.ok) { refresh(); return; }
      switch (r.reason) {
        case 'permission': Alert.alert('Permission needed', r.message); break;
        case 'duplicate':  Alert.alert('Already checked in today.'); break;
        case 'storage':    Alert.alert('Upload failed', `Could not save image.\n\n${r.message}`); break;
        case 'db':         Alert.alert('Check-in failed', `Could not record.\n\n${r.message}`); break;
        case 'cancelled':  /* silent */ break;
        default:           Alert.alert('Upload failed', r.message || 'Unknown error.');
      }
    } catch (e: any) {
      setBusy(false);
      console.log('[proof] ChallengeDetail threw', e?.message);
      Alert.alert('Upload failed', e?.message || 'Unknown error');
    }
  };

  const onLeave = () => {
    if (!challenge) return;
    Alert.alert('Leave challenge?', 'Your previous check-ins stay, but you won’t appear in the active leaderboard.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Leave', style: 'destructive', onPress: async () => {
          try { await leaveChallenge(challenge.id); navigation.goBack(); }
          catch (e: any) { Alert.alert('Could not leave', e.message || 'Unknown error'); }
        },
      },
    ]);
  };

  const onDelete = () => {
    if (!challenge) return;
    Alert.alert('Delete challenge?', `This will delete ${challenge.title} for everyone in the circle.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          try { await deleteChallenge(challenge.id); navigation.goBack(); }
          catch (e: any) { Alert.alert('Could not delete', e.message || 'Unknown error'); }
        },
      },
    ]);
  };

  const isCreator = !!(challenge && session && challenge.created_by === session.user.id);
  const canDelete = isCreator || isCircleOwner;

  const onCheckInTap = () => {
    if (myCheckinToday) {
      Alert.alert('Already checked in today.');
      return;
    }
    if (isPhoto) {
      setPickerOpen(true);
    } else {
      doSubmit();
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bgBase }} edges={['top']}>
      <ScreenAtmosphere />

      {/* Header */}
      <View style={{
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 16, paddingVertical: 10,
      }}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={8} style={{
          width: 36, height: 36, alignItems: 'center', justifyContent: 'center',
        }}>
          <ArrowLeft size={20} color={C.textSecondary} />
        </Pressable>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Lock size={12} color={C.textFaint} />
          <Text style={{ fontFamily: F.sansBold, fontSize: 10, color: C.textFaint, letterSpacing: 1, textTransform: 'uppercase' }}>
            Private
          </Text>
        </View>
        <Pressable onPress={() => setActionsOpen(true)} hitSlop={8} style={{
          width: 36, height: 36, alignItems: 'center', justifyContent: 'center',
        }}>
          <MoreVertical size={20} color={C.textSecondary} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 80 }} showsVerticalScrollIndicator={false}>
        {/* Hero card — large premium with type-themed glow + big badge */}
        <View style={{ paddingHorizontal: 16 }}>
          <ChallengeHero challenge={challenge} days={days}>
            {/* Check-in CTA — gold pill when pending, calm sage when done. */}
            <View style={{ marginTop: 18 }}>
              {myCheckinToday ? (
                <View style={{
                  height: 46, borderRadius: 23,
                  flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
                  backgroundColor: 'rgba(143,168,138,0.18)',
                  borderColor: 'rgba(143,168,138,0.45)', borderWidth: 1,
                }}>
                  <Check size={14} color="#8FA88A" />
                  <Text style={{ fontFamily: F.sansBold, fontSize: 12, color: '#8FA88A', letterSpacing: 0.6, textTransform: 'uppercase' }}>
                    Checked in today
                  </Text>
                </View>
              ) : (
                <GoldButton
                  size="lg" variant="complete"
                  onPress={onCheckInTap}
                  loading={busy}
                  disabled={busy}
                  icon={isPhoto ? <Camera size={14} color={C.bgBase} /> : <Check size={14} color={C.bgBase} />}
                  style={{ alignSelf: 'stretch' }}>
                  {isPhoto ? 'Upload proof' : 'Check in'}
                </GoldButton>
              )}
            </View>
          </ChallengeHero>
        </View>

        {/* Leaderboard */}
        <View style={{ paddingHorizontal: 16, marginTop: 18 }}>
          <SectionLabel style={{ marginLeft: 4, marginBottom: 8 }}>leaderboard</SectionLabel>
          <View style={{
            borderRadius: 14, overflow: 'hidden',
            backgroundColor: 'rgba(255,255,255,0.025)',
            borderColor: C.borderSubtle, borderWidth: 1,
          }}>
            {leaderboard.map((m, i) => <LeaderboardRow key={m.user_id} entry={m} rank={i + 1} />)}
          </View>
        </View>

        {/* Proof feed */}
        <View style={{ paddingHorizontal: 16, marginTop: 18 }}>
          <SectionLabel style={{ marginLeft: 4, marginBottom: 8 }}>proof feed</SectionLabel>
          {recentCheckins.length === 0 ? (
            <View style={{
              paddingVertical: 22, paddingHorizontal: 18, borderRadius: 14,
              backgroundColor: 'rgba(255,255,255,0.025)',
              borderColor: C.borderSubtle, borderWidth: 1,
              alignItems: 'center',
            }}>
              <Text style={{ fontFamily: F.serifItalic, fontSize: 13, color: C.textSecondary, textAlign: 'center' }}>
                No check-ins yet. Be the first.
              </Text>
            </View>
          ) : (
            <View style={{ gap: 10 }}>
              {recentCheckins.map(r => (
                <ProofRow
                  key={r.id}
                  row={r}
                  social={socialById[r.id]}
                  onToggleLike={async () => {
                    const liked = socialById[r.id]?.i_liked ?? false;
                    try {
                      await toggleCheckinLike(r.id, liked);
                      refreshSocial();
                    } catch (e: any) {
                      Alert.alert('Could not update like', e?.message || 'Unknown error');
                    }
                  }}
                  onRefreshSocial={refreshSocial}
                />
              ))}
            </View>
          )}
        </View>

        {/* Challenge messages — private to this challenge */}
        <MessagesSection challengeId={challenge.id} />
      </ScrollView>

      <ProofPicker
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onCamera={() => pickAndUpload('camera')}
        onLibrary={() => pickAndUpload('library')}
      />

      <ActionsSheet
        visible={actionsOpen}
        onClose={() => setActionsOpen(false)}
        canEdit={canDelete}
        canDelete={canDelete}
        onEdit={() => { setActionsOpen(false); setEditOpen(true); }}
        onLeave={() => { setActionsOpen(false); onLeave(); }}
        onDelete={() => { setActionsOpen(false); onDelete(); }}
      />

      <EditChallengeModal
        visible={editOpen}
        onClose={() => setEditOpen(false)}
        challengeId={challenge.id}
        initialTitle={challenge.title}
        initialDescription={challenge.description || ''}
        initialRule={challenge.rule || ''}
        onSaved={() => { setEditOpen(false); refresh(); }}
      />
    </SafeAreaView>
  );
}

// ─── ChallengeHero — type-themed premium header ──────────────────────────

const TYPE_ICON: Record<ChallengeType, typeof Trophy> = {
  workout_photo:   Dumbbell,
  meal_photo:      Utensils,
  reading_checkin: BookOpen,
  custom_photo:    Sparkles,
};

function ChallengeHero({
  challenge, days, children,
}: {
  challenge: NonNullable<ReturnType<typeof useChallengeDetail>['challenge']>;
  days: number;
  children?: React.ReactNode;
}) {
  const theme = challengeTypeTheme(challenge.challenge_type);
  const Icon = TYPE_ICON[challenge.challenge_type];
  const endsLabel = days === 0 ? 'Ends today' : days === 1 ? 'Ends tomorrow' : `Ends in ${days} days`;

  return (
    <View style={{
      borderRadius: 26, overflow: 'hidden',
      backgroundColor: C.bgElevated,
      borderColor: `${theme.accent}33`, borderWidth: 1,
      shadowColor: theme.accent, shadowOpacity: 0.20, shadowRadius: 22, shadowOffset: { width: 0, height: 10 },
    }}>
      {/* Accent-themed gradient wash from top-left */}
      <LinearGradient pointerEvents="none"
        colors={[`${theme.accent}33`, `${theme.accent}10`, 'rgba(0,0,0,0)']}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}
      />
      {/* Soft radial-feel halo behind the badge */}
      <LinearGradient pointerEvents="none"
        colors={[`${theme.accent}28`, 'rgba(0,0,0,0)']}
        start={{ x: 0.3, y: 0.2 }} end={{ x: 0.9, y: 1 }}
        style={{ position: 'absolute', left: 0, top: 0, width: '70%', height: 160 }}
      />
      {/* Top inner highlight */}
      <LinearGradient pointerEvents="none"
        colors={['rgba(255,255,255,0.10)', 'rgba(255,255,255,0)']}
        start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
        style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 32 }}
      />

      <View style={{ padding: 22 }}>
        {/* Big themed badge */}
        <View style={{
          width: 72, height: 72, borderRadius: 22,
          backgroundColor: `${theme.accent}20`,
          borderColor: `${theme.accent}80`, borderWidth: 1.5,
          alignItems: 'center', justifyContent: 'center',
          shadowColor: theme.accent, shadowOpacity: 0.40, shadowRadius: 18, shadowOffset: { width: 0, height: 6 },
        }}>
          <Icon size={34} color={theme.accent} strokeWidth={1.8} />
        </View>

        {/* Type label + ends-in */}
        <Text style={{
          fontFamily: F.sansBold, fontSize: 10, color: theme.accent,
          marginTop: 16, letterSpacing: 1.4, textTransform: 'uppercase',
        }}>
          {challengeTypeLabel(challenge.challenge_type)} · {endsLabel}
        </Text>

        {/* Title — editorial, large */}
        <Text style={[Tx.editorial(), { fontSize: 32, marginTop: 4, letterSpacing: -0.5, lineHeight: 36 }]}>
          {challenge.title}
        </Text>

        {challenge.description && (
          <Text style={{
            fontFamily: F.sans, fontSize: 13, color: C.textSecondary,
            marginTop: 10, lineHeight: 19,
          }}>
            {challenge.description}
          </Text>
        )}
        {challenge.rule && (
          <View style={{
            marginTop: 12, paddingTop: 12,
            borderTopColor: 'rgba(244,240,232,0.08)', borderTopWidth: 1,
          }}>
            <Text style={{
              fontFamily: F.sansBold, fontSize: 9.5, color: C.textFaint,
              letterSpacing: 1, textTransform: 'uppercase',
            }}>
              Rule
            </Text>
            <Text style={{
              fontFamily: F.serifItalic, fontSize: 13.5, color: C.textPrimary,
              marginTop: 4, lineHeight: 19,
            }}>
              {challenge.rule}
            </Text>
          </View>
        )}

        {children}
      </View>
    </View>
  );
}

function ActionsSheet({
  visible, onClose, canEdit, canDelete, onEdit, onLeave, onDelete,
}: {
  visible: boolean; onClose: () => void;
  canEdit: boolean; canDelete: boolean;
  onEdit: () => void; onLeave: () => void; onDelete: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }}>
        <Pressable onPress={(e) => e.stopPropagation()} style={{
          backgroundColor: C.bgBase, borderTopLeftRadius: 22, borderTopRightRadius: 22,
          paddingTop: 16, paddingBottom: 36, paddingHorizontal: 16,
          borderColor: C.borderSubtle, borderWidth: 1,
        }}>
          <View style={{ alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: C.borderSubtle, marginBottom: 14 }} />
          {canEdit && <SheetActionRow Icon={Edit3} label="Edit challenge" onPress={onEdit} />}
          <SheetActionRow Icon={LogOut} label="Leave challenge" onPress={onLeave} destructive />
          {canDelete && <SheetActionRow Icon={Trash2} label="Delete challenge" onPress={onDelete} destructive />}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function EditChallengeModal({
  visible, onClose, challengeId,
  initialTitle, initialDescription, initialRule, onSaved,
}: {
  visible: boolean; onClose: () => void; challengeId: string;
  initialTitle: string; initialDescription: string; initialRule: string;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription);
  const [rule, setRule] = useState(initialRule);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  React.useEffect(() => {
    if (visible) {
      setTitle(initialTitle);
      setDescription(initialDescription);
      setRule(initialRule);
      setError(null);
    }
  }, [visible, initialTitle, initialDescription, initialRule]);

  const submit = async () => {
    if (!title.trim()) { setError('Title is required.'); return; }
    setBusy(true); setError(null);
    try {
      await updateChallenge(challengeId, {
        title: title.trim(),
        description: description.trim() ? description.trim() : null,
        rule: rule.trim() ? rule.trim() : null,
      });
      onSaved();
    } catch (e: any) {
      setError(e.message || 'Could not save changes.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', padding: 22 }}>
          <View style={{
            backgroundColor: C.bgBase, borderRadius: 18, padding: 20,
            borderColor: C.borderSubtle, borderWidth: 1,
          }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={Tx.label({ letterSpacing: 1.6 })}>EDIT CHALLENGE</Text>
              <Pressable onPress={onClose} hitSlop={6}><X size={16} color={C.textMuted} /></Pressable>
            </View>
            <TextInput
              value={title} onChangeText={setTitle}
              placeholder="Title"
              placeholderTextColor={C.textFaint}
              style={{
                marginTop: 14, paddingHorizontal: 14, height: 44, borderRadius: 12,
                backgroundColor: C.bgOverlay, borderColor: C.borderSubtle, borderWidth: 1,
                fontFamily: F.sansBold, fontSize: 14, color: C.textPrimary,
              }}
            />
            <TextInput
              value={description} onChangeText={setDescription}
              placeholder="Description"
              placeholderTextColor={C.textFaint}
              multiline
              style={{
                marginTop: 10, paddingHorizontal: 14, paddingVertical: 10, minHeight: 60, borderRadius: 12,
                backgroundColor: C.bgOverlay, borderColor: C.borderSubtle, borderWidth: 1,
                fontFamily: F.sans, fontSize: 13, color: C.textPrimary,
              }}
            />
            <Text style={{ fontFamily: F.sansBold, fontSize: 10, color: C.textFaint, marginTop: 14, letterSpacing: 0.8, textTransform: 'uppercase' }}>
              Rules or stakes
            </Text>
            <TextInput
              value={rule} onChangeText={setRule}
              placeholder="Lowest count invites pizza."
              placeholderTextColor={C.textFaint}
              style={{
                marginTop: 8, paddingHorizontal: 14, height: 44, borderRadius: 12,
                backgroundColor: C.bgOverlay, borderColor: C.borderSubtle, borderWidth: 1,
                fontFamily: F.sans, fontSize: 13, color: C.textPrimary,
              }}
            />
            {error && (
              <Text style={{ fontFamily: F.sans, fontSize: 12, color: '#D27050', marginTop: 10 }}>
                {error}
              </Text>
            )}
            <Pressable onPress={submit} disabled={busy || !title.trim()} style={{
              marginTop: 16, height: 44, borderRadius: 12,
              backgroundColor: C.goldFaint, borderColor: 'rgba(201,169,97,0.4)', borderWidth: 1,
              alignItems: 'center', justifyContent: 'center',
              opacity: (busy || !title.trim()) ? 0.5 : 1,
            }}>
              {busy ? (
                <ActivityIndicator color={C.gold} />
              ) : (
                <Text style={{ fontFamily: F.sansBold, fontSize: 13, color: C.gold, letterSpacing: 0.6, textTransform: 'uppercase' }}>
                  Save changes
                </Text>
              )}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function SheetActionRow({
  Icon, label, onPress, destructive = false,
}: { Icon: typeof LogOut; label: string; onPress: () => void; destructive?: boolean }) {
  const tint = destructive ? '#D27050' : C.textPrimary;
  return (
    <Pressable onPress={onPress} hitSlop={4} style={{
      flexDirection: 'row', alignItems: 'center', gap: 12,
      paddingVertical: 14, paddingHorizontal: 6,
      borderTopColor: C.borderSubtle, borderTopWidth: 1,
    }}>
      <Icon size={16} color={tint} />
      <Text style={{ fontFamily: F.sansBold, fontSize: 13.5, color: tint, letterSpacing: 0.3 }}>{label}</Text>
    </Pressable>
  );
}

function LeaderboardRow({ entry, rank }: { entry: LeaderboardEntry; rank: number }) {
  const name = entry.profile.display_name || entry.profile.username || 'Member';
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center', gap: 12,
      paddingVertical: 12, paddingHorizontal: 14,
      borderTopColor: C.borderSubtle, borderTopWidth: rank === 1 ? 0 : 1,
    }}>
      <View style={{ width: 22, alignItems: 'center' }}>
        {rank === 1 ? (
          <Crown size={14} color={C.gold} />
        ) : (
          <Text style={{ fontFamily: F.mono, fontSize: 11, color: C.textFaint }}>{rank}</Text>
        )}
      </View>
      <Avatar size={32} label={(name[0] || '?').toUpperCase()} tone={rank === 1 ? 'gold' : 'neutral'} />
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: F.sansBold, fontSize: 13, color: C.textPrimary }}>{name}</Text>
        {entry.checked_in_today && (
          <Text style={{ fontFamily: F.sansBold, fontSize: 9.5, color: '#8FA88A', marginTop: 2, letterSpacing: 0.4, textTransform: 'uppercase' }}>
            Today ✓
          </Text>
        )}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
        <Text style={{ fontFamily: F.sansHeavy, fontSize: 18, color: C.textPrimary, letterSpacing: -0.3 }}>
          {entry.count}
        </Text>
        <Text style={{ fontFamily: F.sansBold, fontSize: 9, color: C.textFaint, letterSpacing: 0.6, textTransform: 'uppercase' }}>
          {entry.count === 1 ? 'check-in' : 'check-ins'}
        </Text>
      </View>
    </View>
  );
}

function ProofRow({
  row, social, onToggleLike, onRefreshSocial,
}: {
  row: CheckinRow;
  social: { like_count: number; i_liked: boolean; comment_count: number } | undefined;
  onToggleLike: () => void;
  onRefreshSocial: () => void;
}) {
  // Feed uses the thumbnail (≈30 KB). Full image is loaded on tap.
  const [thumbUrl, setThumbUrl] = useState<string | null>(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  useEffect(() => {
    const path = row.proof_thumb_url || row.proof_url;
    if (!path) return;
    let alive = true;
    getSignedProofUrl(path).then(u => { if (alive) setThumbUrl(u); });
    return () => { alive = false; };
  }, [row.proof_thumb_url, row.proof_url]);
  const name = row.profile.display_name || row.profile.username || 'Member';
  const when = relativeTime(row.created_at);
  const liked = social?.i_liked ?? false;
  const likeCount = social?.like_count ?? 0;
  const commentCount = social?.comment_count ?? 0;
  return (
    <View style={{
      borderRadius: 18, overflow: 'hidden',
      backgroundColor: 'rgba(255,255,255,0.025)',
      borderColor: C.borderSubtle, borderWidth: 1,
    }}>
      {/* Header — real avatar image or initial fallback */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12 }}>
        <ProofAvatar url={row.profile.avatar_url} name={name} size={34} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: F.sansBold, fontSize: 13, color: C.textPrimary }}>
            {name} <Text style={{ fontFamily: F.sans, fontWeight: '400', color: C.textMuted }}>
              {row.proof_url ? 'uploaded proof' : 'checked in'}
            </Text>
          </Text>
          <Text style={{ fontFamily: F.mono, fontSize: 10, color: C.textFaint, marginTop: 1 }}>{when}</Text>
        </View>
      </View>
      {row.proof_url && (
        <Pressable onPress={() => setLightboxOpen(true)}
          style={{ aspectRatio: 1, width: '100%', backgroundColor: C.bgOverlay }}>
          {thumbUrl ? (
            <Image source={{ uri: thumbUrl }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
          ) : (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <ActivityIndicator color={C.gold} />
            </View>
          )}
        </Pressable>
      )}
      <ProofLightbox
        visible={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
        fullPath={row.proof_url}
      />
      {row.note && (
        <Text style={{
          fontFamily: F.sans, fontSize: 12.5, color: C.textSecondary,
          padding: 12, lineHeight: 17,
        }}>
          {row.note}
        </Text>
      )}
      {/* Like + Comment row */}
      <View style={{
        flexDirection: 'row', alignItems: 'center', gap: 16,
        paddingVertical: 10, paddingHorizontal: 14,
        borderTopColor: C.borderSubtle, borderTopWidth: 1,
      }}>
        <Pressable onPress={onToggleLike} hitSlop={8}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Heart
            size={16}
            color={liked ? C.gold : C.textMuted}
            fill={liked ? C.gold : 'transparent'}
            strokeWidth={1.8}
          />
          <Text style={{
            fontFamily: F.sansBold, fontSize: 11,
            color: liked ? C.gold : C.textMuted, letterSpacing: 0.4,
          }}>
            {likeCount > 0 ? likeCount : ''}
          </Text>
        </Pressable>
        <Pressable onPress={() => setCommentsOpen(o => !o)} hitSlop={8}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <MessageCircle size={16} color={commentsOpen ? C.gold : C.textMuted} strokeWidth={1.8} />
          <Text style={{
            fontFamily: F.sansBold, fontSize: 11,
            color: commentsOpen ? C.gold : C.textMuted, letterSpacing: 0.4,
          }}>
            {commentCount > 0 ? commentCount : 'Comment'}
          </Text>
        </Pressable>
      </View>
      {commentsOpen && (
        <CommentsBlock
          checkinId={row.id}
          onChanged={onRefreshSocial}
        />
      )}
    </View>
  );
}

function ProofPicker({
  visible, onClose, onCamera, onLibrary,
}: { visible: boolean; onClose: () => void; onCamera: () => void; onLibrary: () => void }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      {/* Pure View backdrop — Pressable backdrop was eating row taps. */}
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }}>
        <Pressable
          onPress={onClose}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        />
        <View style={{
          backgroundColor: C.bgBase, borderTopLeftRadius: 22, borderTopRightRadius: 22,
          paddingTop: 16, paddingBottom: 36, paddingHorizontal: 16,
          borderColor: C.borderSubtle, borderWidth: 1,
        }}>
          <View style={{ alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: C.borderSubtle, marginBottom: 14 }} />
          <SheetRow Icon={ImageIcon} label="Choose from gallery"
            onPress={() => { console.log('[proof] gallery row tapped (detail)'); onLibrary(); }} />
          <SheetRow Icon={Camera} label="Take photo"
            onPress={() => { console.log('[proof] camera row tapped (detail)'); onCamera(); }} />
        </View>
      </View>
    </Modal>
  );
}

function SheetRow({
  Icon, label, onPress,
}: { Icon: typeof Camera; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} hitSlop={4} style={{
      flexDirection: 'row', alignItems: 'center', gap: 12,
      paddingVertical: 14, paddingHorizontal: 6,
      borderTopColor: C.borderSubtle, borderTopWidth: 1,
    }}>
      <Icon size={16} color={C.textPrimary} />
      <Text style={{ fontFamily: F.sansBold, fontSize: 13.5, color: C.textPrimary, letterSpacing: 0.3 }}>{label}</Text>
    </Pressable>
  );
}

// ─── Proof lightbox — full-screen full-image preview ────────────────────
function ProofLightbox({
  visible, onClose, fullPath,
}: { visible: boolean; onClose: () => void; fullPath: string | null }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!visible || !fullPath) { setUrl(null); return; }
    let alive = true;
    getSignedProofUrl(fullPath).then(u => { if (alive) setUrl(u); });
    return () => { alive = false; };
  }, [visible, fullPath]);
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.94)' }}>
        <SafeAreaView edges={['top']} style={{
          flexDirection: 'row', justifyContent: 'flex-end', padding: 14,
        }}>
          <Pressable onPress={onClose} hitSlop={10} style={{
            width: 40, height: 40, borderRadius: 20,
            backgroundColor: 'rgba(13,12,11,0.55)',
            borderColor: 'rgba(244,240,232,0.18)', borderWidth: 1,
            alignItems: 'center', justifyContent: 'center',
          }}>
            <X size={20} color="#F4F0E8" />
          </Pressable>
        </SafeAreaView>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 12 }}>
          {url ? (
            <Image source={{ uri: url }}
              style={{ width: '100%', height: '85%' }}
              resizeMode="contain" />
          ) : (
            <ActivityIndicator color="#F4F0E8" />
          )}
        </View>
      </View>
    </Modal>
  );
}

// ─── Proof avatar — real image or initial fallback ──────────────────────
function ProofAvatar({ url, name, size = 34 }: { url: string | null; name: string; size?: number }) {
  if (url) {
    return (
      <Image source={{ uri: url }}
        style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: C.bgOverlay }} />
    );
  }
  return <Avatar size={size} label={(name[0] || '?').toUpperCase()} tone="neutral" />;
}

// ─── Comments inline block for one proof ─────────────────────────────────
function CommentsBlock({ checkinId, onChanged }: { checkinId: string; onChanged: () => void }) {
  const { comments, refresh } = useCheckinComments(checkinId);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!draft.trim()) return;
    setBusy(true);
    try {
      await addCheckinComment(checkinId, draft);
      setDraft('');
      refresh();
      onChanged();
    } catch (e: any) {
      Alert.alert('Could not post comment', e?.message || 'Unknown error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{
      paddingHorizontal: 14, paddingBottom: 12, paddingTop: 4,
      borderTopColor: C.borderSubtle, borderTopWidth: 1,
    }}>
      {comments.length === 0 ? (
        <Text style={{ fontFamily: F.serifItalic, fontSize: 12, color: C.textFaint, paddingVertical: 10 }}>
          No comments yet. Be the first to react.
        </Text>
      ) : (
        comments.map(c => {
          const cname = c.profile.display_name || c.profile.username || 'Member';
          return (
            <View key={c.id} style={{ flexDirection: 'row', gap: 8, paddingVertical: 8 }}>
              <ProofAvatar url={c.profile.avatar_url} name={cname} size={26} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: F.sansBold, fontSize: 12, color: C.textPrimary }}>
                  {cname}{' '}
                  <Text style={{ fontFamily: F.mono, fontSize: 9.5, color: C.textFaint }}>
                    {relativeTime(c.created_at)}
                  </Text>
                </Text>
                <Text style={{ fontFamily: F.sans, fontSize: 12.5, color: C.textSecondary, marginTop: 2, lineHeight: 17 }}>
                  {c.body}
                </Text>
              </View>
            </View>
          );
        })
      )}
      {/* Composer */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 }}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder="Add a comment…"
          placeholderTextColor={C.textFaint}
          editable={!busy}
          style={{
            flex: 1, height: 38, paddingHorizontal: 12, borderRadius: 19,
            backgroundColor: C.bgOverlay, borderColor: C.borderSubtle, borderWidth: 1,
            fontFamily: F.sans, fontSize: 13, color: C.textPrimary,
          }}
        />
        <Pressable onPress={submit} disabled={!draft.trim() || busy} hitSlop={6}
          style={{
            width: 38, height: 38, borderRadius: 19,
            backgroundColor: draft.trim() && !busy ? C.gold : 'rgba(201,169,97,0.18)',
            alignItems: 'center', justifyContent: 'center',
          }}>
          {busy ? <ActivityIndicator color={C.bgBase} /> : (
            <Send size={14} color={draft.trim() ? C.bgBase : C.textFaint} strokeWidth={2.4} />
          )}
        </Pressable>
      </View>
    </View>
  );
}

// ─── Challenge messages section ──────────────────────────────────────────
function MessagesSection({ challengeId }: { challengeId: string }) {
  const { messages, refresh } = useChallengeMessages(challengeId);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!draft.trim()) return;
    setBusy(true);
    try {
      await sendChallengeMessage(challengeId, draft);
      setDraft('');
      refresh();
    } catch (e: any) {
      Alert.alert('Could not send', e?.message || 'Unknown error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ paddingHorizontal: 16, marginTop: 18 }}>
      <SectionLabel style={{ marginLeft: 4, marginBottom: 8 }}>challenge messages</SectionLabel>
      <View style={{
        borderRadius: 18, overflow: 'hidden',
        backgroundColor: 'rgba(255,255,255,0.025)',
        borderColor: C.borderSubtle, borderWidth: 1,
      }}>
        {messages.length === 0 ? (
          <View style={{ paddingVertical: 22, paddingHorizontal: 18, alignItems: 'center' }}>
            <Text style={{ fontFamily: F.serifItalic, fontSize: 13, color: C.textSecondary, textAlign: 'center' }}>
              No messages yet.
            </Text>
            <Text style={{ fontFamily: F.sans, fontSize: 11, color: C.textMuted, marginTop: 4, textAlign: 'center' }}>
              Private to this challenge.
            </Text>
          </View>
        ) : (
          <View style={{ paddingVertical: 6 }}>
            {messages.map((m, i) => {
              const mname = m.profile.display_name || m.profile.username || 'Member';
              return (
                <View key={m.id} style={{ flexDirection: 'row', gap: 10, paddingVertical: 8, paddingHorizontal: 14 }}>
                  <ProofAvatar url={m.profile.avatar_url} name={mname} size={28} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: F.sansBold, fontSize: 12.5, color: C.textPrimary }}>
                      {mname}{' '}
                      <Text style={{ fontFamily: F.mono, fontSize: 10, color: C.textFaint }}>
                        {relativeTime(m.created_at)}
                      </Text>
                    </Text>
                    <Text style={{ fontFamily: F.sans, fontSize: 13, color: C.textSecondary, marginTop: 2, lineHeight: 18 }}>
                      {m.body}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}
        {/* Composer */}
        <View style={{
          flexDirection: 'row', alignItems: 'center', gap: 8,
          padding: 10, borderTopColor: C.borderSubtle, borderTopWidth: 1,
        }}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="Send a message…"
            placeholderTextColor={C.textFaint}
            editable={!busy}
            style={{
              flex: 1, height: 38, paddingHorizontal: 12, borderRadius: 19,
              backgroundColor: C.bgOverlay, borderColor: C.borderSubtle, borderWidth: 1,
              fontFamily: F.sans, fontSize: 13, color: C.textPrimary,
            }}
          />
          <Pressable onPress={submit} disabled={!draft.trim() || busy} hitSlop={6}
            style={{
              width: 38, height: 38, borderRadius: 19,
              backgroundColor: draft.trim() && !busy ? C.gold : 'rgba(201,169,97,0.18)',
              alignItems: 'center', justifyContent: 'center',
            }}>
            {busy ? <ActivityIndicator color={C.bgBase} /> : (
              <Send size={14} color={draft.trim() ? C.bgBase : C.textFaint} strokeWidth={2.4} />
            )}
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function relativeTime(iso: string): string {
  const diff = Math.max(0, Date.now() - new Date(iso).getTime());
  const mins = Math.floor(diff / 60000);
  if (mins < 1)  return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7)  return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}
