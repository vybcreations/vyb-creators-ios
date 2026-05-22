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
 * Important: we do NOT add insets.bottom here. The floating tab bar lives
 * at bottom:24 with a 42pt height — its 66pt visual zone already covers
 * the home-indicator safe area on iPhone. Adding insets.bottom on top
 * double-counts that space and pushes the composer ~30pt too high (the
 * regression that moved the Tasks composer way above the tab bar).
 *
 * Tabbed screens (Tasks): composer rests at ~90pt → sits right above
 * the floating tab bar with a small visual gap. This was the original
 * tuned value.
 *
 * iPad still gets a touch more clearance via IPAD_EXTRA_OFFSET so the
 * hardware-keyboard accessory + bottom-left language indicator don't
 * crowd the composer.
 */
export function useComposerLayout() {
  const insets = useSafeAreaInsets();
  const isTablet = useIsTablet();
  const extra = isTablet ? IPAD_EXTRA_OFFSET : IPHONE_EXTRA_OFFSET;
  const restingBottom = Math.max(90, TAB_BAR_VISUAL_HEIGHT + extra);
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
