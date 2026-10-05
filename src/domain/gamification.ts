import { diffDays } from './dates';
import type { Result } from './srs';

/** XP measures activity, never skill (spec section 10). */
export const XP = {
  correct: 2,
  retry: 1,
  wrong: 0,
  lessonComplete: 5,
  lessonPerfect: 5,
  practiceComplete: 3,
} as const;

export function xpForResult(r: Result): number {
  return r === 'C' ? XP.correct : r === 'R' ? XP.retry : XP.wrong;
}

/** Total XP needed to reach level n: 25 · n · (n − 1). */
export function xpForLevel(level: number): number {
  return 25 * level * (level - 1);
}

export function levelFromXp(xp: number): number {
  let level = 1;
  while (xpForLevel(level + 1) <= xp) level++;
  return level;
}

export function levelProgress(xp: number): { level: number; into: number; span: number } {
  const level = levelFromXp(xp);
  const base = xpForLevel(level);
  const next = xpForLevel(level + 1);
  return { level, into: xp - base, span: next - base };
}

export interface DayActivity {
  lessons: number;
  answers: number;
  xp: number;
}

export interface StreakState {
  current: number;
  longest: number;
  lastDay: string | null;
}

/** A day counts once a lesson was completed or at least 10 practice answers were given. */
export const dayQualifies = (d: DayActivity | undefined) => !!d && (d.lessons >= 1 || d.answers >= 10);

/** Updates the streak after activity on `today`. Never punishes; a broken streak restarts silently. */
export function updateStreak(s: StreakState, today: string, todayActivity: DayActivity): StreakState {
  if (!dayQualifies(todayActivity) || s.lastDay === today) return s;
  const gap = s.lastDay ? diffDays(s.lastDay, today) : Infinity;
  const current = gap === 1 ? s.current + 1 : 1;
  return { current, longest: Math.max(s.longest, current), lastDay: today };
}

/** The streak shown on screen: 0 once more than a day has passed without qualifying activity. */
export function displayedStreak(s: StreakState, today: string): number {
  if (!s.lastDay) return 0;
  return diffDays(s.lastDay, today) <= 1 ? s.current : 0;
}
