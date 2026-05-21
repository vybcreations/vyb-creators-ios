import React, { useState } from 'react';
import {
  View, Text, ScrollView, Pressable, Share, Alert, Modal, TextInput, ActivityIndicator, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import { useFocusEffect } from '@react-navigation/native';
import QRCode from 'react-native-qrcode-svg';
import {
  UserPlus, Copy, ScanLine, Lock, Users, Trophy,
  ChevronRight, Plus, ShieldCheck, Camera, CheckCircle2, X, Check,
} from 'lucide-react-native';
import { Avatar, SectionLabel, Tx } from '../components/primitives';
import { VYBGlowCard } from '../components/ui/VYBGlowCard';
import { colors as C, fonts as F } from '../theme';
import { ScreenAtmosphere } from '../components/ScreenAtmosphere';
import {
  useMyFriendCode, useFriendData,
  formatFriendCode, normalizeFriendCode, friendCodeDeepLink,
  sendFriendRequest, acceptFriendRequest, rejectFriendRequest,
  type IncomingRequest, type Friend,
} from '../lib/friends';
import {
  useCircles, createCircle, joinCircleByCode, normalizeCircleCode,
  type CirclePurpose, type CircleListItem,
} from '../lib/circles';
import {
  useMyActiveChallenges, useJoinableChallenges, pickAndUploadProof, submitCheckin,
  challengeTypeTheme,
  type ActiveChallengeCard, type JoinableChallengeCard,
} from '../lib/challenges';
import { useAuth } from '../lib/auth';
import { Image as ImageIcon } from 'lucide-react-native';
import { addAllDemoFriends, DEMO_CATALOG } from '../lib/demoFriends';
import { LinearGradient } from 'expo-linear-gradient';

/**
 * FriendsScreen — private accountability hub.
 *
 * Phase 1.5: friend codes / QR / requests are real and Supabase-backed.
 * Circles and Challenges remain visual placeholders for a later pass.
 */

type FriendTab = 'friends' | 'circles' | 'challenges';

export function FriendsScreen({ navigation }: any) {
  const [tab, setTab] = useState<FriendTab>('challenges');
  const { code } = useMyFriendCode();
  const { incoming, friends, refresh } = useFriendData();
  const [enterOpen, setEnterOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

  useFocusEffect(React.useCallback(() => { refresh(); }, [refresh]));

  const goToScanner = () => {
    setAddOpen(false);
    navigation.navigate('QRScanner', {
      onScanned: async (scanned: string) => {
        const r = await sendFriendRequest(scanned);
        Alert.alert(r.ok ? 'Friend request sent.' : 'Could not send request',
          r.ok ? `Sent to ${r.receiver.display_name || r.receiver.username || 'user'}.` : r.message);
        if (r.ok) refresh();
      },
    });
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bgBase }} edges={['top']}>
      <ScreenAtmosphere />

      <ScrollView contentContainerStyle={{ paddingBottom: 140 }} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={{
          paddingHorizontal: 22, paddingTop: 4, paddingBottom: 16,
          flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between',
        }}>
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text style={[Tx.editorial(), { fontSize: 32 }]}>Friends</Text>
            <Text style={{ fontFamily: F.serifItalic, fontSize: 13, color: C.textMuted, marginTop: 4 }}>
              Build accountability with people you trust.
            </Text>
          </View>
          <Pressable hitSlop={8} onPress={() => setAddOpen(true)} style={{
            width: 38, height: 38, borderRadius: 19,
            backgroundColor: C.goldFaint, borderColor: 'rgba(201,169,97,0.4)', borderWidth: 1,
            alignItems: 'center', justifyContent: 'center',
          }}>
            <UserPlus size={16} color={C.gold} />
          </Pressable>
        </View>

        {/* Privacy intro */}
        <View style={{ paddingHorizontal: 16 }}>
          <View style={{
            flexDirection: 'row', alignItems: 'flex-start', gap: 12,
            paddingVertical: 14, paddingHorizontal: 14, borderRadius: 14,
            backgroundColor: 'rgba(255,255,255,0.025)',
            borderColor: C.borderSubtle, borderWidth: 1,
          }}>
            <ShieldCheck size={18} color={C.textSecondary} style={{ marginTop: 2 }} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: F.sansBold, fontSize: 13, color: C.textPrimary, letterSpacing: 0.2 }}>
                Private by default.
              </Text>
              <Text style={{ fontFamily: F.sans, fontSize: 12, color: C.textMuted, marginTop: 4, lineHeight: 17 }}>
                Your habits stay private. You choose what to share inside each circle or challenge.
              </Text>
            </View>
          </View>
        </View>

        {/* Tabs */}
        <View style={{ paddingHorizontal: 22, marginTop: 14, marginBottom: 14 }}>
          <SegmentedTabs tab={tab} setTab={setTab} />
        </View>

        {tab === 'friends' && (
          <FriendsTab
            incoming={incoming}
            friends={friends}
            onAdd={() => setAddOpen(true)}
            onAddDemos={async () => {
              await addAllDemoFriends();
              refresh();
            }}
            onOpenFriend={(f) => navigation.navigate('FriendDetail', { friend: f })}
            onAccept={async (id) => { await acceptFriendRequest(id); refresh(); }}
            onReject={async (id) => { await rejectFriendRequest(id); refresh(); }}
          />
        )}
        {tab === 'circles'    && <CirclesTab navigation={navigation} />}
        {tab === 'challenges' && <ChallengesTab navigation={navigation} />}
      </ScrollView>

      <AddFriendSheet
        visible={addOpen}
        onClose={() => setAddOpen(false)}
        code={code}
        onShare={() => onShareCode(code)}
        onCopy={() => onCopyCode(code)}
        onEnter={() => { setAddOpen(false); setEnterOpen(true); }}
        onScan={goToScanner}
      />

      <EnterCodeModal
        visible={enterOpen}
        onClose={() => setEnterOpen(false)}
        onSuccess={() => { setEnterOpen(false); refresh(); }}
      />
    </SafeAreaView>
  );
}

async function onShareCode(code: string | null) {
  if (!code) return;
  const pretty = formatFriendCode(code);
  await Share.share({
    message: `Add me on VYB Life.\nFriend code: ${pretty}\n${friendCodeDeepLink(code)}`,
  });
}

async function onCopyCode(code: string | null) {
  if (!code) return;
  await Clipboard.setStringAsync(code);
  Alert.alert('Friend code copied.');
}

// ─── Segmented tabs ────────────────────────────────────────────────────────

function SegmentedTabs({ tab, setTab }: { tab: FriendTab; setTab: (t: FriendTab) => void }) {
  const items: { key: FriendTab; label: string }[] = [
    { key: 'challenges', label: 'Challenges' },
    { key: 'circles',    label: 'Circles' },
    { key: 'friends',    label: 'Friends' },
  ];
  return (
    <View style={{
      flexDirection: 'row', padding: 4, borderRadius: 999,
      backgroundColor: C.bgOverlay, borderColor: C.borderSubtle, borderWidth: 1,
    }}>
      {items.map(it => {
        const active = tab === it.key;
        return (
          <Pressable key={it.key} onPress={() => setTab(it.key)} hitSlop={4}
            style={{
              flex: 1, height: 30, borderRadius: 999,
              backgroundColor: active ? C.goldFaint : 'transparent',
              alignItems: 'center', justifyContent: 'center',
            }}>
            <Text style={{
              fontFamily: F.sansBold, fontSize: 11,
              color: active ? C.gold : C.textMuted, letterSpacing: 0.6,
              textTransform: 'uppercase',
            }}>
              {it.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ─── Friends tab ───────────────────────────────────────────────────────────

function FriendsTab({
  incoming, friends, onAdd, onAddDemos, onOpenFriend, onAccept, onReject,
}: {
  incoming: IncomingRequest[];
  friends: Friend[];
  onAdd: () => void;
  onAddDemos: () => void;
  onOpenFriend: (f: Friend) => void;
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
}) {
  return (
    <>
      {/* Incoming requests */}
      {incoming.length > 0 && (
        <View style={{ paddingHorizontal: 16, marginTop: 18 }}>
          <SectionLabel style={{ marginLeft: 4, marginBottom: 8 }}>incoming requests</SectionLabel>
          <VYBGlowCard variant="neutral" intensity="soft" contentStyle={{ padding: 0 }}>
            {incoming.map((r, i) => {
              const name = r.requester.display_name || r.requester.username || 'New friend';
              return (
                <View key={r.id} style={{
                  flexDirection: 'row', alignItems: 'center', gap: 12,
                  paddingHorizontal: 14, paddingVertical: 12,
                  borderTopColor: C.borderSubtle, borderTopWidth: i === 0 ? 0 : 1,
                }}>
                  <Avatar size={38} label={(name[0] || '?').toUpperCase()} tone="gold" />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: F.sansBold, fontSize: 13.5, color: C.textPrimary }}>{name}</Text>
                    {r.requester.username && (
                      <Text style={{ fontFamily: F.mono, fontSize: 10, color: C.textFaint, marginTop: 2 }}>
                        @{r.requester.username}
                      </Text>
                    )}
                  </View>
                  <Pressable onPress={() => onAccept(r.id)} hitSlop={6} style={{
                    width: 30, height: 30, borderRadius: 15,
                    backgroundColor: C.goldFaint, borderColor: 'rgba(201,169,97,0.4)', borderWidth: 1,
                    alignItems: 'center', justifyContent: 'center', marginRight: 6,
                  }}>
                    <Check size={14} color={C.gold} />
                  </Pressable>
                  <Pressable onPress={() => onReject(r.id)} hitSlop={6} style={{
                    width: 30, height: 30, borderRadius: 15,
                    backgroundColor: 'rgba(255,255,255,0.03)', borderColor: C.borderSubtle, borderWidth: 1,
                    alignItems: 'center', justifyContent: 'center',
                  }}>
                    <X size={14} color={C.textMuted} />
                  </Pressable>
                </View>
              );
            })}
          </VYBGlowCard>
        </View>
      )}

      <FriendsList friends={friends} onAdd={onAdd} onAddDemos={onAddDemos} onOpenFriend={onOpenFriend} />
    </>
  );
}

function FriendsList({
  friends, onAdd, onAddDemos, onOpenFriend,
}: {
  friends: Friend[];
  onAdd: () => void;
  onAddDemos: () => void;
  onOpenFriend: (f: Friend) => void;
}) {
  if (friends.length === 0) {
    return (
      <View style={{ paddingHorizontal: 16, marginTop: 18 }}>
        <SectionLabel style={{ marginLeft: 4, marginBottom: 8 }}>your friends</SectionLabel>
        <VYBGlowCard variant="neutral" intensity="soft" contentStyle={{ padding: 22, alignItems: 'center' }}>
          <Text style={{ fontFamily: F.serifItalic, fontSize: 16, color: C.textSecondary, textAlign: 'center' }}>
            People you trust, in private.
          </Text>
          <Text style={{
            fontFamily: F.sans, fontSize: 12.5, color: C.textMuted,
            marginTop: 8, textAlign: 'center', lineHeight: 18,
          }}>
            Friends are for trusted accountability — share what you choose, when you choose. Add by code, QR, or invite.
          </Text>
          <Pressable onPress={onAdd} hitSlop={4} style={{
            marginTop: 16, paddingHorizontal: 18, paddingVertical: 11, borderRadius: 999,
            flexDirection: 'row', alignItems: 'center', gap: 6,
            backgroundColor: C.goldFaint, borderColor: 'rgba(201,169,97,0.4)', borderWidth: 1,
          }}>
            <UserPlus size={13} color={C.gold} />
            <Text style={{ fontFamily: F.sansBold, fontSize: 12, color: C.gold, letterSpacing: 0.5 }}>
              Add friend
            </Text>
          </Pressable>

          {/* Dev-only quick-add for testing the UI without real friends. */}
          <Pressable onPress={onAddDemos} hitSlop={4} style={{
            marginTop: 10, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999,
            flexDirection: 'row', alignItems: 'center', gap: 6,
            backgroundColor: 'rgba(143,168,138,0.10)',
            borderColor: 'rgba(143,168,138,0.35)', borderWidth: 1, borderStyle: 'dashed',
          }}>
            <Text style={{ fontFamily: F.sansBold, fontSize: 10.5, color: '#8FA88A', letterSpacing: 0.6, textTransform: 'uppercase' }}>
              Add demo friends · dev
            </Text>
          </Pressable>
        </VYBGlowCard>
      </View>
    );
  }
  return (
    <View style={{ paddingHorizontal: 16, marginTop: 18 }}>
      <SectionLabel style={{ marginLeft: 4, marginBottom: 8 }}>your friends</SectionLabel>
      <VYBGlowCard variant="neutral" intensity="soft" contentStyle={{ padding: 0 }}>
        {friends.map((f, i) => {
          const name = f.display_name || f.username || 'Friend';
          return (
            <Pressable key={f.id} onPress={() => onOpenFriend(f)} style={{
              flexDirection: 'row', alignItems: 'center', gap: 12,
              paddingHorizontal: 14, paddingVertical: 12,
              borderTopColor: C.borderSubtle, borderTopWidth: i === 0 ? 0 : 1,
            }}>
              {f.avatar_url ? (
                <Image source={{ uri: f.avatar_url }}
                  style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: C.bgOverlay }} />
              ) : (
                <Avatar size={38} label={(name[0] || '?').toUpperCase()} tone="neutral" />
              )}
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={{ fontFamily: F.sansBold, fontSize: 13.5, color: C.textPrimary }}>{name}</Text>
                  {f.username && (
                    <Text style={{ fontFamily: F.mono, fontSize: 10, color: C.textFaint }}>@{f.username}</Text>
                  )}
                  {f.is_demo && (
                    <View style={{
                      paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999,
                      backgroundColor: 'rgba(143,168,138,0.18)',
                      borderColor: 'rgba(143,168,138,0.45)', borderWidth: 1,
                    }}>
                      <Text style={{ fontFamily: F.sansBold, fontSize: 8, color: '#8FA88A', letterSpacing: 0.6 }}>
                        DEMO
                      </Text>
                    </View>
                  )}
                </View>
                <Text style={{ fontFamily: F.sans, fontSize: 11.5, color: C.textMuted, marginTop: 2 }}>
                  Private accountability friend
                </Text>
              </View>
              <ChevronRight size={16} color={C.textFaint} />
            </Pressable>
          );
        })}
      </VYBGlowCard>
    </View>
  );
}

// ─── Add Friend sheet (code + QR + actions) ──────────────────────────────

function AddFriendSheet({
  visible, onClose, code, onShare, onCopy, onEnter, onScan,
}: {
  visible: boolean; onClose: () => void;
  code: string | null;
  onShare: () => void; onCopy: () => void;
  onEnter: () => void; onScan: () => void;
}) {
  const prettyCode = code ? formatFriendCode(code) : '— — — —';
  const qrValue = code ? friendCodeDeepLink(code) : '';
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', padding: 22 }}>
        <View style={{
          backgroundColor: C.bgBase, borderRadius: 18, padding: 20,
          borderColor: C.borderSubtle, borderWidth: 1,
        }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={Tx.label({ letterSpacing: 1.6 })}>ADD FRIEND</Text>
            <Pressable onPress={onClose} hitSlop={6}><X size={16} color={C.textMuted} /></Pressable>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 14 }}>
            <View style={{
              width: 92, height: 92, borderRadius: 14,
              backgroundColor: '#F4F0E8',
              borderColor: 'rgba(201,169,97,0.55)', borderWidth: 1,
              alignItems: 'center', justifyContent: 'center',
              shadowColor: '#C9A961', shadowOpacity: 0.18,
              shadowRadius: 14, shadowOffset: { width: 0, height: 4 },
            }}>
              {qrValue ? (
                <QRCode value={qrValue} size={72} backgroundColor="#F4F0E8" color="#5C4520" quietZone={4} />
              ) : (
                <ActivityIndicator color={C.gold} />
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={Tx.label({ letterSpacing: 1.5 })}>YOUR FRIEND CODE</Text>
              <Pressable onLongPress={onCopy} hitSlop={4}>
                <Text style={{
                  fontFamily: F.sansHeavy, fontSize: 19, color: C.textPrimary,
                  marginTop: 4, letterSpacing: 1.1,
                }}>
                  {prettyCode}
                </Text>
              </Pressable>
              <Text style={{ fontFamily: F.sans, fontSize: 11, color: C.textMuted, marginTop: 4 }}>
                Share with someone you trust.
              </Text>
            </View>
          </View>

          <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
            <CodeButton label="Share code" Icon={Copy}     onPress={onShare} primary />
            <CodeButton label="Enter code" Icon={UserPlus} onPress={onEnter} />
            <CodeButton label="Scan QR"    Icon={ScanLine} onPress={onScan} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── Enter code modal ─────────────────────────────────────────────────────

function EnterCodeModal({
  visible, onClose, onSuccess,
}: { visible: boolean; onClose: () => void; onSuccess: () => void }) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true); setError(null);
    const r = await sendFriendRequest(code);
    setBusy(false);
    if (r.ok) {
      Alert.alert('Friend request sent.', `Sent to ${r.receiver.display_name || r.receiver.username || 'user'}.`);
      setCode('');
      onSuccess();
    } else {
      setError(r.message);
    }
  };

  const close = () => { setCode(''); setError(null); onClose(); };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', padding: 22 }}>
        <View style={{
          backgroundColor: C.bgBase, borderRadius: 18, padding: 20,
          borderColor: C.borderSubtle, borderWidth: 1,
        }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={Tx.label({ letterSpacing: 1.6 })}>ENTER FRIEND CODE</Text>
            <Pressable onPress={close} hitSlop={6}><X size={16} color={C.textMuted} /></Pressable>
          </View>
          <Text style={{ fontFamily: F.sans, fontSize: 12, color: C.textMuted, marginTop: 6, lineHeight: 17 }}>
            Ask your friend to share their 12-digit code.
          </Text>
          <TextInput
            value={code}
            onChangeText={setCode}
            placeholder="0000 0000 0000"
            placeholderTextColor={C.textFaint}
            keyboardType="number-pad"
            autoFocus
            style={{
              marginTop: 14, paddingHorizontal: 14, height: 48, borderRadius: 12,
              backgroundColor: C.bgOverlay, borderColor: C.borderSubtle, borderWidth: 1,
              fontFamily: F.sansHeavy, fontSize: 18, color: C.textPrimary, letterSpacing: 1.4,
            }}
          />
          {error && (
            <Text style={{ fontFamily: F.sans, fontSize: 12, color: '#D27050', marginTop: 8 }}>
              {error}
            </Text>
          )}
          <Pressable onPress={submit} disabled={busy || normalizeFriendCode(code).length !== 12}
            style={{
              marginTop: 14, height: 44, borderRadius: 12,
              backgroundColor: C.goldFaint, borderColor: 'rgba(201,169,97,0.4)', borderWidth: 1,
              alignItems: 'center', justifyContent: 'center',
              opacity: (busy || normalizeFriendCode(code).length !== 12) ? 0.5 : 1,
            }}>
            {busy ? (
              <ActivityIndicator color={C.gold} />
            ) : (
              <Text style={{ fontFamily: F.sansBold, fontSize: 13, color: C.gold, letterSpacing: 0.6, textTransform: 'uppercase' }}>
                Send request
              </Text>
            )}
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

// ─── Circles tab (placeholder) ─────────────────────────────────────────────

function CirclesTab({ navigation }: { navigation: any }) {
  const { circles, loading, refresh } = useCircles();
  const [createOpen, setCreateOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);

  useFocusEffect(React.useCallback(() => { refresh(); }, [refresh]));

  const goToCircle = (id: string) => navigation.navigate('CircleDetail', { circleId: id });

  return (
    <View style={{ paddingHorizontal: 16, gap: 10 }}>
      {/* Create + Join CTAs */}
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Pressable hitSlop={4} onPress={() => setCreateOpen(true)} style={{
          flex: 1, borderRadius: 14, borderWidth: 1, borderStyle: 'dashed',
          borderColor: 'rgba(201,169,97,0.4)',
          paddingVertical: 16, paddingHorizontal: 14,
          flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
          backgroundColor: C.goldFaint,
        }}>
          <Plus size={14} color={C.gold} />
          <Text style={{ fontFamily: F.sansBold, fontSize: 12, color: C.gold, letterSpacing: 0.3 }}>
            Create circle
          </Text>
        </Pressable>
        <Pressable hitSlop={4} onPress={() => setJoinOpen(true)} style={{
          flex: 1, borderRadius: 14, borderWidth: 1, borderStyle: 'dashed',
          borderColor: C.borderSubtle,
          paddingVertical: 16, paddingHorizontal: 14,
          flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
          backgroundColor: 'rgba(255,255,255,0.018)',
        }}>
          <UserPlus size={14} color={C.textSecondary} />
          <Text style={{ fontFamily: F.sansBold, fontSize: 12, color: C.textSecondary, letterSpacing: 0.3 }}>
            Join by code
          </Text>
        </Pressable>
      </View>

      {loading ? (
        <View style={{ paddingVertical: 24, alignItems: 'center' }}>
          <ActivityIndicator color={C.gold} />
        </View>
      ) : circles.length === 0 ? (
        <VYBGlowCard variant="neutral" intensity="soft" contentStyle={{ padding: 22, alignItems: 'center', marginTop: 8 }}>
          <Text style={{ fontFamily: F.serifItalic, fontSize: 15, color: C.textSecondary, textAlign: 'center' }}>
            Create your first private circle.
          </Text>
          <Text style={{
            fontFamily: F.sans, fontSize: 12, color: C.textMuted,
            marginTop: 6, textAlign: 'center', lineHeight: 17,
          }}>
            Invite people you trust and build consistency together.
          </Text>
        </VYBGlowCard>
      ) : (
        <>
          <SectionLabel style={{ marginLeft: 4, marginTop: 8 }}>your circles</SectionLabel>
          {circles.map(c => <CircleRow key={c.id} circle={c} onPress={() => goToCircle(c.id)} />)}
        </>
      )}

      <CreateCircleModal
        visible={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(circle) => { setCreateOpen(false); refresh(); goToCircle(circle.id); }}
      />
      <JoinCircleModal
        visible={joinOpen}
        onClose={() => setJoinOpen(false)}
        onJoined={(circleId) => { setJoinOpen(false); refresh(); goToCircle(circleId); }}
      />
    </View>
  );
}

function CircleRow({ circle, onPress }: { circle: CircleListItem; onPress: () => void }) {
  const purposeLabel =
    circle.purpose === 'workout'   ? 'Workout' :
    circle.purpose === 'reading'   ? 'Reading' :
    circle.purpose === 'hydration' ? 'Hydration' :
    circle.purpose === 'general'   ? 'General' :
    circle.purpose === 'custom'    ? 'Custom' : null;
  // Full-image editorial card with left-aligned text + left dark gradient.
  const HEIGHT = 156;
  return (
    <Pressable onPress={onPress} hitSlop={2}>
      <View style={{
        height: HEIGHT, borderRadius: 24, overflow: 'hidden',
        backgroundColor: C.bgElevated,
        borderColor: 'rgba(143,168,138,0.20)', borderWidth: 1,
        shadowColor: '#000', shadowOpacity: 0.32, shadowRadius: 16, shadowOffset: { width: 0, height: 8 },
      }}>
        {/* Background — real image or premium sage gradient fallback */}
        {circle.image_url ? (
          <Image source={{ uri: circle.image_url }}
            style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}
            resizeMode="cover" />
        ) : (
          <LinearGradient
            colors={['rgba(143,168,138,0.55)', 'rgba(50,72,58,0.95)', 'rgba(28,34,30,1)']}
            start={{ x: 0.9, y: 0 }} end={{ x: 0.1, y: 1 }}
            style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0,
                     alignItems: 'flex-end', justifyContent: 'center', paddingRight: 24 }}>
            <Text style={{
              fontFamily: F.sansHeavy, fontSize: 64,
              color: 'rgba(244,240,232,0.30)', letterSpacing: -1.5,
            }}>
              {(circle.name.match(/\b\w/g) || []).slice(0, 2).join('').toUpperCase() || 'C'}
            </Text>
          </LinearGradient>
        )}
        {/* Left-side dark gradient — fades from solid black on the left to
            transparent on the right. Keeps title readable over any image. */}
        <LinearGradient pointerEvents="none"
          colors={['rgba(8,8,10,0.85)', 'rgba(8,8,10,0.55)', 'rgba(8,8,10,0.05)', 'rgba(8,8,10,0)']}
          locations={[0, 0.35, 0.75, 1]}
          start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }}
          style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '85%' }}
        />
        {/* Subtle bottom darken for chip readability */}
        <LinearGradient pointerEvents="none"
          colors={['rgba(8,8,10,0)', 'rgba(8,8,10,0.45)']}
          start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
          style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 70 }}
        />

        {/* Private lock — top-right glass pill */}
        <View style={{
          position: 'absolute', top: 14, right: 14,
          width: 30, height: 30, borderRadius: 15,
          backgroundColor: 'rgba(13,12,11,0.55)',
          borderColor: 'rgba(244,240,232,0.18)', borderWidth: 1,
          alignItems: 'center', justifyContent: 'center',
        }}>
          <Lock size={12} color="rgba(244,240,232,0.85)" />
        </View>

        {/* Editorial text block — left, vertically centered toward bottom */}
        <View style={{
          position: 'absolute', left: 18, right: 18, bottom: 16, top: 14,
          justifyContent: 'space-between',
        }}>
          {purposeLabel ? (
            <View style={{
              alignSelf: 'flex-start',
              paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999,
              backgroundColor: 'rgba(13,12,11,0.55)',
              borderColor: 'rgba(143,168,138,0.45)', borderWidth: 1,
            }}>
              <Text style={{
                fontFamily: F.sansBold, fontSize: 9.5, color: '#A8C0A2',
                letterSpacing: 0.8, textTransform: 'uppercase',
              }}>
                {purposeLabel}
              </Text>
            </View>
          ) : <View />}

          <View>
            <Text numberOfLines={1} style={{
              fontFamily: F.sansHeavy, fontSize: 22, color: '#F4F0E8',
              letterSpacing: -0.4,
              textShadowColor: 'rgba(0,0,0,0.35)', textShadowRadius: 6, textShadowOffset: { width: 0, height: 2 },
            }}>
              {circle.name}
            </Text>
            {circle.description ? (
              <Text numberOfLines={1} style={{
                fontFamily: F.serifItalic, fontSize: 12.5, color: 'rgba(244,240,232,0.78)',
                marginTop: 3,
                textShadowColor: 'rgba(0,0,0,0.4)', textShadowRadius: 4, textShadowOffset: { width: 0, height: 1 },
              }}>
                {circle.description}
              </Text>
            ) : null}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 }}>
              <Users size={11} color="rgba(244,240,232,0.65)" />
              <Text style={{
                fontFamily: F.mono, fontSize: 10.5, color: 'rgba(244,240,232,0.65)',
              }}>
                {circle.member_count} {circle.member_count === 1 ? 'member' : 'members'}
              </Text>
            </View>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

// ─── Create Circle modal ──────────────────────────────────────────────────

const PURPOSE_OPTIONS: { key: Exclude<CirclePurpose, null>; label: string }[] = [
  { key: 'workout',   label: 'Workout' },
  { key: 'reading',   label: 'Reading' },
  { key: 'hydration', label: 'Hydration' },
  { key: 'general',   label: 'General accountability' },
  { key: 'custom',    label: 'Custom' },
];

function CreateCircleModal({
  visible, onClose, onCreated,
}: { visible: boolean; onClose: () => void; onCreated: (circle: any) => void }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [purpose, setPurpose] = useState<CirclePurpose>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => { setName(''); setDescription(''); setPurpose(null); setError(null); };
  const close = () => { reset(); onClose(); };

  const submit = async () => {
    if (!name.trim()) { setError('Circle name is required.'); return; }
    setBusy(true); setError(null);
    try {
      const circle = await createCircle({ name: name.trim(), description: description.trim() || undefined, purpose });
      reset();
      onCreated(circle);
    } catch (e: any) {
      setError(e.message || 'Could not create circle.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', padding: 22 }}>
        <View style={{
          backgroundColor: C.bgBase, borderRadius: 18, padding: 20,
          borderColor: C.borderSubtle, borderWidth: 1,
        }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={Tx.label({ letterSpacing: 1.6 })}>CREATE PRIVATE CIRCLE</Text>
            <Pressable onPress={close} hitSlop={6}><X size={16} color={C.textMuted} /></Pressable>
          </View>

          <Text style={{ fontFamily: F.serifItalic, fontSize: 12.5, color: C.textSecondary, marginTop: 10, lineHeight: 18 }}>
            A Circle is your accountability group. Challenges are the specific goals you complete together.
          </Text>
          <Text style={{ fontFamily: F.sans, fontSize: 11, color: C.textMuted, marginTop: 6, lineHeight: 16 }}>
            Only invited members can see this circle.
          </Text>

          <TextInput
            value={name} onChangeText={setName}
            placeholder="Los 6 duros"
            placeholderTextColor={C.textFaint}
            style={{
              marginTop: 14, paddingHorizontal: 14, height: 44, borderRadius: 12,
              backgroundColor: C.bgOverlay, borderColor: C.borderSubtle, borderWidth: 1,
              fontFamily: F.sansBold, fontSize: 14, color: C.textPrimary,
            }}
          />
          <TextInput
            value={description} onChangeText={setDescription}
            placeholder="A group to stay accountable with workouts, reading, or habits."
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
          <Text style={{ fontFamily: F.sans, fontSize: 11, color: C.textMuted, marginTop: 3, lineHeight: 15 }}>
            Helps shape the first challenges you create inside this circle.
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
            {PURPOSE_OPTIONS.map(opt => {
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
                Create circle
              </Text>
            )}
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

// ─── Join Circle modal ────────────────────────────────────────────────────

function JoinCircleModal({
  visible, onClose, onJoined,
}: { visible: boolean; onClose: () => void; onJoined: (circleId: string) => void }) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = () => { setCode(''); setError(null); onClose(); };

  const submit = async () => {
    setBusy(true); setError(null);
    const r = await joinCircleByCode(code);
    setBusy(false);
    if (!r.ok) { setError(r.message); return; }
    setCode('');
    onJoined(r.circle.id);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', padding: 22 }}>
        <View style={{
          backgroundColor: C.bgBase, borderRadius: 18, padding: 20,
          borderColor: C.borderSubtle, borderWidth: 1,
        }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={Tx.label({ letterSpacing: 1.6 })}>JOIN CIRCLE BY CODE</Text>
            <Pressable onPress={close} hitSlop={6}><X size={16} color={C.textMuted} /></Pressable>
          </View>
          <Text style={{ fontFamily: F.sans, fontSize: 12, color: C.textMuted, marginTop: 6, lineHeight: 17 }}>
            Paste the invite code your friend shared.
          </Text>
          <TextInput
            value={code} onChangeText={setCode}
            placeholder="CIR-XXXXX"
            placeholderTextColor={C.textFaint}
            autoCapitalize="characters"
            autoCorrect={false}
            autoFocus
            style={{
              marginTop: 14, paddingHorizontal: 14, height: 48, borderRadius: 12,
              backgroundColor: C.bgOverlay, borderColor: C.borderSubtle, borderWidth: 1,
              fontFamily: F.sansHeavy, fontSize: 18, color: C.textPrimary, letterSpacing: 1.4,
            }}
          />
          {error && (
            <Text style={{ fontFamily: F.sans, fontSize: 12, color: '#D27050', marginTop: 8 }}>
              {error}
            </Text>
          )}
          <Pressable onPress={submit} disabled={busy || !normalizeCircleCode(code)}
            style={{
              marginTop: 14, height: 44, borderRadius: 12,
              backgroundColor: C.goldFaint, borderColor: 'rgba(201,169,97,0.4)', borderWidth: 1,
              alignItems: 'center', justifyContent: 'center',
              opacity: (busy || !normalizeCircleCode(code)) ? 0.5 : 1,
            }}>
            {busy ? (
              <ActivityIndicator color={C.gold} />
            ) : (
              <Text style={{ fontFamily: F.sansBold, fontSize: 13, color: C.gold, letterSpacing: 0.6, textTransform: 'uppercase' }}>
                Join circle
              </Text>
            )}
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

// ─── Challenges tab — daily action hub ─────────────────────────────────────

function ChallengesTab({ navigation }: { navigation: any }) {
  const { session } = useAuth();
  const { items: active, loading: loadingActive, refresh: refreshActive } = useMyActiveChallenges();
  const { items: joinable, refresh: refreshJoinable } = useJoinableChallenges();
  const [pickerFor, setPickerFor] = useState<ActiveChallengeCard | null>(null);

  useFocusEffect(React.useCallback(() => {
    refreshActive(); refreshJoinable();
  }, [refreshActive, refreshJoinable]));

  const onCardOpen = (id: string) => navigation.navigate('ChallengeDetail', { challengeId: id });
  const onJoinPreview = (id: string) => navigation.navigate('ChallengePreview', { challengeId: id });

  const onUploadProof = (c: ActiveChallengeCard) => {
    console.log('[proof] onUploadProof tapped', { id: c.id, type: c.proof_type, today: c.i_checked_in_today });
    if (c.i_checked_in_today) {
      Alert.alert('Already checked in today.');
      return;
    }
    if (c.proof_type !== 'photo') {
      // Non-photo challenge — submit a simple check-in without picker.
      submitCheckin({ challengeId: c.id }).then(r => {
        console.log('[proof] direct checkin result', r);
        if (!r.ok) Alert.alert('Could not check in', r.message);
        else refreshActive();
      });
      return;
    }
    setPickerFor(c);
  };

  const doUpload = async (source: 'camera' | 'library') => {
    console.log('[proof] doUpload tapped', { source });
    const c = pickerFor;
    if (!c) { Alert.alert('Missing challenge', 'No challenge selected.'); return; }
    if (!session) { Alert.alert('Sign-in required', 'You must be signed in to upload proof.'); return; }
    // Close the sheet, wait for iOS modal to fully dismiss, then launch picker.
    setPickerFor(null);
    await new Promise(r => setTimeout(r, 600));
    try {
      const r = await pickAndUploadProof({
        source, circleId: c.circle_id, challengeId: c.id, userId: session.user.id,
      });
      console.log('[proof] doUpload result', r);
      if (r.ok) {
        refreshActive();
        return;
      }
      // Always surface the failure — no more silent paths.
      switch (r.reason) {
        case 'permission': Alert.alert('Permission needed', r.message); break;
        case 'duplicate':  Alert.alert('Already checked in today.'); break;
        case 'storage':    Alert.alert('Upload failed', `Could not save the image.\n\n${r.message}`); break;
        case 'db':         Alert.alert('Check-in failed', `Could not record the check-in.\n\n${r.message}`); break;
        case 'cancelled':  /* user cancelled — silent is fine */ break;
        default:           Alert.alert('Upload failed', r.message || 'Unknown error.');
      }
    } catch (e: any) {
      console.log('[proof] doUpload threw', e?.message);
      Alert.alert('Upload failed', e?.message || 'Unknown error');
    }
  };

  return (
    <View style={{ paddingHorizontal: 16, gap: 14 }}>
      {/* Heading */}
      <View style={{ paddingHorizontal: 4 }}>
        <Text style={{ fontFamily: F.serifItalic, fontSize: 13, color: C.textMuted, lineHeight: 18 }}>
          Check in with your circles and keep momentum alive.
        </Text>
      </View>

      {/* Active joined challenges */}
      <View>
        <SectionLabel style={{ marginLeft: 4, marginBottom: 8 }}>your active challenges</SectionLabel>
        {loadingActive ? (
          <View style={{ paddingVertical: 22, alignItems: 'center' }}>
            <ActivityIndicator color={C.gold} />
          </View>
        ) : active.length === 0 ? (
          <View style={{
            paddingVertical: 22, paddingHorizontal: 18, borderRadius: 14,
            backgroundColor: 'rgba(255,255,255,0.025)',
            borderColor: C.borderSubtle, borderWidth: 1,
            alignItems: 'center',
          }}>
            <Trophy size={18} color={C.textFaint} />
            <Text style={{ fontFamily: F.serifItalic, fontSize: 14, color: C.textSecondary, marginTop: 8, textAlign: 'center' }}>
              No active challenges yet.
            </Text>
            <Text style={{ fontFamily: F.sans, fontSize: 12, color: C.textMuted, marginTop: 4, textAlign: 'center', lineHeight: 17 }}>
              Join or create a challenge inside a private circle.
            </Text>
          </View>
        ) : (
          <View style={{ gap: 10 }}>
            {active.map(c => (
              <ActiveChallengeCardRow key={c.id} c={c}
                onOpen={() => onCardOpen(c.id)}
                onUpload={() => onUploadProof(c)} />
            ))}
          </View>
        )}
      </View>

      {/* Joinable (in my circles, not joined) */}
      {joinable.length > 0 && (
        <View>
          <SectionLabel style={{ marginLeft: 4, marginBottom: 8 }}>available in your circles</SectionLabel>
          <View style={{ gap: 10 }}>
            {joinable.map(c => (
              <JoinableChallengeCardRow key={c.id} c={c} onOpen={() => onJoinPreview(c.id)} />
            ))}
          </View>
        </View>
      )}

      {/* Official placeholder */}
      <View style={{
        paddingVertical: 18, paddingHorizontal: 18, borderRadius: 14, marginTop: 4,
        backgroundColor: 'rgba(255,255,255,0.018)',
        borderColor: C.borderSubtle, borderWidth: 1, borderStyle: 'dashed',
        alignItems: 'center',
      }}>
        <Text style={{ fontFamily: F.serifItalic, fontSize: 13, color: C.textSecondary }}>
          Official challenges coming later.
        </Text>
        <Text style={{ fontFamily: F.sans, fontSize: 11, color: C.textMuted, marginTop: 4, textAlign: 'center' }}>
          Monthly app challenges and badges will live here.
        </Text>
      </View>

      {/* Proof picker bottom sheet */}
      <Modal visible={!!pickerFor} transparent animationType="fade" onRequestClose={() => setPickerFor(null)}>
        {/* Pure View backdrop avoids the Pressable parent/child gesture
            collision that was eating the row taps. The backdrop has its
            own dismiss Pressable layer behind the sheet content. */}
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }}>
          <Pressable
            onPress={() => setPickerFor(null)}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
          />
          <View style={{
            backgroundColor: C.bgBase, borderTopLeftRadius: 22, borderTopRightRadius: 22,
            paddingTop: 16, paddingBottom: 36, paddingHorizontal: 16,
            borderColor: C.borderSubtle, borderWidth: 1,
          }}>
            <View style={{ alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: C.borderSubtle, marginBottom: 14 }} />
            <ProofSheetRow Icon={ImageIcon} label="Choose from gallery"
              onPress={() => { console.log('[proof] gallery row tapped'); doUpload('library'); }} />
            <ProofSheetRow Icon={Camera}    label="Take photo"
              onPress={() => { console.log('[proof] camera row tapped'); doUpload('camera'); }} />
          </View>
        </View>
      </Modal>
    </View>
  );
}

function ActiveChallengeCardRow({
  c, onOpen, onUpload,
}: { c: ActiveChallengeCard; onOpen: () => void; onUpload: () => void }) {
  const theme = challengeTypeTheme(c.challenge_type);
  const days = daysLeftHelper(c.end_date);
  const endsLabel = days === 0 ? 'Ends today' : days === 1 ? 'Ends tomorrow' : `Ends in ${days}d`;
  const checkedIn = c.i_checked_in_today;
  return (
    <Pressable onPress={onOpen}>
      <VYBGlowCard variant={theme.variant} intensity="soft" contentStyle={{ padding: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          {/* Type badge */}
          <View style={{
            width: 44, height: 44, borderRadius: 14,
            backgroundColor: 'rgba(255,255,255,0.04)',
            borderColor: `${theme.accent}55`, borderWidth: 1,
            alignItems: 'center', justifyContent: 'center',
          }}>
            <Trophy size={20} color={theme.accent} />
          </View>
          {/* Left: identity + meta */}
          <View style={{ flex: 1 }}>
            <Text numberOfLines={1} style={{ fontFamily: F.sansBold, fontSize: 14, color: C.textPrimary }}>
              {c.title}
            </Text>
            <Text numberOfLines={1} style={{ fontFamily: F.sans, fontSize: 11, color: C.textMuted, marginTop: 2 }}>
              {c.circle_name} · {endsLabel}
            </Text>
            <Text style={{ fontFamily: F.mono, fontSize: 9.5, color: C.textFaint, marginTop: 3 }}>
              {c.my_checkin_count} check-in{c.my_checkin_count === 1 ? '' : 's'}
            </Text>
          </View>
          {/* Right: compact CTA — circular when pending, sage pill when done */}
          {checkedIn ? (
            <View style={{
              paddingHorizontal: 10, paddingVertical: 7, borderRadius: 999,
              backgroundColor: 'rgba(143,168,138,0.18)',
              borderColor: 'rgba(143,168,138,0.45)', borderWidth: 1,
              flexDirection: 'row', alignItems: 'center', gap: 4,
            }}>
              <CheckCircle2 size={11} color="#8FA88A" />
              <Text style={{ fontFamily: F.sansBold, fontSize: 9.5, color: '#8FA88A', letterSpacing: 0.4, textTransform: 'uppercase' }}>
                Done
              </Text>
            </View>
          ) : (
            <Pressable
              onPress={(e) => { e.stopPropagation(); onUpload(); }}
              hitSlop={8}
              style={{
                width: 44, height: 44, borderRadius: 22,
                backgroundColor: C.gold,
                alignItems: 'center', justifyContent: 'center',
                shadowColor: '#E8C275', shadowOpacity: 0.45, shadowRadius: 12, shadowOffset: { width: 0, height: 4 },
              }}
              accessibilityLabel={c.proof_type === 'photo' ? 'Upload proof' : 'Check in'}>
              {c.proof_type === 'photo' ? (
                <Camera size={18} color={C.bgBase} strokeWidth={2.4} />
              ) : (
                <Check size={20} color={C.bgBase} strokeWidth={2.6} />
              )}
            </Pressable>
          )}
        </View>
      </VYBGlowCard>
    </Pressable>
  );
}

function JoinableChallengeCardRow({
  c, onOpen,
}: { c: JoinableChallengeCard; onOpen: () => void }) {
  const theme = challengeTypeTheme(c.challenge_type);
  const days = daysLeftHelper(c.end_date);
  const endsLabel = days === 0 ? 'Ends today' : days === 1 ? 'Ends tomorrow' : `Ends in ${days}d`;
  return (
    <Pressable onPress={onOpen}>
      <VYBGlowCard variant={theme.variant} intensity="soft" contentStyle={{ padding: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{
            width: 40, height: 40, borderRadius: 12,
            backgroundColor: 'rgba(255,255,255,0.04)',
            borderColor: `${theme.accent}55`, borderWidth: 1,
            alignItems: 'center', justifyContent: 'center',
          }}>
            <Trophy size={18} color={theme.accent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: F.sansBold, fontSize: 14, color: C.textPrimary }}>{c.title}</Text>
            <Text style={{ fontFamily: F.sans, fontSize: 11, color: C.textMuted, marginTop: 2 }}>
              {c.circle_name} · {endsLabel}
            </Text>
            <Text style={{ fontFamily: F.mono, fontSize: 10, color: C.textFaint, marginTop: 3 }}>
              {c.joined_count} joined
            </Text>
          </View>
          <View style={{
            paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999,
            backgroundColor: C.goldFaint,
            borderColor: 'rgba(201,169,97,0.4)', borderWidth: 1,
          }}>
            <Text style={{ fontFamily: F.sansBold, fontSize: 10, color: C.gold, letterSpacing: 0.5, textTransform: 'uppercase' }}>
              Join
            </Text>
          </View>
        </View>
      </VYBGlowCard>
    </Pressable>
  );
}

function ProofSheetRow({
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

// Tiny helper to compute days left without importing the lib helper.
function daysLeftHelper(endDate: string): number {
  const end = new Date(endDate + 'T23:59:59');
  const ms = end.getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / 86400000));
}

// ─── Code action button ────────────────────────────────────────────────────

function CodeButton({
  label, Icon, onPress, primary = false,
}: {
  label: string;
  Icon: typeof Copy;
  onPress: () => void;
  primary?: boolean;
}) {
  return (
    <Pressable onPress={onPress} hitSlop={4} style={{
      flex: 1, height: 36, borderRadius: 10, flexDirection: 'row',
      gap: 6, alignItems: 'center', justifyContent: 'center',
      backgroundColor: primary ? C.goldFaint : 'rgba(255,255,255,0.03)',
      borderColor: primary ? 'rgba(201,169,97,0.4)' : C.borderSubtle,
      borderWidth: 1,
    }}>
      <Icon size={12} color={primary ? C.gold : C.textSecondary} />
      <Text style={{
        fontFamily: F.sansBold, fontSize: 10,
        color: primary ? C.gold : C.textSecondary, letterSpacing: 0.4,
      }}>
        {label}
      </Text>
    </Pressable>
  );
}
