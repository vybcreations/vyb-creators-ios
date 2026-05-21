# Relevant Files — for Claude Design inspection

> Exact repo paths Claude Design should read first. Grouped by domain. All paths are relative to the repo root (`vyb-creators-ios/`).

---

## Design tokens

- [`src/theme.ts`](../src/theme.ts) — colors, gradients, space, radius, shadow, fonts, semantic state, achievement, motion

---

## Phase A foundation components (`src/components/ui/`)

- [`src/components/ui/index.ts`](../src/components/ui/index.ts) — central exports
- [`src/components/ui/VYBCard.tsx`](../src/components/ui/VYBCard.tsx) — 4 levels (hero/widget/list/flat), accent + glow + onPress
- [`src/components/ui/VYBToggle.tsx`](../src/components/ui/VYBToggle.tsx) — segmented pill
- [`src/components/ui/VYBChip.tsx`](../src/components/ui/VYBChip.tsx) — pill / chip
- [`src/components/ui/VYBProgressRing.tsx`](../src/components/ui/VYBProgressRing.tsx) — SVG ring
- [`src/components/ui/VYBCheckCircle.tsx`](../src/components/ui/VYBCheckCircle.tsx) — animated checkbox circle
- [`src/components/ui/VYBBookCover.tsx`](../src/components/ui/VYBBookCover.tsx) — static cover (5 sizes)
- [`src/components/ui/VYBEmpty.tsx`](../src/components/ui/VYBEmpty.tsx) — empty state
- [`src/components/ui/VYBScreenHeader.tsx`](../src/components/ui/VYBScreenHeader.tsx) — screen-top header (4 variants)
- [`src/components/ui/VYBInput.tsx`](../src/components/ui/VYBInput.tsx) — base input (forwardRef)
- [`src/components/ui/VYBComposer.tsx`](../src/components/ui/VYBComposer.tsx) — bottom composer (iPad-keyboard-safe)

### Other existing v2 cards (will eventually fold into VYBCard)

- [`src/components/ui/VYBGlowCard.tsx`](../src/components/ui/VYBGlowCard.tsx) — colored-glow card (heavily used today)
- [`src/components/ui/VYBGridBeamCard.tsx`](../src/components/ui/VYBGridBeamCard.tsx) — beam-grid card (Profile only)
- [`src/components/ui/VYBBadgeCard.tsx`](../src/components/ui/VYBBadgeCard.tsx) — milestone badge card (Profile only)
- [`src/components/ui/VYBTextAnimate.tsx`](../src/components/ui/VYBTextAnimate.tsx) — text reveal animation

---

## Old primitives + shared helpers

- [`src/components/primitives.tsx`](../src/components/primitives.tsx) — old `Card`, `HeroCard`, `Pill`, `GoldButton`, `IconButton`, `Ring`, `Avatar`, `Check`, `BookCover`, `Heatmap`, `Tx` helpers (some will be deprecated)
- [`src/components/AnimatedHabitTitle.tsx`](../src/components/AnimatedHabitTitle.tsx) — `AnimatedHabitTitle` + `AnimatedHabitCheck` (text-only strikethrough; will be replaced by VYBCheckCircle + VYBHabitRow extraction)
- [`src/components/TabBar.tsx`](../src/components/TabBar.tsx) — floating pill tab bar
- [`src/components/DraggableSheet.tsx`](../src/components/DraggableSheet.tsx) — base bottom sheet
- [`src/components/ActionMenu.tsx`](../src/components/ActionMenu.tsx) — bottom action sheet
- [`src/components/VYBPopover.tsx`](../src/components/VYBPopover.tsx) — popover
- [`src/components/GlassCard.tsx`](../src/components/GlassCard.tsx) — light glass wrapper
- [`src/components/ScreenAtmosphere.tsx`](../src/components/ScreenAtmosphere.tsx) — background atmospheric blobs
- [`src/components/BookCover3D.tsx`](../src/components/BookCover3D.tsx) — interactive 3D book cover
- [`src/components/MiniSessionBar.tsx`](../src/components/MiniSessionBar.tsx) — reading session bar
- [`src/components/UndoToast.tsx`](../src/components/UndoToast.tsx) — global undo toast
- [`src/components/VYBBorderBeamButton.tsx`](../src/components/VYBBorderBeamButton.tsx) — kill-switched (kept for reference)
- [`src/components/VoiceDictationButton.tsx`](../src/components/VoiceDictationButton.tsx) — mic dictation in composers

### Profile-specific components

- [`src/components/profile/AchievementCard.tsx`](../src/components/profile/AchievementCard.tsx) — achievement card + detail sheet
- [`src/components/profile/AuraCircle.tsx`](../src/components/profile/AuraCircle.tsx) — Aura state ring
- [`src/components/profile/FeaturedBadge.tsx`](../src/components/profile/FeaturedBadge.tsx) — featured highlight pill
- [`src/components/profile/SocialIcon.tsx`](../src/components/profile/SocialIcon.tsx) — social platform glyphs + pill

---

## Layout / utility libs

- [`src/lib/layout.ts`](../src/lib/layout.ts) — `useComposerLayout`, `useIsTablet`, `composerLiftFor` (iPad keyboard fix)
- [`src/lib/dates.ts`](../src/lib/dates.ts) — local date helpers (timezone fix)
- [`src/lib/haptics.ts`](../src/lib/haptics.ts) — haptic helpers

---

## Screens

| Screen | Path | Migration status |
|---|---|---|
| Auth | [`src/screens/AuthScreen.tsx`](../src/screens/AuthScreen.tsx) | not migrated |
| Home / Dashboard | [`src/screens/HomeScreen.tsx`](../src/screens/HomeScreen.tsx) | not migrated |
| Habits | [`src/screens/HabitsScreen.tsx`](../src/screens/HabitsScreen.tsx) | partial (header + today summary + check circle) |
| Habit Editor sheet | [`src/screens/habits/HabitEditorSheet.tsx`](../src/screens/habits/HabitEditorSheet.tsx) | migrated |
| Area Editor sheet | [`src/screens/habits/AreaEditorSheet.tsx`](../src/screens/habits/AreaEditorSheet.tsx) | migrated |
| Tasks | [`src/screens/TasksScreen.tsx`](../src/screens/TasksScreen.tsx) | not migrated |
| Reading | [`src/screens/ReadingScreen.tsx`](../src/screens/ReadingScreen.tsx) | not migrated |
| Book Detail | [`src/screens/BookDetailScreen.tsx`](../src/screens/BookDetailScreen.tsx) | not migrated |
| Add Book sheet | [`src/screens/reading/AddBookSheet.tsx`](../src/screens/reading/AddBookSheet.tsx) | not migrated |
| Add Pages sheet | [`src/screens/reading/AddPagesSheet.tsx`](../src/screens/reading/AddPagesSheet.tsx) | not migrated |
| Edit Book sheet | [`src/screens/reading/EditBookSheet.tsx`](../src/screens/reading/EditBookSheet.tsx) | not migrated |
| Entry Composer | [`src/screens/reading/EntryComposer.tsx`](../src/screens/reading/EntryComposer.tsx) | not migrated |
| Entry sheet | [`src/screens/reading/EntrySheet.tsx`](../src/screens/reading/EntrySheet.tsx) | not migrated |
| Favorite Picker sheet | [`src/screens/reading/FavoritePickerSheet.tsx`](../src/screens/reading/FavoritePickerSheet.tsx) | not migrated |
| Goals sheet | [`src/screens/reading/GoalsSheet.tsx`](../src/screens/reading/GoalsSheet.tsx) | not migrated |
| Session sheet | [`src/screens/reading/SessionSheet.tsx`](../src/screens/reading/SessionSheet.tsx) | not migrated |
| Start Reading sheet | [`src/screens/reading/StartReadingSheet.tsx`](../src/screens/reading/StartReadingSheet.tsx) | not migrated |
| Friends | [`src/screens/FriendsScreen.tsx`](../src/screens/FriendsScreen.tsx) | not migrated |
| Friend Detail | [`src/screens/FriendDetailScreen.tsx`](../src/screens/FriendDetailScreen.tsx) | not migrated |
| Circle Detail | [`src/screens/CircleDetailScreen.tsx`](../src/screens/CircleDetailScreen.tsx) | not migrated |
| Challenge Detail | [`src/screens/ChallengeDetailScreen.tsx`](../src/screens/ChallengeDetailScreen.tsx) | not migrated |
| Challenge Preview | [`src/screens/ChallengePreviewScreen.tsx`](../src/screens/ChallengePreviewScreen.tsx) | not migrated |
| Profile / You | [`src/screens/ProfileScreen.tsx`](../src/screens/ProfileScreen.tsx) | not migrated (most v2-aligned today) |
| Edit Profile | [`src/screens/EditProfileScreen.tsx`](../src/screens/EditProfileScreen.tsx) | not migrated |
| Settings | [`src/screens/SettingsScreen.tsx`](../src/screens/SettingsScreen.tsx) | migrated (reference) |
| Capture (Ideas) | [`src/screens/CaptureScreen.tsx`](../src/screens/CaptureScreen.tsx) | not migrated |
| Focus | [`src/screens/FocusScreen.tsx`](../src/screens/FocusScreen.tsx) | not migrated |
| QR Scanner | [`src/screens/QRScannerScreen.tsx`](../src/screens/QRScannerScreen.tsx) | not migrated |

---

## Assets

- [`assets/logos/vyb-white.png`](../assets/logos/vyb-white.png) — square wordmark on dark (used in Dashboard header)
- [`assets/logos/vyb-black.png`](../assets/logos/vyb-black.png) — square wordmark on light
- [`assets/logos/vyb-full-white.png`](../assets/logos/vyb-full-white.png) — wide lockup on dark (used in Auth)
- [`assets/logos/vyb-full-black.png`](../assets/logos/vyb-full-black.png) — wide lockup on light
- [`assets/icon.png`](../assets/icon.png) — app icon
- [`assets/splash-icon.png`](../assets/splash-icon.png) — splash icon
- [`assets/adaptive-icon.png`](../assets/adaptive-icon.png) — Android adaptive icon

---

## Reading order (recommended for Claude Design)

1. `design-handoff/VYB_DESIGN_SYSTEM_HANDOFF.md`
2. `src/theme.ts`
3. All of `src/components/ui/`
4. `src/components/primitives.tsx`
5. `src/screens/SettingsScreen.tsx` (reference: how a migrated screen looks)
6. `src/screens/HabitsScreen.tsx` + `src/screens/habits/HabitEditorSheet.tsx` (reference: partial migration)
7. `src/screens/HomeScreen.tsx` (largest pre-migration screen)
8. `src/screens/ProfileScreen.tsx` (most v2-aligned, heavy use of VYBGlowCard)
9. `design-handoff/COMPONENT_AUDIT_SUMMARY.md`
10. `design-handoff/DASHBOARD_CUSTOMIZATION_PLAN.md`
