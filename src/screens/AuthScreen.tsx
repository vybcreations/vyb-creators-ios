import React, { useState } from 'react';
import { View, Text, TextInput, ScrollView, KeyboardAvoidingView, Platform, Pressable, Alert, ImageBackground, Dimensions, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Mail, ChevronLeft } from 'lucide-react-native';
// ─── Background image + logo tone ───────────────────────────
// Swap BG_IMAGE for any URL. Set LOGO_TONE to 'white' on dark images, 'black' on light ones.
const BG_IMAGE = { uri: 'https://images.unsplash.com/photo-1500375592092-40eb2168fd21?auto=format&fit=crop&w=1400&q=80' };
const LOGO_TONE: 'white' | 'black' = 'white';
const LOGO_WHITE = require('../../assets/logos/vyb-full-white.png');
const LOGO_BLACK = require('../../assets/logos/vyb-full-black.png');
import Svg, { Path } from 'react-native-svg';
import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri } from 'expo-auth-session';
import { GoldButton, Tx } from '../components/primitives';
import { colors as C, fonts as F } from '../theme';
import { VYBTextAnimate } from '../components/ui/VYBTextAnimate';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';

WebBrowser.maybeCompleteAuthSession();

// Parses tokens from a URL fragment (#access_token=...&refresh_token=...)
function tokensFromUrl(url: string) {
  const hash = url.split('#')[1] || url.split('?')[1] || '';
  const params = new URLSearchParams(hash);
  return {
    access_token: params.get('access_token'),
    refresh_token: params.get('refresh_token'),
  };
}

const { height: H } = Dimensions.get('window');

function GoogleG({ size = 18 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Path fill="#4285F4" d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z"/>
      <Path fill="#34A853" d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z"/>
      <Path fill="#FBBC05" d="M11.69 28.18c-.44-1.32-.69-2.73-.69-4.18s.25-2.86.69-4.18v-5.7H4.34C2.85 17.09 2 20.45 2 24s.85 6.91 2.34 9.88l7.35-5.7z"/>
      <Path fill="#EA4335" d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7C13.42 14.62 18.27 10.75 24 10.75z"/>
    </Svg>
  );
}

type Mode = 'chooser' | 'signin' | 'signup';

export function AuthScreen() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<Mode>('chooser');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!email || password.length < 6) {
      Alert.alert('Hmm', 'Need an email and a 6+ character password.');
      return;
    }
    setBusy(true);
    const { error } = mode === 'signin'
      ? await signIn(email.trim(), password)
      : await signUp(email.trim(), password);
    setBusy(false);
    if (error) Alert.alert('Auth error', error.message);
    else if (mode === 'signup') Alert.alert('Check your email', 'Confirm your address to finish signing up.');
  };


  const handleGoogle = async () => {
    setBusy(true);
    try {
      const redirectTo = makeRedirectUri({ path: 'auth-callback' });
      console.log('[OAuth] redirectTo =', redirectTo);
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo, skipBrowserRedirect: true },
      });
      if (error || !data?.url) throw error || new Error('No auth URL');

      const res = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
      if (res.type === 'success' && res.url) {
        const { access_token, refresh_token } = tokensFromUrl(res.url);
        if (access_token && refresh_token) {
          const { error: sErr } = await supabase.auth.setSession({ access_token, refresh_token });
          if (sErr) throw sErr;
        } else {
          throw new Error('No tokens in redirect URL');
        }
      }
    } catch (e: any) {
      Alert.alert('Google sign-in failed', e?.message || 'Unknown error. Make sure the redirect URL is added to Supabase allowlist.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <ImageBackground source={BG_IMAGE} style={{ flex: 1, backgroundColor: '#06060A' }} resizeMode="cover">
      {/* Top fade — keeps wordmark legible on bright images */}
      <LinearGradient
        colors={['rgba(6,6,10,0.55)', 'rgba(6,6,10,0.12)', 'rgba(6,6,10,0)']}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 180 }}
      />
      {/* Bottom fade — most of the screen tints down so buttons sit on dark */}
      <LinearGradient
        colors={['rgba(6,6,10,0)', 'rgba(6,6,10,0.55)', 'rgba(6,6,10,0.92)', '#06060A']}
        locations={[0, 0.45, 0.78, 1]}
        style={{ position: 'absolute', top: H * 0.32, left: 0, right: 0, bottom: 0 }}
      />

      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <ScrollView
            contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 28, paddingTop: 18, paddingBottom: 24, justifyContent: 'flex-end' }}
            keyboardShouldPersistTaps="handled">

            {/* Logo — image at top center */}
            <View style={{ position: 'absolute', top: 14, left: 0, right: 0, alignItems: 'center' }}>
              {mode !== 'chooser' && (
                <Pressable onPress={() => setMode('chooser')} style={{ position: 'absolute', left: 22, top: 14 }}>
                  <ChevronLeft size={24} color={LOGO_TONE === 'white' ? C.textPrimary : C.bgBase} />
                </Pressable>
              )}
              <Image
                source={LOGO_TONE === 'white' ? LOGO_WHITE : LOGO_BLACK}
                resizeMode="contain"
                style={{ width: 130, height: 56 }}
              />
            </View>

            {mode === 'chooser' && (
              <Chooser onGoogle={handleGoogle} onEmail={() => setMode('signin')} />
            )}
            {(mode === 'signin' || mode === 'signup') && (
              <EmailForm
                mode={mode}
                email={email} setEmail={setEmail}
                password={password} setPassword={setPassword}
                busy={busy} onSubmit={submit}
              />
            )}

            {/* Bottom: switch sign in / sign up */}
            <View style={{ alignItems: 'center', paddingTop: 22 }}>
              <Pressable onPress={() => setMode(mode === 'signup' ? 'signin' : 'signup')}>
                <Text style={{ fontFamily: F.sans, fontSize: 13, color: C.textMuted }}>
                  {mode === 'signup' ? 'Already have an account?  ' : 'New here?  '}
                  <Text style={{ color: C.gold, fontFamily: F.sansBold }}>
                    {mode === 'signup' ? 'Sign in' : 'Create one'}
                  </Text>
                </Text>
              </Pressable>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ImageBackground>
  );
}

// ─── Chooser ────────────────────────────────────────────────
function Chooser({ onGoogle, onEmail }: { onGoogle: () => void; onEmail: () => void }) {
  return (
    <View>
      <VYBTextAnimate
        text="Welcome back."
        type="softRollIn"
        stagger={70}
        textStyle={{ fontFamily: F.sansHeavy, fontSize: 34, color: C.textPrimary, letterSpacing: -1, lineHeight: 38 }}
        containerStyle={{ justifyContent: 'center' }}
      />
      <Text style={{ fontFamily: F.sans, fontSize: 14, color: C.textSecondary, textAlign: 'center', marginTop: 12, lineHeight: 22 }}>
        Sign in to continue{'\n'}your practice.
      </Text>

      <View style={{ marginTop: 36, gap: 10 }}>
        <PillButton onPress={onGoogle} bg={C.textPrimary} fg={C.bgBase}
          icon={<GoogleG size={18} />}>
          Continue with Google
        </PillButton>
        <PillButton onPress={onEmail} bg="rgba(255,255,255,0.08)" fg={C.textPrimary} border={C.borderStrong}
          icon={<Mail size={18} color={C.textPrimary} />}>
          Continue with email
        </PillButton>
      </View>
    </View>
  );
}

// ─── Email form ─────────────────────────────────────────────
function EmailForm({ mode, email, setEmail, password, setPassword, busy, onSubmit }: any) {
  return (
    <View>
      <Text style={{ fontFamily: F.sansHeavy, fontSize: 30, color: C.textPrimary, textAlign: 'center', letterSpacing: -0.8 }}>
        {mode === 'signin' ? 'Welcome back.' : 'Make space.'}
      </Text>
      <Text style={{ fontFamily: F.sans, fontSize: 13, color: C.textSecondary, textAlign: 'center', marginTop: 10, lineHeight: 20 }}>
        {mode === 'signin' ? 'Pick up where you left off.' : 'Your inner work — in one quiet place.'}
      </Text>

      <View style={{ marginTop: 28, gap: 10 }}>
        <Text style={Tx.label({ marginLeft: 4 })}>email</Text>
        <TextInput
          value={email} onChangeText={setEmail}
          placeholder="you@example.com" placeholderTextColor={C.textFaint}
          autoCapitalize="none" autoComplete="email" keyboardType="email-address"
          style={inputStyle}
        />
        <Text style={Tx.label({ marginLeft: 4, marginTop: 6 })}>password</Text>
        <TextInput
          value={password} onChangeText={setPassword}
          placeholder="••••••••" placeholderTextColor={C.textFaint}
          secureTextEntry
          autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
          style={inputStyle}
        />
        <View style={{ marginTop: 12 }}>
          <GoldButton variant="complete" size="lg" onPress={onSubmit}
            style={{ justifyContent: 'center', alignSelf: 'stretch' }}>
            {busy ? '…' : mode === 'signin' ? 'Sign in' : 'Create account'}
          </GoldButton>
        </View>
      </View>
    </View>
  );
}

const inputStyle = {
  fontFamily: F.sans, fontSize: 15, color: C.textPrimary,
  backgroundColor: 'rgba(255,255,255,0.06)',
  borderColor: C.borderMid, borderWidth: 1,
  borderRadius: 16, paddingHorizontal: 16, paddingVertical: 14,
};

// ─── PillButton ─────────────────────────────────────────────
function PillButton({ children, onPress, bg, fg, border, icon }: {
  children: React.ReactNode; onPress: () => void; bg: string; fg: string; border?: string; icon?: React.ReactNode;
}) {
  return (
    <Pressable onPress={onPress} style={{
      height: 54, borderRadius: 999, backgroundColor: bg,
      borderColor: border || 'transparent', borderWidth: border ? 1 : 0,
      flexDirection: 'row', alignItems: 'center', paddingHorizontal: 22, gap: 12,
    }}>
      <View style={{ width: 22, alignItems: 'center' }}>{icon}</View>
      <Text style={{ flex: 1, fontFamily: F.sansBold, fontSize: 15, color: fg, letterSpacing: -0.2 }}>
        {children}
      </Text>
    </Pressable>
  );
}
