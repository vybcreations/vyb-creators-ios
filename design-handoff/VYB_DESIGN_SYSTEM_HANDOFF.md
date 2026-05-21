# VYB Creators / VYB Life — Design System v2 Handoff

> **Audience**: Claude Design.
> **Repo**: see `design-handoff/RELEVANT_FILES.md` for the file map.
> **Branch**: `design-system-v2-handoff`.
> **Stack**: React Native + Expo (SDK 54), TypeScript, Supabase backend, react-native-svg, lucide-react-native, expo-linear-gradient.

---

## 1. Product description

**VYB Creators / VYB Life** is a premium dark personal-growth / life-OS mobile app built around the philosophy **"Create Your Reality."** It is privacy-first (no public feed, no follower mechanics) and centered on quiet daily action plus accountability through small circles.

The app helps users manage:

- **Habits** — grouped by personal areas (Health, Mind, Business, etc.)
- **Tasks** — by priority (urgent / important / later), optionally tagged with a project
- **Reading** — books with sessions, notes (ideas / quotes / notes), pages, favorites
- **Ideas** — quick capture
- **Focus** — timed focus blocks
- **Friends / Circles** — small private accountability groups
- **Challenges** — private group challenges with proof uploads
- **Profile** — Aura state score, milestones, achievements, favorite books, social links
- **Friend Profile** — read-only privacy-first profile of a friend

---

## 2. Current goal

We are pausing big new feature work to **unify the app visually through a clear VYB Design System v2**.

The app grew in phases, so older screens and newer screens currently feel visually different.

**Older-feeling screens** (raw View + primitives.Card, list-based, simpler):
- Settings (already migrated to v2 in this branch — reference)
- Habits (sheets migrated; main screen partially migrated)
- Tasks
- some inputs/composers

**Newer-feeling screens** (heavy use of VYBGlowCard, premium gradients, animated):
- Dashboard / Home
- Reading
- Friends / Circles / Challenges
- You / Profile
- Friend Profile

---

## 3. Visual direction (do not change without discussion)

- **Dark premium** by default
- **Warm black** base (`#0A0A0C`) — never pure black
- **Cream typography** (`#FAFAF8`) — never pure white
- **Sand / gold** as the main accent for actions, progress, completions and achievements
- **Sage** as secondary calm / private / social accent
- **Very rounded** cards, pills, circles
- **Static gradients** preferred over animated ones
- **Glass / liquid glass** used carefully (subtle, never noisy)
- Cinematic, calm, premium
- ❌ Not neon
- ❌ Not generic AI-looking
- ❌ No heavy animated beam effects (we explicitly killed the beam button)
- ❌ No "red alarm" states — urgent is warm clay, not error red

---

## 4. Design tokens (`src/theme.ts`)

```ts
colors: {
  bgBase:       '#0A0A0C',   // warm black
  bgElevated:   '#131318',
  bgOverlay:    '#1C1C22',
  bgGlass:      'rgba(20,20,26,0.65)',
  bgGlassSolid: 'rgba(20,20,26,0.96)',

  borderSubtle: 'rgba(255,255,255,0.06)',
  borderMid:    'rgba(255,255,255,0.10)',
  borderStrong: 'rgba(255,255,255,0.18)',

  textPrimary:   '#FAFAF8',
  textSecondary: 'rgba(250,250,248,0.72)',
  textMuted:     'rgba(250,250,248,0.50)',
  textFaint:     'rgba(250,250,248,0.30)',
  textOnAccent:  '#0A0A0C',

  gold:         '#C9A961',
  goldBright:   '#E8C275',
  goldDeep:     '#8C7340',
  goldFaint:    'rgba(201,169,97,0.12)',
  goldGlow:     'rgba(201,169,97,0.35)',

  forest:        '#4A6B52',   // sage family
  forestBright:  '#6B8F70',
  midnight:      '#2C3E5C',   // privacy / blue family
  amber:         '#E8B547',
  clay:          '#B8643C',   // urgent / warm callout (NOT red)

  // glass / atmospheric tokens
  surfaceGlass:       'rgba(255,255,255,0.04)',
  surfaceGlassStrong: 'rgba(255,255,255,0.07)',
}

// Semantic state — added Phase A
state: {
  urgent:     '#D27050',   // clay, not red
  important:  '#C9A961',   // gold
  later:      '#8FA88A',   // sage
  complete:   '#C9A961',
  inProgress: '#8FA88A',
  inactive:   'rgba(255,255,255,0.18)',
}

achievement: { reading, streak, win, proof, circle, general }

motion: {
  duration: { fast: 160, normal: 220, slow: 320 },
  easing:   { standard: [0.22,1,0.36,1], soft: [0.16,1,0.3,1] },
}

radius: { sm: 18, md: 22, lg: 28, xl: 36, xxl: 48, pill: 999 }

fonts: {
  sansLight: Montserrat 300,
  sans:      Montserrat 500,
  sansItalic: Montserrat 500 Italic,
  sansBold:  Montserrat 700,
  sansHeavy: Montserrat 800,
  // "serifItalic" name kept for back-compat; resolves to Montserrat 700 Italic
  serifItalic: Montserrat 700 Italic,
  mono:    JetBrainsMono 500,
  monoBold: JetBrainsMono 600,
}
```

Fonts are loaded via `@expo-google-fonts/*` packages — no licensed font files are bundled or shared.

---

## 5. Phase A foundation components (already created)

Located in `src/components/ui/`. Centralized exports in `src/components/ui/index.ts`.

| Component | Replaces / will replace | Notes |
|---|---|---|
| `VYBCard` | inline `<View>` cards, `WidgetCard`, old `primitives.Card` | 4 levels: `hero` / `widget` / `list` / `flat`. Optional `glow` + `accent` + `onPress`. |
| `VYBGlowCard` | (in use; will fold into VYBCard later) | Heavy colored-glow card variant. |
| `VYBToggle` | every segmented pill (Today/Week, Day/Week/Month, Book/Entries, Friends tabs) | Animated indicator, JS-driven. |
| `VYBChip` | `Pill`, `PriPill`, `SmallPill`, `ProjectPill`, `FilterChip`, `PanelPill`, `ChipButton` | Tones include `urgent/important/later`. |
| `VYBProgressRing` | `primitives.Ring`, `HomeScreen.ProgressRing` | Auto-colors via `state.complete / inProgress / inactive`. |
| `VYBCheckCircle` | all inline check circles (habits, tasks, favorites, proof) | Gold fill + check-pop, reduce-motion aware. |
| `VYBBookCover` | 6+ cover variants across the app | Sizes `xs / sm / md / lg / hero`; favorite frame + star badge. |
| `VYBEmpty` | `EmptyCard`, `EmptyMini`, inline empties | Variants `simple / card / dashed / hero`. |
| `VYBScreenHeader` | every raw header `<View>` | Variants `default / dashboard / detail / profile`. |
| `VYBInput` | inline `TextInput` styles in composers/forms | `forwardRef`'d, supports `icon` + `error`. |
| `VYBComposer` | every bottom-anchored input | `bottomAnchored` mode uses our iPad-keyboard-safe layout helper. |

Already migrated to v2 in this branch:
- **SettingsScreen** (full migration)
- **HabitsScreen** main screen (header + today summary + per-row check circle)
- **HabitEditorSheet** + **AreaEditorSheet** (inputs + day picker + frequency toggle + preset chips)

Not yet migrated:
- Home, Tasks, Reading, BookDetail, Friends, Circles/CircleDetail, ChallengeDetail, Profile, FriendDetail, Auth, EditProfile, Capture, ChallengePreview, QRScanner, Focus.

---

## 6. What Claude Design should help with

1. **Update the VYB Design System v2 visually** — propose refinements to tokens (especially glass / depth / motion) before Phase B continues.
2. **Create a UI Kit / component gallery** — visualize every Phase A component in all states (default / hover / pressed / disabled / done / empty).
3. **Define card hierarchy** more precisely — when does a screen escalate from `list` → `widget` → `hero`?
   - `hero` → marquee element of a screen (Aura state, Reading Now, active Challenge)
   - `widget` → compact module (Habits Today, Tasks Pending, Reading status)
   - `list` → clean grouped row containers (Settings, Habits list, Tasks list)
   - `flat` → ungrouped wrapper (no decoration)
4. **Define widget sizes** for the Dashboard customization phase:
   - small (1×1 square)
   - medium (2×1 horizontal)
   - large (2×2 square)
   - XL (full-width)
5. **Create Dashboard customization wireframes** — see `DASHBOARD_CUSTOMIZATION_PLAN.md`.
6. **Propose how older screens should migrate without overdesigning** — especially Habits and Tasks.
7. **Keep Habits and Tasks simple/list-based** — explicitly NOT card-per-row.
8. **Make Dashboard customizable** like Apple Home Screen logic, but visually VYB.

---

## 7. What should stay simple (do not overdesign)

**HabitsScreen**:
- Should remain a clean checklist grouped by categories.
- Should not become a dashboard / progress page.
- Each habit row should not become a heavy card.
- Progress belongs on Dashboard + Profile, not here.

**TasksScreen**:
- Should remain a clean functional list grouped by priority + project.
- Use cleaner chips / checks / composer, but do not overdesign.
- Subtle animations are good (already in place via `LayoutAnimation` + `AnimatedHabitTitle` patterns).

**SettingsScreen**:
- Already a minimal grouped settings list — keep it that way.

---

## 8. Dashboard direction

Dashboard should become **customizable** in three phases.

Inspired by Apple Home Screen logic, but visually VYB:
- Enter "Edit Dashboard" mode
- Add widgets from a gallery
- Reorder via drag
- Show / hide widgets
- Change widget sizes (small / medium / large / XL)
- Save layout per user (Supabase)
- Reset to default

Widget categories:
- **Habits** (Today, Weekly, Streak)
- **Tasks** (Pending, Tasks That Matter, Completed Today)
- **Reading** (Continue Reading, Favorite Books, Goal Progress)
- **Circles / Challenges** (Active Challenge, Upload Proof, Recent Proofs)
- **Focus** (Quick Start, Focus Streak)
- **Profile / Progress** (Aura State, Featured Highlight, Recent Achievement, Milestones)
- **Inspiration** (Quote of the Day, Reading Recommendation)

Concrete widget candidates already living in screens (need extraction to `src/widgets/`):

| Widget | Currently in | Notes |
|---|---|---|
| Habits Today (ring) | `HomeScreen.HabitsTodayCard` | Self-contained |
| Weekly Habits | `HomeScreen.WeeklyHabitsGrid` | Self-contained |
| Tasks Pending breakdown | `HomeScreen.TaskOverviewCard` | Self-contained |
| Tasks That Matter | HomeScreen tasks block | Refactor needed |
| Completed Today | HomeScreen tasks block | Refactor needed |
| Continue Reading | HomeScreen reading block | Refactor needed |
| Active Challenge | `HomeScreen.ChallengeCardCompact` | Self-contained |
| Focus Mode quick start | HomeScreen focus block | Refactor needed |
| Featured Highlight | `ProfileScreen.FeaturedHighlight` | Self-contained, already premium |
| Aura State | `ProfileScreen.AuraStateCard` | Heavy; needs `compact` variant |
| Milestones | `ProfileScreen.MilestonesPreview` | Self-contained |
| Favorite Books | `ProfileScreen.FavoriteBooksSection` | Self-contained |
| Recent Activity | `ProfileScreen.RecentActivityList` | Self-contained |

---

## 9. Privacy & data model context

Friend profiles, circles, and challenges respect strict privacy:
- A friend never sees another user's habits / tasks / ideas / notes.
- Only what the user explicitly shares (favorites, achievements, bio, socials, branches/interests, circle membership, challenge proofs) is visible.
- Demo friends live entirely in AsyncStorage to avoid polluting the real `auth.users` table during development — they're tagged `is_demo: true` and live alongside real friends in the UI.

Supabase RLS protects every table; the anon key in the client is by design.

---

## 10. Tone & motion guidelines

- Easings: `Easing.bezier(0.22, 1, 0.36, 1)` (standard) or `(0.16, 1, 0.3, 1)` (soft).
- Durations: 160 fast / 220 normal / 320 slow (see `theme.motion`).
- Use `LayoutAnimation` for row reorderings and accordion expansions.
- Avoid continuous animation loops (the beam button taught us this overheats devices).
- Confetti is reserved for big habit days (already wired with gold palette).

---

## 11. What NOT to change in this design pass

- App data logic (`src/lib/*`)
- Supabase schema / RPCs
- Existing Phase A foundation API shapes (we can extend, we should not break callers)
- Tracked screens already migrated to v2 in this branch (Settings, Habits, HabitEditorSheet, AreaEditorSheet) — they are reference, not redesign targets
- Privacy model (no public feed, no follower mechanics)
- The "warm-black, no neon, no alarm-red" design rules

---

## 12. Companion docs

- `COMPONENT_AUDIT_SUMMARY.md` — what exists today, duplicates, recommended consolidation.
- `DASHBOARD_CUSTOMIZATION_PLAN.md` — V1 / V2 / V3 customization roadmap.
- `RELEVANT_FILES.md` — exact file paths Claude Design should inspect.
- `frontend-focused/` — optional self-contained export if browsing the whole repo is unwanted.
