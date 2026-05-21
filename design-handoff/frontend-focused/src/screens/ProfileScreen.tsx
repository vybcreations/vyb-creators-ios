import React, { useEffect, useRef, useState } from 'react';
import { View, Text, ScrollView, Pressable, Image, ActivityIndicator, RefreshControl, Alert, Dimensions, Linking, Animated, Easing, AccessibilityInfo } from 'react-native';
import { useFocusEffect, useIsFocused } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import {
  Settings, Sparkles, Play, Flame, BookOpen, Edit3, Timer, Camera,
  MapPin, Pencil, ImagePlus, Target, Award, CheckSquare, Lightbulb, Trash2,
} from 'lucide-react-native';
import { ActionMenu } from '../components/ActionMenu';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card, SectionLabel, IconButton, BookCover, Tx } from '../components/primitives';
import { colors as C, gradients as G, fonts as F } from '../theme';
import { useAuth } from '../lib/auth';
import { useProfile, uploadImage, updateProfile } from '../lib/profile';
import { hLight } from '../lib/haptics';
import { ScreenAtmosphere } from '../components/ScreenAtmosphere';
import { VYBPopover, VYBPopoverTrigger, VYBPopoverContent, VYBPopoverItem, VYBPopoverDivider } from '../components/VYBPopover';
import { VYBTextAnimate } from '../components/ui/VYBTextAnimate';
import { VYBGridBeamCard } from '../components/ui/VYBGridBeamCard';
import { VYBBadgeCard, BadgeTier } from '../components/ui/VYBBadgeCard';
import { VYBGlowCard } from '../components/ui/VYBGlowCard';
import { calculateAuraScore, AuraPeriod, getTodaysMissions, Mission } from '../lib/aura/calculateAuraScore';
import { AuraCircle } from '../components/profile/AuraCircle';
import { SocialPill, type SocialPlatform } from '../components/profile/SocialIcon';
import { FeaturedBadge } from '../components/profile/FeaturedBadge';
import { useFavoriteBooks, MAX_FAVORITES } from '../lib/favoriteBooks';
import { FavoritePickerSheet } from './reading/FavoritePickerSheet';

const SCREEN_W = Dimensions.get('window').width;
const DEFAULT_COVER_H = 280;
const MIN_COVER_H = 200;
const MAX_COVER_H = Math.round(SCREEN_W * 5 / 4); // cap at 4:5 portrait
const AVATAR_SIZE = 104;

// This version of lucide-react-native dropped brand icons (Instagram, etc.)
// for trademark reasons. We render small wordmarks instead — cleaner than
// trying to ship our own SVGs and matches the app's typographic tone.
// Real brand glyphs live in SocialIcon (react-native-svg) — we just map the
// profile-row keys to platform names + parse the handle out of the URL.
const SOCIAL_DEFS: { key: 'instagram_url' | 'youtube_url' | 'twitter_url' | 'tiktok_url' | 'linkedin_url'; platform: SocialPlatform; label: string }[] = [
  { key: 'instagram_url', platform: 'instagram', label: 'Instagram' },
  { key: 'youtube_url',   platform: 'youtube',   label: 'YouTube' },
  { key: 'twitter_url',   platform: 'twitter',   label: 'X' },
  { key: 'tiktok_url',    platform: 'tiktok',    label: 'TikTok' },
  { key: 'linkedin_url',  platform: 'linkedin',  label: 'LinkedIn' },
];

// Best-effort handle extraction from a full URL — falls back to the URL.
function handleFromUrl(url: string): string {
  try {
    const u = new URL(url);
    const path = u.pathname.replace(/^\/+|\/+$/g, '').split('/')[0] || u.host;
    return path.replace(/^@/, '');
  } catch {
    const m = url.match(/[a-zA-Z0-9_.\-]+$/);
    return m ? m[0] : url;
  }
}

/**
 * pickUserFeaturedBadge — derive a placeholder "featured highlight" from
 * existing profile stats so the slot feels real without a dedicated DB
 * column yet. Picks the best streak; falls back to active days; finally a
 * neutral momentum chip so the slot is never empty for an engaged user.
 */
function pickUserFeaturedBadge(data: any): { emoji: string; label: string; sublabel?: string } | null {
  if (!data) return null;
  const streaks = [
    { kind: 'writing', n: data.writingStreak || 0 },
    { kind: 'reading', n: data.readingStreak || 0 },
    { kind: 'focus',   n: data.focusStreak   || 0 },
  ];
  const best = streaks.reduce((a, b) => (b.n > a.n ? b : a), streaks[0]);
  if (best.n >= 3) {
    return { emoji: '🔥', label: `${best.n}-day streak`, sublabel: `in ${best.kind}` };
  }
  if ((data.totalBooksFinished || 0) >= 1) {
    return { emoji: '📚', label: 'Finished a book', sublabel: 'Keep going' };
  }
  if ((data.totalActiveDaysThisYear || 0) >= 7) {
    return { emoji: '⚡', label: 'Momentum', sublabel: `${data.totalActiveDaysThisYear} active days` };
  }
  return null;
}

function firstName(full?: string | null, email?: string | null) {
  if (full) return full;
  if (email) return email.split('@')[0];
  return 'You';
}

export function ProfileScreen({ navigation }: any) {
  const { session } = useAuth();
  const { data, loading, refresh } = useProfile();
  const user = session?.user;
  const [uploading, setUploading] = useState<null | 'cover' | 'avatar'>(null);
  const [menuKind, setMenuKind] = useState<null | 'cover' | 'avatar'>(null);
  const [summaryPeriod, setSummaryPeriod] = useState<'day' | 'week' | 'month' | 'lifetime'>('day');

  useFocusEffect(React.useCallback(() => { refresh(); }, [refresh]));

  // Measure cover image to fit its aspect (cap at 4:5 portrait)
  const [coverH, setCoverH] = useState(DEFAULT_COVER_H);
  useEffect(() => {
    const url = data?.profile?.cover_url;
    if (!url) { setCoverH(DEFAULT_COVER_H); return; }
    Image.getSize(url, (w, h) => {
      const aspect = w / h;
      const renderedH = Math.round(SCREEN_W / aspect);
      setCoverH(Math.max(MIN_COVER_H, Math.min(MAX_COVER_H, renderedH)));
    }, () => setCoverH(DEFAULT_COVER_H));
  }, [data?.profile?.cover_url]);

  const p = data?.profile;
  const name     = p?.display_name || (user?.user_metadata as any)?.full_name || (user?.user_metadata as any)?.name || firstName(null, user?.email);
  const avatarUrl = p?.avatar_url   || (user?.user_metadata as any)?.avatar_url || (user?.user_metadata as any)?.picture;
  const coverUrl  = p?.cover_url;
  const role      = p?.role;
  const location  = p?.location;
  const bio       = p?.bio;
  const handle    = p?.username;

  const socials = SOCIAL_DEFS
    .map(s => ({ ...s, url: p?.[s.key] || null }))
    .filter(s => !!s.url);

  const pickAndUpload = async (kind: 'cover' | 'avatar') => {
    if (!session) return;
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Photos permission', 'Allow photo access in Settings to change your ' + kind + '.');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: kind === 'avatar',
      aspect: kind === 'avatar' ? [1, 1] : undefined,
      quality: 0.85,
    });
    if (res.canceled || !res.assets?.[0]) return;
    setUploading(kind);
    try {
      const url = await uploadImage(res.assets[0].uri, kind === 'avatar' ? 'avatars' : 'covers', session.user.id);
      await updateProfile(session.user.id, kind === 'avatar' ? { avatar_url: url } : { cover_url: url });
      await refresh();
    } catch (e: any) {
      Alert.alert('Upload failed', e?.message || 'Could not save image.');
    } finally {
      setUploading(null);
    }
  };

  const openImageMenu = (kind: 'cover' | 'avatar') => setMenuKind(kind);

  // Clear avatar/cover by nulling the URL on the profile row.
  const removeImage = async (kind: 'cover' | 'avatar') => {
    if (!session) return;
    setUploading(kind);
    try {
      await updateProfile(session.user.id, kind === 'avatar' ? { avatar_url: null } : { cover_url: null });
      await refresh();
    } catch (e: any) {
      Alert.alert('Could not remove', e?.message || 'Unknown error');
    } finally {
      setUploading(null);
    }
  };

  const openSocial = (url: string) => {
    hLight();
    Linking.openURL(url).catch(() => Alert.alert('Could not open', url));
  };

  if (loading && !data) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bgBase, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={C.gold} />
      </View>
    );
  }

  const dailyPct = (data?.todayHabitsTotal ?? 0) > 0
    ? Math.round((data!.todayHabitsDone / data!.todayHabitsTotal) * 100)
    : 0;

  return (
    <View style={{ flex: 1, backgroundColor: C.bgBase }}>
      <ScreenAtmosphere />
      <ScrollView
        contentContainerStyle={{ paddingBottom: 140 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={C.gold} />}>

        {/* Cover */}
        <Pressable onPress={() => openImageMenu('cover')} style={{ height: coverH, backgroundColor: C.bgElevated }}>
          {coverUrl ? (
            <Image source={{ uri: coverUrl }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
          ) : (
            <LinearGradient colors={G.dusk as any} style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <Camera size={28} color={C.textMuted} />
              <Text style={{ fontFamily: F.sansBold, fontSize: 12, color: C.textMuted, marginTop: 8, letterSpacing: 1.2, textTransform: 'uppercase' }}>
                Add a cover
              </Text>
            </LinearGradient>
          )}
          <LinearGradient
            colors={['rgba(10,10,12,0)', 'rgba(10,10,12,0.6)', C.bgBase]}
            locations={[0, 0.6, 1]}
            style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 140 }}
          />
          {/* Settings gear (top-right) */}
          <SafeAreaView edges={['top']} style={{ position: 'absolute', top: 0, right: 0, left: 0, flexDirection: 'row', justifyContent: 'flex-end', padding: 14 }}>
            <IconButton size={36} onPress={() => navigation?.getParent()?.navigate('Settings')}>
              <Settings size={16} color={C.textPrimary} />
            </IconButton>
          </SafeAreaView>
          {uploading === 'cover' && (
            <View style={{ position: 'absolute', inset: 0 as any, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(10,10,12,0.5)' }}>
              <ActivityIndicator color={C.gold} />
            </View>
          )}
        </Pressable>

        {/* Avatar + edit button */}
        <View style={{ paddingHorizontal: 22, marginTop: -AVATAR_SIZE / 2, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <VYBPopover>
            <VYBPopoverTrigger>
              <Pressable style={{
                width: AVATAR_SIZE, height: AVATAR_SIZE, borderRadius: AVATAR_SIZE / 2,
                borderColor: C.bgBase, borderWidth: 4, backgroundColor: C.bgElevated,
                overflow: 'hidden',
                shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 16, shadowOffset: { width: 0, height: 8 },
              }}>
                {avatarUrl ? (
                  <Image source={{ uri: avatarUrl }} style={{ width: '100%', height: '100%' }} />
                ) : (
                  <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.goldFaint }}>
                    <Text style={{ fontFamily: F.sansHeavy, fontSize: 40, color: C.gold }}>{name.charAt(0).toUpperCase()}</Text>
                  </View>
                )}
                {uploading === 'avatar' && (
                  <View style={{ position: 'absolute', inset: 0 as any, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(10,10,12,0.5)' }}>
                    <ActivityIndicator color={C.gold} />
                  </View>
                )}
              </Pressable>
            </VYBPopoverTrigger>
            <VYBPopoverContent align="start" width={200}>
              <VYBPopoverItem
                label="Choose photo"
                icon={<ImagePlus size={14} color={C.textPrimary} />}
                onPress={() => pickAndUpload('avatar')}
              />
              {avatarUrl && <VYBPopoverDivider />}
              {avatarUrl && (
                <VYBPopoverItem
                  label="Remove photo"
                  destructive
                  icon={<Pencil size={14} color={C.clay} />}
                  onPress={() => removeImage('avatar')}
                />
              )}
            </VYBPopoverContent>
          </VYBPopover>

          {/* Subtle edit affordance: icon-only circle, easy to find but not a CTA. */}
          <Pressable
            onPress={() => navigation?.getParent()?.navigate('EditProfile')}
            hitSlop={8}
            style={{
              width: 30, height: 30, borderRadius: 15,
              alignItems: 'center', justifyContent: 'center',
              backgroundColor: 'transparent', borderColor: C.borderSubtle, borderWidth: 1,
              marginBottom: 10,
            }}>
            <Pencil size={12} color={C.textMuted} />
          </Pressable>
        </View>

        {/* Identity block — name, @handle, role, bio, location, socials. */}
        <View style={{ paddingHorizontal: 22, marginTop: 16 }}>
          <VYBTextAnimate
            key={name}
            text={name}
            type="fadeUp"
            stagger={50}
            textStyle={{ fontFamily: F.sansHeavy, fontSize: 26, color: C.textPrimary, letterSpacing: -0.6 }}
          />
          {handle && (
            <Text style={{ fontFamily: F.mono, fontSize: 12, color: C.textMuted, marginTop: 4 }}>
              @{handle}
            </Text>
          )}
          {role && (
            <Text style={{ fontFamily: F.serifItalic, fontSize: 14, color: C.textSecondary, marginTop: 10, letterSpacing: 0.1 }}>
              {role}
            </Text>
          )}
          {bio && (
            <Text style={{ fontFamily: F.sans, fontSize: 14, color: C.textSecondary, marginTop: 10, lineHeight: 22 }}>
              {bio}
            </Text>
          )}
          {location && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 10 }}>
              <MapPin size={11} color={C.textMuted} />
              <Text style={{ fontFamily: F.sans, fontSize: 12, color: C.textMuted }}>{location}</Text>
            </View>
          )}

          {/* Featured highlight badge — placeholder visual until the full
              badge system ships. Mirrors the friend profile's featured area. */}
          {(() => {
            const fb = pickUserFeaturedBadge(data);
            if (!fb) return null;
            return (
              <View style={{ flexDirection: 'row', marginTop: 14 }}>
                <FeaturedBadge badge={fb} />
              </View>
            );
          })()}

          {socials.length > 0 && (
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
              {socials.map(s => (
                <SocialPill
                  key={s.key}
                  platform={s.platform}
                  handle={handleFromUrl(s.url!)}
                  url={s.url!}
                />
              ))}
            </View>
          )}

          {!bio && !role && (
            <Pressable onPress={() => navigation?.getParent()?.navigate('EditProfile')} style={{ marginTop: 12 }}>
              <Text style={{ fontFamily: F.serifItalic, fontSize: 14, color: C.gold }}>Add a role and bio →</Text>
            </Pressable>
          )}
        </View>

        {/* ───────── LOWER PROFILE — progress showcase, not a dashboard. ──── */}
        <FeaturedHighlight data={data} />
        <PeriodSummary data={data} period={summaryPeriod} setPeriod={setSummaryPeriod} />
        <AuraStateCard data={data} />
        <MilestonesPreview data={data} />
        <FavoriteBooksSection navigation={navigation} />
        <RecentActivityList items={data?.recentActivity ?? []} />

        {/* Heatmap — progress history, kept because it's identity-flavored
            and complements the milestones (not an action surface). */}
        <View style={{ paddingHorizontal: 16, marginTop: 12 }}>
          <Card padding={16}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <SectionLabel>last 26 weeks</SectionLabel>
              <Text style={{ fontFamily: F.mono, fontSize: 10, color: C.textMuted }}>
                {(data?.totalActiveDaysThisYear ?? 0) > 0
                  ? `${data?.totalActiveDaysThisYear} active days`
                  : 'no activity yet'}
              </Text>
            </View>
            <View style={{ marginTop: 12 }}>
              <ActivityHeatmap intensity={data?.activityIntensity} />
            </View>
            {(data?.totalActiveDaysThisYear ?? 0) === 0 && (
              <Text style={{ fontFamily: F.serifItalic, fontSize: 12, color: C.textMuted, marginTop: 10, textAlign: 'center' }}>
                Your activity will appear here as you use the app.
              </Text>
            )}
          </Card>
        </View>
      </ScrollView>

      <ActionMenu
        visible={menuKind !== null}
        onDismiss={() => setMenuKind(null)}
        title={menuKind === 'cover' ? 'Background' : 'Profile picture'}
        options={menuKind === null ? [] : [
          {
            label: coverUrl && menuKind === 'cover'
              ? 'Change background'
              : !coverUrl && menuKind === 'cover'
                ? 'Add background'
                : avatarUrl
                  ? 'Change photo'
                  : 'Add photo',
            icon: <ImagePlus size={18} color={C.textPrimary} />,
            onPress: () => pickAndUpload(menuKind),
          },
          // Only show Remove when there's actually an image to remove.
          ...((menuKind === 'cover' && coverUrl) || (menuKind === 'avatar' && avatarUrl) ? [{
            label: menuKind === 'cover' ? 'Remove background' : 'Remove photo',
            destructive: true,
            icon: <Trash2 size={16} color={C.clay} />,
            onPress: () => removeImage(menuKind),
          }] : []),
        ]}
      />
    </View>
  );
}

/**
 * FavoriteBooksSection — Letterboxd-style top picks on the user's profile.
 * Pulls from `user_book_favorites` (joined with books). Empty state surfaces
 * the picker; tapping a cover opens the book. "Edit" reopens the picker.
 */
function FavoriteBooksSection({ navigation }: { navigation: any }) {
  const { favorites, refresh } = useFavoriteBooks();
  const [pickerOpen, setPickerOpen] = useState(false);

  return (
    <View style={{ paddingHorizontal: 16, marginTop: 22 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginLeft: 4, marginBottom: 8 }}>
        <SectionLabel>favorites</SectionLabel>
        {favorites.length > 0 && (
          <Pressable onPress={() => setPickerOpen(true)} hitSlop={6}>
            <Text style={{ fontFamily: F.sansBold, fontSize: 10, color: C.gold, letterSpacing: 1.2 }}>
              EDIT
            </Text>
          </Pressable>
        )}
      </View>

      {favorites.length === 0 ? (
        <Pressable onPress={() => setPickerOpen(true)} style={{
          paddingVertical: 22, paddingHorizontal: 18, borderRadius: 16,
          backgroundColor: 'rgba(255,255,255,0.025)',
          borderColor: C.borderSubtle, borderWidth: 1, borderStyle: 'dashed',
          alignItems: 'center',
        }}>
          <Text style={{ fontFamily: F.serifItalic, fontSize: 13, color: C.textSecondary, textAlign: 'center' }}>
            No favorite books yet.
          </Text>
          <Text style={{ fontFamily: F.sansBold, fontSize: 11, color: C.gold, marginTop: 8, letterSpacing: 0.8 }}>
            Add favorite books →
          </Text>
        </Pressable>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 4, gap: 14 }}>
          {favorites.map(b => (
            <Pressable
              key={b.id}
              onPress={() => navigation?.getParent()?.navigate('BookDetail', { bookId: b.id })}
              style={{ width: 88 }}>
              <FavoriteCover book={b} />
              <Text numberOfLines={2} style={{
                fontFamily: F.sansBold, fontSize: 11, color: C.textPrimary,
                marginTop: 8, lineHeight: 14,
              }}>
                {b.title}
              </Text>
              {b.author && (
                <Text numberOfLines={1} style={{
                  fontFamily: F.serifItalic, fontSize: 10, color: C.textMuted, marginTop: 1,
                }}>
                  {b.author}
                </Text>
              )}
            </Pressable>
          ))}
          {favorites.length < MAX_FAVORITES && (
            <Pressable onPress={() => setPickerOpen(true)} style={{
              width: 88, height: 132, borderRadius: 10,
              borderColor: 'rgba(201,169,97,0.30)', borderWidth: 1, borderStyle: 'dashed',
              backgroundColor: 'rgba(201,169,97,0.04)',
              alignItems: 'center', justifyContent: 'center', padding: 8,
            }}>
              <Text style={{ fontFamily: F.sansHeavy, fontSize: 22, color: C.gold }}>+</Text>
              <Text style={{ fontFamily: F.sansBold, fontSize: 9, color: C.gold, marginTop: 4, letterSpacing: 0.6, textAlign: 'center' }}>
                ADD
              </Text>
            </Pressable>
          )}
        </ScrollView>
      )}

      <FavoritePickerSheet
        visible={pickerOpen}
        onDismiss={() => setPickerOpen(false)}
        onChanged={refresh}
      />
    </View>
  );
}

function FavoriteCover({ book }: { book: { cover_url: string | null; title: string } }) {
  const W = 88, H = 132;
  const FRAME = { borderColor: 'rgba(201,169,97,0.55)', borderWidth: 1.5 };
  if (book.cover_url) {
    return (
      <Image source={{ uri: book.cover_url }} resizeMode="cover"
        style={{
          width: W, height: H, borderRadius: 10,
          backgroundColor: C.bgOverlay, ...FRAME,
          shadowColor: '#000', shadowOpacity: 0.45, shadowRadius: 12, shadowOffset: { width: 0, height: 6 },
        }} />
    );
  }
  const initials = (book.title.match(/\b\w/g) || []).slice(0, 2).join('').toUpperCase() || '—';
  return (
    <View style={{
      width: W, height: H, borderRadius: 10, overflow: 'hidden', ...FRAME,
      backgroundColor: C.bgElevated,
    }}>
      <LinearGradient
        colors={['rgba(201,169,97,0.22)', 'rgba(28,28,34,0.95)']}
        start={{ x: 0.2, y: 0 }} end={{ x: 1, y: 1 }}
        style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 6 }}>
        <Text style={{ fontFamily: F.sansHeavy, fontSize: 24, color: 'rgba(244,240,232,0.85)' }}>
          {initials}
        </Text>
      </LinearGradient>
    </View>
  );
}

function ActivityHeatmap({ intensity }: { intensity?: Map<string, number> }) {
  const cells = React.useMemo(() => {
    const out: { date: string; n: number }[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const start = new Date(today);
    start.setDate(start.getDate() - (26 * 7 - 1));
    const local = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    for (let i = 0; i < 26 * 7; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const key = local(d);
      out.push({ date: key, n: intensity?.get(key) || 0 });
    }
    return out;
  }, [intensity]);

  // 0 → dark gray. 1 → muted sand. 2 → warm gold. 3+ → sage.
  const cellColor = (n: number) =>
    n <= 0 ? C.borderSubtle :
    n === 1 ? 'rgba(160,138,86,0.35)' :
    n === 2 ? 'rgba(201,169,97,0.85)' :
              'rgba(143,168,138,0.95)';

  return (
    <View style={{ flexDirection: 'row', gap: 3 }}>
      {Array.from({ length: 26 }).map((_, col) => (
        <View key={col} style={{ flex: 1, gap: 3 }}>
          {Array.from({ length: 7 }).map((__, row) => {
            const c = cells[col * 7 + row];
            return (
              <View key={row} style={{ aspectRatio: 1, borderRadius: 3, backgroundColor: cellColor(c?.n || 0) }} />
            );
          })}
        </View>
      ))}
    </View>
  );
}

// ─── Lower profile sections ────────────────────────────────────────────────

import type { ProfileStats, ActivityItem, PeriodStats } from '../lib/profile';

/**
 * FeaturedHighlight — one prominent number that captures the user's current
 * momentum. Picks the best of {writing, reading, focus} streaks; falls back
 * to active days when no streak exists yet. Wrapped in `VYBGridBeamCard` so
 * it feels like the marquee.
 */
/**
 * MissionRow — compact quest line inside the Aura card. Icon + short text.
 * Not styled as a button because tap navigation isn't wired yet.
 */
const MISSION_ICON: Record<Mission['type'], typeof CheckSquare> = {
  task:       CheckSquare,
  habit:      Flame,
  learning:   BookOpen,
  reflection: Edit3,
  idea:       Lightbulb,
  complete:   Award,
};
const MISSION_TINT: Record<Mission['priority'], string> = {
  urgent:    '#D27050',
  high:      '#8FA88A',
  important: '#5DA3C9',
  medium:    '#C9A961',
  low:       '#9F8FD4',
  done:      C.textMuted,
};
function NextBestActionPanel({ missions }: { missions: Mission[] }) {
  const [open, setOpen] = useState(false);
  const rotate = useRef(new Animated.Value(0)).current;
  const fade = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(rotate, {
      toValue: open ? 1 : 0,
      duration: 220,
      easing: Easing.bezier(0.22, 1, 0.36, 1),
      useNativeDriver: true,
    }).start();
    Animated.timing(fade, {
      toValue: open ? 1 : 0,
      duration: 220,
      easing: Easing.bezier(0.22, 1, 0.36, 1),
      useNativeDriver: false,
    }).start();
  }, [open, rotate, fade]);
  const rotateZ = rotate.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '90deg'] });
  const primary = missions[0];
  const extras = missions.slice(1);
  return (
    <View style={{
      marginTop: 14, paddingTop: 12,
      borderTopColor: C.borderSubtle, borderTopWidth: 1,
    }}>
      <Pressable onPress={() => setOpen(o => !o)} hitSlop={6}
        style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={Tx.label({ letterSpacing: 1.6 })}>NEXT BEST ACTION</Text>
        {extras.length > 0 && (
          <Animated.Text style={{
            fontFamily: F.sansBold, fontSize: 12, color: C.textMuted,
            transform: [{ rotateZ }],
          }}>›</Animated.Text>
        )}
      </Pressable>
      <View style={{ marginTop: 8 }}>
        <MissionRow mission={primary} />
      </View>
      {extras.length > 0 && open && (
        <Animated.View style={{ marginTop: 8, gap: 7, opacity: fade }}>
          {extras.map(m => <MissionRow key={m.id} mission={m} />)}
        </Animated.View>
      )}
    </View>
  );
}

function MissionRow({ mission }: { mission: Mission }) {
  const Icon = MISSION_ICON[mission.type];
  const tint = MISSION_TINT[mission.priority];
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <View style={{
        width: 20, height: 20, borderRadius: 10,
        backgroundColor: C.bgOverlay, borderColor: C.borderSubtle, borderWidth: 1,
        alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon size={11} color={tint} />
      </View>
      <Text numberOfLines={1} style={{
        flex: 1, fontFamily: F.sans, fontSize: 12.5, color: C.textPrimary, lineHeight: 17,
      }}>
        {mission.text}
      </Text>
    </View>
  );
}

/**
 * AnimatedBar — animates a horizontal fill bar's width between 0..100.
 * Used inside the Aura pillar breakdown so bar values glide between periods.
 */
function AnimatedBar({ value, color }: { value: number; color: string }) {
  const w = useRef(new Animated.Value(value)).current;
  useEffect(() => {
    Animated.timing(w, {
      toValue: value, duration: 320,
      easing: Easing.bezier(0.22, 1, 0.36, 1),
      useNativeDriver: false,
    }).start();
  }, [value, w]);
  const width = w.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] });
  return <Animated.View style={{ width, height: '100%', backgroundColor: color }} />;
}

function HighlightSweep({ width }: { width: number }) {
  const x = useRef(new Animated.Value(-1)).current;
  const isFocused = useIsFocused();
  useEffect(() => {
    // Self-recursing setTimeout chain: keep a flag so we can cut the chain
    // when Profile loses focus, otherwise the sweep keeps animating in the
    // background while the user is on Home / Reading / etc.
    let alive = isFocused;
    const run = () => {
      if (!alive) return;
      x.setValue(-1);
      Animated.timing(x, {
        toValue: 1, duration: 2600,
        easing: Easing.bezier(0.22, 1, 0.36, 1),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished && alive) setTimeout(run, 2400);
      });
    };
    if (isFocused) run();
    return () => { alive = false; };
  }, [x, isFocused]);
  if (width <= 0) return null;
  const translateX = x.interpolate({ inputRange: [-1, 1], outputRange: [-width * 0.6, width] });
  return (
    <Animated.View pointerEvents="none" style={{
      position: 'absolute', top: 0, bottom: 0, left: 0, width: width * 0.55,
      transform: [{ translateX }, { skewX: '-20deg' }],
    }}>
      <LinearGradient
        colors={['rgba(255,255,255,0)', 'rgba(232,200,120,0.18)', 'rgba(255,255,255,0)']}
        start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }}
        style={{ flex: 1 }}
      />
    </Animated.View>
  );
}

function FeaturedHighlight({ data }: { data: ProfileStats | null }) {
  const [cardW, setCardW] = useState(0);
  if (!data) return null;
  const streaks = [
    { label: 'in writing', n: data.writingStreak, Icon: Edit3 },
    { label: 'in reading', n: data.readingStreak, Icon: BookOpen },
    { label: 'in focus',   n: data.focusStreak,   Icon: Timer },
  ];
  const best = streaks.reduce((a, b) => (b.n > a.n ? b : a), streaks[0]);

  // Empty state — neutral / not gold. Reads as "waiting", not "earned".
  if (best.n === 0) {
    return (
      <View style={{ paddingHorizontal: 16, marginTop: 22 }}>
        <VYBGlowCard variant="neutral" intensity="soft" contentStyle={{ padding: 20 }}>
          <Text style={Tx.label({ letterSpacing: 1.6 })}>CURRENT HIGHLIGHT</Text>
          <Text style={{ fontFamily: F.serifItalic, fontSize: 18, color: C.textSecondary, marginTop: 10, lineHeight: 24 }}>
            Your journey starts here.
          </Text>
          <Text style={{ fontFamily: F.sans, fontSize: 12, color: C.textMuted, marginTop: 6, lineHeight: 18 }}>
            Build a streak, finish a book, capture an idea — your highlight will appear here.
          </Text>
        </VYBGlowCard>
      </View>
    );
  }

  return (
    <View style={{ paddingHorizontal: 16, marginTop: 22 }}
      onLayout={e => setCardW(e.nativeEvent.layout.width - 32)}>
      <VYBGlowCard variant="gold" intensity="medium" contentStyle={{ padding: 20, overflow: 'hidden' }}>
        <HighlightSweep width={cardW} />
        <Text style={Tx.label({ letterSpacing: 1.6 })}>CURRENT HIGHLIGHT</Text>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 10, marginTop: 12 }}>
          <Text style={{ fontFamily: F.sansHeavy, fontSize: 56, color: C.goldBright, letterSpacing: -2, lineHeight: 56 }}>
            {best.n}
          </Text>
          <View style={{ paddingBottom: 6 }}>
            <Text style={{ fontFamily: F.sansBold, fontSize: 12, color: C.textPrimary, letterSpacing: 0.3 }}>
              day{best.n === 1 ? '' : 's'} streak
            </Text>
            <Text style={{ fontFamily: F.serifItalic, fontSize: 12, color: C.textMuted, marginTop: 2 }}>
              {best.label}
            </Text>
          </View>
        </View>
      </VYBGlowCard>
    </View>
  );
}

/**
 * AuraStateCard — V1 of the Kaizen / Aura score. Reads existing app data,
 * weights consistency over quantity (per spec), shows a 0–100 score with
 * state label, message, and a soft progress ring. Tasks + ideas are capped
 * so the score can't be inflated with trivial entries.
 */
function AuraStateCard({ data }: { data: ProfileStats | null }) {
  // Default to Day — the most immediate / rewarding view.
  const [period, setPeriod] = React.useState<AuraPeriod>('day');
  const [showExplain, setShowExplain] = React.useState(false);

  // Toggle-pill animation: equal-width segments, sliding indicator, and a
  // colour value that drifts between gold/sage/blue as the period changes.
  const auraToggleWidth = 210;
  const auraSegW = (auraToggleWidth - 4) / 3;
  const auraIndicatorX = useRef(new Animated.Value(0)).current;
  const auraColorValue = useRef(new Animated.Value(0)).current;
  const PERIODS = ['day', 'week', 'month'] as const;
  useEffect(() => {
    const idx = PERIODS.indexOf(period);
    // Both run on the JS driver — color interpolation requires it, and
    // mixing drivers in parallel can pin the slide value to "native" before
    // the color animation tries to read it (Animated throws on that mix).
    Animated.timing(auraIndicatorX, {
      toValue: idx * auraSegW,
      duration: 240,
      easing: Easing.bezier(0.22, 1, 0.36, 1),
      useNativeDriver: false,
    }).start();
    Animated.timing(auraColorValue, {
      toValue: idx,
      duration: 360,
      easing: Easing.bezier(0.22, 1, 0.36, 1),
      useNativeDriver: false,
    }).start();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period]);
  const pillColor = auraColorValue.interpolate({
    inputRange: [0, 1, 2],
    outputRange: ['rgba(201,169,97,0.20)', 'rgba(143,168,138,0.22)', 'rgba(93,163,201,0.22)'],
  });
  const accentTextColor = auraColorValue.interpolate({
    inputRange: [0, 1, 2],
    outputRange: ['rgba(201,169,97,1)', 'rgba(143,168,138,1)', 'rgba(93,163,201,1)'],
  });

  if (!data) return null;

  // Pick the right slice of pre-bucketed stats + the period-to-date elapsed
  // day count. For "day", elapsedDays is always 1, and habits-planned
  // doesn't multiply (we expect all of today's habits in a single day).
  const stats =
    period === 'day'  ? data.thisDay :
    period === 'week' ? data.thisWeek : data.thisMonth;
  const elapsedDays =
    period === 'day'  ? 1 :
    period === 'week' ? data.effectiveElapsedDaysInWeek : data.effectiveElapsedDaysInMonth;
  const habitsPlanned =
    period === 'day'  ? data.plannedHabitsToday :
    period === 'week' ? data.plannedHabitsThisWeek : data.plannedHabitsThisMonth;

  // Active days within the selected window — derive from the activeDays set
  // using a local-date period start that matches what the lib filters on.
  const periodStartLocal = new Date();
  if (period === 'day') {
    // today only — periodStartLocal stays at "today"
  } else if (period === 'week') {
    const dow = periodStartLocal.getDay();
    periodStartLocal.setDate(periodStartLocal.getDate() - (dow === 0 ? 6 : dow - 1));
  } else {
    periodStartLocal.setDate(1);
  }
  periodStartLocal.setHours(0, 0, 0, 0);
  const periodStartStr =
    `${periodStartLocal.getFullYear()}-${String(periodStartLocal.getMonth() + 1).padStart(2, '0')}-${String(periodStartLocal.getDate()).padStart(2, '0')}`;
  let activeDays = 0;
  data.activeDays.forEach(d => { if (d >= periodStartStr) activeDays++; });

  // Per-area activity used by balance — we treat each of the four pillars
  // as its own "area" so the calc can see how spread out the energy is.
  const areaActivity: Record<string, number> = {
    habits:  stats.habits,
    reading: stats.pages,
    tasks:   stats.tasks,
    ideas:   stats.ideas,
  };

  const aura = calculateAuraScore({
    period,
    elapsedDays,
    habitsCompleted: stats.habits,
    habitsPlanned,
    pagesRead: stats.pages,
    activeDays,
    tasksCompleted: stats.tasks,
    ideasCaptured: stats.ideas,
    areaActivity,
    nbaContext: {
      incompleteHabits: data.incompleteHabitsToday,
      openTasks: data.openTasksByPriority,
      readingLoggedToday: (data.thisDay.pages || 0) > 0,
      ideasCapturedToday: data.thisDay.ideas || 0,
      hourOfDay: new Date().getHours(),
    },
  });

  // Missions are about today's work — independent of the Day/Week/Month
  // toggle so switching the toggle doesn't shuffle the quest list.
  const todaysMissions = React.useMemo(() => getTodaysMissions({
    incompleteHabits: data.incompleteHabitsToday,
    openTasks: data.openTasksByPriority,
    readingLoggedToday: (data.thisDay.pages || 0) > 0,
    ideasCapturedToday: data.thisDay.ideas || 0,
    hourOfDay: new Date().getHours(),
  }), [data]);

  return (
    <View style={{ paddingHorizontal: 16, marginTop: 12 }}>
      <VYBGlowCard
        variant={period === 'day' ? 'gold' : period === 'week' ? 'sage' : 'blue'}
        intensity="medium" contentStyle={{ padding: 18 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
          <AuraCircle score={aura.score} state={aura.state} size={104} />

          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={Tx.label({ letterSpacing: 1.6 })}>AURA STATE</Text>
              <Pressable onPress={() => setShowExplain(s => !s)} hitSlop={6}
                style={{
                  width: 18, height: 18, borderRadius: 9,
                  backgroundColor: showExplain ? C.goldFaint : 'transparent',
                  borderColor: C.borderSubtle, borderWidth: 1,
                  alignItems: 'center', justifyContent: 'center',
                }}>
                <Text style={{ fontFamily: F.sansBold, fontSize: 10, color: showExplain ? C.gold : C.textMuted }}>?</Text>
              </Pressable>
            </View>
            <Text style={{ fontFamily: F.sansHeavy, fontSize: 18, color: C.textPrimary, marginTop: 6, letterSpacing: -0.3 }}>
              {aura.label}
            </Text>
            <Text numberOfLines={2} ellipsizeMode="tail" style={{
              fontFamily: F.sans, fontSize: 12, color: C.textMuted,
              marginTop: 4, lineHeight: 17, minHeight: 34,
            }}>
              {aura.message}
            </Text>

            {/* Day / Week / Month toggle with sliding indicator + colour drift. */}
            {!aura.isEmpty && (
              <View style={{
                flexDirection: 'row', alignSelf: 'flex-start', marginTop: 10,
                padding: 2, borderRadius: 999, width: auraToggleWidth, height: 26,
                backgroundColor: C.bgOverlay, borderColor: C.borderSubtle, borderWidth: 1,
                position: 'relative',
              }}>
                <Animated.View pointerEvents="none" style={{
                  position: 'absolute', top: 2, left: 2,
                  width: auraSegW, height: 22, borderRadius: 999,
                  backgroundColor: pillColor,
                  transform: [{ translateX: auraIndicatorX }],
                }} />
                {PERIODS.map(p => {
                  const active = period === p;
                  return (
                    <Pressable key={p} onPress={() => setPeriod(p)} hitSlop={4}
                      style={{ width: auraSegW, height: 22, borderRadius: 999, alignItems: 'center', justifyContent: 'center' }}>
                      <Animated.Text style={{
                        fontFamily: F.sansBold, fontSize: 10,
                        color: active ? accentTextColor : C.textMuted, letterSpacing: 0.4,
                        textTransform: 'uppercase',
                      }}>{p}</Animated.Text>
                    </Pressable>
                  );
                })}
              </View>
            )}
            <Text style={{
              fontFamily: F.serifItalic, fontSize: 12, color: C.textMuted,
              marginTop: 8,
            }}>
              {period === 'day'   ? 'Build today’s momentum.' :
               period === 'week'  ? 'Keep this week alive.' :
                                    'Strengthen your monthly rhythm.'}
            </Text>
          </View>
        </View>

        {/* Breakdown — Tasks first (most actionable), then Habits, Learning,
            Ideas. Balance + Rhythm still feed the score but live in the
            explanation panel. Bars animate to their new values. */}
        {!aura.isEmpty && (
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
            {[
              { label: 'Tasks',    v: aura.parts.tasks,    color: '#5DA3C9' /* blue */ },
              { label: 'Habits',   v: aura.parts.habits,   color: '#8FA88A' /* sage */ },
              { label: 'Learning', v: aura.parts.learning, color: '#C9A961' /* gold */ },
              { label: 'Ideas',    v: aura.parts.ideas,    color: '#9F8FD4' /* violet */ },
            ].map(b => (
              <View key={b.label} style={{ flex: 1 }}>
                <View style={{ height: 3, backgroundColor: C.borderSubtle, borderRadius: 2, overflow: 'hidden' }}>
                  <AnimatedBar value={b.v} color={b.color} />
                </View>
                <Text style={{
                  fontFamily: F.sansBold, fontSize: 9, color: C.textFaint,
                  marginTop: 5, letterSpacing: 0.8, textAlign: 'center', textTransform: 'uppercase',
                }}>
                  {b.label}
                </Text>
                <AnimatedStatNumber value={b.v} duration={260}
                  style={{ fontFamily: F.mono, fontSize: 9.5, color: C.textMuted, marginTop: 1, textAlign: 'center' }} />
              </View>
            ))}
          </View>
        )}

        {/* How this works — collapsible explanation of every pillar. Stays
            collapsed by default so the card reads clean. */}
        {showExplain && (
          <View style={{
            marginTop: 14, paddingTop: 12,
            borderTopColor: C.borderSubtle, borderTopWidth: 1,
          }}>
            <Text style={{
              fontFamily: F.sans, fontSize: 11.5, color: C.textMuted,
              lineHeight: 16, marginBottom: 10,
            }}>
              {period === 'day'
                ? 'Today’s Aura shows how alive your system feels today. Tasks and ideas are capped so the score rewards consistency over volume.'
                : period === 'week'
                  ? 'Weekly Aura tracks your consistency across the current week so far. Tasks and ideas are capped so volume can’t inflate the score.'
                  : 'Monthly Aura shows your longer-term rhythm this month. Tasks and ideas are capped so volume can’t inflate the score.'}
            </Text>
            <View style={{ gap: 6 }}>
              {aura.details.filter(d => d.visible).map(d => (
                <ExplainRow key={d.key} term={d.label} desc={d.description} />
              ))}
              <Text style={{
                fontFamily: F.sansBold, fontSize: 9, color: C.textFaint,
                letterSpacing: 1.2, marginTop: 8, textTransform: 'uppercase',
              }}>
                Behind the score
              </Text>
              {aura.details.filter(d => !d.visible).map(d => (
                <ExplainRow key={d.key} term={d.label} desc={d.description} />
              ))}
            </View>
          </View>
        )}

        {/* Next best action — collapsed by default, shows the top mission.
            Tap to expand to up to 3 more recommendations. Stays constant
            across Day/Week/Month so switching the toggle doesn't reshape it. */}
        {!aura.isEmpty && todaysMissions.length > 0 && (
          <NextBestActionPanel missions={todaysMissions} />
        )}
      </VYBGlowCard>
    </View>
  );
}

/**
 * AnimatedStatNumber — drives an integer text value from its previous value to
 * `value` over `duration` ms using a cubic ease-out. Respects Reduce Motion
 * (no count-up animation when the OS flag is on).
 */
function AnimatedStatNumber({
  value, duration = 320, style,
}: { value: number; duration?: number; style?: any }) {
  const [display, setDisplay] = useState(value);
  const [reduceMotion, setReduceMotion] = useState(false);
  const rafRef = useRef<number | null>(null);
  const fromRef = useRef(value);
  const startRef = useRef(0);

  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled?.().then(v => { if (alive) setReduceMotion(!!v); });
    const sub = AccessibilityInfo.addEventListener?.('reduceMotionChanged', v => setReduceMotion(!!v));
    return () => { alive = false; (sub as any)?.remove?.(); };
  }, []);

  useEffect(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (value === display) return;
    if (reduceMotion) { setDisplay(value); return; }
    fromRef.current = display;
    startRef.current = Date.now();
    // Approximate cubic-bezier(0.22, 1, 0.36, 1) — easeOutQuint.
    const ease = (t: number) => 1 - Math.pow(1 - t, 5);
    const tick = () => {
      const t = Math.min(1, (Date.now() - startRef.current) / duration);
      const v = fromRef.current + (value - fromRef.current) * ease(t);
      setDisplay(Math.round(v));
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, reduceMotion]);

  return <Text style={style}>{display}</Text>;
}

/**
 * PeriodSummary — Day/Week/Month toggle + a 2×2 metric grid for the period.
 * Animates the toggle pill, the metric numbers, and color theme transitions.
 */
type SummaryPeriod = 'day' | 'week' | 'month' | 'lifetime';

function PeriodSummary({
  data, period, setPeriod,
}: {
  data: ProfileStats | null;
  period: SummaryPeriod;
  setPeriod: (p: SummaryPeriod) => void;
}) {
  const indicatorX = useRef(new Animated.Value(0)).current;
  const PERIODS: SummaryPeriod[] = ['day', 'week', 'month', 'lifetime'];
  const SEG_W = 64;

  useEffect(() => {
    const idx = PERIODS.indexOf(period);
    Animated.timing(indicatorX, {
      toValue: idx * SEG_W,
      duration: 220,
      easing: Easing.bezier(0.22, 1, 0.36, 1),
      useNativeDriver: false,
    }).start();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period]);

  if (!data) return null;
  // Lifetime uses cumulative totals; other periods use bucketed stats.
  const rows = period === 'lifetime'
    ? [
        { label: 'Tasks',      v: data.totalTasksDone },
        { label: 'Habits',     v: data.totalHabitsDone },
        { label: 'Pages read', v: data.totalPagesRead },
        { label: 'Ideas',      v: data.totalIdeasCaptured },
      ]
    : (() => {
        const stats: PeriodStats =
          period === 'day'  ? data.thisDay :
          period === 'week' ? data.thisWeek : data.thisMonth;
        return [
          { label: 'Habits',     v: stats.habits },
          { label: 'Tasks',      v: stats.tasks },
          { label: 'Pages read', v: stats.pages },
          { label: 'Ideas',      v: stats.ideas },
        ];
      })();
  const label =
    period === 'day'   ? 'today' :
    period === 'week'  ? 'this week' :
    period === 'month' ? 'this month' : 'lifetime';
  const variant: 'gold' | 'sage' | 'blue' | 'neutral' =
    period === 'day'      ? 'gold' :
    period === 'week'     ? 'sage' :
    period === 'month'    ? 'blue' : 'neutral';
  const intensity: 'medium' | 'soft' = period === 'lifetime' ? 'soft' : 'medium';
  const activeColor =
    period === 'day'      ? C.gold :
    period === 'week'     ? '#8FA88A' :
    period === 'month'    ? '#5DA3C9' : C.textSecondary;

  return (
    <View style={{ paddingHorizontal: 16, marginTop: 18 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <SectionLabel style={{ marginLeft: 4 }}>{label}</SectionLabel>
        <View style={{
          flexDirection: 'row', padding: 3, borderRadius: 999, width: SEG_W * 4 + 6,
          backgroundColor: C.bgOverlay, borderColor: C.borderSubtle, borderWidth: 1,
          position: 'relative',
        }}>
          <Animated.View
            pointerEvents="none"
            style={{
              position: 'absolute', top: 3, left: 3,
              width: SEG_W, height: 24, borderRadius: 999,
              backgroundColor: C.goldFaint,
              transform: [{ translateX: indicatorX }],
            }}
          />
          {PERIODS.map(p => {
            const active = period === p;
            const tabLabel =
              p === 'day' ? 'Today' :
              p === 'week' ? 'Week' :
              p === 'month' ? 'Month' : 'Life';
            return (
              <Pressable key={p} onPress={() => setPeriod(p)} hitSlop={4}
                style={{ width: SEG_W, height: 24, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{
                  fontFamily: F.sansBold, fontSize: 10,
                  color: active ? activeColor : C.textMuted, letterSpacing: 0.5,
                  textTransform: 'uppercase',
                }}>
                  {tabLabel}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
      <VYBGlowCard variant={variant} intensity={intensity} contentStyle={{ padding: 16 }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {rows.map((r, i) => (
            <View key={r.label} style={{
              width: '50%', paddingVertical: 8,
              borderRightWidth: i % 2 === 0 ? 1 : 0,
              borderRightColor: C.borderSubtle,
              borderBottomWidth: i < 2 ? 1 : 0,
              borderBottomColor: C.borderSubtle,
              paddingLeft: i % 2 === 0 ? 0 : 14,
              paddingRight: i % 2 === 0 ? 14 : 0,
            }}>
              <AnimatedStatNumber value={r.v}
                style={{ fontFamily: F.sansHeavy, fontSize: 22, color: C.textPrimary, letterSpacing: -0.6 }} />
              <Text style={{ fontFamily: F.sansBold, fontSize: 10, color: C.textMuted, marginTop: 2, letterSpacing: 0.8 }}>
                {r.label.toUpperCase()}
              </Text>
            </View>
          ))}
        </View>
      </VYBGlowCard>
    </View>
  );
}

/**
 * MilestonesPreview — four small progress cards mapped to real metrics. Not
 * the full gamification system — placeholders only. Subtle "more coming"
 * footer makes the V1 framing explicit without feeling unfinished.
 */
function MilestonesPreview({ data }: { data: ProfileStats | null }) {
  if (!data) return null;
  const maxStreak = Math.max(data.writingStreak, data.readingStreak, data.focusStreak);

  // Each milestone has a "tier when unlocked" — what visual treatment the
  // card jumps to once the user hits the goal. Until then it's `locked`
  // (greyed) or `common` (visible but quiet) depending on how close they are.
  type M = {
    name: string; have: number; goal: number;
    Icon: typeof Target; desc: string; unlockedTier: BadgeTier;
  };
  const milestones: M[] = [
    { name: 'Task Closer',      have: data.totalTasksDone,          goal: 25, Icon: Target,   desc: 'Complete 25 tasks',    unlockedTier: 'rare' },
    { name: 'Reader',           have: data.totalBooksFinished,      goal: 1,  Icon: BookOpen, desc: 'Finish a book',        unlockedTier: 'rare' },
    { name: 'Locked In',        have: maxStreak,                    goal: 7,  Icon: Flame,    desc: '7-day streak',         unlockedTier: 'epic' },
    { name: 'Momentum Builder', have: data.totalActiveDaysThisYear, goal: 14, Icon: Award,    desc: '14 active days',       unlockedTier: 'legendary' },
  ];

  // Pre-unlock tier rule: if you're past halfway → `common` (lit). Otherwise
  // → `locked` (faint). Once you cross the goal, jump to the milestone's
  // declared unlockedTier.
  const tierFor = (m: M): BadgeTier => {
    if (m.have >= m.goal) return m.unlockedTier;
    return m.have >= m.goal * 0.5 ? 'common' : 'locked';
  };

  return (
    <View style={{ paddingHorizontal: 16, marginTop: 18 }}>
      <SectionLabel style={{ marginLeft: 4, marginBottom: 8 }}>milestones</SectionLabel>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {milestones.map(m => (
          <VYBBadgeCard
            key={m.name}
            name={m.name}
            description={m.desc}
            icon={m.Icon}
            have={m.have}
            goal={m.goal}
            tier={tierFor(m)}
            style={{ flexBasis: '48%', flexGrow: 1 }}
          />
        ))}
      </View>
      <Text style={{
        fontFamily: F.serifItalic, fontSize: 11.5, color: C.textFaint,
        textAlign: 'center', marginTop: 12,
      }}>
        Full badge system coming soon.
      </Text>
    </View>
  );
}

/**
 * RecentActivityList — the user's last few meaningful events, merged from
 * tasks / habits / reading / ideas / books-finished.
 */
function RecentActivityList({ items }: { items: ActivityItem[] }) {
  return (
    <View style={{ paddingHorizontal: 16, marginTop: 18 }}>
      <SectionLabel style={{ marginLeft: 4, marginBottom: 10 }}>recent activity</SectionLabel>
      {items.length === 0 ? (
        <View style={{ paddingVertical: 16 }}>
          <Text style={{ fontFamily: F.serifItalic, fontSize: 13, color: C.textSecondary, lineHeight: 18 }}>
            Your journey starts here.
          </Text>
          <Text style={{ fontFamily: F.sans, fontSize: 12, color: C.textMuted, marginTop: 4 }}>
            Activity will appear as you use the app.
          </Text>
        </View>
      ) : (
        <View style={{ paddingLeft: 4 }}>
          {items.map((it, i) => {
            const Icon = ACTIVITY_ICONS[it.kind];
            const tint = ACTIVITY_TINT[it.kind];
            const isLast = i === items.length - 1;
            return (
              <View key={it.id} style={{ flexDirection: 'row', gap: 12 }}>
                {/* Timeline rail — dot + connecting line below. */}
                <View style={{ width: 18, alignItems: 'center' }}>
                  <View style={{
                    width: 14, height: 14, borderRadius: 7,
                    backgroundColor: C.bgOverlay,
                    borderColor: C.borderSubtle, borderWidth: 1,
                    alignItems: 'center', justifyContent: 'center', marginTop: 2,
                  }}>
                    <Icon size={8} color={tint} />
                  </View>
                  {!isLast && (
                    <View style={{ flex: 1, width: 1, backgroundColor: C.borderSubtle, marginTop: 2 }} />
                  )}
                </View>
                <View style={{ flex: 1, paddingBottom: isLast ? 0 : 14 }}>
                  <Text numberOfLines={2} style={{ fontFamily: F.sans, fontSize: 13, color: C.textPrimary, lineHeight: 18 }}>
                    {it.label}
                  </Text>
                  <Text style={{ fontFamily: F.mono, fontSize: 10, color: C.textFaint, marginTop: 2 }}>
                    {formatRelative(it.ts)}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

const ACTIVITY_ICONS = {
  task:    CheckSquare,
  habit:   Flame,
  reading: BookOpen,
  idea:    Lightbulb,
  book:    Award,
} as const;
const ACTIVITY_TINT = {
  task:    C.gold,
  habit:   C.forestBright,
  reading: C.midnightBright,
  idea:    C.amberBright,
  book:    C.goldBright,
} as const;

function ExplainRow({ term, desc }: { term: string; desc: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
      <Text style={{ fontFamily: F.sansBold, fontSize: 11, color: C.textPrimary, letterSpacing: 0.3, width: 70 }}>
        {term}
      </Text>
      <Text style={{ fontFamily: F.sans, fontSize: 11, color: C.textMuted, flex: 1, lineHeight: 15 }}>
        {desc}
      </Text>
    </View>
  );
}

function formatRelative(iso: string): string {
  const d = new Date(iso);
  const now = Date.now();
  const diffMs = Math.max(0, now - d.getTime());
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1)  return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7)  return `${days}d ago`;
  return d.toLocaleDateString();
}
