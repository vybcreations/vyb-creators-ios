import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, Text, View, Platform, Keyboard } from 'react-native';
import { colors as C, fonts as F, KEYBOARD_GAP } from '../theme';
import { hLight, hSelection } from '../lib/haptics';

/**
 * Global undo toast.
 *
 * Sections call `requestUndo({ label, onUndo })` right after a successful
 * delete. We show a single bottom toast for ~5s; tapping Undo invokes the
 * caller's restore function. Only the latest delete is undoable — a new
 * request replaces the previous one.
 *
 * The toast sits above the floating tab bar (90px) and lifts higher when the
 * keyboard is open so it never gets eaten by the keyboard.
 */

const VYB_EASE = Easing.bezier(0.22, 1, 0.36, 1);
const TAB_BAR_OFFSET = 90;          // floating tab bar
const TOAST_LIFE_MS = 5000;
const TOAST_BG = 'rgba(20, 17, 14, 0.96)';

type UndoPayload = {
  label: string;                     // "Task deleted · Tap to undo"
  onUndo: () => void | Promise<void>;
};

type Ctx = {
  requestUndo: (p: UndoPayload) => void;
  dismiss: () => void;
};

const UndoToastCtx = createContext<Ctx | null>(null);

export function useUndoToast(): Ctx {
  const ctx = useContext(UndoToastCtx);
  if (!ctx) throw new Error('useUndoToast must be used inside UndoToastProvider');
  return ctx;
}

export function UndoToastProvider({ children }: { children: React.ReactNode }) {
  const [payload, setPayload] = useState<UndoPayload | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(20)).current;
  const bottom = useRef(new Animated.Value(TAB_BAR_OFFSET)).current;

  // Lift the toast above the keyboard the same way the Tasks composer does.
  useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvt, (e) => {
      Animated.timing(bottom, {
        toValue: (e.endCoordinates?.height ?? 0) + KEYBOARD_GAP,
        duration: (e as any).duration || 250, easing: VYB_EASE,
        useNativeDriver: false,
      }).start();
    });
    const hideSub = Keyboard.addListener(hideEvt, (e) => {
      Animated.timing(bottom, {
        toValue: TAB_BAR_OFFSET,
        duration: (e as any).duration || 250, easing: VYB_EASE,
        useNativeDriver: false,
      }).start();
    });
    return () => { showSub.remove(); hideSub.remove(); };
  }, []);

  const hide = useCallback(() => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    Animated.parallel([
      Animated.timing(opacity,    { toValue: 0,  duration: 160, easing: VYB_EASE, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 20, duration: 160, easing: VYB_EASE, useNativeDriver: true }),
    ]).start(({ finished }) => { if (finished) setPayload(null); });
  }, []);

  const requestUndo = useCallback((p: UndoPayload) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setPayload(p);
    opacity.setValue(0);
    translateY.setValue(20);
    Animated.parallel([
      Animated.timing(opacity,    { toValue: 1, duration: 200, easing: VYB_EASE, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 200, easing: VYB_EASE, useNativeDriver: true }),
    ]).start();
    timerRef.current = setTimeout(hide, TOAST_LIFE_MS);
  }, [hide]);

  const handleUndo = async () => {
    if (!payload) return;
    hSelection();
    const cb = payload.onUndo;
    hide();
    try { await cb(); } catch { /* caller is responsible for surfacing errors */ }
  };

  return (
    <UndoToastCtx.Provider value={{ requestUndo, dismiss: hide }}>
      {children}
      {payload && (
        <Animated.View
          pointerEvents="box-none"
          style={{
            position: 'absolute', left: 0, right: 0, bottom,
            alignItems: 'center',
          }}>
          <Animated.View
            pointerEvents="auto"
            style={{
              opacity, transform: [{ translateY }],
              flexDirection: 'row', alignItems: 'center',
              backgroundColor: TOAST_BG,
              borderColor: C.borderSubtle, borderWidth: 1,
              borderRadius: 999,
              paddingHorizontal: 16, paddingVertical: 10,
              shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 18, shadowOffset: { width: 0, height: 8 },
              elevation: 8,
              maxWidth: '92%',
            }}>
            <Text numberOfLines={1} style={{
              fontFamily: F.sans, fontSize: 12.5, color: C.textPrimary,
              flexShrink: 1, marginRight: 14,
            }}>
              {payload.label}
            </Text>
            <Pressable onPress={handleUndo} hitSlop={8}>
              <Text style={{
                fontFamily: F.sansBold, fontSize: 12, color: C.gold, letterSpacing: 0.5,
              }}>
                UNDO
              </Text>
            </Pressable>
          </Animated.View>
        </Animated.View>
      )}
    </UndoToastCtx.Provider>
  );
}
