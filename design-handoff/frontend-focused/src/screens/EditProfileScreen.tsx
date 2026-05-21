import React, { useState } from 'react';
import { View, Text, TextInput, ScrollView, Pressable, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft } from 'lucide-react-native';
import { colors as C, fonts as F, KEYBOARD_GAP } from '../theme';
import { useAuth } from '../lib/auth';
import {
  useProfile, updateProfile,
  buildSocialUrl, handleFromSocialUrl, SocialPlatform,
} from '../lib/profile';

// Each social input is just a handle. We show the canonical URL it'll produce
// as a small helper line so the user can verify the link before saving.
const PREVIEW_PREFIX: Record<SocialPlatform, string> = {
  instagram: 'instagram.com/',
  youtube:   'youtube.com/@',
  twitter:   'x.com/',
  tiktok:    'tiktok.com/@',
  linkedin:  'linkedin.com/in/',
};

// Clean any input the user might paste into a social field down to just the
// handle. Strips leading @, handles full URLs (or url-shaped strings without
// protocol), and trims path/query noise.
function sanitizeHandle(platform: SocialPlatform, raw: string): string {
  const t = raw.trim();
  if (!t) return '';
  const looksLikeUrl = /^https?:\/\//i.test(t) || /\.[a-z]{2,}\//i.test(t);
  if (looksLikeUrl) {
    const url = /^https?:\/\//i.test(t) ? t : `https://${t}`;
    const extracted = handleFromSocialUrl(platform, url);
    // `handleFromSocialUrl` may return the original URL when the host doesn't
    // match — in that case fall through and strip generically below.
    if (extracted && !/^https?:\/\//i.test(extracted)) return extracted.replace(/^@+/, '');
  }
  return t.replace(/^@+/, '').split(/[\/?#]/)[0].replace(/\s+/g, '');
}

export function EditProfileScreen({ navigation }: any) {
  const { session } = useAuth();
  const { data, refresh } = useProfile();
  const p = data?.profile;

  // Form fields start empty; we hydrate once `useProfile` resolves. This avoids
  // the bug where the screen mounts before the profile fetch completes and the
  // form ends up permanently empty.
  const [name, setName]         = useState('');
  const [username, setUsername] = useState('');
  const [role, setRole]         = useState('');
  const [location, setLocation] = useState('');
  const [bio, setBio]           = useState('');
  const [instagram, setInstagram] = useState('');
  const [youtube,   setYoutube]   = useState('');
  const [twitter,   setTwitter]   = useState('');
  const [tiktok,    setTiktok]    = useState('');
  const [linkedin,  setLinkedin]  = useState('');

  // Hydrate once. Track via ref so re-renders or background refetches don't
  // clobber whatever the user has typed.
  const hydrated = React.useRef(false);
  React.useEffect(() => {
    if (hydrated.current || !p) return;
    setName(p.display_name || '');
    setUsername(p.username || '');
    setRole(p.role || '');
    setLocation(p.location || '');
    setBio(p.bio || '');
    setInstagram(handleFromSocialUrl('instagram', p.instagram_url));
    setYoutube(handleFromSocialUrl('youtube',   p.youtube_url));
    setTwitter(handleFromSocialUrl('twitter',   p.twitter_url));
    setTiktok(handleFromSocialUrl('tiktok',     p.tiktok_url));
    setLinkedin(handleFromSocialUrl('linkedin', p.linkedin_url));
    hydrated.current = true;
  }, [p]);

  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!session) return;
    setSaving(true);
    try {
      await updateProfile(session.user.id, {
        display_name: name.trim() || null,
        username: username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '') || null,
        role: role.trim() || null,
        location: location.trim() || null,
        bio: bio.trim() || null,
        instagram_url: buildSocialUrl('instagram', instagram),
        youtube_url:   buildSocialUrl('youtube',   youtube),
        twitter_url:   buildSocialUrl('twitter',   twitter),
        tiktok_url:    buildSocialUrl('tiktok',    tiktok),
        linkedin_url:  buildSocialUrl('linkedin',  linkedin),
      });
      await refresh();
      navigation.goBack();
    } catch (e: any) {
      Alert.alert('Could not save', e?.message || 'Unknown error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bgBase }} edges={['top']}>
      <View style={{
        paddingHorizontal: 8, paddingVertical: 12,
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        borderBottomColor: C.borderSubtle, borderBottomWidth: 1,
      }}>
        <Pressable onPress={() => navigation.goBack()} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
          <ChevronLeft size={26} color={C.textPrimary} />
        </Pressable>
        <Text style={{ fontFamily: F.sansBold, fontSize: 17, color: C.textPrimary, letterSpacing: -0.2 }}>Edit profile</Text>
        <Pressable onPress={save} style={{ width: 60, alignItems: 'center', paddingVertical: 12 }}>
          <Text style={{ fontFamily: F.sansBold, fontSize: 15, color: saving ? C.textMuted : C.gold }}>
            {saving ? '…' : 'Save'}
          </Text>
        </Pressable>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={-KEYBOARD_GAP}
        style={{ flex: 1 }}>
      <ScrollView
        contentContainerStyle={{ paddingTop: 8, paddingBottom: 320 }}
        keyboardShouldPersistTaps="handled"
        // iOS: auto-scroll the focused input above the keyboard. Without this,
        // the last social row (LinkedIn) ends up hidden under the keyboard
        // because the form is long enough to need explicit insets.
        automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
        keyboardDismissMode="interactive">
        <Row label="Name"     value={name}     onChange={setName}     placeholder="Your name" />
        <Row label="Username" value={username} onChange={setUsername}
          placeholder="username" autoCapitalize="none"
          help={username ? `vyb.app/${username}` : 'lowercase letters, numbers, underscores'} />
        <Row label="Role"     value={role}     onChange={setRole}     placeholder="Content Creator" />
        <Row label="Location" value={location} onChange={setLocation} placeholder="Miami (optional)" />
        <Row label="Bio"      value={bio}      onChange={setBio}      placeholder="What are you building?" multiline />

        <Text style={{
          fontFamily: F.sansBold, fontSize: 10, color: C.textMuted, letterSpacing: 1.6,
          paddingHorizontal: 20, paddingTop: 24, paddingBottom: 8,
        }}>
          SOCIALS
        </Text>
        <SocialRow platform="instagram" label="Instagram" value={instagram} onChange={setInstagram} />
        <SocialRow platform="youtube"   label="YouTube"   value={youtube}   onChange={setYoutube} />
        <SocialRow platform="twitter"   label="X"         value={twitter}   onChange={setTwitter} />
        <SocialRow platform="tiktok"    label="TikTok"    value={tiktok}    onChange={setTiktok} />
        <SocialRow platform="linkedin"  label="LinkedIn"  value={linkedin}  onChange={setLinkedin} />
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// Social handle input: fixed "@" prefix and a live URL preview below. The
// onChange runs every keystroke through `sanitizeHandle` so the stored value
// never contains "@", URL bits, or whitespace.
function SocialRow({ platform, label, value, onChange }: {
  platform: SocialPlatform;
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const preview = value ? `${PREVIEW_PREFIX[platform]}${value}` : null;
  return (
    <View style={{ paddingHorizontal: 20, borderBottomColor: C.borderSubtle, borderBottomWidth: 1 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 16, gap: 16 }}>
        <Text style={{ width: 96, fontFamily: F.sans, fontSize: 15, color: C.textPrimary }}>
          {label}
        </Text>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
          <Text style={{ fontFamily: F.sans, fontSize: 15, color: C.textMuted }}>@</Text>
          <TextInput
            value={value}
            onChangeText={(raw) => onChange(sanitizeHandle(platform, raw))}
            placeholder="username"
            placeholderTextColor={C.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="default"
            style={{
              flex: 1, marginLeft: 2,
              fontFamily: F.sans, fontSize: 15, color: C.textPrimary, padding: 0,
            }}
          />
        </View>
      </View>
      {preview && (
        <Text style={{ fontFamily: F.mono, fontSize: 11, color: C.textMuted, marginLeft: 112, marginBottom: 10 }}>
          {preview}
        </Text>
      )}
    </View>
  );
}

function Row({ label, value, onChange, placeholder, multiline, autoCapitalize, help }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  help?: string;
}) {
  return (
    <View style={{ paddingHorizontal: 20, borderBottomColor: C.borderSubtle, borderBottomWidth: 1 }}>
      <View style={{ flexDirection: 'row', alignItems: multiline ? 'flex-start' : 'center', paddingVertical: 16, gap: 16 }}>
        <Text style={{ width: 96, fontFamily: F.sans, fontSize: 15, color: C.textPrimary, paddingTop: multiline ? 2 : 0 }}>
          {label}
        </Text>
        <TextInput
          value={value}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor={C.textMuted}
          multiline={multiline}
          autoCapitalize={autoCapitalize}
          style={{
            flex: 1,
            fontFamily: F.sans,
            fontSize: 15,
            color: C.textPrimary,
            padding: 0,
            minHeight: multiline ? 22 : undefined,
            textAlignVertical: multiline ? 'top' : 'center',
          }}
        />
      </View>
      {help && (
        <Text style={{ fontFamily: F.mono, fontSize: 11, color: C.textMuted, marginLeft: 112, marginBottom: 10 }}>
          {help}
        </Text>
      )}
    </View>
  );
}
