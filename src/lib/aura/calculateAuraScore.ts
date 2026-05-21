/**
 * Aura Score (V6) — 0–100 personal momentum signal.
 *
 * Visible pillars (main bars):
 *   Habits · Learning · Tasks · Ideas
 *
 * Internal pillars (kept in score, hidden from main row):
 *   Balance · Rhythm — they nudge the score for spread/consistency but
 *   don't dominate the UI because users can't act on them directly.
 *
 * Weights:
 *   Day:        Habits 45 · Learning 25 · Tasks 15 · Ideas 10 · Rhythm 5
 *   Week/Month: Habits 40 · Learning 25 · Tasks 15 · Ideas 10 · Rhythm 5 · Balance 5
 *
 * Scoring curves (designed so quantity can't inflate the score):
 *   Tasks  — Day: 1=45, 2=80, 3+=100. Priority bonus when context provided.
 *   Ideas  — Day: 1=75, 2=100. Caps grow softly week/month.
 *   Habits — done / planned-this-period × 100, clamped (extras never reduce).
 *   Learn  — max(pages/elapsed-day-goal, sessions/elapsed-half-day-goal × 0.85).
 *   Rhythm — Day: binary. Week/Month: activeDays / elapsedDays.
 *   Balance— Day-bucketed (0/45/80/100). Week/Month: spread + active areas.
 */

export type AuraPeriod = 'day' | 'week' | 'month';
export type TaskPriority = 'urgent' | 'important' | 'later';

export type AuraScoreInput = {
  period: AuraPeriod;
  elapsedDays: number;

  habitsCompleted?: number;
  habitsPlanned?: number;

  pagesRead?: number;
  readingSessions?: number;

  activeDays?: number;

  tasksCompleted?: number;
  ideasCaptured?: number;

  // Optional priority breakdown — when present, urgent/important tasks pull
  // more weight than "later" ones. Falls back to the total cap curve otherwise.
  tasksByPriority?: { urgent?: number; important?: number; later?: number };

  areaActivity?: Record<string, number>;

  // Context used by Next Best Action so it can recommend a real habit/task
  // name instead of generic copy.
  nbaContext?: {
    incompleteHabits?: { id: string; name: string }[];
    openTasks?: { id: string; text: string; pri: TaskPriority }[];
    readingLoggedToday?: boolean;
    ideasCapturedToday?: number;
    hourOfDay?: number;
  };
};

export type NextBestAction = {
  type: 'task' | 'habit' | 'learning' | 'idea' | 'reflection' | 'complete';
  priority: 'urgent' | 'high' | 'important' | 'medium' | 'low' | 'done';
  label: string;
  targetId?: string;
};

export type AuraPartKey =
  | 'habits' | 'learning' | 'tasks' | 'ideas'
  | 'balance' | 'rhythm';

// Pillars surfaced in the main row of bars.
export const VISIBLE_PILLARS: AuraPartKey[] = ['habits', 'learning', 'tasks', 'ideas'];

export type AuraVisualState = 'low' | 'building' | 'stable' | 'unbalanced';

export type AuraScoreResult = {
  score: number;
  label: string;
  message: string;
  nextBestAction: NextBestAction;
  parts: Record<AuraPartKey, number>;
  details: {
    key: AuraPartKey;
    label: string;
    value: number;
    description: string;
    weight: number;
    visible: boolean;
  }[];
  state: AuraVisualState;
  isEmpty: boolean;
};

// ─── helpers ──────────────────────────────────────────────────────────────

const clamp = (v: number, min = 0, max = 100) => Math.max(min, Math.min(max, v));
const scoreFromCap = (v = 0, cap = 1) => clamp((v / Math.max(cap, 1)) * 100);

const calculateHabitsScore = (done = 0, planned = 0) => {
  if (planned <= 0) return done > 0 ? 100 : 50;
  return clamp((done / planned) * 100);
};

// Day tasks: 1→45, 2→80, 3+→100. Priority gives a bonus for urgent/important
// completions when the caller provides a breakdown. Week/Month fall back to
// the standard cap curve.
const calculateTasksScore = (
  period: AuraPeriod,
  total = 0,
  elapsedDays = 1,
  byPriority?: { urgent?: number; important?: number; later?: number },
) => {
  if (period === 'day') {
    if (byPriority) {
      const urgent    = byPriority.urgent    ?? 0;
      const important = byPriority.important ?? 0;
      const later     = byPriority.later     ?? 0;
      // Weighted contribution: urgent 50, important 35, later 20 — capped.
      const weighted = urgent * 50 + important * 35 + later * 20;
      return clamp(weighted);
    }
    if (total <= 0) return 0;
    if (total === 1) return 45;
    if (total === 2) return 80;
    return 100;
  }
  const cap = period === 'week'
    ? Math.min(7,  Math.max(2, elapsedDays))
    : Math.min(24, Math.max(2, elapsedDays));
  return scoreFromCap(total, cap);
};

// Day ideas: 1→75, 2+→100. Week 3–5 → 100. Month softer.
const calculateIdeasScore = (period: AuraPeriod, count = 0, elapsedDays = 1) => {
  if (period === 'day') {
    if (count <= 0) return 0;
    if (count === 1) return 75;
    return 100;
  }
  const cap = period === 'week'
    ? Math.min(4,  Math.max(2, Math.ceil(elapsedDays / 2)))
    : Math.min(14, Math.max(2, Math.ceil(elapsedDays / 3)));
  return scoreFromCap(count, cap);
};

const calculateBalanceScore = (
  areaActivity: Record<string, number> | undefined,
  period: AuraPeriod,
) => {
  if (!areaActivity) return period === 'day' ? 0 : 50;
  const values = Object.values(areaActivity).filter(v => v > 0);
  const activeAreas = values.length;

  if (period === 'day') {
    if (activeAreas === 0) return 0;
    if (activeAreas === 1) return 45;
    if (activeAreas === 2) return 80;
    return 100;
  }
  if (activeAreas === 0) return 35;
  if (activeAreas === 1) return 45;
  const total = values.reduce((s, v) => s + v, 0);
  const maxShare = Math.max(...values.map(v => v / total));
  const spreadScore = clamp((1 - maxShare) * 140);
  const areaScore = clamp((activeAreas / 4) * 100);
  return clamp(spreadScore * 0.6 + areaScore * 0.4);
};

const weightedAverage = (
  parts: { key: AuraPartKey; value: number; weight: number }[],
) => {
  const valid = parts.filter(p => Number.isFinite(p.value));
  const totalWeight = valid.reduce((s, p) => s + p.weight, 0);
  if (totalWeight <= 0) return 0;
  const weighted = valid.reduce((s, p) => s + p.value * p.weight, 0);
  return Math.round(clamp(weighted / totalWeight));
};

const getAuraLabel = (score: number, balance: number) => {
  if (score <= 15) return { label: 'Ready to Start',     message: 'Your aura will grow as you show up. Start with one small win.' };
  if (score <= 35) return { label: 'Warming Up',         message: 'Your system is waking up. One habit today builds the next.' };
  if (balance < 35 && score >= 50)
                   return { label: 'Focused but Narrow', message: 'You are moving, but most of your energy is in one area.' };
  if (score <= 65) return { label: 'Building Momentum',  message: 'Your rhythm is forming. Keep showing up.' };
  if (score <= 82) return { label: 'Strong Rhythm',      message: 'Your system is active and gaining consistency.' };
  return                  { label: 'Stable Aura',        message: 'Your system feels consistent, alive, and balanced.' };
};

const getVisualState = (score: number, balance: number): AuraVisualState => {
  if (balance < 35 && score >= 50) return 'unbalanced';
  if (score <= 25)                  return 'low';
  if (score <= 82)                  return 'building';
  return                                'stable';
};

// Truncate task/habit text to fit the NBA copy line.
const trunc = (s: string, max = 32) => {
  const t = (s || '').trim();
  return t.length > max ? t.slice(0, max - 1) + '…' : t;
};

// Pick the most useful next action. Strict priority (highest first):
//   1. Urgent open task           — biggest lever in the user's day
//   2. Incomplete planned habit   — planned commitments before everything else
//   3. Important open task
//   4. Reading not logged today   — learning pillar
//   5. Ideas not captured today   — low priority; never above anything above
//   6. Late evening + habits done → reflection
//   7. Everything in shape        → keep the rhythm
//
// Period note: Week and Month still pull from today's open data because the
// user can only act *now*. Closing copy adapts to remind them why.
export function getNextBestAction(
  period: AuraPeriod,
  parts: Record<AuraPartKey, number>,
  input: AuraScoreInput,
): NextBestAction {
  const ctx = input.nbaContext;
  const incomplete = ctx?.incompleteHabits || [];
  const tasks      = ctx?.openTasks        || [];
  const urgent     = tasks.find(t => t.pri === 'urgent');
  const important  = tasks.find(t => t.pri === 'important');
  const hour       = ctx?.hourOfDay ?? new Date().getHours();

  const readingLoggedToday = ctx?.readingLoggedToday ?? (parts.learning > 0);
  const ideasCapturedToday = ctx?.ideasCapturedToday ?? 0;
  const habitsDone         = parts.habits >= 95;

  const periodSuffix =
    period === 'day'   ? '' :
    period === 'week'  ? ' (strengthens this week)' :
                         ' (strengthens this month)';
  const withSuffix = (s: string) =>
    period === 'day' ? s : s.replace(/\.$/, '') + periodSuffix + '.';

  // 1. Urgent open task.
  if (urgent) return {
    type: 'task', priority: 'urgent',
    label: withSuffix(`Complete your urgent task: ${trunc(urgent.text)}.`),
    targetId: urgent.id,
  };

  // 2. Incomplete planned habit today.
  if (incomplete.length > 0) {
    const h = incomplete[0];
    const label = incomplete.length === 1
      ? `Complete ${trunc(h.name)} to finish today’s habits.`
      : `Complete ${trunc(h.name)} to keep today on track (${incomplete.length} habits left).`;
    return { type: 'habit', priority: 'high', label: withSuffix(label), targetId: h.id };
  }

  // 3. Important open task.
  if (important) return {
    type: 'task', priority: 'important',
    label: withSuffix(`Move one important task forward: ${trunc(important.text)}.`),
    targetId: important.id,
  };

  // 4. Reading not logged today.
  if (!readingLoggedToday) return {
    type: 'learning', priority: 'medium',
    label: withSuffix('Log a short reading session.'),
  };

  // 5. Ideas not captured today — low priority.
  if (ideasCapturedToday < 1) return {
    type: 'idea', priority: 'low',
    label: withSuffix('Capture one useful idea.'),
  };

  // 6. Late evening + habits done → reflection.
  if (hour >= 19 && habitsDone) return {
    type: 'reflection', priority: 'low',
    label: 'Capture one reflection before closing the day.',
  };

  // 7. Everything in shape.
  const doneCopy =
    period === 'day'  ? 'Your system is alive today. Keep the rhythm tomorrow.' :
    period === 'week' ? 'You are on rhythm this week. Keep showing up.' :
                        'You are on rhythm this month. Keep showing up.';
  return { type: 'complete', priority: 'done', label: doneCopy };
}

export type Mission = {
  id: string;
  type: 'task' | 'habit' | 'learning' | 'reflection' | 'idea' | 'complete';
  priority: 'urgent' | 'high' | 'important' | 'medium' | 'low' | 'done';
  text: string;
  targetId?: string;
};

/**
 * Today's missions — always uses today's open data regardless of the
 * Day/Week/Month toggle in the Aura card. Reads as a short quest list.
 *
 * Priority order:
 *   1. Open urgent tasks      (up to 1)
 *   2. Incomplete planned habits today (up to 2)
 *   3. Open important task
 *   4. Reading not logged today
 *   5. Reflection if late evening + room left
 *   6. Idea — only as filler when nothing else fits
 *
 * Caps at 4 missions.
 */
export function getTodaysMissions(ctx: {
  openTasks?: { id: string; text: string; pri: TaskPriority }[];
  incompleteHabits?: { id: string; name: string }[];
  readingLoggedToday?: boolean;
  ideasCapturedToday?: number;
  hourOfDay?: number;
}): Mission[] {
  const missions: Mission[] = [];
  const tasks = ctx.openTasks || [];
  const habits = ctx.incompleteHabits || [];
  const hour = ctx.hourOfDay ?? new Date().getHours();

  // 1. Urgent task.
  const urgent = tasks.find(t => t.pri === 'urgent');
  if (urgent) missions.push({
    id: `task-${urgent.id}`, type: 'task', priority: 'urgent',
    text: `Complete your urgent task: ${trunc(urgent.text)}.`,
    targetId: urgent.id,
  });

  // 2. Up to two incomplete planned habits today.
  for (const h of habits.slice(0, 2)) {
    missions.push({
      id: `habit-${h.id}`, type: 'habit', priority: 'high',
      text: `Complete ${trunc(h.name)}.`,
      targetId: h.id,
    });
    if (missions.length >= 4) break;
  }

  // 3. Important task.
  const important = tasks.find(t => t.pri === 'important');
  if (important && missions.length < 4) missions.push({
    id: `task-${important.id}`, type: 'task', priority: 'important',
    text: `Move forward: ${trunc(important.text)}.`,
    targetId: important.id,
  });

  // 4. Reading if not logged today.
  if (!ctx.readingLoggedToday && missions.length < 4) missions.push({
    id: 'reading', type: 'learning', priority: 'medium',
    text: 'Read for 15 minutes.',
  });

  // 5. Late-evening reflection — gentle fill, not forced.
  if (missions.length < 3 && hour >= 19) missions.push({
    id: 'reflection', type: 'reflection', priority: 'low',
    text: 'Review today’s progress.',
  });

  // 6. Idea — only as filler, never above the above.
  if (missions.length < 3 && (ctx.ideasCapturedToday ?? 0) < 1) missions.push({
    id: 'idea', type: 'idea', priority: 'low',
    text: 'Capture one useful idea.',
  });

  // All clear.
  if (missions.length === 0) missions.push({
    id: 'complete', type: 'complete', priority: 'done',
    text: 'Your system is alive today. Keep the rhythm tomorrow.',
  });

  return missions.slice(0, 4);
}

// ─── main ─────────────────────────────────────────────────────────────────

export function calculateAuraScore(input: AuraScoreInput): AuraScoreResult {
  const elapsedDays = Math.max(input.elapsedDays || 1, 1);

  const habits = calculateHabitsScore(input.habitsCompleted ?? 0, input.habitsPlanned ?? 0);

  const pageGoalToDate = elapsedDays * 10;
  const learningByPages = scoreFromCap(input.pagesRead ?? 0, pageGoalToDate);
  const sessionGoalToDate = Math.max(1, Math.ceil(elapsedDays / 2));
  const learningBySessions = scoreFromCap(input.readingSessions ?? 0, sessionGoalToDate);
  const learning = Math.max(learningByPages, learningBySessions * 0.85);

  const rhythm = input.period === 'day'
    ? ((input.activeDays ?? 0) > 0 || (input.habitsCompleted ?? 0) > 0
        || (input.tasksCompleted ?? 0) > 0 || (input.ideasCaptured ?? 0) > 0
        || (input.pagesRead ?? 0) > 0 || (input.readingSessions ?? 0) > 0
        ? 100 : 0)
    : clamp(((input.activeDays ?? 0) / elapsedDays) * 100);

  const tasks = calculateTasksScore(input.period, input.tasksCompleted ?? 0, elapsedDays, input.tasksByPriority);
  const ideas = calculateIdeasScore(input.period, input.ideasCaptured ?? 0, elapsedDays);
  const balance = calculateBalanceScore(input.areaActivity, input.period);

  const parts: Record<AuraPartKey, number> = {
    habits:   Math.round(habits),
    learning: Math.round(learning),
    tasks:    Math.round(tasks),
    ideas:    Math.round(ideas),
    balance:  Math.round(balance),
    rhythm:   Math.round(rhythm),
  };

  const weights: Record<AuraPartKey, number> = input.period === 'day'
    ? { habits: 0.45, learning: 0.25, tasks: 0.15, ideas: 0.10, rhythm: 0.05, balance: 0.00 }
    : { habits: 0.40, learning: 0.25, tasks: 0.15, ideas: 0.10, rhythm: 0.05, balance: 0.05 };

  const score = weightedAverage(
    Object.entries(parts).map(([key, value]) => ({
      key: key as AuraPartKey,
      value,
      weight: weights[key as AuraPartKey],
    })),
  );

  const { label, message } = getAuraLabel(score, parts.balance);
  const state = getVisualState(score, parts.balance);

  const isEmpty =
    (input.habitsPlanned ?? 0) === 0 &&
    (input.habitsCompleted ?? 0) === 0 &&
    (input.pagesRead ?? 0) === 0 &&
    (input.readingSessions ?? 0) === 0 &&
    (input.activeDays ?? 0) === 0 &&
    (input.tasksCompleted ?? 0) === 0 &&
    (input.ideasCaptured ?? 0) === 0;

  return {
    score,
    label: isEmpty ? 'Just getting started' : label,
    message: isEmpty ? 'Your aura will grow as you use the app.' : message,
    nextBestAction: getNextBestAction(input.period, parts, input),
    parts,
    state,
    isEmpty,
    details: [
      { key: 'habits',   label: 'Habits',   value: parts.habits,   weight: weights.habits,   visible: true,  description: 'Planned habits completed for this period. Extra habits don’t count against you.' },
      { key: 'learning', label: 'Learning', value: parts.learning, weight: weights.learning, visible: true,  description: 'Reading sessions or pages logged.' },
      { key: 'tasks',    label: 'Tasks',    value: parts.tasks,    weight: weights.tasks,    visible: true,  description: 'Meaningful completed tasks. Capped so the score rewards progress, not task spam.' },
      { key: 'ideas',    label: 'Ideas',    value: parts.ideas,    weight: weights.ideas,    visible: true,  description: 'Useful ideas captured. One or two can be enough for the day.' },
      { key: 'rhythm',   label: 'Rhythm',   value: parts.rhythm,   weight: weights.rhythm,   visible: false, description: 'Internally, Aura also looks at how often you show up.' },
      { key: 'balance',  label: 'Balance',  value: parts.balance,  weight: weights.balance,  visible: false, description: 'Internally, Aura can consider how spread out your system is.' },
    ],
  };
}
