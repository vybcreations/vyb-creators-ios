import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * demoFriends — local-only fake friend system for design/testing.
 *
 * Why local-only: real friends require Supabase auth.users + friend_requests
 * + friendships. We can't fake those without polluting the DB or violating
 * FK constraints. So demo friends live entirely in AsyncStorage and are
 * merged into the visible friends list at the React layer.
 *
 * They're clearly tagged `is_demo: true` everywhere so we can:
 *   - render a subtle "DEMO" chip on rows
 *   - block real interactions (challenges/circles/messages) cleanly
 *   - wipe them in one call when the user adds real friends
 */

const STORE_KEY = 'vyb:demo-friends:added';

export type DemoFavoriteBook = {
  title: string;
  author: string;
  cover_url: string | null;   // null → fallback initials cover
};

export type AchievementType = 'reading' | 'streak' | 'challenge_win' | 'proof' | 'circle' | 'general';

export type Achievement = {
  title: string;            // e.g. "Finished a book"
  subtitle?: string;        // e.g. book title, challenge name
  type: AchievementType;    // drives the icon + accent
  date_label: string;       // e.g. "2d ago", "This week"
};

export type DemoFriend = {
  id: string;
  display_name: string;
  username: string;
  avatar_url: string | null;
  cover_url: string | null;        // header cover (null → gradient fallback)
  cover_accent: string;            // hex for cover gradient fallback (no #)
  friend_code: string;
  bio: string;
  location?: string;
  vibe: string;                    // short tag line
  branches: string[];              // interest pills
  socials?: {
    instagram?: string;
    youtube?: string;
    twitter?: string;
    linkedin?: string;
  };
  stats: {
    streak: number;
    wins: number;
    circles: number;
  };
  favorite_books: DemoFavoriteBook[];
  recent_achievements: Achievement[];
  featured_badge?: { emoji: string; label: string; sublabel?: string };
  is_demo: true;
};

// Curated demo profiles. Avatars use ui-avatars.com (no signup, deterministic
// premium-feeling generated images). Replace with real assets later.
const avatarUrl = (name: string, bg: string, fg = 'fff') =>
  `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=${bg}&color=${fg}&bold=true&size=256`;

export const DEMO_CATALOG: Record<string, DemoFriend> = {
  SOPHIE24: {
    id:           'demo:sophie',
    display_name: 'Sophie Miller',
    username:     'sophie',
    avatar_url:   avatarUrl('Sophie Miller', 'D27050'),
    cover_url:    null,
    cover_accent: 'D27050',
    friend_code:  'SOPHIE24',
    bio:          'Reader, runner, occasional writer.',
    location:     'Lisbon',
    vibe:         'Reading · Wellness · Workouts',
    branches:     ['Reading', 'Wellness', 'Workouts'],
    socials:      { instagram: 'sophiemiller', twitter: 'sophiem' },
    stats:        { streak: 18, wins: 4, circles: 2 },
    favorite_books: [
      { title: 'Atomic Habits', author: 'James Clear', cover_url: null },
      { title: 'Quiet', author: 'Susan Cain', cover_url: null },
      { title: 'The Artist’s Way', author: 'Julia Cameron', cover_url: null },
    ],
    recent_achievements: [
      { title: 'Finished a book',    subtitle: 'Atomic Habits',         type: 'reading',        date_label: '2d ago' },
      { title: '18-day streak',      subtitle: 'Stayed consistent',     type: 'streak',         date_label: 'This week' },
      { title: 'Joined a circle',    subtitle: 'Morning Pages',         type: 'circle',         date_label: '1w ago' },
    ],
    featured_badge: { emoji: '📚', label: 'Finished a book', sublabel: 'Atomic Habits' },
    is_demo:      true,
  },
  PABLO24: {
    id:           'demo:pablo',
    display_name: 'Pablo Ruiz',
    username:     'pablo',
    avatar_url:   avatarUrl('Pablo Ruiz', '8FA88A'),
    cover_url:    null,
    cover_accent: '8FA88A',
    friend_code:  'PABLO24',
    bio:          'Building. Lifting. Pushing through.',
    location:     'Mexico City',
    vibe:         'Business · Workout · Accountability',
    branches:     ['Business', 'Workouts', 'Focus'],
    socials:      { linkedin: 'pabloruiz', instagram: 'pablo.ruiz' },
    stats:        { streak: 32, wins: 7, circles: 3 },
    favorite_books: [
      { title: 'Shoe Dog', author: 'Phil Knight', cover_url: null },
      { title: '4-Hour Body', author: 'Tim Ferriss', cover_url: null },
      { title: 'Deep Work', author: 'Cal Newport', cover_url: null },
    ],
    recent_achievements: [
      { title: 'Won a challenge',    subtitle: '30-Day Lift',           type: 'challenge_win',  date_label: '3d ago' },
      { title: '32-day streak',      subtitle: 'No missed days',        type: 'streak',         date_label: 'Ongoing' },
      { title: 'Posted proof',       subtitle: 'Morning workout',       type: 'proof',          date_label: '5d ago' },
    ],
    featured_badge: { emoji: '🏆', label: 'Challenge winner', sublabel: '30-Day Lift' },
    is_demo:      true,
  },
  ANA24: {
    id:           'demo:ana',
    display_name: 'Ana Morales',
    username:     'ana',
    avatar_url:   avatarUrl('Ana Morales', 'C9A961'),
    cover_url:    null,
    cover_accent: 'C9A961',
    friend_code:  'ANA24',
    bio:          'Quiet days. Deep work. One book at a time.',
    location:     'Madrid',
    vibe:         'Habits · Reading · Focus',
    branches:     ['Habits', 'Reading', 'Focus', 'Creativity'],
    socials:      { instagram: 'anareads' },
    stats:        { streak: 47, wins: 5, circles: 2 },
    favorite_books: [
      { title: 'Bird by Bird', author: 'Anne Lamott', cover_url: null },
      { title: 'The Diary of a CEO', author: 'Steven Bartlett', cover_url: null },
      { title: 'A Room of One’s Own', author: 'Virginia Woolf', cover_url: null },
      { title: 'Steal Like an Artist', author: 'Austin Kleon', cover_url: null },
    ],
    recent_achievements: [
      { title: '47-day streak',      subtitle: 'Reading every night',   type: 'streak',         date_label: 'Ongoing' },
      { title: 'Finished a book',    subtitle: 'Bird by Bird',          type: 'reading',        date_label: '1w ago' },
      { title: 'Created a circle',   subtitle: 'Quiet Mornings',        type: 'circle',         date_label: '2w ago' },
    ],
    featured_badge: { emoji: '🔥', label: '47-day streak', sublabel: 'Reading every night' },
    is_demo:      true,
  },
  MARCO24: {
    id:           'demo:marco',
    display_name: 'Marco Vega',
    username:     'marco',
    avatar_url:   avatarUrl('Marco Vega', '5DA3C9'),
    cover_url:    null,
    cover_accent: '5DA3C9',
    friend_code:  'MARCO24',
    bio:          'Fitness first. Mind second. Both win.',
    location:     'Buenos Aires',
    vibe:         'Fitness · Challenges',
    branches:     ['Workouts', 'Habits', 'Finance'],
    socials:      { instagram: 'marcovegafit', youtube: 'marcovega' },
    stats:        { streak: 12, wins: 11, circles: 4 },
    favorite_books: [
      { title: 'Can’t Hurt Me', author: 'David Goggins', cover_url: null },
      { title: 'The Comfort Crisis', author: 'Michael Easter', cover_url: null },
      { title: 'Endure', author: 'Alex Hutchinson', cover_url: null },
    ],
    recent_achievements: [
      { title: 'Won a challenge',    subtitle: 'Cold Plunge Week',      type: 'challenge_win',  date_label: '1d ago' },
      { title: 'Posted proof',       subtitle: 'Sunrise run',           type: 'proof',          date_label: '2d ago' },
      { title: 'Joined a circle',    subtitle: 'Iron Mind',             type: 'circle',         date_label: '4d ago' },
      { title: '12-day streak',      subtitle: 'Daily training',        type: 'streak',         date_label: 'Ongoing' },
    ],
    featured_badge: { emoji: '⚡', label: 'Momentum', sublabel: 'On a roll' },
    is_demo:      true,
  },
};

export const ALL_DEMO_CODES = Object.keys(DEMO_CATALOG);

// ─── Persistence ──────────────────────────────────────────────────────────

async function readSet(): Promise<Set<string>> {
  try {
    const raw = await AsyncStorage.getItem(STORE_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr : []);
  } catch { return new Set(); }
}

async function writeSet(s: Set<string>): Promise<void> {
  try { await AsyncStorage.setItem(STORE_KEY, JSON.stringify(Array.from(s))); } catch {}
}

export async function listDemoFriends(): Promise<DemoFriend[]> {
  const codes = await readSet();
  return Array.from(codes)
    .map(code => DEMO_CATALOG[code])
    .filter(Boolean);
}

export function lookupDemoByCode(rawCode: string): DemoFriend | null {
  const norm = rawCode.replace(/\s+/g, '').toUpperCase();
  return DEMO_CATALOG[norm] || null;
}

export async function addDemoFriend(code: string): Promise<DemoFriend | null> {
  const demo = lookupDemoByCode(code);
  if (!demo) return null;
  const codes = await readSet();
  codes.add(demo.friend_code);
  await writeSet(codes);
  return demo;
}

export async function addAllDemoFriends(): Promise<DemoFriend[]> {
  const codes = new Set(ALL_DEMO_CODES);
  await writeSet(codes);
  return Array.from(codes).map(c => DEMO_CATALOG[c]);
}

export async function removeDemoFriend(code: string): Promise<void> {
  const codes = await readSet();
  codes.delete(code);
  await writeSet(codes);
}

export async function clearAllDemoFriends(): Promise<void> {
  try { await AsyncStorage.removeItem(STORE_KEY); } catch {}
}
