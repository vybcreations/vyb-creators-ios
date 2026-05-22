import React, { useEffect, useRef } from 'react';
import { Animated, Dimensions, Easing, Keyboard, KeyboardAvoidingView, Modal, PanResponder, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { X } from 'lucide-react-native';
import { colors as C, fonts as F, radius as R, KEYBOARD_GAP } from '../theme';
import { useIsTablet } from '../lib/layout';

// Bottom sheet with slide-up animation + drag-down to dismiss.
//
// Sheets that have a visible title should render <SheetHeader title=... onClose=... />
// as their first child and pass `showClose={false}` so the title + X sit on the
// same row. Sheets without a header (like ActionMenu) leave `showClose` on its
// default and get an absolutely-positioned X.
export function DraggableSheet({
  visible, onDismiss, children, maxHeightFraction = 0.92, showClose = true,
  keyboardAvoiding = true,
  surface = 'solid',
}: {
  visible: boolean;
  onDismiss: () => void;
  children: React.ReactNode;
  maxHeightFraction?: number;
  showClose?: boolean;
  /** Sheet surface style.
   *  - 'solid' (default): warm-black bgElevated — used by short sheets like
   *    ActionMenu, HabitEditor, AreaEditor.
   *  - 'glass': frosted BlurView (iOS) / layered translucent fill (Android)
   *    with a soft top edge highlight. The new v2 creation-flow surface;
   *    consumed by VYBCreationSheet → AddBookSheet, ReadingSessionSheet. */
  surface?: 'solid' | 'glass';
  /** When true (default), the whole sheet is wrapped in a KeyboardAvoidingView
   *  that lifts the sheet above the keyboard. This is correct for short
   *  sheets but overshoots for near-full-height sheets (the sheet would slide
   *  off the top of the screen). For tall sheets (maxHeightFraction ≥ 0.9)
   *  with forms, pass `keyboardAvoiding={false}` and handle keyboard insets
   *  inside the sheet body (e.g. ScrollView w/ keyboardShouldPersistTaps +
   *  automaticallyAdjustKeyboardInsets, or an inner KAV around just the form). */
  keyboardAvoiding?: boolean;
}) {
  const slide = useRef(new Animated.Value(0)).current;
  const drag  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) drag.setValue(0);
    Animated.timing(slide, {
      toValue: visible ? 1 : 0,
      duration: visible ? 320 : 240,
      easing: visible
        ? Easing.bezier(0.16, 1, 0.3, 1)  // springy ease-out for entrance
        : Easing.bezier(0.32, 0, 0.67, 0), // smooth ease-in for exit
      useNativeDriver: true,
    }).start();
  }, [visible, slide, drag]);

  const pan = useRef(
    PanResponder.create({
      // Don't claim the responder on touch START — that lets taps (X, Save,
      // chips, etc.) through. Only steal the gesture once the user drags
      // downward by a few px, so swipe-to-dismiss works from any area we
      // attach the handlers to without breaking taps inside it.
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, g) => g.dy > 6 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderMove: (_, g) => { if (g.dy > 0) drag.setValue(g.dy); },
      onPanResponderRelease: (_, g) => {
        const shouldClose = g.dy > 120 || g.vy > 0.6;
        if (shouldClose) {
          Animated.timing(drag, { toValue: 800, duration: 200, useNativeDriver: true })
            .start(() => { drag.setValue(0); onDismiss(); });
        } else {
          Animated.spring(drag, { toValue: 0, useNativeDriver: true, friction: 8 }).start();
        }
      },
    }),
  ).current;

  const translateY = Animated.add(
    slide.interpolate({ inputRange: [0, 1], outputRange: [800, 0] }),
    drag,
  );
  const backdropOpacity = slide.interpolate({ inputRange: [0, 1], outputRange: [0, 0.6] });

  // When the KAV is disabled (tall sheets like AddBook) we want the sheet to
  // ACTUALLY render at maxHeightFraction — otherwise SafeAreaView sizes to
  // content and a sheet whose body uses minHeight ends up shorter than the
  // user expects. With keyboardAvoiding=true the sheet stays content-sized
  // so the existing short sheets don't regress.
  const fillSheet = !keyboardAvoiding;
  const SCREEN_H = Dimensions.get('window').height;
  const sheetHeight = fillSheet ? Math.round(SCREEN_H * maxHeightFraction) : undefined;

  // iPad: cap sheet width so it doesn't stretch full-width and feel like a
  // giant panel. Centered horizontally.
  const isTablet = useIsTablet();
  const tabletWidth = isTablet ? Math.min(560, Dimensions.get('window').width - 48) : undefined;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onDismiss} statusBarTranslucent>
      <View style={{ flex: 1 }}>
        <Animated.View pointerEvents="none"
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#000', opacity: backdropOpacity }} />
        <Pressable onPress={onDismiss} style={{ flex: 1 }} />
        <ConditionalKAV enabled={keyboardAvoiding}>
          <Animated.View style={{
            transform: [{ translateY }],
            ...(fillSheet
              ? { height: sheetHeight }
              : { maxHeight: `${maxHeightFraction * 100}%` as any }),
            ...(tabletWidth ? { width: tabletWidth, alignSelf: 'center' } : null),
          }}>
            <SafeAreaView edges={['bottom']} style={{
              flex: fillSheet ? 1 : undefined,
              backgroundColor: surface === 'glass' ? 'rgba(13,12,11,0.78)' : C.bgElevated,
              borderTopLeftRadius: R.xl, borderTopRightRadius: R.xl,
              ...(tabletWidth ? { borderBottomLeftRadius: R.xl, borderBottomRightRadius: R.xl } : null),
              borderColor: surface === 'glass' ? 'rgba(255,255,255,0.14)' : C.borderMid,
              borderTopWidth: 1, borderLeftWidth: 1, borderRightWidth: 1,
              ...(tabletWidth ? { borderBottomWidth: 1 } : null),
              shadowColor: '#000', shadowOpacity: 0.6, shadowRadius: 40, shadowOffset: { width: 0, height: -8 },
              overflow: 'hidden',
            }}>
              {/* Glass surface layers — only when surface='glass'. On iOS the
                  native BlurView produces the frosted look; Android falls
                  back to the layered translucent fill we already use in
                  VYBGlassCard (BlurView on Android costs too much overdraw). */}
              {surface === 'glass' && Platform.OS === 'ios' && (
                <BlurView intensity={42} tint="dark" style={StyleSheet.absoluteFill} />
              )}
              {surface === 'glass' && (
                <LinearGradient
                  pointerEvents="none"
                  colors={['rgba(255,255,255,0.10)', 'rgba(255,255,255,0)']}
                  start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
                  style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 36 }}
                />
              )}
              {/* Drag zone — handle. Pan handlers also wrap the header
                  strip of `children` (see below) so users can swipe down
                  from the title area too. Body content scrolls
                  independently because the responder only claims on
                  downward MOVE, not on touch start. */}
              <View {...pan.panHandlers} style={{ paddingTop: 10, paddingBottom: 8, alignItems: 'center' }}>
                <View style={{ width: 38, height: 4, borderRadius: 2, backgroundColor: C.borderStrong }} />
              </View>

              <View {...pan.panHandlers} style={{ flexShrink: 0 }}>
                {/* The sheet's first child is conventionally the SheetHeader
                    (title + X). Wrapping it in panHandlers lets the user
                    swipe down from the title bar to dismiss. Taps on X /
                    back arrow still work because we only claim on move. */}
                {React.Children.toArray(children)[0]}
              </View>
              {React.Children.toArray(children).slice(1)}

              {/* Fallback X for sheets that don't use <SheetHeader>. Absolutely
                  positioned at the top-right of the sheet body. */}
              {showClose && (
                <Pressable
                  onPress={() => { Keyboard.dismiss(); onDismiss(); }}
                  hitSlop={10}
                  style={{
                    position: 'absolute', top: 18, right: 12,
                    width: 40, height: 40,
                    alignItems: 'center', justifyContent: 'center',
                  }}
                  accessibilityLabel="Close"
                >
                  <CloseGlyph />
                </Pressable>
              )}
            </SafeAreaView>
          </Animated.View>
        </ConditionalKAV>
      </View>
    </Modal>
  );
}

function ConditionalKAV({ enabled, children }: { enabled: boolean; children: React.ReactNode }) {
  if (!enabled) return <>{children}</>;
  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={-KEYBOARD_GAP}>
      {children}
    </KeyboardAvoidingView>
  );
}

function CloseGlyph() {
  return (
    <View style={{
      width: 32, height: 32, borderRadius: 16,
      backgroundColor: 'rgba(255,255,255,0.06)',
      alignItems: 'center', justifyContent: 'center',
    }}>
      <X size={16} color={C.textSecondary} />
    </View>
  );
}

/**
 * SheetHeader — a horizontal title row used as the first child of a DraggableSheet
 * so the title and X close button stay vertically aligned regardless of font size.
 * Pass showClose={false} on the parent DraggableSheet to avoid a duplicate X.
 */
export function SheetHeader({
  title, onClose, leftAccessory,
}: {
  title: string;
  onClose: () => void;
  leftAccessory?: React.ReactNode;
}) {
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center',
      paddingHorizontal: 20, paddingTop: 6, paddingBottom: 18,
      gap: 12,
    }}>
      {leftAccessory}
      <Text
        numberOfLines={1}
        style={{
          flex: 1, fontFamily: F.serifItalic, fontSize: 24,
          color: C.textPrimary, letterSpacing: -0.5,
        }}>
        {title}
      </Text>
      <Pressable
        onPress={() => { Keyboard.dismiss(); onClose(); }}
        hitSlop={10}
        accessibilityLabel="Close"
        style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}>
        <CloseGlyph />
      </Pressable>
    </View>
  );
}
