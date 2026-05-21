import { useCallback, useEffect, useRef, useState } from 'react';

// Try to load `expo-speech-recognition` at module time. It is *not* in Expo
// Go, so this require() can throw — we catch and downgrade to an unavailable
// state so the rest of the app keeps working.
let SR: any = null;
let SR_HOOK: any = null;
try {
  const mod = require('expo-speech-recognition');
  SR = mod.ExpoSpeechRecognitionModule;
  SR_HOOK = mod.useSpeechRecognitionEvent;
} catch {
  // module not bundled (Expo Go) — leave SR null
}

export const isDictationAvailable: boolean = !!SR;

export type DictationLocale = 'es-ES' | 'en-US';

export type Dictation = {
  start: () => Promise<void>;
  confirm: () => string;          // returns the final transcript and stops
  cancel: () => void;
  toggle: () => Promise<string | void>;
  listening: boolean;
  transcript: string;             // final + interim, live-updated
  levelRef: { current: number };  // 0..1 if the platform reports volume
  error: string | null;
  available: boolean;
};

/**
 * useDictation — wraps `expo-speech-recognition` into a small state machine
 * the UI can drive with start/confirm/cancel. Falls back to a no-op shape
 * when the native module isn't available (Expo Go).
 *
 * `confirm()` returns the captured text so the caller can append it without
 * waiting for a state flush.
 */
export function useDictation(locale: DictationLocale = 'es-ES'): Dictation {
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const levelRef = useRef(0);

  // Mirror final + interim parts so we can rebuild the visible transcript on
  // every event without losing what was already finalized.
  const finalRef  = useRef('');
  const interimRef = useRef('');

  // Wire native events when the module is present. The hook is required at
  // top level so we always render the same number of hooks regardless of
  // availability.
  const useEvt = SR_HOOK || ((_name: string, _cb: any) => {});

  useEvt('result', (e: any) => {
    if (!e?.results?.length) return;
    // The last result is the most recent chunk. expo-speech-recognition flags
    // it final via `isFinal` when supported (iOS Always; Android usually).
    const last = e.results[e.results.length - 1];
    const text: string = last?.transcript ?? '';
    if (e.isFinal || last?.isFinal) {
      finalRef.current = (finalRef.current + ' ' + text).trim();
      interimRef.current = '';
    } else {
      interimRef.current = text;
    }
    setTranscript((finalRef.current + ' ' + interimRef.current).trim());
  });

  useEvt('error', (e: any) => {
    const code = e?.error || e?.message || 'error';
    // Common no-ops the user shouldn't see as scary errors.
    if (code === 'no-speech' || code === 'aborted') return;
    setError(String(code));
    setListening(false);
  });

  useEvt('end', () => { setListening(false); });

  useEffect(() => () => {
    // Best-effort stop on unmount.
    try { SR?.stop?.(); } catch {}
  }, []);

  const start = useCallback(async () => {
    if (!SR) { setError('unavailable'); return; }
    setError(null);
    finalRef.current = '';
    interimRef.current = '';
    setTranscript('');
    try {
      const perm = await SR.requestPermissionsAsync?.();
      if (perm && perm.granted === false) {
        setError('permission-denied');
        return;
      }
      SR.start({
        lang: locale,
        interimResults: true,
        continuous: true,
        // Try to surface volume samples for waveform UI if iOS provides them.
        volumeChangeEventOptions: { enabled: true, intervalMillis: 100 },
      });
      setListening(true);
    } catch (e: any) {
      setError(e?.message || 'start-failed');
    }
  }, [locale]);

  useEvt('volumechange', (e: any) => {
    // value is roughly -2..10 on iOS, normalize to 0..1.
    const v = typeof e?.value === 'number' ? Math.max(0, Math.min(1, (e.value + 2) / 12)) : 0;
    levelRef.current = v;
  });

  const confirm = useCallback((): string => {
    const text = (finalRef.current + ' ' + interimRef.current).trim();
    try { SR?.stop?.(); } catch {}
    setListening(false);
    return text;
  }, []);

  const cancel = useCallback(() => {
    finalRef.current = '';
    interimRef.current = '';
    setTranscript('');
    try { SR?.abort?.(); } catch { try { SR?.stop?.(); } catch {} }
    setListening(false);
  }, []);

  const toggle = useCallback(async () => {
    if (listening) return confirm();
    await start();
  }, [listening, start, confirm]);

  return {
    start, confirm, cancel, toggle,
    listening, transcript, levelRef, error,
    available: isDictationAvailable,
  };
}

/**
 * Append helper used by composers. Adds a single space between existing text
 * and the new transcript, and capitalizes the first letter when appending to
 * an empty buffer. Punctuation chunks attach without an extra space.
 */
export function appendTranscript(current: string, transcript: string): string {
  if (!transcript) return current;
  const t = transcript.trim();
  if (!t) return current;
  if (!current.trim()) {
    return t.charAt(0).toUpperCase() + t.slice(1);
  }
  // If the transcript starts with punctuation, glue it on.
  if (/^[,.;:!?]/.test(t)) return current.trimEnd() + t;
  return current.trimEnd() + ' ' + t;
}
