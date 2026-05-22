import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, Alert, ScrollView, Pressable } from 'react-native';
import { Minus, Plus } from 'lucide-react-native';
import {
  VYBCreationSheet, VYBToggle, VYBChip, VYBCard, VYBInput,
} from '../../components/ui';
import { GoldButton } from '../../components/primitives';
import { colors as C, fonts as F } from '../../theme';
import { logReadingSession } from '../../lib/reading';
import { useAuth } from '../../lib/auth';
import { hSelection, hSuccess, hLight } from '../../lib/haptics';
import type { ActiveSession } from './SessionSheet';

/**
 * ReadingSessionSheet — unified VYB v2 sheet for the per-book reading
 * actions that used to live across three separate surfaces:
 *
 *   1. ActionMenu chooser   ("Add pages" / "Start reading block")
 *   2. AddPagesSheet         (manual page logging)
 *   3. SessionSheet          (focus block duration picker)
 *
 * Now it's one sheet with a segmented control at the top:
 *   - "Add pages"      → start (locked) + end stepper + Save
 *   - "Reading block"  → starting page + duration (presets + ± steppers)
 *                        + Start. On start, fires `onStartBlock` so the
 *                        screen above arms its MiniSessionBar timer.
 */

type Tab = 'pages' | 'block';

const PRESETS = [15, 30, 45, 60];
const STEP = 5;
const MIN_MINUTES = 5;
const MAX_MINUTES = 180;

export function ReadingSessionSheet({
  visible, onDismiss, onSaved, onStartBlock,
  bookId, bookCurrentPage, totalPages,
}: {
  visible: boolean;
  onDismiss: () => void;
  /** Called after a successful "Add pages" save so the screen can refresh. */
  onSaved: () => void;
  /** Called when the user starts a reading block — parent arms the active
   *  ActiveSession state + MiniSessionBar. */
  onStartBlock: (s: Omit<ActiveSession, 'elapsedSeconds' | 'running'>) => void;
  bookId: string;
  bookCurrentPage: number;
  totalPages: number | null;
}) {
  const { session } = useAuth();
  const [tab, setTab] = useState<Tab>('pages');

  // ─── Add pages state ───────────────────────────────────────
  const startRef = useRef<number>(bookCurrentPage);
  const [endPage, setEndPage] = useState<number>(bookCurrentPage);
  const [busy, setBusy] = useState(false);

  // ─── Block state ───────────────────────────────────────────
  const [minutes, setMinutes] = useState<number>(30);

  useEffect(() => {
    if (!visible) return;
    setTab('pages');
    startRef.current = bookCurrentPage;
    setEndPage(bookCurrentPage);
    setMinutes(30);
  }, [visible, bookCurrentPage]);

  // ─── Pages logic ───────────────────────────────────────────
  const start = startRef.current;
  const clampEnd = (n: number) => Math.max(start, totalPages ? Math.min(totalPages, n) : n);
  const setEnd = (n: number) => setEndPage(clampEnd(n));
  const pagesRead = Math.max(0, endPage - start);

  const savePages = async () => {
    if (!session || pagesRead <= 0) {
      Alert.alert('Pages read', 'End page must be greater than the start page.');
      return;
    }
    setBusy(true);
    try {
      await logReadingSession(session.user.id, bookId, {
        start_page: start,
        end_page: endPage,
        elapsedSeconds: null,
        note: null,
      });
      hSuccess();
      onSaved();
      onDismiss();
    } catch (e: any) {
      Alert.alert('Could not save', e?.message || 'Unknown error');
    } finally {
      setBusy(false);
    }
  };

  // ─── Block logic ───────────────────────────────────────────
  const incBlock = () => setMinutes(m => Math.min(MAX_MINUTES, m + STEP));
  const decBlock = () => setMinutes(m => Math.max(MIN_MINUTES, m - STEP));

  const startBlock = () => {
    hLight();
    onStartBlock({
      startPage: bookCurrentPage,
      endPage: bookCurrentPage,
      targetSeconds: minutes * 60,
    });
    onDismiss();
  };

  return (
    <VYBCreationSheet
      visible={visible}
      onDismiss={onDismiss}
      title="Reading session"
      variant="action"
    >
      {/* Action variant is content-sized — no flex:1, just paddings. The
          sheet shrinks to the natural height of whichever panel is
          active. */}
      <ScrollView
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 28 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Segmented control — one source of truth for the two actions. */}
        <View style={{ marginBottom: 22 }}>
          <VYBToggle
            tone="gold"
            variant="subtle"
            size="lg"
            value={tab}
            onChange={(v) => { hSelection(); setTab(v as Tab); }}
            options={[
              { label: 'Add pages',     value: 'pages' },
              { label: 'Reading block', value: 'block' },
            ]}
          />
        </View>

        {tab === 'pages' ? (
          <PagesPanel
            start={start}
            endPage={endPage}
            setEnd={setEnd}
            totalPages={totalPages}
            pagesRead={pagesRead}
            busy={busy}
            onSave={savePages}
          />
        ) : (
          <BlockPanel
            startPage={bookCurrentPage}
            minutes={minutes}
            inc={incBlock}
            dec={decBlock}
            setMinutes={(m: number) => { hSelection(); setMinutes(m); }}
            onStart={startBlock}
          />
        )}
      </ScrollView>
    </VYBCreationSheet>
  );
}

// ─── Pages panel ─────────────────────────────────────────────
function PagesPanel({
  start, endPage, setEnd, totalPages, pagesRead, busy, onSave,
}: {
  start: number; endPage: number; setEnd: (n: number) => void;
  totalPages: number | null; pagesRead: number; busy: boolean; onSave: () => void;
}) {
  return (
    <>
      <Text style={{ fontFamily: F.serifItalic, fontSize: 13, color: C.textMuted, textAlign: 'center', marginBottom: 22 }}>
        Log pages you already read — no timer.
      </Text>

      {/* Start / End row */}
      <VYBCard level="widget" padding={18} style={{ marginBottom: 18 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={Label}>START</Text>
            <Text style={{
              fontFamily: F.sansHeavy, fontSize: 32, color: C.textSecondary,
              letterSpacing: -0.6, marginTop: 6,
            }}>{start}</Text>
            <Text style={{ fontFamily: F.mono, fontSize: 10, color: C.textFaint, marginTop: 4 }}>fixed</Text>
          </View>
          <Text style={{ fontFamily: F.mono, fontSize: 20, color: C.textMuted }}>→</Text>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={Label}>END</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 }}>
              <Pressable onPress={() => setEnd(endPage - 1)} hitSlop={8} style={stepBtn}>
                <Minus size={14} color={C.textPrimary} />
              </Pressable>
              <TextInput
                value={String(endPage)}
                onChangeText={t => setEnd(parseInt(t.replace(/\D/g, ''), 10) || start)}
                keyboardType="number-pad" selectionColor={C.gold}
                style={{
                  fontFamily: F.sansHeavy, fontSize: 32, color: C.textPrimary,
                  minWidth: 64, textAlign: 'center', letterSpacing: -0.6,
                }}
              />
              <Pressable onPress={() => setEnd(endPage + 1)} hitSlop={8} style={stepBtn}>
                <Plus size={14} color={C.textPrimary} />
              </Pressable>
            </View>
            <Text style={{ fontFamily: F.mono, fontSize: 10, color: C.textFaint, marginTop: 4 }}>
              {totalPages ? `max ${totalPages}` : 'editable'}
            </Text>
          </View>
        </View>
      </VYBCard>

      {/* Pages-read summary */}
      <VYBCard level="widget" accent="gold" padding={16} style={{ marginBottom: 22 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ fontFamily: F.sansBold, fontSize: 11, color: C.gold, letterSpacing: 2 }}>
            PAGES READ
          </Text>
          <Text style={{ fontFamily: F.sansHeavy, fontSize: 28, color: C.textPrimary, letterSpacing: -0.7 }}>
            {pagesRead}
          </Text>
        </View>
      </VYBCard>

      <GoldButton
        variant="complete" size="lg"
        onPress={onSave}
        loading={busy}
        disabled={pagesRead <= 0}
        style={{ alignSelf: 'stretch', justifyContent: 'center' }}>
        Save
      </GoldButton>
      {pagesRead <= 0 && (
        <Text style={{
          fontFamily: F.sans, fontSize: 11.5, color: C.textMuted,
          textAlign: 'center', marginTop: 10,
        }}>
          Bump the end page above {start} to save.
        </Text>
      )}
    </>
  );
}

// ─── Block panel ─────────────────────────────────────────────
function BlockPanel({
  startPage, minutes, inc, dec, setMinutes, onStart,
}: {
  startPage: number; minutes: number;
  inc: () => void; dec: () => void;
  setMinutes: (m: number) => void; onStart: () => void;
}) {
  return (
    <>
      <Text style={{ fontFamily: F.serifItalic, fontSize: 13, color: C.textMuted, textAlign: 'center', marginBottom: 22 }}>
        A timed reading block. The page progress is tracked.
      </Text>

      {/* Starting page card */}
      <VYBCard level="widget" padding={16} style={{ marginBottom: 18 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={Label}>STARTING AT PAGE</Text>
          <Text style={{ fontFamily: F.sansHeavy, fontSize: 28, color: C.textPrimary, letterSpacing: -0.7 }}>
            {startPage}
          </Text>
        </View>
      </VYBCard>

      {/* Focus length — big number with ± + presets */}
      <VYBCard level="widget" accent="gold" padding={20} style={{ marginBottom: 22 }}>
        <Text style={[Label, { textAlign: 'center' }]}>FOCUS LENGTH</Text>
        <View style={{
          flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
          gap: 22, marginTop: 12,
        }}>
          <Pressable onPress={dec} disabled={minutes <= MIN_MINUTES}
            style={[bigStepBtn, minutes <= MIN_MINUTES && { opacity: 0.35 }]}>
            <Minus size={16} color={C.textPrimary} />
          </Pressable>
          <View style={{ alignItems: 'center' }}>
            <Text style={{
              fontFamily: F.sansHeavy, fontSize: 60, color: C.goldBright,
              letterSpacing: -2, lineHeight: 62,
            }}>
              {minutes}
            </Text>
            <Text style={{
              fontFamily: F.sansBold, fontSize: 11, color: C.textMuted,
              letterSpacing: 1.6, marginTop: 2,
            }}>
              MINUTES
            </Text>
          </View>
          <Pressable onPress={inc} disabled={minutes >= MAX_MINUTES}
            style={[bigStepBtn, minutes >= MAX_MINUTES && { opacity: 0.35 }]}>
            <Plus size={16} color={C.textPrimary} />
          </Pressable>
        </View>

        {/* Presets */}
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 18 }}>
          {PRESETS.map(m => (
            <View key={m} style={{ flex: 1 }}>
              <VYBChip
                label={`${m} min`}
                tone="gold"
                selected={minutes === m}
                size="md"
                onPress={() => setMinutes(m)}
                style={{ width: '100%', justifyContent: 'center' }}
              />
            </View>
          ))}
        </View>
      </VYBCard>

      <GoldButton
        variant="complete" size="lg" onPress={onStart}
        style={{ alignSelf: 'stretch', justifyContent: 'center' }}>
        {`Start ${minutes} min block`}
      </GoldButton>

      <Text style={{
        fontFamily: F.sans, fontSize: 11.5, color: C.textMuted, textAlign: 'center',
        marginTop: 14, lineHeight: 17,
      }}>
        The timer keeps running while you move between the book and entries.{'\n'}
        Save the session when you're done.
      </Text>
    </>
  );
}

// ─── Styles ──────────────────────────────────────────────────
const Label = { fontFamily: F.sansBold, fontSize: 10, color: C.textMuted, letterSpacing: 2 } as const;

const stepBtn = {
  width: 30, height: 30, borderRadius: 15,
  backgroundColor: C.bgOverlay, borderColor: C.borderMid, borderWidth: 1,
  alignItems: 'center' as const, justifyContent: 'center' as const,
};

const bigStepBtn = {
  width: 48, height: 48, borderRadius: 24,
  backgroundColor: C.bgOverlay, borderColor: C.borderMid, borderWidth: 1,
  alignItems: 'center' as const, justifyContent: 'center' as const,
};
