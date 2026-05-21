// VYB Creators — design tokens (RN port of tokens.css).
// Dark by default. Light is secondary.

export const colors = {
  bgBase:     '#0A0A0C',
  bgElevated: '#131318',
  bgOverlay:  '#1C1C22',
  bgGlass:    'rgba(20,20,26,0.65)',
  bgGlassSolid: 'rgba(20,20,26,0.96)',

  borderSubtle: 'rgba(255,255,255,0.06)',
  borderMid:    'rgba(255,255,255,0.10)',
  borderStrong: 'rgba(255,255,255,0.18)',

  textPrimary:   '#FAFAF8',
  textSecondary: 'rgba(250,250,248,0.72)',
  textMuted:     'rgba(250,250,248,0.50)',
  textFaint:     'rgba(250,250,248,0.30)',
  textOnAccent:  '#0A0A0C',

  gold:        '#C9A961',
  goldBright:  '#E8C275',
  goldDeep:    '#8C7340',
  goldFaint:   'rgba(201,169,97,0.12)',
  goldGlow:    'rgba(201,169,97,0.35)',

  forest:        '#4A6B52',
  forestBright:  '#6B8F70',
  forestDeep:    '#2D4332',
  forestFaint:   'rgba(74,107,82,0.14)',

  midnight:        '#2C3E5C',
  midnightBright:  '#4F6A8E',
  midnightDeep:    '#1A2538',
  midnightFaint:   'rgba(44,62,92,0.16)',

  amber:        '#E8B547',
  amberBright:  '#F5C766',
  amberFaint:   'rgba(232,181,71,0.14)',

  clay:        '#B8643C',
  clayBright:  '#D17F52',
  clayFaint:   'rgba(184,100,60,0.14)',

  // Glass / atmospheric tokens. Used by `ScreenAtmosphere` (background blobs)
  // and `glass` card variants. Kept low-opacity on purpose — depth, not noise.
  surfaceGlass:       'rgba(255,255,255,0.04)',
  surfaceGlassStrong: 'rgba(255,255,255,0.07)',
  borderGlass:        'rgba(255,255,255,0.09)',
  glowSand:           '#A08A56',
  glowSage:           '#5E7558',
  glowTeal:           '#284C55',
  glowAmber:          '#6B3D20',
};

export const gradients = {
  gold:     ['#C9A961', '#8C7340'] as const,
  forest:   ['#6B8F70', '#2D4332'] as const,
  midnight: ['#4F6A8E', '#1A2538'] as const,
  amber:    ['#F5C766', '#A87E26'] as const,
  clay:     ['#D17F52', '#7A3F22'] as const,
  aurora:   ['#C9A961', '#6B8F70', '#4F6A8E'] as const,
  dusk:     ['#1A2538', '#0A0A0C'] as const,
};

export const space = {
  s1: 4, s2: 8, s3: 12, s4: 16, s5: 20, s6: 24,
  s8: 32, s10: 40, s12: 48, s16: 64,
};

// Air left between a bottom composer/input and the keyboard top edge when
// the keyboard is open. Pass to KeyboardAvoidingView as a *negative*
// keyboardVerticalOffset so the view lifts an extra KEYBOARD_GAP pixels.
export const KEYBOARD_GAP = 20;

export const radius = {
  sm: 18, md: 22, lg: 28, xl: 36, xxl: 48, pill: 999,
};

export const shadow = {
  sm: { shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  md: { shadowColor: '#000', shadowOpacity: 0.28, shadowRadius: 24, shadowOffset: { width: 0, height: 8 }, elevation: 6 },
  lg: { shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 40, shadowOffset: { width: 0, height: 16 }, elevation: 10 },
  xl: { shadowColor: '#000', shadowOpacity: 0.45, shadowRadius: 60, shadowOffset: { width: 0, height: 24 }, elevation: 14 },
  goldGlow: { shadowColor: '#E8C275', shadowOpacity: 0.45, shadowRadius: 32, shadowOffset: { width: 0, height: 0 }, elevation: 8 },
};

// ─── Semantic state colors ───────────────────────────────────────────────
// Used by chips/pills/dots/cards to stop hardcoding hex literals per screen.
// "urgent" is warm clay (needs attention), NOT alarm red.
export const state = {
  urgent:     '#D27050', // clay
  important:  '#C9A961', // gold
  later:      '#8FA88A', // sage
  complete:   '#C9A961', // gold (same family as important)
  inProgress: '#8FA88A', // sage
  inactive:   'rgba(255,255,255,0.18)',
};

// ─── Achievement type accents ────────────────────────────────────────────
// Used by AchievementCard + any future badge surfaces.
export const achievement = {
  reading: '#C9A961',
  streak:  '#E8A87A',
  win:     '#E8C878',
  proof:   '#5DA3C9',
  circle:  '#8FA88A',
  general: '#9F8FD4',
};

// ─── Motion ──────────────────────────────────────────────────────────────
// Encodes the durations/easings used across the app so component-level
// animations stay coherent. Keep loops out — only transient state changes.
export const motion = {
  duration: {
    fast:   160,
    normal: 220,
    slow:   320,
  },
  easing: {
    // standard easeOut curve used across the app
    standard: [0.22, 1, 0.36, 1] as [number, number, number, number],
    // softer ease for sheet/expand transitions
    soft:     [0.16, 1, 0.3, 1] as [number, number, number, number],
  },
};

export const fonts = {
  sansLight: 'Montserrat_300Light',
  sans:      'Montserrat_500Medium',
  sansItalic:'Montserrat_500Medium_Italic',
  sansBold:  'Montserrat_700Bold',
  sansHeavy: 'Montserrat_800ExtraBold',
  // "serifItalic" name kept for compat; the actual font is now Montserrat Bold Italic —
  // cleaner and more legible than Fraunces while preserving the editorial italic feel.
  serifItalic: 'Montserrat_700Bold_Italic',
  mono:    'JetBrainsMono_500Medium',
  monoBold:'JetBrainsMono_600SemiBold',
};

export type Theme = {
  colors: typeof colors;
  gradients: typeof gradients;
  space: typeof space;
  radius: typeof radius;
  shadow: typeof shadow;
  fonts: typeof fonts;
  state: typeof state;
  achievement: typeof achievement;
  motion: typeof motion;
};
