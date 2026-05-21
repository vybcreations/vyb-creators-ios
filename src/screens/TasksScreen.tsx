import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, ScrollView, Pressable, TextInput, ActivityIndicator,
  Platform, Keyboard, Alert, AccessibilityInfo,
  LayoutAnimation, UIManager, Animated, Easing,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Plus, ArrowUp, X, Check as CheckIcon, Trash2, ChevronDown, MoreHorizontal, Folder } from 'lucide-react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Pill, Tx } from '../components/primitives';
import { VYBChip, VYBCheckCircle } from '../components/ui';
import { colors as C, fonts as F, KEYBOARD_GAP } from '../theme';
import { useAuth } from '../lib/auth';
import {
  useTasks, createTask, updateTask, deleteTask, restoreTask, toggleDone,
  groupByProject, loadDefaults, saveDefaults,
  loadRecentProjects, saveRecentProjects, touchRecentProject,
  mergeProjects, canonicalProjectLabel,
  PRIS, Pri, Task, normalizeProjectKey, cleanProjectInput,
} from '../lib/tasks';
import { hLight, hSelection, hSuccess, hWarning } from '../lib/haptics';
import { useComposerLayout, composerLiftFor } from '../lib/layout';
import { useUndoToast } from '../components/UndoToast';
import { VoiceDictationButton, appendTranscript } from '../components/VoiceDictationButton';
import { ScreenAtmosphere } from '../components/ScreenAtmosphere';
import { GlassCard } from '../components/GlassCard';

// Main mobile filter — collapses status (always active) + priority into one row.
// "Completed" and project filtering remain in the data layer but are not
// surfaced as primary filters here. They'll live in a secondary view later.
type Filter = 'all' | Pri;

const FILTER_LABEL: Record<Filter, string> = {
  all: 'Todas', urgent: 'Urgente', important: 'Importante', later: 'Después',
};
const URGENT_THRESHOLD = 5;

// Enable LayoutAnimation on Android (iOS is on by default).
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}
const ANIM_FADE = LayoutAnimation.create(220, 'easeInEaseOut', 'opacity');
const VYB_EASE = Easing.bezier(0.22, 1, 0.36, 1);
// Sand/gold glow used for "I'm here" hints (web parity: rgba(160,138,86,_)).
const VYB_GOLD_GLOW = 'rgba(160,138,86,1)';

const PRI_LABEL: Record<Pri, string> = { urgent: 'Urgent', important: 'Important', later: 'Later' };
const PRI_ACCENT: Record<Pri, string> = { urgent: C.clay, important: C.gold, later: C.textMuted };

export function TasksScreen() {
  const { session } = useAuth();
  const { tasks, loading, setTasks, refresh } = useTasks();
  const { requestUndo } = useUndoToast();
  const [filter, setFilter] = useState<Filter>('all');

  // Composer state
  const [draft, setDraft] = useState('');
  const [pri, setPri] = useState<Pri>('important');
  const [project, setProject] = useState<string | null>(null);
  const [pickingProject, setPickingProject] = useState(false);
  const [newProjectInput, setNewProjectInput] = useState<string | null>(null); // null = closed
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Sticky recent projects (AsyncStorage). Survives task deletion + dedup
  // checks happen against this list ∪ task-derived projects.
  const [recentProjects, setRecentProjects] = useState<string[]>([]);

  // Highlight a task briefly after it's restored from Completed → original group.
  const [restoredId, setRestoredId] = useState<string | null>(null);

  // Completed section collapsed by default to keep focus on active work.
  const [completedExpanded, setCompletedExpanded] = useState(false);
  const [editingTextId, setEditingTextId] = useState<string | null>(null); // inline-rename target

  // Inline quick actions per row. Only one row at a time can have its actions
  // expanded; opening another row's actions auto-collapses the previous one.
  // `expandedSub` tracks which inline option list (folder vs priority) is open
  // below the chips, so we don't stack both at once.
  const [expandedActionsId, setExpandedActionsId] = useState<string | null>(null);
  const [expandedSub, setExpandedSub] = useState<null | 'folder' | 'priority'>(null);

  // Reduce-motion: when the user has the accessibility setting on, we skip
  // glows/pulses and just apply the state change instantly.
  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => sub?.remove?.();
  }, []);

  // Composer position — manual keyboard tracking. `KeyboardAvoidingView`
  // doesn't lift correctly when the lifted view is itself absolutely-positioned
  // off the screen bottom (the math underflows and pads to 0). So we listen to
  // keyboard events and animate `bottom` ourselves.
  //
  // restingBottom already clears the floating tab bar + safe area (with extra
  // room on iPad). We clamp the shown position to never drop below it, so an
  // iPad hardware keyboard (which reports height 0 / a tiny accessory bar)
  // keeps the composer above the nav instead of behind it.
  const { restingBottom } = useComposerLayout();
  const composerBottom = useRef(new Animated.Value(restingBottom)).current;
  useEffect(() => {
    // Keep the resting position correct across orientation / inset changes
    // (e.g. iPad rotate) when the keyboard isn't open.
    composerBottom.setValue(restingBottom);
  }, [restingBottom]);
  useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvt, (e) => {
      Animated.timing(composerBottom, {
        toValue: composerLiftFor(e.endCoordinates?.height ?? 0, KEYBOARD_GAP, restingBottom),
        duration: (e as any).duration || 250,
        easing: VYB_EASE,
        useNativeDriver: false,
      }).start();
    });
    const hideSub = Keyboard.addListener(hideEvt, (e) => {
      Animated.timing(composerBottom, {
        toValue: restingBottom,
        duration: (e as any).duration || 250,
        easing: VYB_EASE,
        useNativeDriver: false,
      }).start();
    });
    return () => { showSub.remove(); hideSub.remove(); };
  }, [restingBottom]);

  const inputRef = useRef<TextInput>(null);
  const newProjectRef = useRef<TextInput>(null);

  useFocusEffect(React.useCallback(() => { refresh(); }, [refresh]));

  // Load saved defaults + recent projects once.
  useEffect(() => {
    loadDefaults().then(d => { setPri(d.pri); setProject(d.project); });
    loadRecentProjects().then(setRecentProjects);
  }, []);

  // Auto-clear the restored highlight after 1.6s so the glow doesn't linger.
  useEffect(() => {
    if (!restoredId) return;
    const id = setTimeout(() => setRestoredId(null), 1800);
    return () => clearTimeout(id);
  }, [restoredId]);

  // Auto-cancel pending delete confirmation.
  useEffect(() => {
    if (!confirmDeleteId) return;
    const id = setTimeout(() => setConfirmDeleteId(null), 2500);
    return () => clearTimeout(id);
  }, [confirmDeleteId]);

  const projectsQuick = useMemo(() => mergeProjects(recentProjects, tasks), [recentProjects, tasks]);

  // Main board is implicitly Active (never includes done). The filter pill
  // narrows to one priority; "Todas" shows all three accordions.
  const activeTasks = useMemo(() => tasks.filter(t => !t.done), [tasks]);
  const completedTasks = useMemo(
    () => [...tasks].filter(t => t.done).sort((a, b) =>
      (b.done_at || b.updated_at).localeCompare(a.done_at || a.updated_at)),
    [tasks],
  );

  const byPri: Record<Pri, Task[]> = {
    urgent:    activeTasks.filter(t => t.pri === 'urgent'),
    important: activeTasks.filter(t => t.pri === 'important'),
    later:     activeTasks.filter(t => t.pri === 'later'),
  };

  const visiblePris: Pri[] = filter === 'all' ? PRIS : [filter as Pri];

  // ─── Composer actions ────────────────────────────────────
  const togglePri = (next: Pri) => {
    setPri(next);
    hSelection();
  };
  const persistRecent = (name: string) => {
    const next = touchRecentProject(recentProjects, name);
    setRecentProjects(next);
    saveRecentProjects(next);
  };

  const toggleProject = (p: string | null) => {
    if (p === null) { setProject(null); hSelection(); return; }
    if (normalizeProjectKey(p) === normalizeProjectKey(project)) {
      setProject(null);
    } else {
      setProject(p);
      persistRecent(p);
    }
    hSelection();
  };

  const submitNewProject = () => {
    const typed = cleanProjectInput(newProjectInput || '');
    LayoutAnimation.configureNext(ANIM_FADE);
    if (!typed) { setNewProjectInput(null); return; }
    // Dedup: if a project with the same normalized key already exists, snap to
    // its canonical label instead of forking casings.
    const label = canonicalProjectLabel(typed, recentProjects, tasks);
    setProject(label);
    persistRecent(label);
    setNewProjectInput(null);
    setPickingProject(false);
  };

  // Mode togglers wrap LayoutAnimation so the priority pills fade in/out
  // smoothly when entering/leaving project-pick / new-project modes.
  const enterPickProject  = () => { LayoutAnimation.configureNext(ANIM_FADE); setPickingProject(true); };
  const leavePickProject  = () => { LayoutAnimation.configureNext(ANIM_FADE); setPickingProject(false); setNewProjectInput(null); };
  const enterNewProject   = () => { LayoutAnimation.configureNext(ANIM_FADE); setNewProjectInput(''); };
  const cancelNewProject  = () => { LayoutAnimation.configureNext(ANIM_FADE); setNewProjectInput(null); };

  const send = async () => {
    const text = draft.trim();
    if (!text || !session) return;
    const optimistic: Task = {
      id: `tmp-${Date.now()}`,
      user_id: session.user.id,
      text,
      pri,
      project: project ? cleanProjectInput(project) : null,
      done: false,
      done_at: null,
      due_date: null,
      due_kind: null,
      scheduled_for: null,
      position: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    setTasks(ts => [optimistic, ...ts]);
    setDraft('');
    saveDefaults(pri, project ?? null);
    if (project) persistRecent(project);
    // Tasks: dismiss after send. Rapid capture isn't the dominant mode here
    // (unlike book Entries), and keeping the keyboard up obscures the board.
    Keyboard.dismiss();
    try {
      const real = await createTask(session.user.id, { text, pri, project });
      setTasks(ts => ts.map(t => t.id === optimistic.id ? real : t));
      // Subtle gold pulse on the freshly-landed row so the user sees where it
      // ended up in the board.
      setRestoredId(real.id);
      hSuccess();
    } catch (e: any) {
      setTasks(ts => ts.filter(t => t.id !== optimistic.id));
      Alert.alert('Could not save', e?.message || 'Please try again.');
    }
  };

  // ─── Task actions ────────────────────────────────────────
  const onToggle = async (t: Task) => {
    const next = !t.done;
    LayoutAnimation.configureNext(ANIM_FADE);
    setTasks(ts => ts.map(x => x.id === t.id ? { ...x, done: next, done_at: next ? new Date().toISOString() : null } : x));
    if (next) hSuccess(); else { hLight(); setRestoredId(t.id); }
    try {
      await toggleDone(t.id, next);
    } catch (e: any) {
      LayoutAnimation.configureNext(ANIM_FADE);
      setTasks(ts => ts.map(x => x.id === t.id ? { ...x, done: !next, done_at: !next ? new Date().toISOString() : null } : x));
      if (!next) setRestoredId(null);
      Alert.alert('Could not update', e?.message || 'Please try again.');
    }
  };

  const onDelete = async (t: Task) => {
    if (confirmDeleteId !== t.id) {
      setConfirmDeleteId(t.id);
      hWarning();
      return;
    }
    setConfirmDeleteId(null);
    collapseAll();
    const snap = tasks;
    LayoutAnimation.configureNext(ANIM_FADE);
    setTasks(ts => ts.filter(x => x.id !== t.id));
    try {
      await deleteTask(t.id);
      // Offer undo. Restore re-inserts with the original id + metadata so the
      // row lands back in its original priority/project group, and we flash
      // the gold "moved" pulse so the user sees where it came back.
      requestUndo({
        label: 'Task deleted · Tap to undo',
        onUndo: async () => {
          try {
            await restoreTask(t);
            LayoutAnimation.configureNext(ANIM_FADE);
            setTasks(ts => [t, ...ts.filter(x => x.id !== t.id)]);
            setRestoredId(t.id);
          } catch (e: any) {
            Alert.alert('Could not undo', e?.message || 'Please try again.');
          }
        },
      });
    } catch (e: any) {
      LayoutAnimation.configureNext(ANIM_FADE);
      setTasks(snap);
      Alert.alert('Could not delete', e?.message || 'Please try again.');
    }
  };

  const onEditPri = async (t: Task, nextPri: Pri) => {
    if (t.pri === nextPri) return;
    LayoutAnimation.configureNext(ANIM_FADE);
    setTasks(ts => ts.map(x => x.id === t.id ? { ...x, pri: nextPri } : x));
    setRestoredId(t.id);
    hSelection();
    try { await updateTask(t.id, { pri: nextPri }); }
    catch (e: any) {
      LayoutAnimation.configureNext(ANIM_FADE);
      setTasks(ts => ts.map(x => x.id === t.id ? { ...x, pri: t.pri } : x));
      Alert.alert('Could not update', e?.message || 'Please try again.');
    }
  };

  const onChangeProject = async (t: Task, nextProject: string | null) => {
    if (normalizeProjectKey(t.project) === normalizeProjectKey(nextProject)) return;
    const cleaned = nextProject ? canonicalProjectLabel(nextProject, recentProjects, tasks) : null;
    LayoutAnimation.configureNext(ANIM_FADE);
    setTasks(ts => ts.map(x => x.id === t.id ? { ...x, project: cleaned } : x));
    setRestoredId(t.id);
    hSelection();
    if (cleaned) persistRecent(cleaned);
    try { await updateTask(t.id, { project: cleaned }); }
    catch (e: any) {
      LayoutAnimation.configureNext(ANIM_FADE);
      setTasks(ts => ts.map(x => x.id === t.id ? { ...x, project: t.project } : x));
      Alert.alert('Could not update', e?.message || 'Please try again.');
    }
  };

  // Three-dot tap on a row toggles its quick actions inline. Opening one row's
  // actions collapses any other row's actions + sub-list (project/priority).
  // Any state transition here also clears delete-confirm — closing/switching
  // the action area should always make the task safe again.
  const toggleActions = (taskId: string) => {
    Keyboard.dismiss();
    LayoutAnimation.configureNext(ANIM_FADE);
    setExpandedSub(null);
    setConfirmDeleteId(null);
    setExpandedActionsId(prev => prev === taskId ? null : taskId);
    hSelection();
  };
  const toggleSub = (which: 'folder' | 'priority') => {
    Keyboard.dismiss();
    LayoutAnimation.configureNext(ANIM_FADE);
    setConfirmDeleteId(null);
    setExpandedSub(prev => prev === which ? null : which);
    hSelection();
  };
  const collapseAll = () => {
    LayoutAnimation.configureNext(ANIM_FADE);
    setExpandedActionsId(null);
    setExpandedSub(null);
    setConfirmDeleteId(null);
  };

  const onEditText = async (t: Task, nextText: string) => {
    const text = nextText.trim();
    if (!text || text === t.text) return;
    setTasks(ts => ts.map(x => x.id === t.id ? { ...x, text } : x));
    try { await updateTask(t.id, { text }); }
    catch (e: any) {
      setTasks(ts => ts.map(x => x.id === t.id ? { ...x, text: t.text } : x));
      Alert.alert('Could not save', e?.message || 'Please try again.');
    }
  };

  const total = tasks.length;
  const open  = tasks.filter(t => !t.done).length;
  const done  = tasks.filter(t => t.done).length;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bgBase }} edges={['top']}>
      <ScreenAtmosphere />
      {/* Header */}
      <View style={{ paddingHorizontal: 22, paddingBottom: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <View>
          <Text style={Tx.label({ letterSpacing: 1.2 })}>{open} open · {done} done</Text>
          <Text style={[Tx.editorial(), { marginTop: 6, fontSize: 32 }]}>Tasks</Text>
        </View>
      </View>

      {/* Primary filters — sits above the scrolling board so it stays put. */}
      <View style={{ paddingHorizontal: 22, paddingBottom: 12, flexDirection: 'row', gap: 6 }}>
        {(['all', 'urgent', 'important', 'later'] as Filter[]).map(f => {
          // Each filter chip uses its semantic priority tone so 'urgent'
          // reads clay, 'important' gold, 'later' sage — calm, not alarming.
          const tone =
            f === 'urgent'    ? 'urgent' :
            f === 'important' ? 'important' :
            f === 'later'     ? 'later' :
                                'gold';
          return (
            <VYBChip
              key={f}
              label={FILTER_LABEL[f]}
              tone={tone}
              selected={filter === f}
              size="md"
              onPress={() => { Keyboard.dismiss(); hSelection(); setFilter(f); }}
            />
          );
        })}
      </View>

      {/* Board */}
      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={C.gold} />
        </View>
      ) : activeTasks.length === 0 && completedTasks.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, paddingBottom: 220 }}>
          <Text style={{ fontFamily: F.serifItalic, fontSize: 22, color: C.textSecondary, textAlign: 'center', lineHeight: 30 }}>
            Clear for now.{'\n'}Add your next move below.
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 300 }} keyboardShouldPersistTaps="handled">
          {/* Priority sections — hidden entirely when there are no active
              tasks, so we don't show three empty accordions above Completed. */}
          {activeTasks.length > 0 && visiblePris.map(p => (
            <PrioritySection key={p} pri={p} tasks={byPri[p]}
              showOverloadWarning={p === 'urgent' && byPri.urgent.length > URGENT_THRESHOLD}
              confirmDeleteId={confirmDeleteId}
              restoredId={restoredId}
              reduceMotion={reduceMotion}
              editingTextId={editingTextId}
              expandedActionsId={expandedActionsId}
              expandedSub={expandedSub}
              projectsQuick={projectsQuick}
              onToggle={onToggle} onDelete={onDelete}
              onStartEdit={(t) => { collapseAll(); setEditingTextId(t.id); }}
              onToggleActions={toggleActions}
              onToggleSub={toggleSub}
              onPickProject={(t, p2) => { onChangeProject(t, p2); collapseAll(); }}
              onPickPri={(t, p2) => { onEditPri(t, p2); collapseAll(); }}
              onEditText={onEditText}
              onCommitEdit={() => setEditingTextId(null)} />
          ))}

          {/* "Everything done" hint when there's no active work but completed
              tasks exist — keeps the screen calm instead of feeling empty. */}
          {activeTasks.length === 0 && completedTasks.length > 0 && (
            <Text style={{
              fontFamily: F.serifItalic, fontSize: 16, color: C.textSecondary,
              textAlign: 'center', paddingVertical: 32, lineHeight: 24,
            }}>
              All clear for now.{'\n'}Your completed work is below.
            </Text>
          )}

          {/* Completed — collapsible drawer at the bottom */}
          {completedTasks.length > 0 && (
            <GlassCard style={{ marginTop: 6, marginBottom: 10 }}>
              <Pressable
                onPress={() => { LayoutAnimation.configureNext(ANIM_FADE); setCompletedExpanded(e => !e); hSelection(); }}
                style={({ pressed }) => ({
                  flexDirection: 'row', alignItems: 'center', gap: 10,
                  paddingHorizontal: 22, paddingVertical: 14,
                  backgroundColor: pressed ? C.bgOverlay : 'transparent',
                })}>
                <CheckIcon size={13} color={C.textMuted} />
                <Text style={{ fontFamily: F.sansHeavy, fontSize: 13, color: C.textSecondary, letterSpacing: 0.3, flex: 1 }}>
                  Completadas · {completedTasks.length}
                </Text>
                <View style={{ transform: [{ rotate: completedExpanded ? '0deg' : '-90deg' }] }}>
                  <ChevronDown size={14} color={C.textMuted} />
                </View>
              </Pressable>
              {completedExpanded && (
                <View>
                  {completedTasks.map((t, i) => (
                    <TaskRow key={t.id} task={t}
                      isLast={i === completedTasks.length - 1}
                      confirming={confirmDeleteId === t.id}
                      restored={false}
                      reduceMotion={reduceMotion}
                      editingText={editingTextId === t.id}
                      expandedActions={expandedActionsId === t.id}
                      expandedSub={expandedActionsId === t.id ? expandedSub : null}
                      projectsQuick={projectsQuick}
                      onToggle={() => onToggle(t)}
                      onDelete={() => onDelete(t)}
                      onStartEdit={() => { collapseAll(); setEditingTextId(t.id); }}
                      onToggleActions={() => toggleActions(t.id)}
                      onToggleSub={toggleSub}
                      onPickProject={(p) => { onChangeProject(t, p); collapseAll(); }}
                      onPickPri={(p) => { onEditPri(t, p); collapseAll(); }}
                      onEditText={(text) => onEditText(t, text)}
                      onCommitEdit={() => setEditingTextId(null)} />
                  ))}
                </View>
              )}
            </GlassCard>
          )}
        </ScrollView>
      )}

      {/* Bottom scrim — fades the screen background from solid (under the
          composer + tab bar) to transparent above the project/priority pills
          so tasks scrolling behind never collide with composer controls.
          pointerEvents=none so it doesn't eat taps. */}
      <LinearGradient
        pointerEvents="none"
        colors={[
          'rgba(13,12,11,0)',
          'rgba(13,12,11,0.55)',
          'rgba(13,12,11,0.88)',
          'rgba(13,12,11,0.98)',
        ]}
        locations={[0, 0.35, 0.7, 1]}
        style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 240 }}
      />

      {/* Composer — always visible. `bottom` is animated manually based on
          keyboard events, since KeyboardAvoidingView's padding math fails for
          absolutely-positioned views that don't reach the screen bottom. */}
      <Animated.View
        style={{ position: 'absolute', left: 0, right: 0, bottom: composerBottom }}>
        <View style={{ marginHorizontal: 12 }}>
          {/* Top row: project selector + priority pills */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6, flexWrap: 'wrap' }}>
            {pickingProject ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <Pressable onPress={leavePickProject} hitSlop={6}
                  style={iconChip}>
                  <X size={12} color={C.textMuted} />
                </Pressable>
                {newProjectInput === null ? (
                  <>
                    {projectsQuick.map(p => (
                      <ProjectPill key={p} label={p}
                        active={normalizeProjectKey(project) === normalizeProjectKey(p)}
                        onPress={() => { toggleProject(p); leavePickProject(); }} />
                    ))}
                    <Pressable onPress={enterNewProject} hitSlop={6}
                      style={[chipBase, { backgroundColor: C.bgOverlay, borderColor: C.borderSubtle, borderWidth: 1 }]}>
                      <Plus size={11} color={C.textMuted} />
                      <Text style={{ fontFamily: F.sansBold, fontSize: 11, color: C.textMuted, letterSpacing: 0.3 }}>New</Text>
                    </Pressable>
                  </>
                ) : (
                  <View style={{
                    flexDirection: 'row', alignItems: 'center', gap: 4,
                    height: 28, paddingHorizontal: 10, borderRadius: 999,
                    backgroundColor: C.goldFaint, borderColor: 'rgba(201,169,97,0.5)', borderWidth: 1,
                  }}>
                    <TextInput
                      ref={newProjectRef} autoFocus
                      value={newProjectInput}
                      onChangeText={setNewProjectInput}
                      onSubmitEditing={submitNewProject}
                      placeholder="Project name"
                      placeholderTextColor={C.textFaint}
                      returnKeyType="done" selectionColor={C.gold}
                      style={{ fontFamily: F.sansBold, fontSize: 11, color: C.textPrimary, minWidth: 90, padding: 0 }}
                    />
                    <Pressable onPress={submitNewProject} hitSlop={4}>
                      <CheckIcon size={11} color={C.gold} />
                    </Pressable>
                    <Pressable onPress={cancelNewProject} hitSlop={4}>
                      <X size={11} color={C.textMuted} />
                    </Pressable>
                  </View>
                )}
              </View>
            ) : (
              <Pressable onPress={enterPickProject} hitSlop={6}
                style={[chipBase, {
                  backgroundColor: project ? C.goldFaint : C.bgOverlay,
                  borderColor: project ? 'rgba(201,169,97,0.5)' : C.borderSubtle, borderWidth: 1,
                }]}>
                {project ? null : <Plus size={11} color={C.textMuted} />}
                <Text style={{
                  fontFamily: F.sansBold, fontSize: 11,
                  color: project ? C.gold : C.textMuted, letterSpacing: 0.3,
                }}>
                  {project || 'Add project'}
                </Text>
              </Pressable>
            )}

            <View style={{ flex: 1 }} />

            {/* Priority pills — hidden while the composer is in project-pick
                or new-project mode so the row stays focused on one decision. */}
            {!pickingProject && newProjectInput === null && (
              <View style={{ flexDirection: 'row', gap: 4 }}>
                {PRIS.map(p => (
                  <PriPill key={p} label={PRI_LABEL[p]} accent={PRI_ACCENT[p]}
                    active={pri === p} onPress={() => togglePri(p)} />
                ))}
              </View>
            )}
          </View>

          {/* Input row */}
          <BlurView intensity={50} tint="dark" style={{
            borderRadius: 28, overflow: 'hidden',
            borderColor: C.borderMid, borderWidth: 1,
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', padding: 8, paddingLeft: 14, gap: 10 }}>
              <TextInput
                ref={inputRef}
                value={draft}
                onChangeText={setDraft}
                onSubmitEditing={send}
                placeholder="Capture a task…"
                placeholderTextColor={C.textMuted}
                returnKeyType="send"
                blurOnSubmit={true}
                selectionColor={C.gold}
                style={{ flex: 1, fontFamily: F.sans, fontSize: 14, color: C.textPrimary, paddingVertical: 8 }}
              />
              <VoiceDictationButton
                onTranscript={(text) => setDraft(d => appendTranscript(d, text))}
              />
              <Pressable onPress={send} disabled={!draft.trim()} style={{
                width: 38, height: 38, borderRadius: 19, backgroundColor: C.gold,
                opacity: !draft.trim() ? 0.35 : 1,
                alignItems: 'center', justifyContent: 'center',
                shadowColor: '#E8C275', shadowOpacity: draft.trim() ? 0.4 : 0, shadowRadius: 14,
              }}>
                <ArrowUp size={17} color={C.bgBase} strokeWidth={2.4} />
              </Pressable>
            </View>
          </BlurView>
        </View>
      </Animated.View>
    </SafeAreaView>
  );
}

// ─── Sub-components ──────────────────────────────────────

const PRI_SUBTITLE: Record<Pri, string> = {
  urgent:    'Move on this first',
  important: 'Worth doing this week',
  later:     'For later',
};

function PrioritySection({
  pri, tasks, confirmDeleteId, restoredId, editingTextId, reduceMotion,
  expandedActionsId, expandedSub, projectsQuick,
  onToggle, onDelete, onStartEdit, onToggleActions, onToggleSub,
  onPickProject, onPickPri, onEditText, onCommitEdit, showOverloadWarning,
}: {
  pri: Pri;
  tasks: Task[];
  confirmDeleteId: string | null;
  restoredId: string | null;
  editingTextId: string | null;
  reduceMotion: boolean;
  expandedActionsId: string | null;
  expandedSub: null | 'folder' | 'priority';
  projectsQuick: string[];
  onToggle: (t: Task) => void;
  onDelete: (t: Task) => void;
  onStartEdit: (t: Task) => void;
  onToggleActions: (id: string) => void;
  onToggleSub: (which: 'folder' | 'priority') => void;
  onPickProject: (t: Task, project: string | null) => void;
  onPickPri: (t: Task, pri: Pri) => void;
  onEditText: (t: Task, text: string) => void;
  onCommitEdit: () => void;
  showOverloadWarning?: boolean;
}) {
  const [expanded, setExpanded] = useState(true);

  // Unprojected tasks render plainly inside the section (no "Inbox" header).
  // Real-project tasks render in subtle labeled subgroups below.
  const unprojected = tasks.filter(t => !t.project);
  const projectGroups = groupByProject(tasks.filter(t => t.project));

  const toggleExpanded = () => {
    Keyboard.dismiss();
    LayoutAnimation.configureNext(ANIM_FADE);
    setExpanded(e => !e);
    hSelection();
  };

  // Collapsed: pill-shaped (large radius, no internal divider).
  // Expanded: card with rounded corners + contained task list.
  return (
    <GlassCard
      radius={expanded ? 16 : 999}
      style={{ marginBottom: 10 }}>
      <Pressable onPress={toggleExpanded} style={({ pressed }) => ({
        flexDirection: 'row', alignItems: 'center', gap: 10,
        paddingHorizontal: expanded ? 14 : 16,
        paddingVertical: expanded ? 12 : 11,
        backgroundColor: pressed ? C.bgOverlay : 'transparent',
      })}>
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: PRI_ACCENT[pri] }} />
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
          <Text style={{ fontFamily: F.sansHeavy, fontSize: 13, color: C.textPrimary, letterSpacing: 0.3 }}>
            {PRI_LABEL[pri]}
          </Text>
          <Text style={{ fontFamily: F.mono, fontSize: 11, color: C.textMuted }}>
            · {tasks.length}
          </Text>
          <Text numberOfLines={1} style={{ fontFamily: F.sans, fontSize: 11, color: C.textFaint, flexShrink: 1 }}>
            — {PRI_SUBTITLE[pri]}
          </Text>
        </View>
        <View style={{ transform: [{ rotate: expanded ? '0deg' : '-90deg' }] }}>
          <ChevronDown size={14} color={C.textMuted} />
        </View>
      </Pressable>

      {expanded && (
        <View>
          {showOverloadWarning && (
            <View style={{
              marginHorizontal: 14, marginTop: 6, marginBottom: 6,
              paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10,
              backgroundColor: 'rgba(192,86,67,0.12)', borderColor: 'rgba(192,86,67,0.35)', borderWidth: 1,
            }}>
              <Text style={{ fontFamily: F.sans, fontSize: 11.5, color: C.clay, lineHeight: 16 }}>
                Tienes varias tareas urgentes. Intenta mantener esta lista en 5 o menos.
              </Text>
            </View>
          )}
          {tasks.length === 0 ? (
            <Text style={{
              fontFamily: F.serifItalic, fontSize: 12, color: C.textFaint,
              marginLeft: 22, marginBottom: 14, marginTop: 4,
            }}>
              {pri === 'urgent' ? 'Nothing urgent.' : pri === 'important' ? 'Nothing important right now.' : 'Nothing parked for later.'}
            </Text>
          ) : (
            <>
              {/* Unprojected — flat list, no header */}
              <Subgroup
                tasks={unprojected}
                confirmDeleteId={confirmDeleteId}
                restoredId={restoredId}
                reduceMotion={reduceMotion}
                editingTextId={editingTextId}
                expandedActionsId={expandedActionsId}
                expandedSub={expandedSub}
                projectsQuick={projectsQuick}
                onToggle={onToggle} onDelete={onDelete}
                onStartEdit={onStartEdit}
                onToggleActions={onToggleActions}
                onToggleSub={onToggleSub}
                onPickProject={onPickProject}
                onPickPri={onPickPri}
                onEditText={onEditText} onCommitEdit={onCommitEdit}
              />
              {/* Project subgroups */}
              {projectGroups.map(g => (
                <View key={g.label}>
                  {/* Divider above the project label when there's content before it */}
                  {unprojected.length > 0 && (
                    <View style={{ height: 1, backgroundColor: C.borderSubtle }} />
                  )}
                  <Text style={{
                    fontFamily: F.sansBold, fontSize: 9.5, color: C.textFaint,
                    letterSpacing: 1.6, paddingHorizontal: 22, paddingTop: 12, paddingBottom: 6,
                    textTransform: 'uppercase',
                  }}>
                    {g.label}
                  </Text>
                  <Subgroup
                    tasks={g.tasks}
                    confirmDeleteId={confirmDeleteId}
                    restoredId={restoredId}
                    reduceMotion={reduceMotion}
                    editingTextId={editingTextId}
                    expandedActionsId={expandedActionsId}
                    expandedSub={expandedSub}
                    projectsQuick={projectsQuick}
                    onToggle={onToggle} onDelete={onDelete}
                    onStartEdit={onStartEdit}
                    onToggleActions={onToggleActions}
                    onToggleSub={onToggleSub}
                    onPickProject={onPickProject}
                    onPickPri={onPickPri}
                    onEditText={onEditText} onCommitEdit={onCommitEdit}
                  />
                </View>
              ))}
            </>
          )}
        </View>
      )}
    </GlassCard>
  );
}

// Subgroup — renders a list of tasks that share the same priority + project.
function Subgroup({
  tasks, confirmDeleteId, restoredId, reduceMotion, editingTextId,
  expandedActionsId, expandedSub, projectsQuick,
  onToggle, onDelete, onStartEdit, onToggleActions, onToggleSub,
  onPickProject, onPickPri, onEditText, onCommitEdit,
}: {
  tasks: Task[];
  confirmDeleteId: string | null;
  restoredId: string | null;
  reduceMotion: boolean;
  editingTextId: string | null;
  expandedActionsId: string | null;
  expandedSub: null | 'folder' | 'priority';
  projectsQuick: string[];
  onToggle: (t: Task) => void;
  onDelete: (t: Task) => void;
  onStartEdit: (t: Task) => void;
  onToggleActions: (id: string) => void;
  onToggleSub: (which: 'folder' | 'priority') => void;
  onPickProject: (t: Task, project: string | null) => void;
  onPickPri: (t: Task, pri: Pri) => void;
  onEditText: (t: Task, text: string) => void;
  onCommitEdit: () => void;
}) {
  if (tasks.length === 0) return null;
  return (
    <>
      {tasks.map((t, i) => (
        <TaskRow key={t.id} task={t}
          isLast={i === tasks.length - 1}
          confirming={confirmDeleteId === t.id}
          restored={restoredId === t.id}
          reduceMotion={reduceMotion}
          editingText={editingTextId === t.id}
          expandedActions={expandedActionsId === t.id}
          expandedSub={expandedActionsId === t.id ? expandedSub : null}
          projectsQuick={projectsQuick}
          onToggle={() => onToggle(t)}
          onDelete={() => onDelete(t)}
          onStartEdit={() => onStartEdit(t)}
          onToggleActions={() => onToggleActions(t.id)}
          onToggleSub={onToggleSub}
          onPickProject={(p) => onPickProject(t, p)}
          onPickPri={(p) => onPickPri(t, p)}
          onEditText={(text) => onEditText(t, text)}
          onCommitEdit={onCommitEdit} />
      ))}
    </>
  );
}

function TaskRow({
  task, isLast, confirming, restored, reduceMotion, editingText,
  expandedActions, expandedSub, projectsQuick,
  onToggle, onDelete, onStartEdit, onToggleActions, onToggleSub,
  onPickProject, onPickPri, onEditText, onCommitEdit,
}: {
  task: Task;
  isLast: boolean;
  confirming: boolean;
  restored: boolean;
  reduceMotion: boolean;
  editingText: boolean;
  expandedActions: boolean;
  expandedSub: null | 'folder' | 'priority';
  projectsQuick: string[];
  onToggle: () => void;
  onDelete: () => void;
  onStartEdit: () => void;
  onToggleActions: () => void;
  onToggleSub: (which: 'folder' | 'priority') => void;
  onPickProject: (project: string | null) => void;
  onPickPri: (pri: Pri) => void;
  onEditText: (text: string) => void;
  onCommitEdit: () => void;
}) {
  const [draft, setDraft] = useState(task.text);
  useEffect(() => { setDraft(task.text); }, [task.text]);

  // Gold "I'm here" hint — mirrors the web `vyb-task-moved` keyframes:
  //   0% transparent → 18% strong → 55% softer → 100% transparent.
  // Runs whenever `restored` flips true (create, uncomplete, move).
  const glow = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!restored) return;
    if (reduceMotion) { glow.setValue(0); return; }
    glow.setValue(0);
    Animated.sequence([
      Animated.timing(glow, { toValue: 1,   duration: 320, easing: VYB_EASE, useNativeDriver: true }),
      Animated.timing(glow, { toValue: 0.6, duration: 660, easing: VYB_EASE, useNativeDriver: true }),
      Animated.timing(glow, { toValue: 0,   duration: 820, easing: VYB_EASE, useNativeDriver: true }),
    ]).start();
  }, [restored, reduceMotion]);

  const commit = () => {
    onCommitEdit();
    if (draft.trim() && draft.trim() !== task.text) onEditText(draft);
  };

  // Quick-action group fade+slide. translateX starts negative so the icons
  // feel like they slid out *from* the dots position. Mounted is held through
  // the close animation so we don't snap-collapse.
  const actionsAnim = useRef(new Animated.Value(expandedActions ? 1 : 0)).current;
  const [actionsMounted, setActionsMounted] = useState(expandedActions);
  useEffect(() => {
    if (expandedActions) {
      setActionsMounted(true);
      Animated.timing(actionsAnim, {
        toValue: 1, duration: 200, easing: VYB_EASE,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(actionsAnim, {
        toValue: 0, duration: 140, easing: VYB_EASE,
        useNativeDriver: true,
      }).start(({ finished }) => { if (finished) setActionsMounted(false); });
    }
  }, [expandedActions]);

  // We show the *full* list (including the current selection) so the user can
  // see what's selected. Tapping the current one is a no-op that just closes
  // the selector — handled at the call site.
  const currentProjectKey = normalizeProjectKey(task.project);

  // Tap-handlers that short-circuit when the user picks the current value.
  // Closing the sub-mode happens by toggling the same sub-mode off.
  const pickProjectSafe = (p: string | null) => {
    const sameKey = normalizeProjectKey(p) === currentProjectKey;
    if (sameKey) { onToggleSub('folder'); return; }
    onPickProject(p);
  };
  const pickPriSafe = (p: Pri) => {
    if (p === task.pri) { onToggleSub('priority'); return; }
    onPickPri(p);
  };

  // When the row is in quick-action / sub-mode, the right side gets denser, so
  // we truncate the title to one line to leave space.
  const titleLines = expandedActions ? 1 : 3;

  return (
    // Habits-style row: tap text to rename; tap ⋯ to flip the right side into
    // compact icons. All quick actions live in the same horizontal action area.
    <View style={{
      position: 'relative',
      paddingHorizontal: 22, paddingVertical: 13,
      backgroundColor: confirming ? 'rgba(192,86,67,0.10)' : 'transparent',
      opacity: task.done ? 0.55 : 1,
    }}>
      {/* Gold pulse overlay — pinned to the row bounds. */}
      <Animated.View pointerEvents="none" style={{
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: VYB_GOLD_GLOW,
        opacity: glow.interpolate({ inputRange: [0, 1], outputRange: [0, 0.18] }),
      }} />

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        {/* Shared completion circle — gold fill + check pop, same as Habits + Dashboard. */}
        <VYBCheckCircle checked={task.done} onPress={onToggle} />

        {/* Tap text → inline rename. flexShrink so the right action area gets
            priority when there's not enough room. */}
        <Pressable style={{ flex: 1, flexShrink: 1 }} onPress={editingText ? undefined : onStartEdit}>
          {editingText ? (
            <TextInput
              value={draft} onChangeText={setDraft}
              onBlur={commit} onSubmitEditing={commit}
              autoFocus selectionColor={C.gold}
              style={{ fontFamily: F.sans, fontSize: 14, color: C.textPrimary, padding: 0 }}
            />
          ) : (
            <Text numberOfLines={titleLines} style={{
              fontFamily: F.sans, fontSize: 14, color: C.textPrimary,
              textDecorationLine: task.done ? 'line-through' : 'none',
            }}>{task.text}</Text>
          )}
          {task.due_date && !expandedActions && (
            <Text style={{ fontFamily: F.mono, fontSize: 10.5, color: C.textMuted, marginTop: 3 }}>
              {formatDue(task.due_date)}
            </Text>
          )}
        </Pressable>

        {/* ─── ACTION AREA — right side. ───
            The ⋯ trigger stays at a fixed position and is intentionally subtle
            (no circle background) so it never reads as a CTA. The folder /
            priority / trash icons slide+fade in to its left when expanded,
            making it feel like the same dots are expanding into actions. */}
        {!expandedSub && (
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            {actionsMounted && (
              <Animated.View
                pointerEvents={expandedActions ? 'auto' : 'none'}
                style={{
                  flexDirection: 'row', alignItems: 'center', gap: 4,
                  marginRight: 6,
                  opacity: actionsAnim,
                  transform: [{
                    translateX: actionsAnim.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }),
                  }],
                }}>
                <Pressable onPress={() => onToggleSub('folder')} hitSlop={6}
                  style={iconBtn(false)}>
                  <Folder size={13} color={C.textSecondary} />
                </Pressable>
                <Pressable onPress={() => onToggleSub('priority')} hitSlop={6}
                  style={iconBtn(false)}>
                  <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: PRI_ACCENT[task.pri] }} />
                </Pressable>
                {/* Visual separator + extra room so trash isn't a mis-tap. */}
                <View style={{ width: 1, height: 16, backgroundColor: C.borderSubtle, opacity: 0.55, marginHorizontal: 6 }} />
                <Pressable onPress={onDelete} hitSlop={6}
                  style={{
                    width: 28, height: 28, borderRadius: 14,
                    alignItems: 'center', justifyContent: 'center',
                    backgroundColor: confirming ? 'rgba(192,86,67,0.18)' : C.bgOverlay,
                    borderColor: confirming ? 'rgba(192,86,67,0.5)' : C.borderSubtle, borderWidth: 1,
                  }}>
                  <Trash2 size={12} color={confirming ? C.clay : C.textFaint} />
                </Pressable>
              </Animated.View>
            )}

            <Pressable onPress={onToggleActions} hitSlop={10}
              style={{ paddingHorizontal: 6, paddingVertical: 8 }}>
              <MoreHorizontal size={16} color={expandedActions ? C.textSecondary : C.textFaint} />
            </Pressable>
          </View>
        )}

        {/* Folder sub-mode: full project list, current highlighted. Tapping
            the current selection closes the selector without mutating. */}
        {expandedActions && expandedSub === 'folder' && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ gap: 4, alignItems: 'center' }}
            style={{ flexShrink: 1 }}>
            <SmallPill label="No project"
              active={!task.project}
              onPress={() => pickProjectSafe(null)} />
            {projectsQuick.map(p => (
              <SmallPill key={p} label={p}
                active={normalizeProjectKey(p) === currentProjectKey}
                onPress={() => pickProjectSafe(p)} />
            ))}
          </ScrollView>
        )}

        {/* Priority sub-mode: all 3 in canonical order, current highlighted. */}
        {expandedActions && expandedSub === 'priority' && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            {PRIS.map(p => {
              const isCurrent = p === task.pri;
              return (
                <Pressable key={p} onPress={() => pickPriSafe(p)} hitSlop={8}
                  style={{
                    width: 28, height: 28, borderRadius: 14,
                    alignItems: 'center', justifyContent: 'center',
                    backgroundColor: isCurrent ? C.goldFaint : C.bgOverlay,
                    borderColor: isCurrent ? 'rgba(201,169,97,0.6)' : C.borderSubtle,
                    borderWidth: isCurrent ? 1.5 : 1,
                  }}>
                  <View style={{ width: 11, height: 11, borderRadius: 6, backgroundColor: PRI_ACCENT[p] }} />
                </Pressable>
              );
            })}
          </View>
        )}
      </View>
    </View>
  );
}

// Small inline pill used inside row sub-lists (project picker).
function SmallPill({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} hitSlop={4} style={{
      height: 28, paddingHorizontal: 12, borderRadius: 999,
      backgroundColor: active ? C.goldFaint : C.bgOverlay,
      borderColor: active ? 'rgba(201,169,97,0.5)' : C.borderSubtle, borderWidth: 1,
      justifyContent: 'center',
    }}>
      <Text numberOfLines={1} style={{
        fontFamily: F.sansBold, fontSize: 11,
        color: active ? C.gold : C.textSecondary, letterSpacing: 0.3,
      }}>{label}</Text>
    </Pressable>
  );
}

// Compact 28-circle button used in the quick-action area.
function iconBtn(active: boolean) {
  return {
    width: 28, height: 28, borderRadius: 14,
    alignItems: 'center' as const, justifyContent: 'center' as const,
    backgroundColor: active ? C.goldFaint : C.bgOverlay,
    borderColor: active ? 'rgba(201,169,97,0.5)' : C.borderSubtle, borderWidth: 1,
  };
}

// Groups completed tasks into Today / Yesterday / Earlier based on done_at.
function completedBuckets(list: Task[]): { label: string; tasks: Task[] }[] {
  const today = new Date(); today.setHours(0,0,0,0);
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
  const todayBucket: Task[]  = [];
  const yestBucket:  Task[]  = [];
  const earlier:     Task[]  = [];
  for (const t of list) {
    if (!t.done_at) { earlier.push(t); continue; }
    const d = new Date(t.done_at); d.setHours(0,0,0,0);
    if (d.getTime() === today.getTime()) todayBucket.push(t);
    else if (d.getTime() === yesterday.getTime()) yestBucket.push(t);
    else earlier.push(t);
  }
  return [
    { label: 'Today',     tasks: todayBucket },
    { label: 'Yesterday', tasks: yestBucket },
    { label: 'Earlier',   tasks: earlier },
  ].filter(b => b.tasks.length > 0);
}

function PriPill({ label, accent, active, onPress }: {
  label: string; accent: string; active: boolean; onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} hitSlop={4} style={{
      paddingHorizontal: 10, height: 28, borderRadius: 999,
      backgroundColor: active ? C.goldFaint : C.bgOverlay,
      borderColor: active ? accent : C.borderSubtle, borderWidth: 1,
      alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 5,
    }}>
      <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: accent }} />
      <Text style={{
        fontFamily: F.sansBold, fontSize: 10.5,
        color: active ? C.textPrimary : C.textSecondary, letterSpacing: 0.3,
      }}>{label}</Text>
    </Pressable>
  );
}

function ProjectPill({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} hitSlop={4} style={[chipBase, {
      backgroundColor: active ? C.goldFaint : C.bgOverlay,
      borderColor: active ? 'rgba(201,169,97,0.5)' : C.borderSubtle, borderWidth: 1,
    }]}>
      <Text numberOfLines={1} style={{
        fontFamily: F.sansBold, fontSize: 11,
        color: active ? C.gold : C.textSecondary, letterSpacing: 0.3,
      }}>{label}</Text>
    </Pressable>
  );
}

function FilterChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={{
      paddingHorizontal: 12, height: 28, borderRadius: 999,
      backgroundColor: active ? C.goldFaint : C.bgOverlay,
      borderColor: active ? 'rgba(201,169,97,0.45)' : C.borderSubtle, borderWidth: 1,
      alignItems: 'center', justifyContent: 'center',
    }}>
      <Text style={{ fontFamily: F.sansBold, fontSize: 11, color: active ? C.gold : C.textSecondary, letterSpacing: 0.3 }}>
        {label}
      </Text>
    </Pressable>
  );
}

function formatDue(iso: string): string {
  const d = new Date(iso);
  const today = new Date(); today.setHours(0,0,0,0);
  const day = new Date(d); day.setHours(0,0,0,0);
  const diff = Math.round((day.getTime() - today.getTime()) / 86400000);
  if (diff === 0) return 'today';
  if (diff === 1) return 'tomorrow';
  if (diff === -1) return 'yesterday';
  if (diff > 1 && diff < 7) return `in ${diff}d`;
  if (diff < -1) return `${-diff}d ago`;
  return d.toLocaleDateString();
}

const chipBase = {
  paddingHorizontal: 10, height: 28, borderRadius: 999,
  flexDirection: 'row' as const, alignItems: 'center' as const, gap: 4,
  justifyContent: 'center' as const,
};
const iconChip = {
  width: 28, height: 28, borderRadius: 14,
  backgroundColor: C.bgOverlay, borderColor: C.borderSubtle, borderWidth: 1,
  alignItems: 'center' as const, justifyContent: 'center' as const,
};
