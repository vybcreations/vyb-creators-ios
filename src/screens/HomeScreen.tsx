import React, { useState } from 'react';
import {
  View, Text, ScrollView, Pressable, Alert, Modal, Image, ActivityIndicator,
  LayoutAnimation, Platform, UIManager, InteractionManager,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import {
  Flame, Timer, Camera, ChevronRight,
  Image as ImageIcon, CheckCircle2, Trophy, Lock,
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { AnimatedHabitTitle } from '../components/AnimatedHabitTitle';
import {
  VYBCard, VYBProgressRing, VYBCheckCircle, VYBBookCover, VYBEmpty, VYBToggle,
} from '../components/ui';

// Enable LayoutAnimation on Android (no-op on iOS where it's on by default).
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}
const SHEET_LAYOUT = {
  duration: 240,
  create:  { type: 'easeInEaseOut' as const, property: 'opacity' as const },
  update:  { type: 'easeInEaseOut' as const },
  delete:  { type: 'easeInEaseOut' as const, property: 'opacity' as const },
};
import { SectionLabel, Tx, GoldButton } from '../components/primitives';
import { colors as C, fonts as F } from '../theme';
import { ScreenAtmosphere } from '../components/ScreenAtmosphere';
import { useAuth } from '../lib/auth';
import { useProfile } from '../lib/profile';
import { useHabits, toggleCheckin } from '../lib/habits';
import { useTasks, toggleDone } from '../lib/tasks';
import {
  useMyActiveChallenges, pickAndUploadProof, submitCheckin,
  challengeTypeTheme, type ActiveChallengeCard,
} from '../lib/challenges';
import { hLight } from '../lib/haptics';

/**
 * HomeScreen — daily action hub. Reuses data from existing screens so the
 * user can complete the day without diving into Habits / Tasks / Reading /
 * Challenges individually. Editing remains in the dedicated tabs.
 */
export function HomeScreen({ navigation }: any) {
  const { session } = useAuth();
  const { data: profileData, refresh: refreshProfile } = useProfile();
  const { areas, refresh: refreshHabits } = useHabits();
  const { tasks, setTasks, refresh: refreshTasks } = useTasks();
  const { items: activeChallenges, refresh: refreshChallenges } = useMyActiveChallenges();

  // Defer Supabase refreshes until the tab-switch animation finishes —
  // otherwise four parallel queries fire on the same frame the user is
  // landing and the JS bridge stutters (especially after the app has been
  // idle). InteractionManager waits for interaction handles to clear.
  useFocusEffect(React.useCallback(() => {
    const handle = InteractionManager.runAfterInteractions(() => {
      refreshProfile(); refreshHabits(); refreshTasks(); refreshChallenges();
    });
    return () => handle.cancel?.();
  }, [refreshProfile, refreshHabits, refreshTasks, refreshChallenges]));

  const [proofFor, setProofFor] = useState<ActiveChallengeCard | null>(null);
  const [habitsView, setHabitsView] = useState<'today' | 'week'>('today');
  const [habitsExpanded, setHabitsExpanded] = useState(false);

  // ─── Today's habits (scheduled-for-today only) ────────────────────────
  // Match Habits screen's source of truth: useHabits() exposes
  // `todayScheduled = days_of_week.includes(todayDow)`.
  const todayHabitsAll = areas.flatMap(a => a.habits).filter(h => h.todayScheduled);
  const habitsDone   = todayHabitsAll.filter(h => h.todayDone).length;
  const habitsTotal  = todayHabitsAll.length;
  // Compact = first 5; user can expand to see all today-planned habits.
  const COMPACT_HABITS = 5;
  const todayHabits = habitsExpanded ? todayHabitsAll : todayHabitsAll.slice(0, COMPACT_HABITS);
  const habitsAllHabits = areas.flatMap(a => a.habits); // for weekly grid

  // ─── Tasks (urgent → important) ───────────────────────────────────────
  const openTasks    = tasks.filter(t => !t.done);
  const urgentTasks  = openTasks.filter(t => t.pri === 'urgent').slice(0, 4);
  const importantTasks = openTasks.filter(t => t.pri === 'important').slice(0, 3);
  const urgentCount  = openTasks.filter(t => t.pri === 'urgent').length;
  const importantCount = openTasks.filter(t => t.pri === 'important').length;
  const laterCount     = openTasks.filter(t => t.pri === 'later').length;

  // Tasks the user completed today — surfaced in a "Completed today"
  // section under Tasks that matter so finished work doesn't vanish on tap.
  const todayLocal = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  })();
  const completedTodayTasks = tasks.filter(t => {
    if (!t.done || !t.done_at) return false;
    const dt = new Date(t.done_at);
    const key = `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`;
    return key === todayLocal;
  }).slice(0, 6);

  // ─── Reading status ───────────────────────────────────────────────────
  const currentBook = profileData?.currentBook ?? null;
  const readingLoggedToday = (profileData?.thisDay.pages || 0) > 0;

  // ─── Proof status (only real challenge_checkins count) ────────────────
  // proofsDone   = how many active joined challenges already have a check-in
  //                from this user today (real challenge_checkins row).
  // proofsTotal  = active joined challenges total.
  // proofPending = unchecked count.
  const proofsTotal   = activeChallenges.length;
  const proofsDone    = activeChallenges.filter(c => c.i_checked_in_today).length;
  const proofPending  = proofsTotal - proofsDone;
  const allProofsDone = proofsTotal > 0 && proofsDone === proofsTotal;

  // ─── Greeting ─────────────────────────────────────────────────────────
  const hour = new Date().getHours();
  const greet = hour < 5 ? 'Good night' : hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const firstName =
    (profileData?.profile?.display_name || '').split(' ')[0]
    || profileData?.profile?.username
    || 'there';

  // ─── Actions ──────────────────────────────────────────────────────────
  const onToggleHabit = async (habitId: string, currentlyDone: boolean) => {
    if (!session) return;
    hLight();
    // Animate the row state shift (line-through + color) and any list
    // reflow alongside it.
    LayoutAnimation.configureNext(SHEET_LAYOUT);
    await toggleCheckin(habitId, session.user.id, !currentlyDone);
    refreshHabits(); refreshProfile();
  };

  const onToggleTask = async (taskId: string, currentlyDone: boolean) => {
    hLight();
    // Animate the row leaving "Tasks that matter" and reappearing under
    // "Completed today" (or vice versa).
    LayoutAnimation.configureNext(SHEET_LAYOUT);
    setTasks(prev => prev.map(t => t.id === taskId
      ? { ...t, done: !currentlyDone, done_at: !currentlyDone ? new Date().toISOString() : null }
      : t));
    await toggleDone(taskId, !currentlyDone);
    refreshProfile();
  };

  const onUploadProof = (c: ActiveChallengeCard) => {
    if (c.i_checked_in_today) { Alert.alert('Already checked in today.'); return; }
    if (c.proof_type !== 'photo') {
      submitCheckin({ challengeId: c.id }).then(r => {
        if (!r.ok) Alert.alert('Could not check in', r.message);
        else refreshChallenges();
      });
      return;
    }
    setProofFor(c);
  };

  const doProofUpload = async (source: 'camera' | 'library') => {
    console.log('[proof] doProofUpload tapped', { source });
    const c = proofFor;
    if (!c) { Alert.alert('Missing challenge', 'No challenge selected.'); return; }
    if (!session) { Alert.alert('Sign-in required', 'You must be signed in to upload proof.'); return; }
    setProofFor(null);
    // Wait for iOS Modal to fully dismiss before launching the picker.
    await new Promise(r => setTimeout(r, 600));
    try {
      const r = await pickAndUploadProof({
        source, circleId: c.circle_id, challengeId: c.id, userId: session.user.id,
      });
      console.log('[proof] doProofUpload result', r);
      if (r.ok) { refreshChallenges(); return; }
      switch (r.reason) {
        case 'permission': Alert.alert('Permission needed', r.message); break;
        case 'duplicate':  Alert.alert('Already checked in today.'); break;
        case 'storage':    Alert.alert('Upload failed', `Could not save image.\n\n${r.message}`); break;
        case 'db':         Alert.alert('Check-in failed', `Could not record the check-in.\n\n${r.message}`); break;
        case 'cancelled':  /* silent */ break;
        default:           Alert.alert('Upload failed', r.message || 'Unknown error.');
      }
    } catch (e: any) {
      console.log('[proof] doProofUpload threw', e?.message);
      Alert.alert('Upload failed', e?.message || 'Unknown error');
    }
  };

  const startFocus = (minutes: number) => navigation.navigate('Focus', { minutes });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bgBase }} edges={['top']}>
      <ScreenAtmosphere />

      <ScrollView contentContainerStyle={{ paddingBottom: 140 }} showsVerticalScrollIndicator={false}>
        {/* Header — VYB mark + thin divider + greeting block, side by side.
            The mark is sized to anchor the row visually (same optical weight
            as the greeting heading). Greeting reads from profile with a
            neutral 'there' fallback. */}
        <View style={{
          paddingHorizontal: 20, paddingTop: 10, paddingBottom: 10,
          flexDirection: 'row', alignItems: 'center', gap: 16,
        }}>
          <Image
            source={require('../../assets/logos/vyb-white.png')}
            style={{ width: 84, height: 56 }}
            resizeMode="contain"
          />
          <View style={{
            width: 1, height: 46,
            backgroundColor: 'rgba(244,240,232,0.18)',
          }} />
          <View style={{ flex: 1 }}>
            <Text numberOfLines={1} style={[Tx.editorial(), { fontSize: 22, letterSpacing: -0.4 }]}>
              {greet}, {firstName}
            </Text>
            <Text numberOfLines={2} style={{
              fontFamily: F.serifItalic, fontSize: 12, color: C.textMuted,
              marginTop: 3, lineHeight: 16,
            }}>
              Here’s what needs your attention today.
            </Text>
          </View>
        </View>

        {/* Two large overview cards — the new dashboard anchor. Replaces
            the old snapshot row + Quick Actions. Tap to drill into each
            domain. */}
        <View style={{ paddingHorizontal: 16, marginTop: 12, flexDirection: 'row', gap: 10 }}>
          <HabitsTodayCard
            done={habitsDone}
            total={habitsTotal}
            onPress={() => navigation.navigate('habits')}
          />
          <TaskOverviewCard
            urgent={urgentCount}
            important={importantCount}
            later={laterCount}
            onPress={() => navigation.navigate('tasks')}
          />
        </View>

        {/* Tasks that matter — first because the Dashboard's main question
            is "what do I need to do today?". Habits come right after. */}
        <View style={{ paddingHorizontal: 16, marginTop: 22 }}>
          <SectionLabel style={{ marginLeft: 4, marginBottom: 8 }}>tasks that matter</SectionLabel>
          {urgentTasks.length === 0 && importantTasks.length === 0 && completedTodayTasks.length === 0 ? (
            <VYBEmpty
              title="Nothing urgent."
              body="Choose one meaningful task and move it forward."
              actionLabel="Open Tasks"
              onAction={() => navigation.navigate('tasks')}
            />
          ) : (
            <View style={{ gap: 10 }}>
              {urgentTasks.length > 0 && (
                <TaskGroup
                  label="Urgent" accent="#D27050"
                  tasks={urgentTasks}
                  onToggle={onToggleTask}
                  onOpen={() => navigation.navigate('tasks')} />
              )}
              {importantTasks.length > 0 && (
                <TaskGroup
                  label="Important" accent={C.gold}
                  tasks={importantTasks}
                  onToggle={onToggleTask}
                  onOpen={() => navigation.navigate('tasks')} />
              )}
              {completedTodayTasks.length > 0 && (
                <TaskGroup
                  label="Completed today" accent="#8FA88A"
                  tasks={completedTodayTasks}
                  onToggle={onToggleTask}
                  onOpen={() => navigation.navigate('tasks')} />
              )}
            </View>
          )}
        </View>

        {/* Habits — Today/Week toggle. Today supports compact + expanded
            so the user can complete the full day without leaving Home. */}
        <View style={{ paddingHorizontal: 16, marginTop: 22 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <SectionLabel style={{ marginLeft: 4 }}>habits</SectionLabel>
            <VYBToggle
              tone="gold"
              variant="subtle"
              size="sm"
              value={habitsView}
              onChange={(v) => {
                LayoutAnimation.configureNext(SHEET_LAYOUT);
                setHabitsView(v as 'today' | 'week');
              }}
              options={[
                { label: 'Today', value: 'today' },
                { label: 'Week',  value: 'week' },
              ]}
            />
          </View>

          {habitsView === 'today' ? (
            todayHabitsAll.length === 0 ? (
              <VYBEmpty
                title="No habits planned for today."
                body="Go to Habits to build your daily system."
                actionLabel="Open Habits"
                onAction={() => navigation.navigate('habits')}
              />
            ) : (
              <VYBCard level="widget"
                padding={0}
                accent={habitsTotal > 0 && habitsDone >= habitsTotal ? 'sage' : undefined}
              >
                {todayHabits.map((h, i) => (
                  <Pressable key={h.id} onPress={() => onToggleHabit(h.id, h.todayDone)} style={{
                    flexDirection: 'row', alignItems: 'center', gap: 14,
                    paddingVertical: 12, paddingHorizontal: 14,
                    borderTopColor: C.borderSubtle, borderTopWidth: i === 0 ? 0 : 1,
                  }}>
                    <VYBCheckCircle checked={h.todayDone} />
                    <View style={{ flex: 1 }}>
                      <AnimatedHabitTitle
                        name={h.name}
                        done={h.todayDone}
                        textStyle={{ fontFamily: F.sans, fontSize: 13.5, color: C.textPrimary }}
                      />
                    </View>
                    {h.streak > 0 && (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                        <Flame size={10} color={C.gold} />
                        <Text style={{ fontFamily: F.mono, fontSize: 10, color: C.gold }}>{h.streak}</Text>
                      </View>
                    )}
                  </Pressable>
                ))}
                {todayHabitsAll.length > COMPACT_HABITS && (
                  <Pressable
                    onPress={() => {
                      LayoutAnimation.configureNext(SHEET_LAYOUT);
                      setHabitsExpanded(e => !e);
                    }}
                    style={{
                      paddingVertical: 12, alignItems: 'center',
                      borderTopColor: C.borderSubtle, borderTopWidth: 1,
                    }}>
                    <Text style={{ fontFamily: F.sansBold, fontSize: 10.5, color: C.gold, letterSpacing: 1.2 }}>
                      {habitsExpanded ? 'COLLAPSE' : `SHOW ALL ${todayHabitsAll.length}`}
                    </Text>
                  </Pressable>
                )}
              </VYBCard>
            )
          ) : (
            <WeeklyHabitsGrid
              habits={habitsAllHabits}
              onToggleToday={onToggleHabit}
            />
          )}
        </View>

        {/* Reading */}
        <View style={{ paddingHorizontal: 16, marginTop: 22 }}>
          <SectionLabel style={{ marginLeft: 4, marginBottom: 8 }}>reading</SectionLabel>
          {currentBook ? (
            <VYBCard level="widget" accent="gold" padding={14}>
              <View style={{ flexDirection: 'row', gap: 14 }}>
                <VYBBookCover
                  coverUrl={currentBook.cover_url}
                  title={currentBook.title}
                  size="sm"
                />
                <View style={{ flex: 1, justifyContent: 'space-between' }}>
                  <View>
                    <Text style={{
                      fontFamily: F.sansBold, fontSize: 9.5, color: C.textFaint,
                      letterSpacing: 1.4, textTransform: 'uppercase',
                    }}>
                      Reading now
                    </Text>
                    <Text numberOfLines={2} style={{
                      fontFamily: F.serifItalic, fontSize: 16,
                      color: C.textPrimary, marginTop: 4, lineHeight: 20, letterSpacing: -0.2,
                    }}>
                      {currentBook.title}
                    </Text>
                    {currentBook.author && (
                      <Text numberOfLines={1} style={{
                        fontFamily: F.sans, fontSize: 11, color: C.textMuted, marginTop: 2,
                      }}>
                        {currentBook.author}
                      </Text>
                    )}
                  </View>
                  <View>
                    {currentBook.total_pages ? (() => {
                      const pct = Math.round((currentBook.current_page / currentBook.total_pages) * 100);
                      return (
                        <>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 8 }}>
                            <Text style={{ fontFamily: F.mono, fontSize: 10, color: C.textMuted }}>
                              {currentBook.current_page} / {currentBook.total_pages}
                            </Text>
                            <Text style={{ fontFamily: F.sansHeavy, fontSize: 12, color: C.goldBright, letterSpacing: -0.2 }}>
                              {pct}%
                            </Text>
                          </View>
                          <View style={{ marginTop: 4, height: 2, backgroundColor: C.borderSubtle, borderRadius: 1, overflow: 'hidden' }}>
                            <View style={{ width: `${pct}%`, height: '100%', backgroundColor: C.gold }} />
                          </View>
                        </>
                      );
                    })() : null}
                    <View style={{ marginTop: 10, alignSelf: 'flex-start' }}>
                      <GoldButton
                        size="sm" variant="complete"
                        onPress={() => navigation.getParent()?.navigate('BookDetail', { bookId: currentBook.id })}>
                        Continue
                      </GoldButton>
                    </View>
                  </View>
                </View>
              </View>
            </VYBCard>
          ) : (
            <VYBEmpty
              title="No book yet."
              body="Add a book to start tracking your reading."
              actionLabel="Add a book"
              onAction={() => navigation.navigate('reading')}
            />
          )}
        </View>

        {/* Active challenges / proof pending */}
        <View style={{ paddingHorizontal: 16, marginTop: 22 }}>
          <SectionLabel style={{ marginLeft: 4, marginBottom: 8 }}>active challenges</SectionLabel>
          {activeChallenges.length === 0 ? (
            <VYBEmpty
              title="No active challenges."
              body="Join or create a challenge with your circle."
              actionLabel="Open Friends"
              onAction={() => navigation.navigate('friends')}
            />
          ) : (
            <View style={{ gap: 10 }}>
              {activeChallenges.slice(0, 3).map(c => (
                <ChallengeCardCompact key={c.id} c={c}
                  onUpload={() => onUploadProof(c)}
                  onOpen={() => navigation.getParent()?.navigate('ChallengeDetail', { challengeId: c.id })} />
              ))}
            </View>
          )}
        </View>

        {/* Focus mode */}
        <View style={{ paddingHorizontal: 16, marginTop: 22 }}>
          <SectionLabel style={{ marginLeft: 4, marginBottom: 8 }}>focus mode</SectionLabel>
          <VYBCard level="widget" accent="cream" padding={16}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{
                width: 40, height: 40, borderRadius: 20,
                backgroundColor: 'rgba(201,169,97,0.10)',
                borderColor: 'rgba(201,169,97,0.35)', borderWidth: 1,
                alignItems: 'center', justifyContent: 'center',
              }}>
                <Timer size={18} color={C.gold} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: F.sansBold, fontSize: 14, color: C.textPrimary }}>Focus Mode</Text>
                <Text style={{ fontFamily: F.sans, fontSize: 11.5, color: C.textMuted, marginTop: 2 }}>
                  Start a focused session.
                </Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
              {[15, 25, 45].map(m => (
                <Pressable key={m} onPress={() => startFocus(m)} hitSlop={4}
                  style={{
                    flex: 1, height: 36, borderRadius: 999,
                    backgroundColor: 'rgba(255,255,255,0.04)',
                    borderColor: C.borderSubtle, borderWidth: 1,
                    alignItems: 'center', justifyContent: 'center',
                  }}>
                  <Text style={{ fontFamily: F.sansBold, fontSize: 11, color: C.textSecondary, letterSpacing: 0.5 }}>
                    {m} MIN
                  </Text>
                </Pressable>
              ))}
            </View>
          </VYBCard>
        </View>
      </ScrollView>

      {/* Proof picker — pure-View backdrop avoids Pressable parent/child
          gesture collision that was eating row taps. */}
      <Modal visible={!!proofFor} transparent animationType="fade" onRequestClose={() => setProofFor(null)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }}>
          <Pressable
            onPress={() => setProofFor(null)}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
          />
          <View style={{
            backgroundColor: C.bgBase, borderTopLeftRadius: 22, borderTopRightRadius: 22,
            paddingTop: 16, paddingBottom: 36, paddingHorizontal: 16,
            borderColor: C.borderSubtle, borderWidth: 1,
          }}>
            <View style={{ alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: C.borderSubtle, marginBottom: 14 }} />
            <ProofSheetRow Icon={ImageIcon} label="Choose from gallery"
              onPress={() => { console.log('[proof] gallery row tapped'); doProofUpload('library'); }} />
            <ProofSheetRow Icon={Camera}    label="Take photo"
              onPress={() => { console.log('[proof] camera row tapped'); doProofUpload('camera'); }} />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────

/**
 * WeeklyHabitsGrid — mobile-friendly week view for habits.
 * Rows = habits, columns = Mon..Sun. Uses real data:
 *   - scheduled day → outline circle
 *   - scheduled + done → filled gold with check
 *   - unscheduled day → muted dot
 * Today's column is emphasized. Only today's cell is tap-editable since the
 * lib's toggleCheckin only writes today; back-edits aren't supported yet.
 */
function WeeklyHabitsGrid({
  habits, onToggleToday,
}: {
  habits: { id: string; name: string; days_of_week: number[]; weekDone: boolean[]; todayDone: boolean }[];
  onToggleToday: (habitId: string, currentlyDone: boolean) => void;
}) {
  const dowOfToday = new Date().getDay();
  // weekDone is Mon..Sun (index 0=Mon). Map today's getDay() into that index.
  const todayIdx = dowOfToday === 0 ? 6 : dowOfToday - 1;
  // weekDone index → real day-of-week value (0=Sun..6=Sat) for schedule check.
  const COL_DOW = [1, 2, 3, 4, 5, 6, 0];
  const COL_LABEL = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

  if (habits.length === 0) {
    return (
      <VYBEmpty
        title="No habits yet."
        body="Add a habit in the Habits tab to start your week."
        actionLabel="Open Habits"
        onAction={() => {}}
      />
    );
  }

  return (
    <VYBCard level="widget" padding={0}>
      {/* Header row — day initials with today highlighted. */}
      <View style={{
        flexDirection: 'row', paddingTop: 12, paddingBottom: 8,
        paddingHorizontal: 14, alignItems: 'center',
        borderBottomColor: C.borderSubtle, borderBottomWidth: 1,
      }}>
        <View style={{ flex: 1 }} />
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {COL_LABEL.map((lbl, i) => (
            <View key={i} style={{ width: 26, alignItems: 'center' }}>
              <Text style={{
                fontFamily: F.sansBold, fontSize: 10,
                color: i === todayIdx ? C.gold : C.textFaint, letterSpacing: 0.6,
              }}>
                {lbl}
              </Text>
            </View>
          ))}
        </View>
      </View>

      {habits.map((h, rowIdx) => (
        <View key={h.id} style={{
          flexDirection: 'row', alignItems: 'center',
          paddingHorizontal: 14, paddingVertical: 10,
          borderTopColor: C.borderSubtle, borderTopWidth: rowIdx === 0 ? 0 : 1,
        }}>
          <Text numberOfLines={1} style={{
            flex: 1, fontFamily: F.sans, fontSize: 12.5, color: C.textPrimary,
            paddingRight: 8,
          }}>
            {h.name}
          </Text>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {COL_DOW.map((dow, colIdx) => {
              const scheduled = h.days_of_week.includes(dow);
              const done = h.weekDone[colIdx];
              const isToday = colIdx === todayIdx;
              const cell = (
                <View style={{
                  width: 22, height: 22, borderRadius: 11,
                  borderWidth: scheduled ? 1.5 : 1,
                  borderColor: done ? C.gold : scheduled ? (isToday ? C.gold : C.borderMid) : 'transparent',
                  backgroundColor: done
                    ? C.gold
                    : (!scheduled && isToday) ? 'rgba(255,255,255,0.04)'
                    : 'transparent',
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  {done ? (
                    <Text style={{ color: C.bgBase, fontFamily: F.sansBold, fontSize: 11, lineHeight: 13 }}>✓</Text>
                  ) : !scheduled ? (
                    <View style={{ width: 3, height: 3, borderRadius: 2, backgroundColor: C.borderMid }} />
                  ) : null}
                </View>
              );
              if (isToday && scheduled) {
                return (
                  <Pressable key={colIdx} onPress={() => onToggleToday(h.id, h.todayDone)}
                    style={{ width: 26, alignItems: 'center' }}>
                    {cell}
                  </Pressable>
                );
              }
              return <View key={colIdx} style={{ width: 26, alignItems: 'center' }}>{cell}</View>;
            })}
          </View>
        </View>
      ))}
    </VYBCard>
  );
}

/**
 * HabitsTodayCard — one of two main dashboard anchors. Ring + count.
 * Sage while in progress, gold on full completion, gray when nothing
 * planned/done.
 */
function HabitsTodayCard({
  done, total, onPress,
}: { done: number; total: number; onPress: () => void }) {
  const complete = total > 0 && done >= total;
  return (
    <Pressable onPress={onPress} style={{ flex: 1 }}>
      <View style={{
        borderRadius: 22, padding: 16, minHeight: 168,
        backgroundColor: 'rgba(255,255,255,0.035)',
        borderColor: complete ? 'rgba(201,169,97,0.30)' : C.borderSubtle,
        borderWidth: 1, overflow: 'hidden',
        shadowColor: complete ? '#C9A961' : '#000',
        shadowOpacity: complete ? 0.18 : 0.18, shadowRadius: 14, shadowOffset: { width: 0, height: 6 },
      }}>
        <LinearGradient pointerEvents="none"
          colors={complete
            ? ['rgba(201,169,97,0.10)', 'rgba(0,0,0,0)']
            : ['rgba(143,168,138,0.06)', 'rgba(0,0,0,0)']}
          start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
          style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}
        />
        <Text style={{
          fontFamily: F.sansBold, fontSize: 9.5, color: C.textFaint,
          letterSpacing: 1.4, textTransform: 'uppercase',
        }}>
          Habits Today
        </Text>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', marginTop: 6 }}>
          <VYBProgressRing done={done} total={total} size={108} strokeWidth={8}>
            <Text style={{
              fontFamily: F.sansHeavy, fontSize: 26,
              color: total > 0 && done >= total ? C.goldBright : C.textPrimary,
              letterSpacing: -0.8, lineHeight: 28,
            }}>
              {total > 0 ? `${done}/${total}` : '0'}
            </Text>
          </VYBProgressRing>
        </View>
      </View>
    </Pressable>
  );
}

/**
 * TaskOverviewCard — the second main anchor. Shows urgent/important/later
 * counts and an adaptive one-liner that tells the user what to do today.
 */
function TaskOverviewCard({
  urgent, important, later, onPress,
}: { urgent: number; important: number; later: number; onPress: () => void }) {
  // Helper copy only appears when the user has zero open tasks. With any
  // tasks present the card stays data-only so it reads as a widget.
  const empty = urgent === 0 && important === 0 && later === 0;
  const message = empty
    ? 'Your day is looking clear. Plan your top 3 priorities for today.'
    : null;

  return (
    <Pressable onPress={onPress} style={{ flex: 1 }}>
      <View style={{
        borderRadius: 22, padding: 16, minHeight: 168,
        backgroundColor: 'rgba(255,255,255,0.035)',
        borderColor: C.borderSubtle, borderWidth: 1, overflow: 'hidden',
        shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 14, shadowOffset: { width: 0, height: 6 },
      }}>
        {/* Neutral wash — no red/coral tint even when urgent > 0. The
            urgent state is signalled by the tiny clay dot on its row, not by
            the whole card. */}
        <LinearGradient pointerEvents="none"
          colors={['rgba(255,255,255,0.04)', 'rgba(0,0,0,0)']}
          start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
          style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}
        />
        <Text style={{
          fontFamily: F.sansBold, fontSize: 9.5, color: C.textFaint,
          letterSpacing: 1.4, textTransform: 'uppercase',
        }}>
          Tasks Pending
        </Text>
        <View style={{ flex: 1, justifyContent: 'center', marginTop: 10, gap: 8 }}>
          <TaskCountRow label="Urgent"    count={urgent}    color="#D27050" />
          <TaskCountRow label="Important" count={important} color={C.gold} />
          <TaskCountRow label="Later"     count={later}     color="#8FA88A" />
        </View>
        {message && (
          <Text numberOfLines={2} style={{
            fontFamily: F.serifItalic, fontSize: 11.5, color: C.textMuted,
            marginTop: 10, lineHeight: 15,
          }}>
            {message}
          </Text>
        )}
      </View>
    </Pressable>
  );
}

function TaskCountRow({ label, count, color }: { label: string; count: number; color: string }) {
  const muted = count === 0;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <View style={{
        width: 6, height: 6, borderRadius: 3,
        backgroundColor: muted ? C.borderMid : color, opacity: muted ? 0.5 : 1,
      }} />
      <Text style={{
        flex: 1, fontFamily: F.sansBold, fontSize: 11.5,
        color: muted ? C.textFaint : C.textSecondary, letterSpacing: 0.3,
      }}>
        {label}
      </Text>
      <Text style={{
        fontFamily: F.sansHeavy, fontSize: 16,
        color: muted ? C.textFaint : C.textPrimary, letterSpacing: -0.3,
      }}>
        {count}
      </Text>
    </View>
  );
}

function TaskGroup({
  label, accent, tasks, onToggle, onOpen,
}: {
  label: string; accent: string;
  tasks: { id: string; text: string; done: boolean; pri: string }[];
  onToggle: (id: string, currentlyDone: boolean) => void;
  onOpen: () => void;
}) {
  return (
    <View style={{
      borderRadius: 14, overflow: 'hidden',
      backgroundColor: 'rgba(255,255,255,0.025)',
      borderColor: C.borderSubtle, borderWidth: 1,
    }}>
      <View style={{
        paddingHorizontal: 14, paddingVertical: 8,
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        borderBottomColor: C.borderSubtle, borderBottomWidth: 1,
      }}>
        <Text style={{ fontFamily: F.sansBold, fontSize: 10, color: accent, letterSpacing: 0.8, textTransform: 'uppercase' }}>
          {label}
        </Text>
        <Pressable onPress={onOpen} hitSlop={6}>
          <ChevronRight size={14} color={C.textFaint} />
        </Pressable>
      </View>
      {tasks.map((t, i) => (
        <Pressable key={t.id} onPress={() => onToggle(t.id, t.done)} style={{
          flexDirection: 'row', alignItems: 'center', gap: 14,
          paddingVertical: 12, paddingHorizontal: 14,
          borderTopColor: C.borderSubtle, borderTopWidth: i === 0 ? 0 : 1,
        }}>
          {/* Gold completion circle — same as Habits + Tasks (VYB v2). */}
          <View style={{
            width: 26, height: 26, borderRadius: 13,
            borderColor: t.done ? C.gold : C.borderMid, borderWidth: 1.5,
            backgroundColor: t.done ? C.gold : 'transparent',
            alignItems: 'center', justifyContent: 'center',
          }}>
            {t.done && (
              <Text style={{ color: C.bgBase, fontFamily: F.sansBold, fontSize: 14, lineHeight: 16 }}>✓</Text>
            )}
          </View>
          <Text numberOfLines={2} style={{
            flex: 1, fontFamily: F.sans, fontSize: 13.5,
            color: t.done ? C.textMuted : C.textPrimary,
            textDecorationLine: t.done ? 'line-through' : 'none',
            lineHeight: 18,
          }}>
            {t.text}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

function ChallengeCardCompact({
  c, onUpload, onOpen,
}: { c: ActiveChallengeCard; onUpload: () => void; onOpen: () => void }) {
  const theme = challengeTypeTheme(c.challenge_type);
  const checkedIn = c.i_checked_in_today;
  return (
    <Pressable onPress={onOpen}>
      <View style={{
        borderRadius: 14, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12,
        backgroundColor: 'rgba(255,255,255,0.025)',
        borderColor: `${theme.accent}33`, borderWidth: 1,
      }}>
        <View style={{
          width: 38, height: 38, borderRadius: 12,
          backgroundColor: 'rgba(255,255,255,0.04)',
          borderColor: `${theme.accent}55`, borderWidth: 1,
          alignItems: 'center', justifyContent: 'center',
        }}>
          <Trophy size={16} color={theme.accent} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: F.sansBold, fontSize: 13.5, color: C.textPrimary }}>{c.title}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
            <Text style={{ fontFamily: F.sans, fontSize: 10.5, color: C.textMuted }}>{c.circle_name}</Text>
            <Lock size={8} color={C.textFaint} />
          </View>
        </View>
        {checkedIn ? (
          <View style={{
            paddingHorizontal: 10, paddingVertical: 7, borderRadius: 999,
            backgroundColor: 'rgba(143,168,138,0.18)',
            borderColor: 'rgba(143,168,138,0.45)', borderWidth: 1,
            flexDirection: 'row', alignItems: 'center', gap: 4,
          }}>
            <CheckCircle2 size={11} color="#8FA88A" />
            <Text style={{ fontFamily: F.sansBold, fontSize: 10, color: '#8FA88A', letterSpacing: 0.4, textTransform: 'uppercase' }}>
              Checked in
            </Text>
          </View>
        ) : (
          <Pressable onPress={(e) => { e.stopPropagation(); onUpload(); }} hitSlop={4} style={{
            paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999,
            backgroundColor: C.goldFaint,
            borderColor: 'rgba(201,169,97,0.4)', borderWidth: 1,
            flexDirection: 'row', alignItems: 'center', gap: 4,
          }}>
            <Camera size={11} color={C.gold} />
            <Text style={{ fontFamily: F.sansBold, fontSize: 10, color: C.gold, letterSpacing: 0.4, textTransform: 'uppercase' }}>
              Upload
            </Text>
          </Pressable>
        )}
      </View>
    </Pressable>
  );
}

function ProofSheetRow({
  Icon, label, onPress,
}: { Icon: typeof Camera; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} hitSlop={4} style={{
      flexDirection: 'row', alignItems: 'center', gap: 12,
      paddingVertical: 14, paddingHorizontal: 6,
      borderTopColor: C.borderSubtle, borderTopWidth: 1,
    }}>
      <Icon size={16} color={C.textPrimary} />
      <Text style={{ fontFamily: F.sansBold, fontSize: 13.5, color: C.textPrimary, letterSpacing: 0.3 }}>{label}</Text>
    </Pressable>
  );
}
