import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, Pressable, Alert, ActivityIndicator, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft, Lock, Trophy, Users, Calendar, Camera } from 'lucide-react-native';
import { Tx } from '../components/primitives';
import { colors as C, fonts as F, gradients as G } from '../theme';
import { ScreenAtmosphere } from '../components/ScreenAtmosphere';
import { supabase } from '../lib/supabase';
import {
  joinChallenge, challengeTypeLabel, challengeTypeTheme, challengeTypePrompt,
  daysLeft, type Challenge,
} from '../lib/challenges';

/**
 * ChallengePreviewScreen — shown when a circle member opens a challenge they
 * have NOT joined yet. Shows rules + Join CTA. No proof feed exposed here.
 */
export function ChallengePreviewScreen({ route, navigation }: any) {
  const challengeId: string = route?.params?.challengeId;
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [circleName, setCircleName] = useState<string>('');
  const [joinedCount, setJoinedCount] = useState<number>(0);
  const [busy, setBusy] = useState(false);
  const [accepted, setAccepted] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [chQ, memberQ] = await Promise.all([
        supabase.from('challenges').select('*, circle:circles(name)').eq('id', challengeId).maybeSingle(),
        supabase.from('challenge_members').select('user_id').eq('challenge_id', challengeId).eq('status', 'active'),
      ]);
      if (!alive) return;
      const row: any = chQ.data;
      if (row) {
        setChallenge(row as Challenge);
        setCircleName(row.circle?.name || '');
      }
      setJoinedCount((memberQ.data || []).length);
    })();
    return () => { alive = false; };
  }, [challengeId]);

  const onJoin = async () => {
    if (!challenge) return;
    setBusy(true);
    const r = await joinChallenge(challenge.id);
    setBusy(false);
    if (!r.ok) {
      Alert.alert('Could not join', r.message);
      return;
    }
    setAccepted(true);
    setTimeout(() => {
      setAccepted(false);
      navigation.replace('ChallengeDetail', { challengeId: challenge.id });
    }, 1400);
  };

  if (!challenge) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bgBase }}>
        <ScreenAtmosphere />
        <SafeAreaView edges={['top']} style={{ paddingHorizontal: 14, paddingVertical: 4 }}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={8} style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}>
            <ArrowLeft size={20} color={C.textSecondary} />
          </Pressable>
        </SafeAreaView>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={C.gold} />
        </View>
      </View>
    );
  }

  const theme = challengeTypeTheme(challenge.challenge_type);
  const days = daysLeft(challenge.end_date);
  const endsLabel = days === 0 ? 'Ends today' : days === 1 ? 'Ends tomorrow' : `Ends in ${days} days`;

  return (
    <View style={{ flex: 1, backgroundColor: C.bgBase }}>
      <ScreenAtmosphere />

      <ScrollView contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
        {/* Cover — VYB premium dusk + accent glow */}
        <View style={{ height: 280, backgroundColor: C.bgElevated, position: 'relative' }}>
          <LinearGradient colors={G.dusk as any} style={{ position: 'absolute', inset: 0 as any }} />
          {/* Accent glow per type */}
          <LinearGradient
            colors={[`${theme.accent}55`, 'rgba(13,12,11,0)']}
            start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 220 }}
          />
          {/* Bottom fade into bg */}
          <LinearGradient
            colors={['rgba(13,12,11,0)', 'rgba(13,12,11,0.7)', C.bgBase] as any}
            locations={[0, 0.6, 1]}
            style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 160 }}
          />

          {/* Big trophy icon centered */}
          <View pointerEvents="none" style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <View style={{
              width: 96, height: 96, borderRadius: 48,
              backgroundColor: 'rgba(13,12,11,0.55)',
              borderColor: `${theme.accent}88`, borderWidth: 1.5,
              alignItems: 'center', justifyContent: 'center',
              shadowColor: theme.accent, shadowOpacity: 0.35, shadowRadius: 28, shadowOffset: { width: 0, height: 8 },
            }}>
              <Trophy size={40} color={theme.accent} />
            </View>
          </View>

          {/* Header */}
          <SafeAreaView edges={['top']} style={{
            position: 'absolute', top: 0, left: 0, right: 0,
            flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
            paddingHorizontal: 14,
          }}>
            <Pressable onPress={() => navigation.goBack()} hitSlop={8} style={{
              width: 36, height: 36, borderRadius: 18,
              backgroundColor: 'rgba(13,12,11,0.55)',
              borderColor: 'rgba(244,240,232,0.18)', borderWidth: 1,
              alignItems: 'center', justifyContent: 'center',
            }}>
              <ArrowLeft size={18} color="#F4F0E8" />
            </Pressable>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Lock size={12} color="rgba(244,240,232,0.7)" />
              <Text style={{ fontFamily: F.sansBold, fontSize: 10, color: 'rgba(244,240,232,0.7)', letterSpacing: 1, textTransform: 'uppercase' }}>
                Private
              </Text>
            </View>
            <View style={{ width: 36 }} />
          </SafeAreaView>
        </View>

        {/* Identity */}
        <View style={{ paddingHorizontal: 22, marginTop: -10 }}>
          <Text style={[Tx.editorial(), { fontSize: 30 }]}>{challenge.title}</Text>
          <Text style={{ fontFamily: F.sansBold, fontSize: 11, color: theme.accent, marginTop: 6, letterSpacing: 0.8, textTransform: 'uppercase' }}>
            {challengeTypeLabel(challenge.challenge_type)} {circleName ? `· ${circleName}` : ''}
          </Text>
          <Text style={{ fontFamily: F.serifItalic, fontSize: 13, color: C.textSecondary, marginTop: 10, lineHeight: 19 }}>
            {challenge.description || challengeTypePrompt(challenge.challenge_type)}
          </Text>
        </View>

        {/* Stats grid */}
        <View style={{ paddingHorizontal: 16, marginTop: 18, flexDirection: 'row', gap: 8 }}>
          <StatTile Icon={Calendar} label="Duration" value={endsLabel} />
          <StatTile Icon={Users}    label="Joined"   value={`${joinedCount} member${joinedCount === 1 ? '' : 's'}`} />
          <StatTile Icon={Camera}   label="Proof"    value={challenge.proof_type === 'photo' ? 'Photo' : 'Check-in'} />
        </View>

        {/* Rule */}
        {challenge.rule && (
          <View style={{ paddingHorizontal: 16, marginTop: 14 }}>
            <View style={{
              paddingVertical: 14, paddingHorizontal: 16, borderRadius: 14,
              backgroundColor: 'rgba(255,255,255,0.025)',
              borderColor: C.borderSubtle, borderWidth: 1,
            }}>
              <Text style={{ fontFamily: F.sansBold, fontSize: 10, color: C.textFaint, letterSpacing: 0.8, textTransform: 'uppercase' }}>
                Rule
              </Text>
              <Text style={{ fontFamily: F.serifItalic, fontSize: 13.5, color: C.textPrimary, marginTop: 4, lineHeight: 19 }}>
                {challenge.rule}
              </Text>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Sticky Join CTA */}
      <SafeAreaView edges={['bottom']} style={{
        position: 'absolute', left: 0, right: 0, bottom: 0,
        paddingHorizontal: 16, paddingTop: 14,
        backgroundColor: 'rgba(13,12,11,0.85)',
        borderTopColor: C.borderSubtle, borderTopWidth: 1,
      }}>
        <Pressable onPress={onJoin} disabled={busy} hitSlop={4} style={{
          height: 50, borderRadius: 14,
          flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
          backgroundColor: C.goldFaint,
          borderColor: 'rgba(201,169,97,0.4)', borderWidth: 1,
          opacity: busy ? 0.6 : 1,
        }}>
          {busy ? (
            <ActivityIndicator color={C.gold} />
          ) : (
            <Text style={{ fontFamily: F.sansBold, fontSize: 13, color: C.gold, letterSpacing: 0.8, textTransform: 'uppercase' }}>
              Join challenge
            </Text>
          )}
        </Pressable>
      </SafeAreaView>

      {/* Challenge accepted moment */}
      <ChallengeAcceptedOverlay visible={accepted} />
    </View>
  );
}

function StatTile({ Icon, label, value }: { Icon: typeof Calendar; label: string; value: string }) {
  return (
    <View style={{
      flex: 1, paddingVertical: 12, paddingHorizontal: 12, borderRadius: 12,
      backgroundColor: 'rgba(255,255,255,0.025)',
      borderColor: C.borderSubtle, borderWidth: 1,
    }}>
      <Icon size={12} color={C.textFaint} />
      <Text style={{ fontFamily: F.sansBold, fontSize: 9, color: C.textFaint, marginTop: 6, letterSpacing: 0.7, textTransform: 'uppercase' }}>
        {label}
      </Text>
      <Text style={{ fontFamily: F.sansBold, fontSize: 12.5, color: C.textPrimary, marginTop: 2 }}>
        {value}
      </Text>
    </View>
  );
}

function ChallengeAcceptedOverlay({ visible }: { visible: boolean }) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={{ flex: 1, backgroundColor: 'rgba(13,12,11,0.85)', alignItems: 'center', justifyContent: 'center' }}>
        <View style={{
          width: 64, height: 64, borderRadius: 32,
          backgroundColor: C.goldFaint,
          borderColor: 'rgba(201,169,97,0.55)', borderWidth: 1.5,
          alignItems: 'center', justifyContent: 'center',
          shadowColor: '#C9A961', shadowOpacity: 0.4, shadowRadius: 24, shadowOffset: { width: 0, height: 6 },
        }}>
          <Trophy size={28} color={C.gold} />
        </View>
        <Text style={[Tx.editorial(), { fontSize: 28, marginTop: 20 }]}>Challenge accepted</Text>
        <Text style={{ fontFamily: F.serifItalic, fontSize: 14, color: C.textSecondary, marginTop: 6 }}>
          You’re in.
        </Text>
        <Text style={{ fontFamily: F.sans, fontSize: 12, color: C.textMuted, marginTop: 8, textAlign: 'center', paddingHorizontal: 32 }}>
          Start checking in to build your score.
        </Text>
      </View>
    </Modal>
  );
}
