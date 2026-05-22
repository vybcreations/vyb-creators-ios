import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Keyboard, KeyboardAvoidingView, Modal, PanResponder, Platform, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';
import { colors as C, fonts as F, radius as R, KEYBOARD_GAP } from '../theme';

// Bottom sheet with slide-up animation + drag-down to dismiss.
//
// Sheets that have a visible title should render <SheetHeader title=... onClose=... />
// as their first child and pass `showClose={false}` so the title + X sit on the
// same row. Sheets without a header (like ActionMenu) leave `showClose` on its
// default and get an absolutely-positioned X.
export function DraggableSheet({
  visible, onDismiss, children, maxHeightFraction = 0.92, showClose = true,
}: {
  visible: boolean;
  onDismiss: () => void;
  children: React.ReactNode;
  maxHeightFraction?: number;
  showClose?: boolean;
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
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, g) => g.dy > 2,
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

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onDismiss} statusBarTranslucent>
      <View style={{ flex: 1 }}>
        <Animated.View pointerEvents="none"
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#000', opacity: backdropOpacity }} />
        <Pressable onPress={onDismiss} style={{ flex: 1 }} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={-KEYBOARD_GAP}>
          <Animated.View style={{ transform: [{ translateY }], maxHeight: `${maxHeightFraction * 100}%` as any }}>
            <SafeAreaView edges={['bottom']} style={{
              backgroundColor: C.bgElevated,
              borderTopLeftRadius: R.xl, borderTopRightRadius: R.xl,
              borderColor: C.borderMid, borderTopWidth: 1, borderLeftWidth: 1, borderRightWidth: 1,
              shadowColor: '#000', shadowOpacity: 0.6, shadowRadius: 40, shadowOffset: { width: 0, height: -8 },
            }}>
              {/* Centered drag handle at the very top */}
              <View {...pan.panHandlers} style={{ paddingTop: 10, paddingBottom: 8, alignItems: 'center' }}>
                <View style={{ width: 38, height: 4, borderRadius: 2, backgroundColor: C.borderStrong }} />
              </View>

              {children}

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
        </KeyboardAvoidingView>
      </View>
    </Modal>
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
