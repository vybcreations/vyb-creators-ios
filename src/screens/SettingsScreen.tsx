import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable, Switch, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronRight, User, Link as LinkIcon, Lock, Moon, Bell, Globe, Timer, Flame, BookOpen, Eye, XOctagon, Sparkles } from 'lucide-react-native';
import { SectionLabel } from '../components/primitives';
import { VYBCard, VYBScreenHeader } from '../components/ui';
import { colors as C, fonts as F } from '../theme';
import { useAuth } from '../lib/auth';
import { get1111Enabled, set1111Enabled } from '../lib/notifications';

export function SettingsScreen({ navigation }: any) {
  const { signOut } = useAuth();
  const [reminder1111, setReminder1111] = useState(false);

  useEffect(() => { get1111Enabled().then(setReminder1111); }, []);

  const toggle1111 = async (next: boolean) => {
    try {
      setReminder1111(next);
      await set1111Enabled(next);
    } catch (e: any) {
      setReminder1111(!next);
      Alert.alert('Notifications', e?.message || 'Could not toggle.');
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bgBase }} edges={['top']}>
      <VYBScreenHeader
        title="Settings"
        back
        onBack={() => navigation?.goBack()}
      />

      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 60, gap: 18 }}>

        {/* Rituals */}
        <View>
          <SectionLabel style={{ marginLeft: 6, marginBottom: 8 }}>rituals</SectionLabel>
          <VYBCard level="list">
            <View style={{
              flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14,
            }}>
              <View style={{
                width: 34, height: 34, borderRadius: 999, backgroundColor: C.goldFaint,
                borderColor: 'rgba(201,169,97,0.4)', borderWidth: 1,
                alignItems: 'center', justifyContent: 'center',
              }}>
                <Sparkles size={15} color={C.gold} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: F.sansBold, fontSize: 13.5, color: C.textPrimary }}>11:11 reminder</Text>
                <Text style={{ fontFamily: F.sans, fontSize: 11, color: C.textMuted, marginTop: 1 }}>
                  Two daily nudges, morning + night.
                </Text>
              </View>
              <Switch
                value={reminder1111}
                onValueChange={toggle1111}
                trackColor={{ false: C.bgOverlay, true: C.gold }}
                thumbColor={C.textPrimary}
                ios_backgroundColor={C.bgOverlay}
              />
            </View>
          </VYBCard>
        </View>

        {/* Account */}
        <Group title="account" items={[
          { l: 'Profile',          sub: 'name, bio, avatar', Icon: User },
          { l: 'Public link',      sub: 'vyb.app/…',         Icon: LinkIcon },
          { l: 'Email & password', sub: '',                  Icon: Lock },
        ]} />

        <Group title="app" items={[
          { l: 'Appearance',    sub: 'dark · system', Icon: Moon },
          { l: 'Notifications', sub: '',              Icon: Bell },
          { l: 'Language',      sub: 'english',       Icon: Globe },
        ]} />

        <Group title="focus & habits" items={[
          { l: 'Default focus block', sub: '25 minutes', Icon: Timer },
          { l: 'Habit reminders',     sub: '',           Icon: Flame },
          { l: 'Reading goals',       sub: '',           Icon: BookOpen },
        ]} />

        <Group title="friends" items={[
          { l: 'Privacy', sub: 'what friends see', Icon: Eye },
          { l: 'Blocked', sub: '',                 Icon: XOctagon },
        ]} />

        <Pressable onPress={signOut} style={{ paddingVertical: 14, alignItems: 'center' }}>
          <Text style={{ fontFamily: F.sansBold, fontSize: 13, color: C.clay, letterSpacing: 0.5 }}>Sign out</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function Group({ title, items }: { title: string; items: { l: string; sub: string; Icon: any }[] }) {
  return (
    <View>
      <SectionLabel style={{ marginLeft: 6, marginBottom: 8 }}>{title}</SectionLabel>
      <VYBCard level="list">
        {items.map((it, ii, arr) => (
          <Pressable key={it.l} style={{
            flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14,
            borderBottomColor: C.borderSubtle, borderBottomWidth: ii < arr.length - 1 ? 1 : 0,
          }}>
            <View style={{
              width: 34, height: 34, borderRadius: 999, backgroundColor: C.bgOverlay,
              borderColor: C.borderSubtle, borderWidth: 1,
              alignItems: 'center', justifyContent: 'center',
            }}>
              <it.Icon size={15} color={C.textSecondary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: F.sansBold, fontSize: 13.5, color: C.textPrimary }}>{it.l}</Text>
              {it.sub ? <Text style={{ fontFamily: F.sans, fontSize: 11, color: C.textMuted, marginTop: 1 }}>{it.sub}</Text> : null}
            </View>
            <ChevronRight size={15} color={C.textFaint} />
          </Pressable>
        ))}
      </VYBCard>
    </View>
  );
}
