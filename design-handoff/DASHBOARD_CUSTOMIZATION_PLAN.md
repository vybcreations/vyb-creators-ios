# Dashboard Customization Plan

> Roadmap for turning the Dashboard / Home screen into a customizable widget surface, inspired by Apple Home Screen logic but visually VYB.

---

## 1. Dashboard purpose

The Dashboard is the **first answer to "What do I need to do today?"**. It is not an analytics page (that's Profile) and it is not a settings page (that's Settings).

Today's structure (after Phase A polish):

1. Header (VYB logo + divider + greeting block)
2. Two overview cards side-by-side: **Habits Today** (ring) + **Tasks Pending** (priority breakdown)
3. Tasks that matter (Urgent / Important / Completed today)
4. Today's Habits (compact, with "show all" + Today / Week toggle)
5. Reading (current book + Continue)
6. Active Challenges (compact rows with proof upload)
7. Focus Mode (quick-start 15 / 25 / 45 min)

In future versions, **the user picks which widgets appear here, in what order, and at what size**.

---

## 2. Widget categories

| Category | Examples |
|---|---|
| **Habits** | Habits Today, Weekly Habits, Habit Streak |
| **Tasks** | Tasks Pending, Tasks That Matter, Completed Today |
| **Reading** | Continue Reading, Favorite Books, Reading Goal |
| **Circles / Challenges** | Active Challenge, Upload Proof, Recent Proofs |
| **Focus** | Quick Focus, Focus Streak |
| **Profile / Progress** | Aura State, Featured Highlight, Milestones, Recent Achievement |
| **Inspiration** | Quote of the Day, Reading Recommendation |

---

## 3. Widget sizes

| Size | Grid | Use |
|---|---|---|
| **small** | 1×1 | Single metric (urgent count, streak, focus minutes). |
| **medium** | 2×1 | Compact module with a number + small action (Habits Today ring + count). |
| **large** | 2×2 | Module with content + breakdown (Tasks Pending, Weekly Habits grid). |
| **XL** | full-width | Hero (Aura State, Active Challenge, Continue Reading). |

iPhone uses 2 columns by default. iPad scales to 3 or 4 columns (the existing `useIsTablet` helper from `src/lib/layout.ts` already lives in the codebase).

---

## 4. Default Dashboard order (factory default)

For a brand-new user:

1. Greeting (header — fixed, not a widget)
2. Habits Today (medium)
3. Tasks Pending (medium)
4. Tasks That Matter (large)
5. Today's Habits (large)
6. Continue Reading (medium)
7. Active Challenge (XL if any active, otherwise hidden)
8. Focus Mode (medium)

Users with no books / no challenges / no habits should see softer empty-state widgets that link into the relevant screen (use `VYBEmpty`).

---

## 5. V1 — Manual edit

Goal: prove the customization model with the minimum useful set.

**Features**:
- "Edit Dashboard" mode entered from a long-press on Home or via a small pencil icon in the header right-action.
- In edit mode each widget shows a remove (`–`) handle and a drag handle.
- **Reorder** by drag (use `react-native-reanimated` + `react-native-gesture-handler` — already in the project).
- **Show / hide** widgets.
- **Save layout** to Supabase (`dashboard_layouts` table keyed by `user_id`, JSON column).
- **Reset to default** button.

**Out of scope for V1**: adding widgets that aren't already in default, changing sizes, multiple layouts.

**Data model proposal**:
```sql
create table public.dashboard_layouts (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  widgets     jsonb not null default '[]'::jsonb,
  updated_at  timestamptz not null default now()
);
-- widgets shape:
-- [{ id: 'habits-today', size: 'medium', hidden: false }, ...]
```

---

## 6. V2 — Add Widget gallery

Goal: full Apple-style customization.

**Features**:
- "Add Widget" opens a gallery sheet grouped by category.
- Each widget shows a **preview** (rendered at the chosen size, with mock data) before adding.
- **Size selection** in the gallery — small / medium / large / XL.
- **Empty Dashboard** state when nothing added: friendly hero "Tap + to add your first widget".
- **iPad-aware** previews show wider layouts.

**Refactor required first**:
- Move every widget candidate from inside `HomeScreen.tsx` and `ProfileScreen.tsx` into `src/widgets/`. Each widget must:
  - Accept its own data hook OR receive props (no `navigation` reach-throughs).
  - Declare a `meta.sizes: ('small' | 'medium' | 'large' | 'xl')[]`.
  - Export a `preview` variant rendered with mock data for the gallery.

---

## 7. V3 — Smart layout

Goal: subtle intelligence that fits the VYB tone.

**Features**:
- **Recommendations** — "You haven't logged reading in 3 days. Add the Continue Reading widget?" (silent, dismissible suggestion in edit mode).
- **Presets** — themed dashboard packs (e.g. "Daily action", "Reading retreat", "Challenge mode", "Quiet days").
- **Advanced social / challenge widgets** — e.g. "Friends progress today" (when explicitly shared), "Circle streak".
- **Per-time-of-day** layouts (morning vs. evening) — optional, off by default.

---

## 8. Editing UX direction (for design exploration)

- Long-press anywhere on Home enters edit mode (Apple parity).
- In edit mode: subtle "shimmer" or scale-down on widgets, remove + drag handles visible.
- Tapping a widget in edit mode opens an **inspector sheet**: size, accent (gold / sage / neutral), show/hide labels, etc.
- Done button (top-right) commits + animates back to view mode.
- Animation budget: stay within `theme.motion` durations. No continuous shimmer.

---

## 9. Risks / open questions

- **Performance** — many heavy widgets at once (Aura, Weekly Habits, Featured Highlight) need lazy mounting. Each widget should be cheap when offscreen.
- **iPad layout** — drag-reorder behaviors differ at 3+ columns. Worth a design exploration before V1 ships.
- **Sync vs. local** — V1 stores layouts in Supabase. Should there be a local-first cache so the Dashboard renders instantly while the layout fetch resolves? Yes, AsyncStorage cache + Supabase as source of truth.
- **Onboarding** — should the default layout be tailored to declared interests during signup? Worth a small spec.
