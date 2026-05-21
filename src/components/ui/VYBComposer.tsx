import React, { useEffect, useRef } from 'react';
import {
  View, TextInput, Pressable, Animated, Easing, Keyboard, Platform,
  ActivityIndicator, StyleProp, ViewStyle,
} from 'react-native';
import { Send } from 'lucide-react-native';
import { colors as C, fonts as F, KEYBOARD_GAP } from '../../theme';
import { useComposerLayout, composerLiftFor } from '../../lib/layout';

/**
 * VYBComposer — pill-shaped bottom composer.
 *
 * Replaces the inline composers in Tasks, Challenge messages, Circle
 * messages, comment composers, and EntryComposer.
 *
 * `bottomAnchored` opts into the iPad-hardware-keyboard-safe positioning
 * already used by TasksScreen (resting offset + keyboard lift clamp). Inline
 * mode (default) just renders the pill in flow and the parent decides
 * positioning — useful inside scroll views or sheets.
 */

export function VYBComposer({
  value, onChangeText, onSubmit,
  placeholder = 'Type…',
  leftAction, rightAction, sendIcon,
  disabled, loading, bottomAnchored, multiline,
  style,
}: {
  value: string;
  onChangeText: (v: string) => void;
  onSubmit?: () => void;
  placeholder?: string;
  leftAction?: React.ReactNode;
  rightAction?: React.ReactNode;
  sendIcon?: React.ReactNode;
  disabled?: boolean;
  loading?: boolean;
  bottomAnchored?: boolean;
  multiline?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const canSend = !disabled && !loading && value.trim().length > 0;

  const handleSubmit = () => {
    if (!canSend || !onSubmit) return;
    onSubmit();
  };

  // ─── Bottom-anchored mode ─────────────────────────────────
  // Uses the same resting offset + keyboard clamp as the Tasks composer so
  // we get the iPad hardware-keyboard fix for free.
  const { restingBottom } = useComposerLayout();
  const composerBottom = useRef(new Animated.Value(restingBottom)).current;
  useEffect(() => {
    if (!bottomAnchored) return;
    composerBottom.setValue(restingBottom);
  }, [restingBottom, bottomAnchored]);
  useEffect(() => {
    if (!bottomAnchored) return;
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvt, (e) => {
      Animated.timing(composerBottom, {
        toValue: composerLiftFor(e.endCoordinates?.height ?? 0, KEYBOARD_GAP, restingBottom),
        duration: (e as any).duration || 250,
        easing: Easing.bezier(0.22, 1, 0.36, 1),
        useNativeDriver: false,
      }).start();
    });
    const hideSub = Keyboard.addListener(hideEvt, (e) => {
      Animated.timing(composerBottom, {
        toValue: restingBottom,
        duration: (e as any).duration || 250,
        easing: Easing.bezier(0.22, 1, 0.36, 1),
        useNativeDriver: false,
      }).start();
    });
    return () => { showSub.remove(); hideSub.remove(); };
  }, [bottomAnchored, restingBottom]);

  const pill = (
    <View style={[{
      flexDirection: 'row', alignItems: 'center', gap: 8,
      padding: 6, paddingLeft: leftAction ? 6 : 14,
      borderRadius: 999,
      backgroundColor: C.bgElevated, borderColor: C.borderSubtle, borderWidth: 1,
    }, style]}>
      {leftAction}
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={C.textFaint}
        editable={!disabled && !loading}
        multiline={multiline}
        onSubmitEditing={handleSubmit}
        returnKeyType="send"
        blurOnSubmit={!multiline}
        style={{
          flex: 1, color: C.textPrimary,
          fontFamily: F.sans, fontSize: 14,
          paddingVertical: 6, minHeight: 32,
        }}
      />
      {rightAction}
      {onSubmit && (
        <Pressable onPress={handleSubmit} disabled={!canSend} hitSlop={6} style={{
          width: 38, height: 38, borderRadius: 19,
          backgroundColor: canSend ? C.gold : 'rgba(201,169,97,0.18)',
          alignItems: 'center', justifyContent: 'center',
        }}>
          {loading ? (
            <ActivityIndicator color={C.bgBase} />
          ) : (
            sendIcon ?? <Send size={14} color={canSend ? C.bgBase : C.textFaint} strokeWidth={2.4} />
          )}
        </Pressable>
      )}
    </View>
  );

  if (!bottomAnchored) return pill;
  return (
    <Animated.View style={{
      position: 'absolute', left: 16, right: 16, bottom: composerBottom,
    }}>
      {pill}
    </Animated.View>
  );
}
