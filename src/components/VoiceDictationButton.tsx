import React, { useEffect, useRef } from 'react';
import { Pressable, Animated, View, Text, Easing } from 'react-native';
import { Mic, Square } from 'lucide-react-native';
import { colors as C, fonts as F } from '../theme';
import { hLight, hSuccess, hWarning } from '../lib/haptics';
import { useDictation, appendTranscript, DictationLocale } from '../lib/dictation';

/**
 * Reusable voice dictation mic button.
 *
 * Uses native OS speech recognition (free) via `expo-speech-recognition`.
 * When the module isn't bundled (Expo Go), the button stays visible but
 * disabled and a small "Not available" hint shows under it after a tap, so
 * dev/test on Expo Go never crashes.
 *
 * Lifecycle:
 *   tap once  → start listening, mic turns clay, pulse ring loops
 *   tap again → stop + confirm; final transcript is appended to caller's
 *               buffer via onTranscript(newText)
 *
 * The caller decides how to merge the transcript with existing text — most
 * composers want `appendTranscript(current, text)` (exported from
 * lib/dictation) for natural spacing.
 */

const VYB_EASE = Easing.bezier(0.22, 1, 0.36, 1);

export function VoiceDictationButton({
  onTranscript, size = 38, disabled, locale = 'es-ES',
}: {
  onTranscript: (text: string) => void;
  size?: number;
  disabled?: boolean;
  locale?: DictationLocale;
}) {
  const d = useDictation(locale);

  // Pulse ring while recording.
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!d.listening) { pulse.setValue(0); return; }
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 800, easing: VYB_EASE, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0, duration: 800, easing: VYB_EASE, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [d.listening]);

  // Surface a tiny hint when the user taps a disabled (unavailable) mic, so
  // they understand why nothing happened. Auto-clears in 3s.
  const [hint, setHint] = React.useState<string | null>(null);
  useEffect(() => {
    if (!hint) return;
    const t = setTimeout(() => setHint(null), 3000);
    return () => clearTimeout(t);
  }, [hint]);

  // React to internal errors with subtle hints (no scary alerts).
  useEffect(() => {
    if (!d.error) return;
    if (d.error === 'permission-denied') setHint('Microphone permission needed.');
    else if (d.error === 'unavailable')  setHint('Voice dictation will be available in the development build.');
    else                                 setHint('Voice dictation failed. Try again.');
    hWarning();
  }, [d.error]);

  const onPress = async () => {
    if (disabled) return;
    if (!d.available) {
      setHint('Voice dictation will be available in the development build.');
      hWarning();
      return;
    }
    if (d.listening) {
      const text = d.confirm();
      hSuccess();
      if (text) onTranscript(text);
    } else {
      hLight();
      await d.start();
    }
  };

  const listening = d.listening;
  const greyed = disabled || !d.available;

  return (
    <View style={{ alignItems: 'center' }}>
      <Pressable
        onPress={onPress}
        style={{
          width: size, height: size, borderRadius: size / 2,
          backgroundColor: listening ? 'rgba(192,86,67,0.18)' : C.bgOverlay,
          borderColor: listening ? C.clay : C.borderSubtle, borderWidth: 1,
          alignItems: 'center', justifyContent: 'center',
          opacity: greyed ? 0.35 : 1,
        }}>
        {/* Pulse ring while recording */}
        <Animated.View pointerEvents="none" style={{
          position: 'absolute', top: -4, left: -4, right: -4, bottom: -4,
          borderRadius: size,
          borderColor: C.clay, borderWidth: 1,
          opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0, 0.5] }),
          transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.18] }) }],
        }} />
        {listening
          ? <Square size={size * 0.42} color={C.clay} fill={C.clay} />
          : <Mic size={size * 0.45} color={C.textSecondary} />}
      </Pressable>
      {hint && (
        <Text numberOfLines={2} style={{
          position: 'absolute', bottom: size + 6, right: 0,
          width: 180, textAlign: 'right',
          fontFamily: F.sans, fontSize: 10.5, color: C.textMuted, lineHeight: 14,
        }}>
          {hint}
        </Text>
      )}
    </View>
  );
}

// Re-export the helper so screens can import it from the same module.
export { appendTranscript };
