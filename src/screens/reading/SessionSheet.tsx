/**
 * SessionSheet — deprecated. The interactive sheet that used to live here
 * was replaced by ReadingSessionSheet (unified "Add pages" / "Reading
 * block" v2 sheet). This file is kept only to host the shared types +
 * formatter that the MiniSessionBar still consumes.
 */

export type ActiveSession = {
  startPage: number;
  endPage: number;
  targetSeconds: number;      // always countdown — required
  elapsedSeconds: number;
  running: boolean;
};

// Formats the live mini-bar display. Used by MiniSessionBar.
export function formatSessionDisplay(active: ActiveSession): { display: string; label: string; completed: boolean } {
  const remaining = Math.max(0, active.targetSeconds - active.elapsedSeconds);
  const completed = active.elapsedSeconds >= active.targetSeconds;
  const m = Math.floor(remaining / 60);
  const s = remaining % 60;
  const pad2 = (n: number) => String(n).padStart(2, '0');
  return {
    display: `${pad2(m)}:${pad2(s)}`,
    label: completed ? 'COMPLETE' : 'TIME LEFT',
    completed,
  };
}
