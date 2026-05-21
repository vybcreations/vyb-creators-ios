import React, { useState, useMemo, useEffect, useRef } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, RefreshControl, LayoutAnimation, Platform, UIManager, Animated, Easing, Dimensions } from 'react-native';
import ConfettiCannon from 'react-native-confetti-cannon';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Plus, Flame, MoreHorizontal, Pencil, ArrowRight, Trash2, ChevronDown } from 'lucide-react-native';
import { Tx } from '../components/primitives';
import { ActionMenu } from '../components/ActionMenu';
import { ScreenAtmosphere } from '../components/ScreenAtmosphere';
import { AnimatedHabitTitle } from '../components/AnimatedHabitTitle';
import {
  VYBTextAnimate, VYBScreenHeader, VYBCard, VYBProgressRing, VYBCheckCircle,
} from '../components/ui';
import { colors as C, fonts as F } from '../theme';
import { useAuth } from '../lib/auth';
import { useHabits, toggleCheckin, HabitWithStatus, HabitArea, AreaWithHabits, colorToHex, updateHabit, deleteHabit } from '../lib/habits';
import { hLight, hSuccess } from '../lib/haptics';
import { AreaEditorSheet } from './habits/AreaEditorSheet';
import { HabitEditorSheet } from './habits/HabitEditorSheet';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

// Editorial gold gradient for celebration confetti — deep gold → bright gold → cream.
const GOLD_PALETTE = ['#8C7340', '#A88944', '#C9A961', '#D4B57A', '#E8C275', '#F4DCA1', '#FAFAF8'];

const SPRING_LAYOUT: any = {
  duration: 380,
  create: { type: 'easeInEaseOut', property: 'opacity' },
  update: { type: 'spring', springDamping: 0.75 },
  delete: { type: 'easeInEaseOut', property: 'opacity' },
};

export function HabitsScreen() {
  const { session } = useAuth();
  const { areas, loading, refresh } = useHabits();
  const [editMode, setEditMode] = useState(false);
  const [areaSheetOpen, setAreaSheetOpen] = useState(false);
  const [editingArea, setEditingArea] = useState<HabitArea | undefined>();
  const [habitSheetOpen, setHabitSheetOpen] = useState(false);
  const [habitSheetAreaId, setHabitSheetAreaId] = useState<string | null>(null);
  const [editingHabit, setEditingHabit] = useState<HabitWithStatus | undefined>();
  const [habitMenuTarget, setHabitMenuTarget] = useState<HabitWithStatus | null>(null);
  const [extrasOpen, setExtrasOpen] = useState(false);
  const [confettiVisible, setConfettiVisible] = useState(false);
  const [confettiNonce, setConfettiNonce] = useState(0);
  const celebrationOpacity = useRef(new Animated.Value(0)).current;
  const wasAllDoneRef = useRef(false);

  useFocusEffect(React.useCallback(() => { refresh(); }, [refresh]));

  // Animate area/habit changes
  const animatedRefresh = async () => {
    LayoutAnimation.configureNext(SPRING_LAYOUT);
    await refresh();
  };

  // Animate edit mode toggle
  const toggleEdit = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setEditMode(e => !e);
  };

  const allHabits = useMemo(() => areas.flatMap(a => a.habits), [areas]);
  const todayScheduled = allHabits.filter(h => h.todayScheduled);
  const todayDone      = todayScheduled.filter(h => h.todayDone);
  const dailyPct       = todayScheduled.length ? Math.round((todayDone.length / todayScheduled.length) * 100) : 0;
  const extras         = allHabits.filter(h => !h.todayScheduled);
  const extrasDone     = extras.filter(h => h.todayDone).length;

  // Areas filtered to only their scheduled habits (extras live in their own section).
  const visibleAreas = useMemo(() =>
    areas
      .map(a => ({ ...a, habits: a.habits.filter(h => h.todayScheduled) }))
      .filter(a => a.habits.length > 0 || a.id !== '__orphan__'),
    [areas]
  );

  // Fire confetti + message the moment we transition to "all done" today.
  // Confetti stays mounted longer than the card so the fall + fadeOut completes.
  useEffect(() => {
    const allDone = todayScheduled.length > 0 && todayDone.length === todayScheduled.length;
    if (allDone && !wasAllDoneRef.current) {
      wasAllDoneRef.current = true;
      setConfettiVisible(true);
      setConfettiNonce(n => n + 1);
      Animated.sequence([
        Animated.timing(celebrationOpacity, { toValue: 1, duration: 280, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.delay(2000),
        Animated.timing(celebrationOpacity, { toValue: 0, duration: 480, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
      ]).start();
      // Keep confetti mounted long enough to complete fall (~3800ms) + fadeOut buffer
      const t = setTimeout(() => setConfettiVisible(false), 4600);
      return () => clearTimeout(t);
    } else if (!allDone) {
      wasAllDoneRef.current = false;
    }
  }, [todayScheduled.length, todayDone.length, celebrationOpacity]);

  const onToggle = async (h: HabitWithStatus) => {
    if (!session) return;
    const becomingDone = !h.todayDone;
    // Tactile feedback fires immediately so the user feels the tap before the
    // network round-trip. Per-row visual animation lives inside HabitRow,
    // driven by the `habit.todayDone` prop change.
    if (becomingDone) hSuccess(); else hLight();
    LayoutAnimation.configureNext({
      duration: 240,
      update: { type: 'easeInEaseOut' },
    });
    await toggleCheckin(h.id, session.user.id, becomingDone);
    refresh();
  };

  const openHabitSheet = (areaId: string | null) => {
    setEditingHabit(undefined);
    setHabitSheetAreaId(areaId);
    setHabitSheetOpen(true);
  };

  const openEditHabit = (h: HabitWithStatus) => {
    setEditingHabit(h);
    setHabitSheetAreaId(h.area_id);
    setHabitSheetOpen(true);
  };

  const moveHabit = async (h: HabitWithStatus, targetAreaId: string | null) => {
    const targetArea = areas.find(a => a.id === targetAreaId);
    LayoutAnimation.configureNext(SPRING_LAYOUT);
    await updateHabit(h.id, {
      area_id: targetAreaId,
      color: targetArea?.color || 'gold',
    });
    refresh();
  };

  const removeHabit = async (h: HabitWithStatus) => {
    LayoutAnimation.configureNext({ duration: 280, delete: { type: 'easeInEaseOut', property: 'opacity' } });
    await deleteHabit(h.id);
    refresh();
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bgBase }} edges={['top']}>
      <ScreenAtmosphere />
      {/* Header */}
      <VYBScreenHeader
        title="Habits"
        subtitle={todayScheduled.length === 0
          ? 'no habits today'
          : `${todayDone.length} of ${todayScheduled.length} today`}
        rightAction={areas.length > 0 ? (
          <Pressable onPress={toggleEdit} hitSlop={10}>
            <Text style={{
              fontFamily: F.sansBold, fontSize: 14,
              color: editMode ? C.gold : C.textSecondary,
              letterSpacing: 0.2,
            }}>
              {editMode ? 'Done' : 'Edit'}
            </Text>
          </Pressable>
        ) : undefined}
      />

      {loading && areas.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={C.gold} />
        </View>
      ) : areas.length === 0 ? (
        <EmptyState onAddArea={() => { setEditingArea(undefined); setAreaSheetOpen(true); }} />
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingBottom: 140 }}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={C.gold} />}>

          {/* Today summary — kept compact and minimal. Progress lives on
              Dashboard/Profile; this is just a calm header for the list. */}
          {todayScheduled.length > 0 && (
            <View style={{ paddingHorizontal: 16, paddingTop: 4, paddingBottom: 14 }}>
              <VYBCard level="widget" accent="gold" padding={18}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 18 }}>
                  <VYBProgressRing
                    size={76} strokeWidth={6}
                    done={todayDone.length} total={todayScheduled.length}
                  >
                    <Text style={{ fontFamily: F.monoBold, fontSize: 18, color: C.textPrimary, letterSpacing: -0.5 }}>
                      {dailyPct}%
                    </Text>
                  </VYBProgressRing>
                  <View style={{ flex: 1 }}>
                    <Text style={Tx.label({})}>TODAY</Text>
                    <Text style={{ fontFamily: F.serifItalic, fontSize: 22, color: C.textPrimary, marginTop: 4, letterSpacing: -0.4, lineHeight: 26 }}>
                      {todayDone.length === todayScheduled.length ? 'All done. Quietly proud.' : `${todayDone.length} of ${todayScheduled.length} done`}
                    </Text>
                  </View>
                </View>
              </VYBCard>
            </View>
          )}

          {visibleAreas.map(area => (
            <AreaSection
              key={area.id}
              area={area}
              editMode={editMode}
              onAddHabit={() => openHabitSheet(area.id === '__orphan__' ? null : area.id)}
              onEditArea={area.id === '__orphan__' ? undefined : () => { setEditingArea(area); setAreaSheetOpen(true); }}
              onToggleHabit={onToggle}
              onHabitPress={openEditHabit}
              onHabitMenu={setHabitMenuTarget}
            />
          ))}

          {/* Extras — habits not scheduled today */}
          {extras.length > 0 && (
            <View style={{ marginTop: 18 }}>
              <Pressable
                onPress={() => { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setExtrasOpen(o => !o); }}
                style={{
                  flexDirection: 'row', alignItems: 'center',
                  paddingHorizontal: 22, paddingVertical: 12,
                  borderTopColor: C.borderSubtle, borderTopWidth: 1,
                }}>
                <Text style={{ flex: 1, fontFamily: F.sansBold, fontSize: 12, color: C.textMuted, letterSpacing: 1.4, textTransform: 'uppercase' }}>
                  Extras · {extras.length}{extrasDone > 0 ? ` · ${extrasDone} done` : ''}
                </Text>
                <Animated.View style={{ transform: [{ rotate: extrasOpen ? '180deg' : '0deg' }] }}>
                  <ChevronDown size={16} color={C.textMuted} />
                </Animated.View>
              </Pressable>
              {!extrasOpen && (
                <Text style={{ fontFamily: F.serifItalic, fontSize: 13, color: C.textMuted, paddingHorizontal: 22, paddingBottom: 10, lineHeight: 18 }}>
                  Not scheduled today — but free to do. Doesn't affect streaks.
                </Text>
              )}
              {extrasOpen && extras.map((h, i) => {
                const areaForHabit = areas.find(a => a.id === h.area_id);
                return (
                  <HabitRow
                    key={h.id}
                    habit={h}
                    areaColor={areaForHabit?.color || h.color}
                    isLast={i === extras.length - 1}
                    isExtra
                    editMode={editMode}
                    onToggle={() => onToggle(h)}
                    onPress={() => openEditHabit(h)}
                    onLongPress={() => setHabitMenuTarget(h)}
                  />
                );
              })}
            </View>
          )}

          {/* + New area — only in edit mode */}
          {editMode && (
            <Pressable
              onPress={() => { setEditingArea(undefined); setAreaSheetOpen(true); }}
              style={{
                marginTop: 12, marginHorizontal: 22, paddingVertical: 16,
                borderRadius: 14, borderColor: C.borderMid, borderWidth: 1, borderStyle: 'dashed',
                flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}>
              <Plus size={14} color={C.textMuted} />
              <Text style={{ fontFamily: F.sansBold, fontSize: 12, color: C.textMuted, letterSpacing: 1.2, textTransform: 'uppercase' }}>New area</Text>
            </Pressable>
          )}
        </ScrollView>
      )}

      <AreaEditorSheet
        visible={areaSheetOpen}
        onDismiss={() => setAreaSheetOpen(false)}
        onSaved={animatedRefresh}
        existing={editingArea}
      />
      <HabitEditorSheet
        visible={habitSheetOpen}
        onDismiss={() => setHabitSheetOpen(false)}
        onSaved={animatedRefresh}
        existing={editingHabit}
        defaultAreaId={habitSheetAreaId}
        areas={areas.filter(a => a.id !== '__orphan__')}
      />

      {/* Celebration — two gold confetti cannons converging toward center.
          Stays mounted through full fall so fadeOut completes; gold-only palette. */}
      {confettiVisible && (
        <>
          <ConfettiCannon
            key={`L-${confettiNonce}`}
            count={70}
            origin={{ x: -40, y: SCREEN_H * 0.22 }}
            fadeOut
            autoStart
            fallSpeed={3800}
            explosionSpeed={760}
            colors={GOLD_PALETTE}
          />
          <ConfettiCannon
            key={`R-${confettiNonce}`}
            count={70}
            origin={{ x: SCREEN_W + 40, y: SCREEN_H * 0.22 }}
            fadeOut
            autoStart
            fallSpeed={3800}
            explosionSpeed={760}
            colors={GOLD_PALETTE}
          />
        </>
      )}
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute', top: '38%', left: 0, right: 0, alignItems: 'center',
          opacity: celebrationOpacity,
          transform: [{ translateY: celebrationOpacity.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }],
        }}>
        <View style={{
          paddingHorizontal: 26, paddingVertical: 18, borderRadius: 28,
          backgroundColor: C.bgElevated, borderColor: 'rgba(201,169,97,0.4)', borderWidth: 1,
          shadowColor: '#E8C275', shadowOpacity: 0.6, shadowRadius: 30, shadowOffset: { width: 0, height: 0 },
          alignItems: 'center',
        }}>
          <Text style={{ fontFamily: F.sansBold, fontSize: 10, color: C.gold, letterSpacing: 2.4 }}>TODAY</Text>
          <Text style={{ fontFamily: F.serifItalic, fontSize: 26, color: C.textPrimary, marginTop: 6, letterSpacing: -0.4 }}>
            Daily habits completed
          </Text>
          <Text style={{ fontFamily: F.serifItalic, fontSize: 13, color: C.textMuted, marginTop: 2 }}>
            Quietly proud.
          </Text>
        </View>
      </Animated.View>

      <ActionMenu
        visible={habitMenuTarget !== null}
        onDismiss={() => setHabitMenuTarget(null)}
        title={habitMenuTarget?.name}
        options={(() => {
          const h = habitMenuTarget;
          if (!h) return [];
          const moveOptions = areas
            .filter(a => a.id !== '__orphan__' && a.id !== h.area_id)
            .map(a => {
              const tint = colorToHex(a.color);
              return {
                label: `Move to ${a.name}`,
                icon: <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: tint.primary }} />,
                onPress: () => moveHabit(h, a.id),
              };
            });
          // also offer "move to Unsorted" if currently in an area
          const moveToNone = h.area_id ? [{
            label: 'Move to Unsorted',
            icon: <ArrowRight size={16} color={C.textMuted} />,
            onPress: () => moveHabit(h, null),
          }] : [];
          return [
            { label: 'Edit habit', icon: <Pencil size={16} color={C.textPrimary} />, onPress: () => openEditHabit(h) },
            ...moveOptions,
            ...moveToNone,
            { label: 'Delete habit', destructive: true, icon: <Trash2 size={16} color={C.clay} />, onPress: () => removeHabit(h) },
          ];
        })()}
      />
    </SafeAreaView>
  );
}

function AreaSection({ area, editMode, onAddHabit, onEditArea, onToggleHabit, onHabitPress, onHabitMenu }: {
  area: AreaWithHabits;
  editMode: boolean;
  onAddHabit: () => void;
  onEditArea?: () => void;
  onToggleHabit: (h: HabitWithStatus) => void;
  onHabitPress: (h: HabitWithStatus) => void;
  onHabitMenu: (h: HabitWithStatus) => void;
}) {
  const tint = colorToHex(area.color);
  return (
    <View style={{ marginTop: 6 }}>
      {/* Area header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 22, paddingVertical: 10 }}>
        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: tint.primary, marginRight: 10 }} />
        <Text style={{ flex: 1, fontFamily: F.sansBold, fontSize: 12, color: C.textPrimary, letterSpacing: 1.4, textTransform: 'uppercase' }}>
          {area.name}
        </Text>
        {editMode && onEditArea && (
          <Pressable onPress={onEditArea} style={{ padding: 6 }}>
            <MoreHorizontal size={16} color={C.textMuted} />
          </Pressable>
        )}
      </View>

      {/* Habits list */}
      {area.habits.length === 0 && editMode ? (
        <Pressable onPress={onAddHabit} style={{
          marginHorizontal: 22, paddingVertical: 14, paddingHorizontal: 14,
          borderRadius: 12, borderColor: C.borderSubtle, borderWidth: 1, borderStyle: 'dashed',
          flexDirection: 'row', alignItems: 'center', gap: 10,
        }}>
          <Plus size={14} color={tint.primary} />
          <Text style={{ fontFamily: F.sans, fontSize: 13, color: C.textMuted, flex: 1 }}>
            No habits yet. Add one.
          </Text>
        </Pressable>
      ) : (
        <View>
          {area.habits.map((h, i) => (
            <HabitRow
              key={h.id}
              habit={h}
              areaColor={area.color}
              isLast={i === area.habits.length - 1 && !editMode}
              editMode={editMode}
              onToggle={() => onToggleHabit(h)}
              onPress={() => onHabitPress(h)}
              onLongPress={() => onHabitMenu(h)}
            />
          ))}
          {editMode && (
            <Pressable onPress={onAddHabit} style={{
              paddingHorizontal: 22, paddingVertical: 14,
              flexDirection: 'row', alignItems: 'center', gap: 10,
              borderBottomColor: C.borderSubtle, borderBottomWidth: 1,
            }}>
              <Plus size={14} color={tint.primary} />
              <Text style={{ fontFamily: F.sansBold, fontSize: 13, color: tint.primary, letterSpacing: 0.3 }}>Add habit</Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}

function HabitRow({ habit, areaColor, isLast, isExtra, editMode, onToggle, onPress, onLongPress }: {
  habit: HabitWithStatus;
  areaColor: import('../lib/habits').HabitColor;
  isLast: boolean;
  isExtra?: boolean;
  editMode?: boolean;
  onToggle: () => void;
  onPress: () => void;
  onLongPress: () => void;
}) {
  const tint = colorToHex(areaColor);
  const isHot = habit.streak >= 7;

  return (
    <Pressable
      onPress={editMode ? onPress : undefined}
      onLongPress={onLongPress}
      delayLongPress={350}
      style={{
        paddingHorizontal: 22, paddingVertical: 14,
        borderBottomColor: C.borderSubtle, borderBottomWidth: isLast ? 0 : 1,
        flexDirection: 'row', alignItems: 'center', gap: 14,
      }}>
      {/* Shared check circle — gold fill + check pop, same animation as Dashboard. */}
      <VYBCheckCircle checked={habit.todayDone} onPress={onToggle} />

      <View style={{ flex: 1 }}>
        {/* Title + strikethrough — measured-width line, shared with Dashboard. */}
        <AnimatedHabitTitle
          name={habit.name}
          done={habit.todayDone}
          textStyle={{ fontFamily: F.sansBold, fontSize: 14, color: C.textPrimary }}
        />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 }}>
          <Flame size={11} color={isHot ? tint.primary : C.textFaint} />
          <Text style={{ fontFamily: F.mono, fontSize: 10.5, color: isHot ? tint.primary : C.textMuted }}>
            {habit.streak} {habit.streak === 1 ? 'day' : 'days'}
          </Text>
          {isExtra && (
            <Text style={{ fontFamily: F.sansLight, fontSize: 11, color: C.textMuted, marginLeft: 8, letterSpacing: 0.4 }}>
              extra
            </Text>
          )}
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: 4, alignItems: 'center' }}>
        {habit.weekDone.map((d, i) => (
          <View key={i} style={{
            width: 7, height: 7, borderRadius: 3.5,
            backgroundColor: d ? tint.primary : C.borderSubtle,
            opacity: d ? 0.95 : 1,
          }} />
        ))}
      </View>
    </Pressable>
  );
}

function EmptyState({ onAddArea }: { onAddArea: () => void }) {
  return (
    <View style={{ flex: 1, paddingHorizontal: 28, alignItems: 'center', justifyContent: 'center' }}>
      <VYBTextAnimate
        text="Build the inner life, one habit at a time."
        type="wordReveal"
        textStyle={{ fontFamily: F.serifItalic, fontSize: 26, color: C.textPrimary, letterSpacing: -0.4 }}
        containerStyle={{ justifyContent: 'center', paddingHorizontal: 8 }}
      />
      <Text style={{ fontFamily: F.sans, fontSize: 13, color: C.textMuted, textAlign: 'center', marginTop: 14, lineHeight: 20 }}>
        Start with an area — Health, Mind, Business —{'\n'}then add the habits that matter inside it.
      </Text>
      <Pressable onPress={onAddArea} style={{
        marginTop: 28, paddingHorizontal: 22, height: 50, borderRadius: 999,
        backgroundColor: C.gold, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8,
        shadowColor: '#E8C275', shadowOpacity: 0.45, shadowRadius: 24,
      }}>
        <Plus size={16} color={C.bgBase} strokeWidth={2.4} />
        <Text style={{ fontFamily: F.sansBold, fontSize: 14, color: C.bgBase, letterSpacing: 0.3 }}>Create first area</Text>
      </Pressable>
    </View>
  );
}
