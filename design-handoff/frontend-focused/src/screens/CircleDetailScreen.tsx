import React, { useState } from 'react';
import {
  View, Text, ScrollView, Pressable, Share, Alert, ActivityIndicator,
  Image, Modal, TextInput, KeyboardAvoidingView, Platform,
} from 'react-native';
import {
  useCircleChallenges, useCircleActivity, createChallenge, todayISO, isoDaysFromToday,
  daysLeft, challengeTypeLabel, challengeTypePrompt, challengeTypeTheme, challengeTitlePlaceholder,
  type ChallengeType, type ChallengeListItem,
} from '../lib/challenges';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect } from '@react-navigation/native';
import {
  ArrowLeft, Lock, Copy, Share2, LogOut, Trophy, Plus, ShieldCheck, Users,
  MoreVertical, Edit3, Trash2, UserPlus, Camera, X,
  Dumbbell, Utensils, BookOpen, Sparkles,
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Avatar, SectionLabel, Tx } from '../components/primitives';
import { VYBGlowCard } from '../components/ui/VYBGlowCard';
import { colors as C, fonts as F, gradients as G } from '../theme';
import { ScreenAtmosphere } from '../components/ScreenAtmosphere';
import {
  useCircleDetail, leaveCircle, updateCircle, deleteCircle, uploadCircleImage,
  type CircleMember, type CirclePurpose,
} from '../lib/circles';
import { useAuth } from '../lib/auth';

/**
 * CircleDetailScreen — overview of a private circle.
 *
 * Shows a group photo, metadata, members and challenge placeholders. The
 * invite code lives behind an "Invite members" sheet so it doesn't dominate
 * the screen. Owners get Edit / Invite / Delete; members get Leave.
 */
export function CircleDetailScreen({ route, navigation }: any) {
  const circleId: string = route?.params?.circleId;
  const { session } = useAuth();
  const { circle, members, loading, refresh } = useCircleDetail(circleId);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [createChallengeOpen, setCreateChallengeOpen] = useState(false);
  const { challenges, refresh: refreshChallenges } = useCircleChallenges(circleId);
  const { items: activityItems, refresh: refreshActivity } = useCircleActivity(circleId);

  useFocusEffect(React.useCallback(() => {
    refresh(); refreshChallenges(); refreshActivity();
  }, [refresh, refreshChallenges, refreshActivity]));

  const isOwner = !!(circle && session && circle.owner_id === session.user.id);

  const onCopy = async () => {
    if (!circle) return;
    await Clipboard.setStringAsync(circle.invite_code);
    Alert.alert('Invite code copied.');
  };
  const onShare = async () => {
    if (!circle) return;
    await Share.share({
      message: `Join my private VYB circle.\nCircle: ${circle.name}\nInvite code: ${circle.invite_code}`,
    });
  };
  const onLeave = () => {
    if (!circle) return;
    Alert.alert('Leave circle?', `You'll no longer see ${circle.name} activity.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Leave', style: 'destructive', onPress: async () => {
          const r = await leaveCircle(circle.id);
          if (!r.ok) { Alert.alert('Could not leave', r.message); return; }
          navigation.goBack();
        },
      },
    ]);
  };
  const onDelete = () => {
    if (!circle) return;
    Alert.alert(
      'Delete circle?',
      `This will delete ${circle.name} for all members. This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive', onPress: async () => {
            try {
              await deleteCircle(circle.id);
              navigation.goBack();
            } catch (e: any) {
              Alert.alert('Could not delete', e.message || 'Unknown error');
            }
          },
        },
      ],
    );
  };
  const onPickImage = async () => {
    if (!circle || !isOwner) return;
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert('Photo access is required.'); return; }
    const r = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85, allowsEditing: true, aspect: [16, 9],
    });
    if (r.canceled || !r.assets[0]) return;
    try {
      const url = await uploadCircleImage(r.assets[0].uri, circle.id);
      await updateCircle(circle.id, { image_url: url });
      refresh();
    } catch (e: any) {
      Alert.alert('Could not upload', e.message || 'Unknown error');
    }
  };
  const onCreateChallenge = () => setCreateChallengeOpen(true);
  const goToChallenge = (ch: ChallengeListItem) =>
    navigation.navigate(ch.i_am_joined ? 'ChallengeDetail' : 'ChallengePreview', { challengeId: ch.id });

  if (loading || !circle) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bgBase }} edges={['top']}>
        <ScreenAtmosphere />
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10 }}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={8} style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}>
            <ArrowLeft size={20} color={C.textSecondary} />
          </Pressable>
        </View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={C.gold} />
        </View>
      </SafeAreaView>
    );
  }

  const purposeLabel =
    circle.purpose === 'workout'   ? 'Workout' :
    circle.purpose === 'reading'   ? 'Reading' :
    circle.purpose === 'hydration' ? 'Hydration' :
    circle.purpose === 'general'   ? 'General accountability' :
    circle.purpose === 'custom'    ? 'Custom' : null;

  const COVER_H = 220;
  const MEMBERS_MAX_H = 244;       // ≈ 4 rows visible, scrolls past that
  const showsMemberScroll = members.length > 4;

  return (
    <View style={{ flex: 1, backgroundColor: C.bgBase }}>
      <ScreenAtmosphere />

      <ScrollView contentContainerStyle={{ paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
        {/* Cover — full-bleed Profile-style header */}
        <Pressable onPress={isOwner ? onPickImage : undefined} disabled={!isOwner}
          style={{ height: COVER_H, backgroundColor: C.bgElevated }}>
          {circle.image_url ? (
            <Image source={{ uri: circle.image_url }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
          ) : (
            <LinearGradient colors={G.dusk as any} style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <CirclePlaceholder name={circle.name} />
            </LinearGradient>
          )}
          {/* Bottom fade into bgBase */}
          <LinearGradient
            colors={['rgba(13,12,11,0)', 'rgba(13,12,11,0.55)', C.bgBase] as any}
            locations={[0, 0.55, 1]}
            style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 130 }}
            pointerEvents="none"
          />
          {/* Owner-only edit cover affordance */}
          {isOwner && (
            <View pointerEvents="none" style={{
              position: 'absolute', right: 14, bottom: 14,
              width: 32, height: 32, borderRadius: 16,
              backgroundColor: 'rgba(13,12,11,0.62)',
              borderColor: 'rgba(244,240,232,0.18)', borderWidth: 1,
              alignItems: 'center', justifyContent: 'center',
            }}>
              <Camera size={14} color="#F4F0E8" />
            </View>
          )}

          {/* Floating top bar in safe area */}
          <SafeAreaView edges={['top']} style={{
            position: 'absolute', top: 0, left: 0, right: 0,
            flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
            paddingHorizontal: 14,
          }}>
            <HeaderIconButton onPress={() => navigation.goBack()}>
              <ArrowLeft size={18} color="#F4F0E8" />
            </HeaderIconButton>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <HeaderIconButton onPress={() => setInviteOpen(true)}>
                <UserPlus size={16} color="#F4F0E8" />
              </HeaderIconButton>
              <HeaderIconButton onPress={() => setActionsOpen(true)}>
                <MoreVertical size={18} color="#F4F0E8" />
              </HeaderIconButton>
            </View>
          </SafeAreaView>
        </Pressable>

        {/* Identity block — name + subtitle below the cover */}
        <View style={{ paddingHorizontal: 22, marginTop: -8 }}>
          <Text style={[Tx.editorial(), { fontSize: 30 }]}>{circle.name}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
            {purposeLabel && (
              <Text style={{ fontFamily: F.sansBold, fontSize: 11, color: C.textSecondary, letterSpacing: 0.8, textTransform: 'uppercase' }}>
                {purposeLabel}
              </Text>
            )}
            <Text style={{ fontFamily: F.sans, fontSize: 11, color: C.textFaint }}>·</Text>
            <Lock size={10} color={C.textFaint} />
            <Text style={{ fontFamily: F.sansBold, fontSize: 11, color: C.textFaint, letterSpacing: 0.8, textTransform: 'uppercase' }}>
              Private
            </Text>
          </View>
          {circle.description && (
            <Text style={{ fontFamily: F.sans, fontSize: 13, color: C.textSecondary, marginTop: 10, lineHeight: 19 }}>
              {circle.description}
            </Text>
          )}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 }}>
            <Users size={12} color={C.textMuted} />
            <Text style={{ fontFamily: F.sans, fontSize: 11.5, color: C.textMuted }}>
              {members.length} {members.length === 1 ? 'member' : 'members'}
            </Text>
          </View>
        </View>

        {/* Members — adaptive: scrolls inside the card when 5+ */}
        <View style={{ paddingHorizontal: 16, marginTop: 22 }}>
          <SectionLabel style={{ marginLeft: 4, marginBottom: 8 }}>members</SectionLabel>
          <View style={{
            borderRadius: 14, overflow: 'hidden',
            backgroundColor: 'rgba(255,255,255,0.025)',
            borderColor: C.borderSubtle, borderWidth: 1,
          }}>
            {showsMemberScroll ? (
              <ScrollView nestedScrollEnabled showsVerticalScrollIndicator={false}
                style={{ maxHeight: MEMBERS_MAX_H }}>
                {members.map((m, i) => <MemberRow key={m.id} member={m} divider={i > 0} />)}
              </ScrollView>
            ) : (
              members.map((m, i) => <MemberRow key={m.id} member={m} divider={i > 0} />)
            )}
          </View>
        </View>

        {/* Active challenges */}
        <View style={{ paddingHorizontal: 16, marginTop: 18 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <SectionLabel style={{ marginLeft: 4 }}>active challenges</SectionLabel>
            {challenges.length > 0 && (
              <Pressable onPress={onCreateChallenge} hitSlop={6}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Plus size={12} color={C.gold} />
                <Text style={{ fontFamily: F.sansBold, fontSize: 10, color: C.gold, letterSpacing: 0.5, textTransform: 'uppercase' }}>
                  New
                </Text>
              </Pressable>
            )}
          </View>

          {challenges.length === 0 ? (
            <View style={{
              paddingVertical: 22, paddingHorizontal: 18, borderRadius: 14,
              backgroundColor: 'rgba(255,255,255,0.025)',
              borderColor: C.borderSubtle, borderWidth: 1,
              alignItems: 'center',
            }}>
              <Trophy size={18} color={C.textFaint} />
              <Text style={{ fontFamily: F.serifItalic, fontSize: 14, color: C.textSecondary, marginTop: 8, textAlign: 'center' }}>
                No challenges yet.
              </Text>
              <Text style={{ fontFamily: F.sans, fontSize: 12, color: C.textMuted, marginTop: 4, textAlign: 'center' }}>
                Create a challenge for this circle.
              </Text>
              <Pressable onPress={onCreateChallenge} hitSlop={4} style={{
                marginTop: 12, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999,
                flexDirection: 'row', alignItems: 'center', gap: 6,
                backgroundColor: C.goldFaint, borderColor: 'rgba(201,169,97,0.4)', borderWidth: 1,
              }}>
                <Plus size={12} color={C.gold} />
                <Text style={{ fontFamily: F.sansBold, fontSize: 11, color: C.gold, letterSpacing: 0.4 }}>
                  Create challenge
                </Text>
              </Pressable>
            </View>
          ) : (
            <View style={{ gap: 10 }}>
              {challenges.map(ch => (
                <ChallengeRow key={ch.id} challenge={ch} onPress={() => goToChallenge(ch)} />
              ))}
            </View>
          )}
        </View>

        {/* Recent activity — text-only timeline of challenge events. */}
        <View style={{ paddingHorizontal: 16, marginTop: 18 }}>
          <SectionLabel style={{ marginLeft: 4, marginBottom: 8 }}>recent activity</SectionLabel>
          {activityItems.length === 0 ? (
            <View style={{
              paddingVertical: 18, paddingHorizontal: 18, borderRadius: 14,
              backgroundColor: 'rgba(255,255,255,0.025)',
              borderColor: C.borderSubtle, borderWidth: 1,
              alignItems: 'center',
            }}>
              <Text style={{ fontFamily: F.serifItalic, fontSize: 13, color: C.textSecondary, textAlign: 'center' }}>
                Activity will appear when members check in.
              </Text>
            </View>
          ) : (
            <View style={{
              borderRadius: 14, overflow: 'hidden',
              backgroundColor: 'rgba(255,255,255,0.025)',
              borderColor: C.borderSubtle, borderWidth: 1,
            }}>
              {activityItems.map((a, i) => (
                <View key={a.id} style={{
                  paddingVertical: 11, paddingHorizontal: 14,
                  borderTopColor: C.borderSubtle, borderTopWidth: i === 0 ? 0 : 1,
                }}>
                  <Text style={{ fontFamily: F.sans, fontSize: 12.5, color: C.textPrimary, lineHeight: 17 }}>
                    {a.text}
                  </Text>
                  <Text style={{ fontFamily: F.mono, fontSize: 9.5, color: C.textFaint, marginTop: 2 }}>
                    {relativeTimeShort(a.ts)}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Privacy note */}
        <View style={{ paddingHorizontal: 16, marginTop: 14 }}>
          <View style={{
            flexDirection: 'row', alignItems: 'flex-start', gap: 10,
            paddingVertical: 12, paddingHorizontal: 14, borderRadius: 14,
            backgroundColor: 'rgba(255,255,255,0.025)',
            borderColor: C.borderSubtle, borderWidth: 1,
          }}>
            <ShieldCheck size={14} color={C.textMuted} style={{ marginTop: 1 }} />
            <Text style={{ flex: 1, fontFamily: F.sans, fontSize: 11.5, color: C.textMuted, lineHeight: 16 }}>
              This circle is private. Only members can see shared challenge activity.
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Invite Members sheet */}
      <InviteSheet
        visible={inviteOpen}
        onClose={() => setInviteOpen(false)}
        code={circle.invite_code}
        onCopy={onCopy}
        onShare={onShare}
      />

      {/* Owner / member action sheet */}
      <ActionsSheet
        visible={actionsOpen}
        onClose={() => setActionsOpen(false)}
        isOwner={isOwner}
        onEdit={() => { setActionsOpen(false); setEditOpen(true); }}
        onInvite={() => { setActionsOpen(false); setInviteOpen(true); }}
        onDelete={() => { setActionsOpen(false); onDelete(); }}
        onLeave={() => { setActionsOpen(false); onLeave(); }}
      />

      {/* Create challenge modal */}
      <CreateChallengeModal
        visible={createChallengeOpen}
        onClose={() => setCreateChallengeOpen(false)}
        circleId={circle.id}
        onCreated={(challengeId) => {
          setCreateChallengeOpen(false);
          refreshChallenges();
          // Creator is auto-joined, so go straight to Detail.
          navigation.navigate('ChallengeDetail', { challengeId });
        }}
      />

      {/* Edit circle modal (owner) */}
      <EditCircleModal
        visible={editOpen}
        onClose={() => setEditOpen(false)}
        circleId={circle.id}
        initialName={circle.name}
        initialDescription={circle.description || ''}
        initialPurpose={circle.purpose}
        onSaved={() => { setEditOpen(false); refresh(); }}
      />
    </View>
  );
}

function HeaderIconButton({ onPress, children }: { onPress: () => void; children: React.ReactNode }) {
  return (
    <Pressable onPress={onPress} hitSlop={8} style={{
      width: 36, height: 36, borderRadius: 18,
      backgroundColor: 'rgba(13,12,11,0.55)',
      borderColor: 'rgba(244,240,232,0.18)', borderWidth: 1,
      alignItems: 'center', justifyContent: 'center',
    }}>
      {children}
    </Pressable>
  );
}

function CirclePlaceholder({ name }: { name: string }) {
  const initials = (name.match(/\b\w/g) || []).slice(0, 2).join('').toUpperCase() || 'C';
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{
        fontFamily: F.sansHeavy, fontSize: 80, color: 'rgba(244,240,232,0.85)',
        letterSpacing: -1,
      }}>
        {initials}
      </Text>
    </View>
  );
}

function MemberRow({ member, divider }: { member: CircleMember; divider: boolean }) {
  const name = member.profile.display_name || member.profile.username || 'Member';
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center', gap: 12,
      paddingHorizontal: 14, paddingVertical: 12,
      borderTopColor: C.borderSubtle, borderTopWidth: divider ? 1 : 0,
    }}>
      <Avatar size={36} label={(name[0] || '?').toUpperCase()} tone={member.role === 'owner' ? 'gold' : 'neutral'} />
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={{ fontFamily: F.sansBold, fontSize: 13.5, color: C.textPrimary }}>{name}</Text>
          {member.profile.username && (
            <Text style={{ fontFamily: F.mono, fontSize: 10, color: C.textFaint }}>@{member.profile.username}</Text>
          )}
        </View>
        {member.role === 'owner' && (
          <Text style={{ fontFamily: F.sansBold, fontSize: 10, color: C.gold, marginTop: 2, letterSpacing: 0.6, textTransform: 'uppercase' }}>
            Owner
          </Text>
        )}
      </View>
    </View>
  );
}

// ─── Invite sheet ────────────────────────────────────────────────────────

function InviteSheet({
  visible, onClose, code, onCopy, onShare,
}: {
  visible: boolean; onClose: () => void;
  code: string; onCopy: () => void; onShare: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', padding: 22 }}>
        <View style={{
          backgroundColor: C.bgBase, borderRadius: 18, padding: 22,
          borderColor: C.borderSubtle, borderWidth: 1,
        }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={Tx.label({ letterSpacing: 1.6 })}>INVITE MEMBERS</Text>
            <Pressable onPress={onClose} hitSlop={6}><X size={16} color={C.textMuted} /></Pressable>
          </View>
          <Text style={{ fontFamily: F.sans, fontSize: 12, color: C.textMuted, marginTop: 8, lineHeight: 17 }}>
            Share this code with people you trust. Only invited members can see this circle.
          </Text>
          <Text style={{ fontFamily: F.sansHeavy, fontSize: 26, color: C.textPrimary, marginTop: 14, letterSpacing: 1.6, textAlign: 'center' }}>
            {code}
          </Text>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
            <Pressable onPress={onShare} hitSlop={4} style={{
              flex: 1, height: 42, borderRadius: 10, flexDirection: 'row',
              gap: 6, alignItems: 'center', justifyContent: 'center',
              backgroundColor: C.goldFaint,
              borderColor: 'rgba(201,169,97,0.4)', borderWidth: 1,
            }}>
              <Share2 size={13} color={C.gold} />
              <Text style={{ fontFamily: F.sansBold, fontSize: 12, color: C.gold, letterSpacing: 0.4 }}>
                Share invite
              </Text>
            </Pressable>
            <Pressable onPress={onCopy} hitSlop={4} style={{
              flex: 1, height: 42, borderRadius: 10, flexDirection: 'row',
              gap: 6, alignItems: 'center', justifyContent: 'center',
              backgroundColor: 'rgba(255,255,255,0.03)',
              borderColor: C.borderSubtle, borderWidth: 1,
            }}>
              <Copy size={13} color={C.textSecondary} />
              <Text style={{ fontFamily: F.sansBold, fontSize: 12, color: C.textSecondary, letterSpacing: 0.4 }}>
                Copy code
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── Actions sheet ───────────────────────────────────────────────────────

function ActionsSheet({
  visible, onClose, isOwner, onEdit, onInvite, onDelete, onLeave,
}: {
  visible: boolean; onClose: () => void; isOwner: boolean;
  onEdit: () => void; onInvite: () => void;
  onDelete: () => void; onLeave: () => void;
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
          <SheetRow Icon={UserPlus} label="Invite members" onPress={onInvite} />
          {isOwner && <SheetRow Icon={Edit3} label="Edit circle" onPress={onEdit} />}
          {isOwner ? (
            <SheetRow Icon={Trash2} label="Delete circle" onPress={onDelete} destructive />
          ) : (
            <SheetRow Icon={LogOut} label="Leave circle" onPress={onLeave} destructive />
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function SheetRow({
  Icon, label, onPress, destructive = false,
}: { Icon: typeof Edit3; label: string; onPress: () => void; destructive?: boolean }) {
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

// ─── Edit circle modal ───────────────────────────────────────────────────

const PURPOSES: { key: Exclude<CirclePurpose, null>; label: string }[] = [
  { key: 'workout', label: 'Workout' },
  { key: 'reading', label: 'Reading' },
  { key: 'hydration', label: 'Hydration' },
  { key: 'general', label: 'General accountability' },
  { key: 'custom', label: 'Custom' },
];

function EditCircleModal({
  visible, onClose, circleId,
  initialName, initialDescription, initialPurpose, onSaved,
}: {
  visible: boolean; onClose: () => void; circleId: string;
  initialName: string; initialDescription: string; initialPurpose: CirclePurpose;
  onSaved: () => void;
}) {
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription);
  const [purpose, setPurpose] = useState<CirclePurpose>(initialPurpose);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  React.useEffect(() => {
    if (visible) {
      setName(initialName);
      setDescription(initialDescription);
      setPurpose(initialPurpose);
      setError(null);
    }
  }, [visible, initialName, initialDescription, initialPurpose]);

  const submit = async () => {
    if (!name.trim()) { setError('Circle name is required.'); return; }
    setBusy(true); setError(null);
    try {
      await updateCircle(circleId, {
        name: name.trim(),
        description: description.trim() ? description.trim() : null,
        purpose,
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
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', padding: 22 }}>
        <View style={{
          backgroundColor: C.bgBase, borderRadius: 18, padding: 20,
          borderColor: C.borderSubtle, borderWidth: 1,
        }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={Tx.label({ letterSpacing: 1.6 })}>EDIT CIRCLE</Text>
            <Pressable onPress={onClose} hitSlop={6}><X size={16} color={C.textMuted} /></Pressable>
          </View>

          <TextInput
            value={name} onChangeText={setName}
            placeholder="Circle name"
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
            Purpose
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
            {PURPOSES.map(opt => {
              const active = purpose === opt.key;
              return (
                <Pressable key={opt.key} onPress={() => setPurpose(active ? null : opt.key)} hitSlop={2} style={{
                  paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999,
                  backgroundColor: active ? C.goldFaint : 'transparent',
                  borderColor: active ? 'rgba(201,169,97,0.4)' : C.borderSubtle, borderWidth: 1,
                }}>
                  <Text style={{
                    fontFamily: F.sansBold, fontSize: 10.5,
                    color: active ? C.gold : C.textMuted, letterSpacing: 0.4,
                  }}>
                    {opt.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {error && (
            <Text style={{ fontFamily: F.sans, fontSize: 12, color: '#D27050', marginTop: 10 }}>
              {error}
            </Text>
          )}

          <Pressable onPress={submit} disabled={busy || !name.trim()} style={{
            marginTop: 16, height: 44, borderRadius: 12,
            backgroundColor: C.goldFaint, borderColor: 'rgba(201,169,97,0.4)', borderWidth: 1,
            alignItems: 'center', justifyContent: 'center',
            opacity: (busy || !name.trim()) ? 0.5 : 1,
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
    </Modal>
  );
}

// ─── Challenge row + Create challenge modal ──────────────────────────────

function ChallengeRow({ challenge, onPress }: { challenge: ChallengeListItem; onPress: () => void }) {
  const days = daysLeft(challenge.end_date);
  const endsLabel = days === 0 ? 'Ends today' : days === 1 ? 'Ends tomorrow' : `Ends in ${days}d`;
  const theme = challengeTypeTheme(challenge.challenge_type);
  const Icon = challengeTypeIconFor(challenge.challenge_type);

  let badgeLabel: string; let badgeBg: string; let badgeColor: string; let badgeBorder: string;
  if (!challenge.i_am_joined) {
    badgeLabel = 'Join'; badgeBg = C.goldFaint; badgeColor = C.gold; badgeBorder = 'rgba(201,169,97,0.4)';
  } else if (challenge.i_checked_in_today) {
    badgeLabel = 'Checked in'; badgeBg = 'rgba(143,168,138,0.18)'; badgeColor = '#8FA88A'; badgeBorder = 'rgba(143,168,138,0.45)';
  } else {
    badgeLabel = 'Open'; badgeBg = 'rgba(255,255,255,0.04)'; badgeColor = C.textSecondary; badgeBorder = C.borderSubtle;
  }

  return (
    <Pressable onPress={onPress} hitSlop={2}>
      <View style={{
        borderRadius: 22, overflow: 'hidden',
        backgroundColor: C.bgElevated,
        borderColor: `${theme.accent}30`, borderWidth: 1,
        shadowColor: theme.accent, shadowOpacity: 0.10, shadowRadius: 16, shadowOffset: { width: 0, height: 6 },
      }}>
        {/* Premium gradient wash + accent glow */}
        <LinearGradient pointerEvents="none"
          colors={[`${theme.accent}22`, `${theme.accent}08`, 'rgba(0,0,0,0)']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}
        />
        {/* Top inner highlight */}
        <LinearGradient pointerEvents="none"
          colors={['rgba(255,255,255,0.10)', 'rgba(255,255,255,0)']}
          start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
          style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 22 }}
        />
        <View style={{ padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          {/* Large type badge — visual identity per challenge type */}
          <View style={{
            width: 54, height: 54, borderRadius: 16,
            backgroundColor: `${theme.accent}1A`,
            borderColor: `${theme.accent}55`, borderWidth: 1,
            alignItems: 'center', justifyContent: 'center',
            shadowColor: theme.accent, shadowOpacity: 0.25, shadowRadius: 10, shadowOffset: { width: 0, height: 3 },
          }}>
            <Icon size={24} color={theme.accent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text numberOfLines={1} style={{
              fontFamily: F.sansHeavy, fontSize: 16, color: C.textPrimary, letterSpacing: -0.2,
            }}>
              {challenge.title}
            </Text>
            <Text style={{
              fontFamily: F.sansBold, fontSize: 9.5, color: theme.accent,
              marginTop: 3, letterSpacing: 0.8, textTransform: 'uppercase',
            }}>
              {challengeTypeLabel(challenge.challenge_type)} · {endsLabel}
            </Text>
            <Text style={{ fontFamily: F.mono, fontSize: 10, color: C.textFaint, marginTop: 4 }}>
              {challenge.member_count} joined · {challenge.total_checkins} check-ins
            </Text>
          </View>
          <View style={{
            paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999,
            backgroundColor: badgeBg, borderColor: badgeBorder, borderWidth: 1,
          }}>
            <Text style={{ fontFamily: F.sansBold, fontSize: 10, color: badgeColor, letterSpacing: 0.5, textTransform: 'uppercase' }}>
              {badgeLabel}
            </Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

// Local helper — type → Lucide icon component (avoids passing through lib).
function challengeTypeIconFor(t: ChallengeType): typeof Trophy {
  switch (t) {
    case 'workout_photo':   return Dumbbell;
    case 'meal_photo':      return Utensils;
    case 'reading_checkin': return BookOpen;
    case 'custom_photo':    return Sparkles;
  }
}

const CHALLENGE_TYPES: { key: ChallengeType; label: string }[] = [
  { key: 'workout_photo',   label: 'Workout' },
  { key: 'meal_photo',      label: 'Meal' },
  { key: 'reading_checkin', label: 'Reading' },
  { key: 'custom_photo',    label: 'Custom' },
];

const DURATION_PRESETS: { days: number; label: string }[] = [
  { days: 7,  label: '7 days' },
  { days: 30, label: '30 days' },
  { days: 60, label: '60 days' },
  { days: 90, label: '90 days' },
];

function CreateChallengeModal({
  visible, onClose, circleId, onCreated,
}: {
  visible: boolean; onClose: () => void;
  circleId: string;
  onCreated: (challengeId: string) => void;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<ChallengeType>('workout_photo');
  const [duration, setDuration] = useState<number>(30);
  const [maxPerDay, setMaxPerDay] = useState<number>(1);
  const [rule, setRule] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  React.useEffect(() => {
    if (visible) {
      setTitle(''); setDescription(''); setType('workout_photo');
      setDuration(30); setMaxPerDay(1); setRule(''); setError(null);
    }
  }, [visible]);

  const submit = async () => {
    if (!title.trim()) { setError('Title is required.'); return; }
    setBusy(true); setError(null);
    try {
      const proofType = type === 'reading_checkin' ? 'checkin' : 'photo';
      const c = await createChallenge({
        circleId, title: title.trim(),
        description: description.trim() || undefined,
        type, startDate: todayISO(), endDate: isoDaysFromToday(duration),
        proofType, maxPerDay,
        rule: rule.trim() || undefined,
      });
      onCreated(c.id);
    } catch (e: any) {
      setError(e.message || 'Could not create challenge.');
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
          <ScrollView
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="none"
            contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingVertical: 20 }}
            showsVerticalScrollIndicator={false}
          >
            <View style={{
              backgroundColor: C.bgBase, borderRadius: 18, padding: 20,
              borderColor: C.borderSubtle, borderWidth: 1,
            }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={Tx.label({ letterSpacing: 1.6 })}>CREATE CHALLENGE</Text>
                <Pressable onPress={onClose} hitSlop={6}><X size={16} color={C.textMuted} /></Pressable>
              </View>

            <Text style={{ fontFamily: F.serifItalic, fontSize: 12.5, color: C.textSecondary, marginTop: 8, lineHeight: 17 }}>
              {challengeTypePrompt(type)}
            </Text>

            <TextInput
              value={title} onChangeText={setTitle}
              placeholder={challengeTitlePlaceholder(type)}
              placeholderTextColor={C.textFaint}
              style={{
                marginTop: 14, paddingHorizontal: 14, height: 44, borderRadius: 12,
                backgroundColor: C.bgOverlay, borderColor: C.borderSubtle, borderWidth: 1,
                fontFamily: F.sansBold, fontSize: 14, color: C.textPrimary,
              }}
            />
            <TextInput
              value={description} onChangeText={setDescription}
              placeholder={challengeTypePrompt(type)}
              placeholderTextColor={C.textFaint}
              multiline
              style={{
                marginTop: 10, paddingHorizontal: 14, paddingVertical: 10, minHeight: 56, borderRadius: 12,
                backgroundColor: C.bgOverlay, borderColor: C.borderSubtle, borderWidth: 1,
                fontFamily: F.sans, fontSize: 13, color: C.textPrimary,
              }}
            />

            <Text style={{ fontFamily: F.sansBold, fontSize: 10, color: C.textFaint, marginTop: 14, letterSpacing: 0.8, textTransform: 'uppercase' }}>
              Type
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
              {CHALLENGE_TYPES.map(opt => (
                <ChipButton key={opt.key} label={opt.label} active={type === opt.key} onPress={() => setType(opt.key)} />
              ))}
            </View>

            <Text style={{ fontFamily: F.sansBold, fontSize: 10, color: C.textFaint, marginTop: 14, letterSpacing: 0.8, textTransform: 'uppercase' }}>
              Duration
            </Text>
            <View style={{ flexDirection: 'row', gap: 6, marginTop: 8 }}>
              {DURATION_PRESETS.map(opt => (
                <ChipButton key={opt.days} label={opt.label} active={duration === opt.days} onPress={() => setDuration(opt.days)} />
              ))}
            </View>

            <Text style={{ fontFamily: F.sansBold, fontSize: 10, color: C.textFaint, marginTop: 14, letterSpacing: 0.8, textTransform: 'uppercase' }}>
              Max check-ins per day
            </Text>
            <View style={{ flexDirection: 'row', gap: 6, marginTop: 8 }}>
              {[1, 2, 3].map(n => (
                <ChipButton key={n} label={String(n)} active={maxPerDay === n} onPress={() => setMaxPerDay(n)} />
              ))}
            </View>

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
                    Create challenge
                  </Text>
                )}
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function ChipButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} hitSlop={2} style={{
      paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999,
      backgroundColor: active ? C.goldFaint : 'transparent',
      borderColor: active ? 'rgba(201,169,97,0.4)' : C.borderSubtle, borderWidth: 1,
    }}>
      <Text style={{
        fontFamily: F.sansBold, fontSize: 10.5,
        color: active ? C.gold : C.textMuted, letterSpacing: 0.4,
      }}>
        {label}
      </Text>
    </Pressable>
  );
}

function relativeTimeShort(iso: string): string {
  const d = Math.max(0, Date.now() - new Date(iso).getTime());
  const m = Math.floor(d / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}
