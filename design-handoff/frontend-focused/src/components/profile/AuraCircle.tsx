import React, { useEffect, useRef, useState } from 'react';
import { View, Text, AccessibilityInfo } from 'react-native';
import Svg, { Defs, LinearGradient as SvgLinearGradient, Stop, RadialGradient, Circle } from 'react-native-svg';
import { colors as C, fonts as F } from '../../theme';
import type { AuraVisualState } from '../../lib/aura/calculateAuraScore';

/**
 * AuraCircle — V1 visual for the Aura Score.
 *
 * No heavy animation yet (per spec). Just a circular ring + soft halo whose
 * color reflects the current state:
 *
 *   - stable     → sage / gold gradient. Defined, bright ring.
 *   - building   → sand / teal gradient. Medium brightness.
 *   - low        → muted gray. Dim glow. Reads as quiet, not broken.
 *   - unbalanced → coral / violet gradient. The split palette hints that
 *                  the energy is uneven across pillars.
 *
 * Distortion / pulse / breathing can layer on later. This V1 prioritizes
 * readability + brand fit.
 */

type Palette = { c1: string; c2: string; halo: string; track: string };

const PALETTES: Record<AuraVisualState, Palette> = {
  stable:     { c1: 'rgba(94,117,88,0.95)',   c2: 'rgba(160,138,86,0.95)',  halo: 'rgba(94,117,88,0.20)',   track: 'rgba(255,255,255,0.08)' },
  building:   { c1: 'rgba(160,138,86,0.88)',  c2: 'rgba(72,150,205,0.78)',  halo: 'rgba(160,138,86,0.14)',  track: 'rgba(255,255,255,0.08)' },
  low:        { c1: 'rgba(180,180,180,0.55)', c2: 'rgba(120,120,120,0.55)', halo: 'rgba(255,255,255,0.04)', track: 'rgba(255,255,255,0.06)' },
  unbalanced: { c1: 'rgba(210,112,80,0.88)',  c2: 'rgba(135,120,220,0.85)', halo: 'rgba(210,112,80,0.10)',  track: 'rgba(255,255,255,0.08)' },
};

export function AuraCircle({
  score, state, size = 104, showNumber = true,
}: {
  score: number;
  state: AuraVisualState;
  size?: number;
  showNumber?: boolean;
}) {
  const stroke = 7;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const target = Math.max(0, Math.min(100, score));

  // RAF-driven animation between previous and new score so the ring and
  // number glide between periods. Respects Reduce Motion.
  const [display, setDisplay] = useState(target);
  const [reduceMotion, setReduceMotion] = useState(false);
  const rafRef = useRef<number | null>(null);
  const fromRef = useRef(target);
  const startRef = useRef(0);

  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled?.().then(v => { if (alive) setReduceMotion(!!v); });
    const sub = AccessibilityInfo.addEventListener?.('reduceMotionChanged', v => setReduceMotion(!!v));
    return () => { alive = false; (sub as any)?.remove?.(); };
  }, []);

  useEffect(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (target === display) return;
    if (reduceMotion) { setDisplay(target); return; }
    fromRef.current = display;
    startRef.current = Date.now();
    const duration = 420;
    const ease = (t: number) => 1 - Math.pow(1 - t, 5);
    const tick = () => {
      const t = Math.min(1, (Date.now() - startRef.current) / duration);
      setDisplay(fromRef.current + (target - fromRef.current) * ease(t));
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, reduceMotion]);

  const safe = display;
  const dash = (safe / 100) * circumference;

  const palette = PALETTES[state];

  // Unique-per-instance IDs so multiple AuraCircles on one screen don't share
  // the SVG <defs> namespace.
  const ringId = React.useRef(`aura-ring-${Math.random().toString(36).slice(2, 8)}`).current;
  const haloId = React.useRef(`aura-halo-${Math.random().toString(36).slice(2, 8)}`).current;

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <Defs>
          <SvgLinearGradient id={ringId} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={palette.c1} />
            <Stop offset="1" stopColor={palette.c2} />
          </SvgLinearGradient>
          <RadialGradient id={haloId} cx="50%" cy="50%" r="50%">
            <Stop offset="0%"  stopColor={palette.halo} />
            <Stop offset="100%" stopColor="rgba(0,0,0,0)" />
          </RadialGradient>
        </Defs>

        {/* Soft halo inside the ring */}
        <Circle cx={size / 2} cy={size / 2} r={r - 4} fill={`url(#${haloId})`} />

        {/* Track */}
        <Circle cx={size / 2} cy={size / 2} r={r}
          stroke={palette.track} strokeWidth={stroke} fill="none" />

        {/* Progress — starts at the top (12 o'clock), winds clockwise */}
        <Circle cx={size / 2} cy={size / 2} r={r}
          stroke={`url(#${ringId})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${dash} ${circumference - dash}`}
          strokeDashoffset={circumference / 4}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>

      {showNumber && (
        <Text style={{
          fontFamily: F.sansHeavy,
          fontSize: size * 0.30,
          color: C.textPrimary,
          letterSpacing: -1,
        }}>
          {Math.round(safe)}
        </Text>
      )}
    </View>
  );
}
