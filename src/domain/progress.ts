import { dayKey } from './dates';
import { updateStreak, xpForResult, XP, type DayActivity, type StreakState } from './gamification';
import { applyAnswer, introduce, settleNewItem, type ItemProgress, type Result } from './srs';
import type { Lang } from './types';

/**
 * Persisted progress: one JSON document (spec section 13). Weak flags,
 * mastery states and levels are always computed, never stored.
 */
export const SCHEMA_VERSION = 1;

export interface LessonRecord {
  completedAt: number;
  times: number;
  bestCorrect: number;
  bestTotal: number;
}

export interface PracticeConfigStored {
  categories: string[];
  weakOnly: boolean;
  scope: 'learned' | 'all';
  prioritizeWeak: boolean;
  count: number;
}

export interface CourseProgress {
  startedAt: number;
  lastSessionAt: number | null;
  xp: number;
  lessons: Record<string, LessonRecord>;
  items: Record<string, ItemProgress>;
  /** "idA>idB" → how often idA was answered with idB's answer. */
  confusions: Record<string, number>;
  /** Last 200 graded results (C/R/W) for the accuracy figure. */
  recent: string;
  lastPracticeConfig?: PracticeConfigStored;
}

export interface Profile {
  xp: number;
  streak: StreakState;
  daily: Record<string, DayActivity>;
  achievements: Record<string, number>;
  totalAnswers: number;
}

/** How places are labelled on maps: native script, Latin script, or not at all. */
export type MapLabels = 'native' | 'latin' | 'none';

export interface Settings {
  uiLang: Lang;
  /** Labels on the explore map. */
  mapLabels?: MapLabels;
  /** Labels around the target in map tasks (off by default, the target itself is never labelled). */
  taskMapLabels?: MapLabels;
}

export interface ProgressRoot {
  schemaVersion: number;
  createdAt: number;
  updatedAt: number;
  lastExportAt: number | null;
  settings: Settings;
  profile: Profile;
  courses: Record<string, CourseProgress>;
}

export function emptyRoot(uiLang: Lang, now = Date.now()): ProgressRoot {
  return {
    schemaVersion: SCHEMA_VERSION,
    createdAt: now,
    updatedAt: now,
    lastExportAt: null,
    settings: { uiLang },
    profile: { xp: 0, streak: { current: 0, longest: 0, lastDay: null }, daily: {}, achievements: {}, totalAnswers: 0 },
    courses: {},
  };
}

export function emptyCourse(now = Date.now()): CourseProgress {
  return { startedAt: now, lastSessionAt: null, xp: 0, lessons: {}, items: {}, confusions: {}, recent: '' };
}

function withCourse(root: ProgressRoot, courseId: string, now: number, fn: (c: CourseProgress) => CourseProgress): ProgressRoot {
  const course = root.courses[courseId] ?? emptyCourse(now);
  return { ...root, updatedAt: now, courses: { ...root.courses, [courseId]: fn(course) } };
}

function addDaily(profile: Profile, today: string, delta: Partial<DayActivity>): Profile {
  const d = profile.daily[today] ?? { lessons: 0, answers: 0, xp: 0 };
  const next: DayActivity = {
    lessons: d.lessons + (delta.lessons ?? 0),
    answers: d.answers + (delta.answers ?? 0),
    xp: d.xp + (delta.xp ?? 0),
  };
  const daily = { ...profile.daily, [today]: next };
  // keep the last 400 days
  const keys = Object.keys(daily).sort();
  if (keys.length > 400) for (const k of keys.slice(0, keys.length - 400)) delete daily[k];
  const streak = updateStreak(profile.streak, today, next);
  return { ...profile, daily, streak };
}

function addXp(root: ProgressRoot, courseId: string, xp: number, today: string, extra: Partial<DayActivity> = {}): ProgressRoot {
  const profile = addDaily({ ...root.profile, xp: root.profile.xp + xp }, today, { ...extra, xp });
  const course = root.courses[courseId];
  return { ...root, profile, courses: course ? { ...root.courses, [courseId]: { ...course, xp: course.xp + xp } } : root.courses };
}

/** First learning card of an item seen. */
export function recordIntro(root: ProgressRoot, courseId: string, itemId: string, now = Date.now()): ProgressRoot {
  const today = dayKey(new Date(now));
  return withCourse(root, courseId, now, (c) => ({ ...c, items: { ...c.items, [itemId]: introduce(c.items[itemId], today, now) } }));
}

export interface AnswerInput {
  itemId: string;
  result: Result;
  /** Update long-term SRS state (first graded answer of the session, not a new lesson item). */
  applySrs: boolean;
  confusedWith?: string;
}

export function recordAnswer(root: ProgressRoot, courseId: string, a: AnswerInput, now = Date.now()): ProgressRoot {
  const today = dayKey(new Date(now));
  let next = withCourse(root, courseId, now, (c) => {
    const items = a.applySrs ? { ...c.items, [a.itemId]: applyAnswer(c.items[a.itemId], a.result, today, now) } : c.items;
    const confusions = a.confusedWith
      ? { ...c.confusions, [`${a.itemId}>${a.confusedWith}`]: (c.confusions[`${a.itemId}>${a.confusedWith}`] ?? 0) + 1 }
      : c.confusions;
    return { ...c, items, confusions, recent: (c.recent + a.result).slice(-200), lastSessionAt: now };
  });
  next = { ...next, profile: { ...next.profile, totalAnswers: next.profile.totalAnswers + 1 } };
  return addXp(next, courseId, xpForResult(a.result), today, { answers: 1 });
}

/** End of a lesson: settle new items (box 2 if their last answer was right, else 1) and add the bonus. */
export function completeLesson(
  root: ProgressRoot,
  courseId: string,
  lessonId: string,
  info: { correct: number; total: number; newItems: { itemId: string; solid: boolean }[] },
  now = Date.now(),
): ProgressRoot {
  const today = dayKey(new Date(now));
  let next = withCourse(root, courseId, now, (c) => {
    const items = { ...c.items };
    for (const n of info.newItems) items[n.itemId] = settleNewItem(items[n.itemId], n.solid, today, now);
    const prev = c.lessons[lessonId];
    const better = !prev || info.correct / Math.max(1, info.total) >= prev.bestCorrect / Math.max(1, prev.bestTotal);
    const record: LessonRecord = {
      completedAt: now,
      times: (prev?.times ?? 0) + 1,
      bestCorrect: better ? info.correct : prev!.bestCorrect,
      bestTotal: better ? info.total : prev!.bestTotal,
    };
    return { ...c, items, lessons: { ...c.lessons, [lessonId]: record }, lastSessionAt: now };
  });
  const perfect = info.total > 0 && info.correct === info.total;
  next = addXp(next, courseId, XP.lessonComplete + (perfect ? XP.lessonPerfect : 0), today, { lessons: 1 });
  return next;
}

export function completePractice(root: ProgressRoot, courseId: string, answered: number, now = Date.now()): ProgressRoot {
  if (answered < 10) return root;
  return addXp(root, courseId, XP.practiceComplete, dayKey(new Date(now)));
}

export function unlockAchievements(root: ProgressRoot, ids: string[], now = Date.now()): ProgressRoot {
  if (!ids.length) return root;
  const achievements = { ...root.profile.achievements };
  for (const id of ids) if (!achievements[id]) achievements[id] = now;
  return { ...root, profile: { ...root.profile, achievements } };
}

/** Items involved in a confusion that happened at least twice. */
export function confusedTwiceSet(c: CourseProgress | undefined): Set<string> {
  const out = new Set<string>();
  if (!c) return out;
  for (const [pair, n] of Object.entries(c.confusions)) {
    if (n < 2) continue;
    const [a, b] = pair.split('>');
    out.add(a);
    out.add(b);
  }
  return out;
}
