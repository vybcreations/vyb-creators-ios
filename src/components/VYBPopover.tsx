import React, {
  createContext, useContext, useEffect, useRef, useState, useCallback,
} from 'react';
import {
  View, Pressable, Modal, Animated, Easing, Dimensions, Keyboard,
  Text, ViewStyle, StyleProp, AccessibilityInfo, BackHandler,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { colors as C, fonts as F } from '../theme';

/**
 * VYBPopover — small native popover for lightweight contextual actions.
 *
 * Built natively for Expo: standard RN `Modal` for the overlay layer, JS
 * `Animated` for the open/close transition, `measureInWindow` for anchoring.
 * No reanimated, no SVG, nothing that would force a dev build.
 *
 * Visual treatment matches the bottom-nav glass language (BlurView dark +
 * borderMid + rounded) so it doesn't read as a generic web popover.
 *
 * Use it for *small* lists of contextual actions (≤5 items). For full forms,
 * keep using `DraggableSheet` / full-screen routes.
 *
 * Usage:
 *   <VYBPopover>
 *     <VYBPopoverTrigger>
 *       <IconButton>...</IconButton>
 *     </VYBPopoverTrigger>
 *     <VYBPopoverContent>
 *       <VYBPopoverItem label="Edit"   icon={...} onPress={...} />
 *       <VYBPopoverDivider />
 *       <VYBPopoverItem label="Delete" destructive icon={...} onPress={...} />
 *     </VYBPopoverContent>
 *   </VYBPopover>
 */

type Anchor = { x: number; y: number; width: number; height: number };
type Align = 'start' | 'end' | 'center';

type Ctx = {
  open: boolean;
  anchor: Anchor | null;
  openAt: (a: Anchor) => void;
  close: () => void;
};

const PopoverCtx = createContext<Ctx | null>(null);
function useCtx(): Ctx {
  const c = useContext(PopoverCtx);
  if (!c) throw new Error('VYBPopover.* must be used inside <VYBPopover>');
  return c;
}

export function VYBPopover({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const openAt = useCallback((a: Anchor) => {
    Keyboard.dismiss();
    setAnchor(a);
    setOpen(true);
  }, []);
  const close = useCallback(() => setOpen(false), []);
  return (
    <PopoverCtx.Provider value={{ open, anchor, openAt, close }}>
      {children}
    </PopoverCtx.Provider>
  );
}

export function VYBPopoverTrigger({ children }: { children: React.ReactElement }) {
  const ctx = useCtx();
  const ref = useRef<View>(null);
  const trigger = () => {
    ref.current?.measureInWindow((x, y, width, height) => {
      ctx.openAt({ x, y, width, height });
    });
  };
  // Clone the child instead of wrapping it in our own Pressable. This lets
  // callers attach styles, refs, and other props on their own Pressable/
  // Button/IconButton without losing them to an extra wrapper. We replace
  // the child's `onPress` with our trigger — that's the whole point of
  // VYBPopoverTrigger: open the popover when the child is tapped.
  return React.cloneElement(children as any, { ref, onPress: trigger });
}

export function VYBPopoverContent({
  children, width = 220, align = 'end', offset = 8,
}: {
  children: React.ReactNode;
  width?: number;
  align?: Align;       // horizontal alignment relative to the trigger
  offset?: number;     // vertical gap between trigger and popover
}) {
  const ctx = useCtx();
  const opacity = useRef(new Animated.Value(0)).current;
  const scale   = useRef(new Animated.Value(0.96)).current;
  const ty      = useRef(new Animated.Value(4)).current;

  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => sub?.remove?.();
  }, []);

  // Drive the open/close animation.
  useEffect(() => {
    if (ctx.open) {
      if (reduceMotion) {
        opacity.setValue(1); scale.setValue(1); ty.setValue(0);
        return;
      }
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 180, easing: VYB_EASE, useNativeDriver: true }),
        Animated.timing(scale,   { toValue: 1, duration: 220, easing: VYB_EASE, useNativeDriver: true }),
        Animated.timing(ty,      { toValue: 0, duration: 220, easing: VYB_EASE, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 0,    duration: 140, easing: VYB_EASE, useNativeDriver: true }),
        Animated.timing(scale,   { toValue: 0.96, duration: 160, easing: VYB_EASE, useNativeDriver: true }),
      ]).start(() => {
        // Reset translateY for next open so the entry animation looks the same.
        ty.setValue(4);
      });
    }
  }, [ctx.open, reduceMotion]);

  // Android hardware back should close the popover instead of navigating.
  useEffect(() => {
    if (!ctx.open) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { ctx.close(); return true; });
    return () => sub.remove();
  }, [ctx.open, ctx.close]);

  if (!ctx.open || !ctx.anchor) return null;

  // Compute final position with cheap flip heuristics: if the trigger sits in
  // the bottom half of the screen, open *above* it so the popover stays in
  // view. Same for horizontal: clamp inside a 16px screen gutter.
  const screen = Dimensions.get('window');
  const a = ctx.anchor;
  const estimatedHeight = 200; // a sane cap; the actual content can be shorter
  const wouldOverflowDown = (a.y + a.height + offset + estimatedHeight) > (screen.height - 100);

  let top: number;
  if (wouldOverflowDown) {
    top = Math.max(48, a.y - offset - estimatedHeight);
  } else {
    top = a.y + a.height + offset;
  }

  let left: number;
  if (align === 'start')      left = a.x;
  else if (align === 'center') left = a.x + a.width / 2 - width / 2;
  else                         left = a.x + a.width - width; // 'end'
  left = Math.min(Math.max(16, left), screen.width - width - 16);

  return (
    <Modal
      transparent
      visible
      animationType="none"
      statusBarTranslucent
      onRequestClose={ctx.close}>
      {/* Tap-outside backdrop. Transparent so the screen behind is visible. */}
      <Pressable onPress={ctx.close} style={{ flex: 1 }}>
        {/* Inner Pressable swallows taps so they don't bubble to the backdrop. */}
        <Animated.View
          pointerEvents="box-none"
          style={{
            position: 'absolute', top, left, width,
            opacity,
            transform: [{ scale }, { translateY: ty }],
          }}>
          <Pressable onPress={() => {}}>
            <BlurView intensity={45} tint="dark" style={{
              borderRadius: 14, overflow: 'hidden',
              borderColor: C.borderMid, borderWidth: 1,
              shadowColor: '#000', shadowOpacity: 0.45, shadowRadius: 20, shadowOffset: { width: 0, height: 10 },
            }}>
              <View style={{ paddingVertical: 6 }}>
                {children}
              </View>
            </BlurView>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

export function VYBPopoverItem({
  label, icon, onPress, destructive,
}: {
  label: string;
  icon?: React.ReactNode;
  onPress?: () => void;
  destructive?: boolean;
}) {
  const ctx = useCtx();
  return (
    <Pressable
      onPress={() => { ctx.close(); setTimeout(() => onPress?.(), 80); }}
      style={({ pressed }) => ({
        flexDirection: 'row', alignItems: 'center', gap: 10,
        paddingHorizontal: 14, paddingVertical: 11,
        backgroundColor: pressed ? 'rgba(255,255,255,0.05)' : 'transparent',
      })}>
      {icon && <View style={{ width: 18, alignItems: 'center' }}>{icon}</View>}
      <Text style={{
        flex: 1, fontFamily: F.sansBold, fontSize: 13, letterSpacing: 0.2,
        color: destructive ? C.clay : C.textPrimary,
      }}>
        {label}
      </Text>
    </Pressable>
  );
}

export function VYBPopoverDivider() {
  return <View style={{ height: 1, backgroundColor: C.borderGlass, marginVertical: 4, marginHorizontal: 8 }} />;
}

export function VYBPopoverClose({ children }: { children: React.ReactNode }) {
  const ctx = useCtx();
  return <Pressable onPress={ctx.close}>{children}</Pressable>;
}

// Internal — shared with the open/close animation.
const VYB_EASE = Easing.bezier(0.22, 1, 0.36, 1);

// Optional style helper for callers that want a Pressable-only wrapper.
export const popoverItemStyle: StyleProp<ViewStyle> = {
  flexDirection: 'row', alignItems: 'center', gap: 10,
  paddingHorizontal: 14, paddingVertical: 11,
};
