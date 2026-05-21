import React from 'react';
import { View, Text, ScrollView, Image, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ChevronLeft, Lock, MapPin, Flame, Trophy, Users,
} from 'lucide-react-native';
import { Avatar, SectionLabel, Tx } from '../components/primitives';
import { colors as C, fonts as F } from '../theme';
import { DEMO_CATALOG, type DemoFavoriteBook } from '../lib/demoFriends';
import { SocialPill } from '../components/profile/SocialIcon';
import { FeaturedBadge } from '../components/profile/FeaturedBadge';
import { RecentAchievementsSection } from '../components/profile/AchievementCard';

/**
 * FriendDetailScreen — premium private friend profile.
 *
 * Layout mirrors the user's own Profile screen at a smaller scale:
 *   Cover (image or gradient) → avatar overlap → name → username →
 *   bio + location → branches → socials → rhythm stats → favorite books →
 *   shared circles → privacy note.
 *
 * Receives a `friend` (Friend | DemoFriend shape) via route. Demo friends
 * extend with branches/socials/favorite_books/cover_accent so the same
 * layout works for both.
 */
export function FriendDetailScreen({ navigation, route }: any) {
  const f = route?.params?.friend || {};
  const isDemo = !!f.is_demo;
  const demo = isDemo ? DEMO_CATALOG[f.friend_code] : null;

  const name      = f.display_name || f.username || 'Friend';
  const username  = f.username;
  const avatarUrl = f.avatar_url;
  const coverUrl  = demo?.cover_url || f.cover_url || null;
  const accent    = demo?.cover_accent || '8FA88A';
  const bio       = demo?.bio || f.bio || null;
  const location  = demo?.location || f.location || null;
  const branches  = demo?.branches || [];
  const socials   = demo?.socials || {};
  const stats     = demo?.stats || null;
  const books     = demo?.favorite_books || [];
  const achievements  = demo?.recent_achievements || [];
  const featuredBadge = demo?.featured_badge;
  const vibe          = demo?.vibe;

  return (
    <View style={{ flex: 1, backgroundColor: C.bgBase }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
        {/* Cover */}
        <View style={{ height: 200, backgroundColor: C.bgElevated, position: 'relative' }}>
          {coverUrl ? (
            <Image source={{ uri: coverUrl }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
          ) : (
            <LinearGradient
              colors={[`#${accent}`, `rgba(${hexToRgb(accent)},0.45)`, 'rgba(28,28,34,1)'] as any}
              start={{ x: 0.1, y: 0 }} end={{ x: 0.95, y: 1 }}
              style={{ flex: 1 }}
            />
          )}
          {/* Bottom fade into bg for legibility under avatar/name */}
          <LinearGradient
            colors={['rgba(13,12,11,0)', 'rgba(13,12,11,0.55)', C.bgBase] as any}
            locations={[0, 0.55, 1]}
            style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 130 }}
            pointerEvents="none"
          />

          {/* Floating header */}
          <SafeAreaView edges={['top']} style={{
            position: 'absolute', top: 0, left: 0, right: 0,
            flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
            paddingHorizontal: 14,
          }}>
            <Pressable onPress={() => navigation.goBack()} hitSlop={8} style={{
              width: 36, height: 36, borderRadius: 18,
              backgroundColor: 'rgba(13,12,11,0.55)',
              borderColor: 'rgba(244,240,232,0.18)', borderWidth: 1,
              alignItems: 'center', justifyContent: 'center',
            }}>
              <ChevronLeft size={18} color="#F4F0E8" />
            </Pressable>
            <View style={{
              flexDirection: 'row', alignItems: 'center', gap: 6,
              paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999,
              backgroundColor: 'rgba(13,12,11,0.55)',
              borderColor: 'rgba(244,240,232,0.18)', borderWidth: 1,
            }}>
              <Lock size={10} color="rgba(244,240,232,0.85)" />
              <Text style={{
                fontFamily: F.sansBold, fontSize: 9.5, color: 'rgba(244,240,232,0.85)',
                letterSpacing: 1, textTransform: 'uppercase',
              }}>
                Private friend
              </Text>
            </View>
            <View style={{ width: 36 }} />
          </SafeAreaView>
        </View>

        {/* Avatar — overlaps the cover */}
        <View style={{ paddingHorizontal: 22, marginTop: -54 }}>
          <View style={{
            width: 108, height: 108, borderRadius: 54, overflow: 'hidden',
            borderColor: C.bgBase, borderWidth: 4,
            backgroundColor: C.bgElevated,
            shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 16, shadowOffset: { width: 0, height: 8 },
          }}>
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={{ width: '100%', height: '100%' }} />
            ) : (
              <Avatar size={100} label={(name[0] || '?').toUpperCase()} tone="gold" />
            )}
          </View>
        </View>

        {/* Identity */}
        <View style={{ paddingHorizontal: 22, marginTop: 12 }}>
          <Text style={[Tx.editorial(), { fontSize: 28 }]}>{name}</Text>
          {username && (
            <Text style={{ fontFamily: F.mono, fontSize: 12, color: C.textMuted, marginTop: 2 }}>
              @{username}
            </Text>
          )}
          {/* Identity descriptor line — mirrors the user profile's "role" line. */}
          {vibe && (
            <Text style={{
              fontFamily: F.serifItalic, fontSize: 13.5, color: C.textSecondary,
              marginTop: 10, letterSpacing: 0.1,
            }}>
              {vibe}
            </Text>
          )}
          {bio && (
            <Text style={{
              fontFamily: F.sans, fontSize: 14, color: C.textSecondary,
              marginTop: 8, lineHeight: 21,
            }}>
              {bio}
            </Text>
          )}
          {location && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 10 }}>
              <MapPin size={11} color={C.textFaint} />
              <Text style={{ fontFamily: F.sans, fontSize: 11.5, color: C.textMuted }}>{location}</Text>
            </View>
          )}

          {/* Featured badge — replaces the old DEMO chip with a meaningful highlight. */}
          {featuredBadge && (
            <View style={{ flexDirection: 'row', marginTop: 14 }}>
              <FeaturedBadge badge={featuredBadge} />
            </View>
          )}

          {/* Socials */}
          {Object.values(socials).some(Boolean) && (
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
              {socials.instagram && <SocialPill platform="instagram" handle={socials.instagram} url={`https://instagram.com/${socials.instagram}`} />}
              {socials.youtube   && <SocialPill platform="youtube"   handle={socials.youtube}   url={`https://youtube.com/@${socials.youtube}`} />}
              {socials.twitter   && <SocialPill platform="twitter"   handle={socials.twitter}   url={`https://x.com/${socials.twitter}`} />}
              {socials.linkedin  && <SocialPill platform="linkedin"  handle={socials.linkedin}  url={`https://linkedin.com/in/${socials.linkedin}`} />}
            </View>
          )}
        </View>

        {/* Branches / interests */}
        {branches.length > 0 && (
          <View style={{ paddingHorizontal: 22, marginTop: 16, flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {branches.map(b => (
              <View key={b} style={{
                paddingHorizontal: 11, paddingVertical: 6, borderRadius: 999,
                backgroundColor: 'rgba(201,169,97,0.10)',
                borderColor: 'rgba(201,169,97,0.30)', borderWidth: 1,
              }}>
                <Text style={{
                  fontFamily: F.sansBold, fontSize: 10.5, color: C.gold, letterSpacing: 0.4,
                }}>
                  {b}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Rhythm stats */}
        {stats && (
          <View style={{ paddingHorizontal: 16, marginTop: 22 }}>
            <SectionLabel style={{ marginLeft: 4, marginBottom: 8 }}>rhythm</SectionLabel>
            <View style={{
              flexDirection: 'row', borderRadius: 18, overflow: 'hidden',
              backgroundColor: 'rgba(255,255,255,0.025)',
              borderColor: C.borderSubtle, borderWidth: 1,
            }}>
              <StatCell Icon={Flame}  label="Streak"  value={`${stats.streak}d`} divider />
              <StatCell Icon={Trophy} label="Wins"    value={String(stats.wins)} divider />
              <StatCell Icon={Users}  label="Circles" value={String(stats.circles)} />
            </View>
          </View>
        )}

        {/* Recent achievements */}
        <View style={{ paddingHorizontal: 16, marginTop: 22 }}>
          <SectionLabel style={{ marginLeft: 4, marginBottom: 8 }}>recent achievements</SectionLabel>
          {achievements.length === 0 ? (
            <EmptyMini text="No achievements shared yet." />
          ) : (
            <RecentAchievementsSection achievements={achievements} />
          )}
        </View>

        {/* Favorite books */}
        <View style={{ paddingHorizontal: 16, marginTop: 22 }}>
          <SectionLabel style={{ marginLeft: 4, marginBottom: 8 }}>favorite books</SectionLabel>
          {books.length === 0 ? (
            <EmptyMini text="No favorite books shared yet." />
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 4, gap: 12 }}>
              {books.map((b, i) => <BookCoverMini key={i} book={b} />)}
            </ScrollView>
          )}
        </View>

        {/* Shared circles */}
        <View style={{ paddingHorizontal: 16, marginTop: 22 }}>
          <SectionLabel style={{ marginLeft: 4, marginBottom: 8 }}>shared circles</SectionLabel>
          <EmptyMini text={isDemo
            ? 'Demo friends don’t share real circles yet.'
            : 'No shared circles yet.'}
            sub="Invite them to a private circle to start." />
        </View>

        {/* Privacy note */}
        <View style={{ paddingHorizontal: 16, marginTop: 18 }}>
          <View style={{
            flexDirection: 'row', alignItems: 'flex-start', gap: 10,
            paddingVertical: 12, paddingHorizontal: 14, borderRadius: 14,
            backgroundColor: 'rgba(255,255,255,0.025)',
            borderColor: C.borderSubtle, borderWidth: 1,
          }}>
            <Lock size={14} color={C.textMuted} style={{ marginTop: 1 }} />
            <Text style={{ flex: 1, fontFamily: F.sans, fontSize: 11.5, color: C.textMuted, lineHeight: 16 }}>
              Their habits, tasks and ideas stay private. You only see what they choose to share inside your shared circles or challenges.
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────

function hexToRgb(hex: string): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `${r},${g},${b}`;
}

function StatCell({
  Icon, label, value, divider = false,
}: { Icon: typeof Flame; label: string; value: string; divider?: boolean }) {
  return (
    <View style={{
      flex: 1, paddingVertical: 14, paddingHorizontal: 8, alignItems: 'center',
      borderRightColor: C.borderSubtle, borderRightWidth: divider ? 1 : 0,
    }}>
      <Icon size={13} color={C.gold} />
      <Text style={{ fontFamily: F.sansHeavy, fontSize: 18, color: C.textPrimary, marginTop: 4, letterSpacing: -0.3 }}>
        {value}
      </Text>
      <Text style={{ fontFamily: F.sansBold, fontSize: 9, color: C.textFaint, marginTop: 2, letterSpacing: 0.6, textTransform: 'uppercase' }}>
        {label}
      </Text>
    </View>
  );
}

function BookCoverMini({ book }: { book: DemoFavoriteBook }) {
  const W = 82, H = 118;
  const initials = (book.title.match(/\b\w/g) || []).slice(0, 2).join('').toUpperCase() || '—';
  return (
    <View style={{ width: W }}>
      <View style={{
        width: W, height: H, borderRadius: 10, overflow: 'hidden',
        backgroundColor: C.bgElevated,
        borderColor: 'rgba(201,169,97,0.20)', borderWidth: 1,
        shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 10, shadowOffset: { width: 0, height: 5 },
      }}>
        {book.cover_url ? (
          <Image source={{ uri: book.cover_url }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
        ) : (
          <LinearGradient
            colors={['rgba(201,169,97,0.22)', 'rgba(28,28,34,0.95)']}
            start={{ x: 0.2, y: 0 }} end={{ x: 1, y: 1 }}
            style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 6 }}
          >
            <Text style={{
              fontFamily: F.sansHeavy, fontSize: 24,
              color: 'rgba(244,240,232,0.85)', letterSpacing: -0.5,
            }}>
              {initials}
            </Text>
          </LinearGradient>
        )}
      </View>
      <Text numberOfLines={2} style={{
        fontFamily: F.sansBold, fontSize: 10.5, color: C.textPrimary,
        marginTop: 6, lineHeight: 13,
      }}>
        {book.title}
      </Text>
      <Text numberOfLines={1} style={{
        fontFamily: F.serifItalic, fontSize: 9.5, color: C.textMuted, marginTop: 1,
      }}>
        {book.author}
      </Text>
    </View>
  );
}

function EmptyMini({ text, sub }: { text: string; sub?: string }) {
  return (
    <View style={{
      paddingVertical: 18, paddingHorizontal: 18, borderRadius: 14,
      backgroundColor: 'rgba(255,255,255,0.025)',
      borderColor: C.borderSubtle, borderWidth: 1,
      alignItems: 'center',
    }}>
      <Text style={{ fontFamily: F.serifItalic, fontSize: 13, color: C.textSecondary, textAlign: 'center' }}>
        {text}
      </Text>
      {sub && (
        <Text style={{ fontFamily: F.sans, fontSize: 11, color: C.textMuted, marginTop: 4, textAlign: 'center' }}>
          {sub}
        </Text>
      )}
    </View>
  );
}
