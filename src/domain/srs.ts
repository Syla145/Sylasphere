import { addDays, diffDays } from './dates';

/**
 * Leitner spaced repetition with 8 boxes (spec section 9).
 * The box decides the next due day and the mastery state. Weak flag,
 * mastery state and level are always derived, never stored.
 */

export type Result = 'C' | 'R' | 'W'; // correct first try · correct after help · wrong

export interface ItemProgress {
  box: number; // 0–7
  due: string | null; // YYYY-MM-DD
  last: number | null; // epoch ms of last graded answer
  intro: number | null; // epoch ms of first introduction
  seen: number;
  ok: number;
  retry: number;
  wrong: number;
  lapses: number;
  streak: number;
  promotedDay: string | null;
  days: number; // distinct days with a correct answer
  lastOkDay: string | null;
  recent: string; // last 5 results, e.g. "CCWRC"
}

/** Interval in days until due, per box. Box 1 is due in the same or next session. */
export const INTERVALS = [0, 0, 1, 3, 7, 14, 30, 60] as const;
export const MASTERY_VALUE = [0, 0.15, 0.3, 0.5, 0.65, 0.8, 0.9, 1] as const;
export const MAX_BOX = 7;

export type MasteryState = 'new' | 'learning' | 'familiar' | 'mastered';

export function emptyProgress(): ItemProgress {
  return {
    box: 0,
    due: null,
    last: null,
    intro: null,
    seen: 0,
    ok: 0,
    retry: 0,
    wrong: 0,
    lapses: 0,
    streak: 0,
    promotedDay: null,
    days: 0,
    lastOkDay: null,
    recent: '',
  };
}

export function masteryState(p?: ItemProgress): MasteryState {
  const box = p?.box ?? 0;
  if (box <= 0) return 'new';
  if (box <= 2) return 'learning';
  if (box <= 4) return 'familiar';
  return 'mastered';
}

export function masteryValue(p?: ItemProgress): number {
  return MASTERY_VALUE[Math.max(0, Math.min(MAX_BOX, p?.box ?? 0))];
}

/** Marks an item as introduced (first learning card seen): box 0 → 1. */
export function introduce(p: ItemProgress | undefined, today: string, now: number): ItemProgress {
  const base = p ? { ...p } : emptyProgress();
  if (base.intro === null) base.intro = now;
  if (base.box < 1) {
    base.box = 1;
    base.due = today;
  }
  return base;
}

/**
 * Applies a graded answer. Only the first graded answer per item and session
 * is passed here; repetitions inside a session only steer the session queue.
 */
export function applyAnswer(p: ItemProgress | undefined, result: Result, today: string, now: number): ItemProgress {
  const n = p ? { ...p } : emptyProgress();
  if (n.intro === null) n.intro = now;
  n.seen += 1;
  n.last = now;
  n.recent = (n.recent + result).slice(-5);

  if (result === 'C') {
    n.ok += 1;
    n.streak += 1;
    if (n.lastOkDay !== today) {
      n.days += 1;
      n.lastOkDay = today;
    }
    // From box 3 on, at most one promotion per calendar day: mastery needs several days.
    const canPromote = n.box < 3 || n.promotedDay !== today;
    if (canPromote && n.box < MAX_BOX) {
      if (n.box >= 3) n.promotedDay = today;
      n.box += 1;
    }
    if (n.box < 1) n.box = 1;
  } else if (result === 'R') {
    n.retry += 1;
    n.streak = 0;
    n.box = Math.max(1, n.box);
  } else {
    n.wrong += 1;
    n.lapses += 1;
    n.streak = 0;
    n.box = Math.max(1, n.box - 2);
  }
  n.due = addDays(today, INTERVALS[n.box]);
  return n;
}

/** Sets the box directly (end of lesson for newly introduced items). */
export function settleNewItem(p: ItemProgress | undefined, solid: boolean, today: string, now: number): ItemProgress {
  const n = p ? { ...p } : emptyProgress();
  if (n.intro === null) n.intro = now;
  n.box = Math.max(n.box, solid ? 2 : 1);
  n.due = addDays(today, INTERVALS[n.box]);
  return n;
}

export function isDue(p: ItemProgress | undefined, today: string): boolean {
  if (!p || p.box === 0 || !p.due) return false;
  return diffDays(p.due, today) >= 0;
}

/** Overdue ratio: (today − due) / interval, never negative. */
export function overdue(p: ItemProgress | undefined, today: string): number {
  if (!p || !p.due || p.box === 0) return 0;
  const late = diffDays(p.due, today);
  if (late < 0) return 0;
  return late / Math.max(1, INTERVALS[p.box]);
}

/**
 * Weak items: lapses ≥ 2 with at least one error in the last three answers,
 * or still in box ≤ 2 after four or more answers, or part of a confusion pair
 * that happened at least twice (while not yet mastered).
 */
export function isWeak(p: ItemProgress | undefined, confusedTwice = false): boolean {
  if (!p || p.seen === 0) return false;
  const last3 = p.recent.slice(-3);
  if (p.lapses >= 2 && last3.includes('W')) return true;
  if (p.seen >= 4 && p.box <= 2) return true;
  if (confusedTwice && p.box < 5) return true;
  return false;
}

/** Selection priority for practice sessions (spec section 9). */
export function priority(p: ItemProgress | undefined, today: string, weak: boolean, rnd: number): number {
  return 2 * overdue(p, today) + 1.5 * (weak ? 1 : 0) + 0.5 * (1 - masteryValue(p)) + rnd * 0.3;
}
