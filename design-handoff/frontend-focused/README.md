# VYB Frontend-focused export

A self-contained snapshot of the frontend (tokens + components + screens) for design review.

Paths inside this folder mirror the real repo layout, so file paths in the handoff docs (e.g. `src/components/ui/VYBCard.tsx`) point to the same relative location here.

## What's inside

- `src/theme.ts` — design tokens
- `src/components/ui/` — Phase A foundation components + index
- `src/components/profile/` — profile-domain components
- `src/components/primitives.tsx` + selected shared components
- `src/lib/layout.ts`, `dates.ts`, `haptics.ts` — UI-adjacent utilities
- `src/screens/` — all visible screens (no data libs)
- `assets/logos/` — brand wordmarks

## What's NOT inside (intentionally)

- `node_modules/`, build outputs
- `.env`, secrets, credentials
- Backend / data libraries (`src/lib/*.ts` other than the UI utilities above)
- Supabase migrations + edge functions
- Licensed font binaries (fonts are loaded via `@expo-google-fonts/*` — see `theme.ts` for the family names)

## How to read it

Start with `../VYB_DESIGN_SYSTEM_HANDOFF.md`, then follow the recommended reading order in `../RELEVANT_FILES.md`.
