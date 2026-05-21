# Component Audit Summary

> Snapshot of the current state of the VYB component system, the duplications we want to consolidate, and the recommended shared components going forward.

---

## TL;DR

- **Token layer (`src/theme.ts`)**: solid foundation. Semantic state / achievement / motion tokens were added in Phase A.
- **Component layer**: fragmented. Two card systems coexist (`VYBCard` and `VYBGlowCard`) plus old `primitives.tsx` + raw inline `<View>` styling.
- The intended source of truth, **`VYBCard`** (with explicit `hero / widget / list / flat` levels), exists and is documented but is **almost never used directly** — most "v2-feeling" screens reach for `VYBGlowCard` instead.
- **HomeScreen reinvented the widget-level card inline** as `WidgetCard`.
- Most v2-aligned screen: **ProfileScreen**.
- Most off-system screen: **TasksScreen + HabitsScreen** (raw `<View>` styling, list-based, no shared card primitive) — but Habits has now been partially migrated in this branch.

---

## Old vs. new system

**Old system** — `primitives.tsx` (`Card`, `HeroCard`, `Ring`, `Check`, `BookCover`) + raw `<View>` styling.
- Used by: **Habits, Tasks, Settings, BookDetail, Reading list grid, AuthScreen, EditProfile, Capture**.
- `Card` is now removed from Settings (migrated). Habits main screen partially migrated.

**New system** — `components/ui/` + `components/profile/`.
- `VYBCard`, `VYBGlowCard`, `VYBGridBeamCard`, `VYBBadgeCard` + the Phase A additions.
- Used heavily by: **Profile, Friends, FriendDetail, CircleDetail, ChallengeDetail (partial), Home (partial)**.

---

## Duplications to consolidate

| Concept | Implementations today | Target |
|---|---|---|
| **Card surface** | `primitives.Card`, `VYBCard`, `VYBGlowCard`, `HomeScreen.WidgetCard` | `VYBCard` (fold `VYBGlowCard` into a `glow` variant) |
| **Book cover** | `primitives.BookCover`, `BookCover3D`, `ReadingScreen.Cover`, `HomeScreen.BookCoverThumb`, `FriendDetailScreen.BookCoverMini`, `ProfileScreen.FavoriteCover`, `FavoritePickerSheet.MiniCover` | `VYBBookCover` (static) + `BookCover3D` (interactive only) |
| **Habit row** | `HabitsScreen.HabitRow`, `HomeScreen` Today list, `HomeScreen.WeeklyHabitsGrid` cells | `VYBHabitRow` (extract) |
| **Task row** | `TasksScreen.TaskRow`, `HomeScreen.TaskGroup` rows | `VYBTaskRow` (extract) |
| **Segmented toggle** | `HomeScreen.HabitsViewToggle`, `ProfileScreen` Aura toggle, `ProfileScreen.PeriodSummary` toggle, `BookDetailScreen.PanelPill` + `FilterChip`, `FriendsScreen.SegmentedTabs`, `TasksScreen` filter pills | `VYBToggle` (exists in Phase A) |
| **Progress ring** | `primitives.Ring`, `HomeScreen.ProgressRing`, `profile/AuraCircle` | `VYBProgressRing` (exists; `AuraCircle` can layer on top) |
| **Check circle** | inline in ≥ 5 screens; `primitives.Check` unused | `VYBCheckCircle` (exists) |
| **Pill / chip** | `Pill`, `PriPill`, `SmallPill`, `ProjectPill`, `FilterChip`, `PanelPill`, `ChipButton`, `HeaderIconButton` | `VYBChip` (exists) |
| **Composer / TextInput** | ≥ 7 inline copies | `VYBInput` + `VYBComposer` (exist) |
| **Empty state** | `HomeScreen.EmptyCard`, `FriendDetailScreen.EmptyMini`, inline dashed empties | `VYBEmpty` (exists) |
| **Hero card** | ReadingScreen "Reading Now", HabitsScreen today hero, ChallengeDetail `ChallengeHero`, ProfileScreen `AuraStateCard` | `VYBCard level="hero"` + a `Hero...` content recipe per domain |
| **Screen header** | every screen builds its own raw `<View>` (back + title + right action) | `VYBScreenHeader` (exists; 4 variants) |

---

## Recommended shared components (the v2 surface)

Already in `src/components/ui/`:

- `VYBCard`
- `VYBGlowCard` (keep for now; document as "will fold into VYBCard glow option")
- `VYBToggle`
- `VYBChip`
- `VYBProgressRing`
- `VYBCheckCircle`
- `VYBBookCover`
- `VYBEmpty`
- `VYBScreenHeader`
- `VYBInput`
- `VYBComposer`

Not yet built — recommended next:

- **`VYBHabitRow`** — extract the row shell from `HabitsScreen.HabitRow` + the equivalent Dashboard pattern. Keeps the title (using `AnimatedHabitTitle` + `VYBCheckCircle`), streak, weekly dots, optional action menu.
- **`VYBTaskRow`** — extract the row shell from `TasksScreen.TaskRow` and the simpler `HomeScreen.TaskGroup` row. Same gold check + strikethrough + priority dot.
- **`VYBAvatar`** — promote the existing `primitives.Avatar` cleanly with v2-aligned tones.
- **`VYBPopover`** — already exists at `src/components/VYBPopover.tsx`; move under `ui/`.
- **`VYBActionMenu`** — promote `src/components/ActionMenu.tsx` to the shared sheet bottom-action menu.

---

## Token additions (Phase A)

Added to `src/theme.ts`:

- `state` — `urgent / important / later / complete / inProgress / inactive`
- `achievement` — `reading / streak / win / proof / circle / general`
- `motion` — `duration: {fast, normal, slow}` + `easing: {standard, soft}`

Existing token layer kept intact (colors, gradients, space, radius, shadow, fonts).

---

## Migration status (in `design-system-v2-handoff` branch)

| Screen | Status |
|---|---|
| SettingsScreen | ✅ migrated (VYBCard + VYBScreenHeader) |
| HabitsScreen | 🟡 partial (header + today summary + check circle migrated; row shell + extras kept) |
| HabitEditorSheet | ✅ migrated (VYBInput + VYBChip + VYBToggle) |
| AreaEditorSheet | ✅ migrated (VYBInput + VYBChip) |
| HomeScreen | ❌ pending |
| TasksScreen | ❌ pending |
| ReadingScreen | ❌ pending |
| BookDetailScreen | ❌ pending |
| FriendsScreen | ❌ pending |
| CircleDetailScreen | ❌ pending |
| ChallengeDetailScreen | ❌ pending |
| ProfileScreen | ❌ pending (most v2-aligned today) |
| FriendDetailScreen | ❌ pending |
| AuthScreen | ❌ pending |
| EditProfileScreen | ❌ pending |
| CaptureScreen | ❌ pending |
