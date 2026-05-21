import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, Animated, Easing } from 'react-native';
import { X, Pause, Play, SkipForward } from 'lucide-react-native';
import { colors as C, fonts as F } from '../theme';

export function FocusScreen({ navigation, route }: any) {
  const taskTitle: string | undefined = route?.params?.task;
  const minutes: number = Math.max(1, Math.min(120, route?.params?.minutes ?? 25));
  const DURATION = minutes * 60;
  const [remaining, setRemaining] = useState(DURATION);
  const [running, setRunning] = useState(true);
  const breath = useRef(new Animated.Value(1)).current;

  // Breathing animation on the rings
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breath, { toValue: 1.06, duration: 2200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(breath, { toValue: 1, duration: 2200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [breath]);

  // Countdown
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      setRemaining(r => Math.max(0, r - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [running]);

  const mm = String(Math.floor(remaining / 60)).padStart(2, '0');
  const ss = String(remaining % 60).padStart(2, '0');
  const pct = ((DURATION - remaining) / DURATION) * 100;

  return (
    <View style={{ flex: 1, backgroundColor: '#06060A' }}>
      {/* Top header */}
      <View style={{ paddingTop: 60, paddingHorizontal: 24, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ fontFamily: F.sansBold, fontSize: 10, color: 'rgba(250,250,248,0.4)', letterSpacing: 2.5 }}>
          FOCUS · SESSION 3
        </Text>
        <Text style={{ fontFamily: F.mono, fontSize: 11, color: 'rgba(250,250,248,0.4)' }}>9:41</Text>
      </View>

      {/* Breathing rings + timer */}
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Animated.View style={{
          position: 'absolute', width: 280, height: 280, borderRadius: 140,
          borderColor: 'rgba(201,169,97,0.18)', borderWidth: 1,
          transform: [{ scale: breath }],
        }} />
        <Animated.View style={{
          position: 'absolute', width: 360, height: 360, borderRadius: 180,
          borderColor: 'rgba(201,169,97,0.08)', borderWidth: 1, borderStyle: 'dashed',
          transform: [{ scale: breath }],
        }} />
        <View style={{
          position: 'absolute', width: 440, height: 440, borderRadius: 220,
          backgroundColor: 'rgba(201,169,97,0.05)',
        }} />

        <View style={{ alignItems: 'center' }}>
          <Text style={{ fontFamily: F.sansBold, fontSize: 10, color: 'rgba(250,250,248,0.4)', letterSpacing: 2.5 }}>
            FOCUSING ON
          </Text>
          <Text style={{ fontFamily: F.serifItalic, fontSize: 18, color: C.textPrimary, marginTop: 8, letterSpacing: -0.3 }}>
            {taskTitle || 'Newsletter outline'}
          </Text>
          <Text style={{
            fontFamily: F.monoBold, fontSize: 84, lineHeight: 88, marginTop: 24,
            color: C.goldBright, letterSpacing: -3,
            textShadowColor: 'rgba(201,169,97,0.4)', textShadowRadius: 24, textShadowOffset: { width: 0, height: 0 },
          }}>{mm}:{ss}</Text>
          <Text style={{ fontFamily: F.mono, fontSize: 11, color: 'rgba(250,250,248,0.4)', marginTop: 8, letterSpacing: 1.4 }}>
            of {Math.floor(DURATION / 60).toString().padStart(2, '0')}:00
          </Text>
        </View>
      </View>

      {/* Progress bar */}
      <View style={{ marginHorizontal: 22, height: 2, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden', marginBottom: 22 }}>
        <View style={{ width: `${pct}%`, height: '100%', backgroundColor: C.goldBright }} />
      </View>

      {/* Controls */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 22, paddingBottom: 60 }}>
        <Pressable onPress={() => navigation.goBack()} style={{
          width: 48, height: 48, borderRadius: 24,
          borderColor: 'rgba(250,250,248,0.18)', borderWidth: 1,
          alignItems: 'center', justifyContent: 'center',
        }}>
          <X size={18} color="rgba(250,250,248,0.6)" />
        </Pressable>
        <Pressable onPress={() => setRunning(r => !r)} style={{
          width: 72, height: 72, borderRadius: 36,
          backgroundColor: 'rgba(201,169,97,0.12)',
          borderColor: C.gold, borderWidth: 1.5,
          alignItems: 'center', justifyContent: 'center',
          shadowColor: C.gold, shadowOpacity: 0.4, shadowRadius: 32, shadowOffset: { width: 0, height: 0 },
        }}>
          {running
            ? <Pause size={26} color={C.gold} strokeWidth={2} />
            : <Play size={26} color={C.gold} strokeWidth={2} />}
        </Pressable>
        <Pressable onPress={() => setRemaining(0)} style={{
          width: 48, height: 48, borderRadius: 24,
          borderColor: 'rgba(250,250,248,0.18)', borderWidth: 1,
          alignItems: 'center', justifyContent: 'center',
        }}>
          <SkipForward size={18} color="rgba(250,250,248,0.6)" />
        </Pressable>
      </View>

      <View style={{ alignItems: 'center', paddingBottom: 30 }}>
        <Text style={{ fontFamily: F.sansBold, fontSize: 10, color: 'rgba(250,250,248,0.3)', letterSpacing: 2 }}>
          POMODORO · 25 / 5
        </Text>
      </View>
    </View>
  );
}
