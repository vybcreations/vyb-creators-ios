import { useWindowDimensions, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Layout helpers for bottom-anchored composers.
 *
 * The bug this solves: on iPad with a hardware/wireless keyboard the software
 * keyboard never appears, so KeyboardAvoidingView / keyboard-height tracking
 * report 0 and the composer drops to the screen bottom — behind the floating
 * tab bar and under iOS's bottom-left input/language indicator.
 *
 * Fix: every bottom composer reserves a *resting* offset that already clears
 * the tab bar + safe area (plus extra room on tablets), independent of
 * keyboard height. When a software keyboard does appear we lift to whichever
 * is higher.
 */

// The floating pill tab bar sits at bottom:24 and is ~42pt tall (see TabBar).
const TAB_BAR_VISUAL_HEIGHT = 24 + 42; // ≈ 66

// Extra clearance above the tab bar / safe area. iPad gets a touch more so
// the composer also clears the hardware-keyboard language indicator — but
// tuned low so it sits close to the nav, not floating mid-screen.
const IPHONE_EXTRA_OFFSET = 12;
const IPAD_EXTRA_OFFSET   = 16;

// iPad / large screens get extra breathing room so the composer also clears
// the system keyboard accessory + bottom-left language indicator.
export function useIsTablet(): boolean {
  const { width, height } = useWindowDimensions();
  const minSide = Math.min(width, height);
  return Platform.OS === 'ios' && minSide >= 768;
}

/**
 * restingBottom — where a bottom composer should sit when no software
 * keyboard is shown.
 *
 * Two contexts:
 *   - 'tabbed' (default) — used by Tasks. The bottom of the screen has
 *     the floating tab bar (66pt visual zone at the bottom). Resting at
 *     90pt puts the composer right above the tab bar with a small gap.
 *
 *   - 'stack'  — used by BookDetail. The screen is pushed on the stack
 *     and the tab bar is hidden. The composer/switcher only needs to
 *     clear the safe-area home indicator + a tiny visual gap. Resting
 *     at insets.bottom + 12 keeps it close to the bottom edge.
 *
 * iPad still gets a touch more clearance via IPAD_EXTRA_OFFSET so the
 * hardware-keyboard accessory + bottom-left language indicator don't
 * crowd the composer.
 */
export function useComposerLayout(opts?: { context?: 'tabbed' | 'stack' }) {
  const insets = useSafeAreaInsets();
  const isTablet = useIsTablet();
  const extra = isTablet ? IPAD_EXTRA_OFFSET : IPHONE_EXTRA_OFFSET;
  const ctx = opts?.context ?? 'tabbed';
  const restingBottom = ctx === 'stack'
    ? Math.max(40, insets.bottom + extra)
    : Math.max(90, TAB_BAR_VISUAL_HEIGHT + extra);
  return { restingBottom, isTablet, insets };
}

/**
 * composerLiftFor — given a measured software-keyboard height, the bottom
 * offset the composer should animate to. Never drops below restingBottom, so
 * a hardware keyboard (height 0) keeps the composer above the tab bar.
 */
export function composerLiftFor(
  keyboardHeight: number,
  gap: number,
  restingBottom: number,
): number {
  return Math.max(keyboardHeight + gap, restingBottom);
}
