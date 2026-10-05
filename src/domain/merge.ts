import type { DayActivity, StreakState } from './gamification';
import type { CourseProgress, LessonRecord, ProgressRoot } from './progress';
import type { ItemProgress } from './srs';

/**
 * Combines two progress documents (this device and the cloud copy) so that
 * nothing learned on either device is lost. The rules are symmetric, so two
 * devices that merge each other's state end up with the same document.
 *
 * - Items: the record with the most recent graded answer wins (its box and
 *   due date belong together); ties go to the record seen more often.
 * - Lessons, achievements, daily activity: union, keeping the better values.
 * - XP and counters: the larger value (both copies share their history).
 * - Settings: this device's settings stay.
 */
export function mergeRoots(local: ProgressRoot, remote: ProgressRoot): ProgressRoot {
  const courses: ProgressRoot['courses'] = {};
  for (const id of new Set([...Object.keys(local.courses), ...Object.keys(remote.courses)])) {
    const a = local.courses[id];
    const b = remote.courses[id];
    courses[id] = a && b ? mergeCourse(a, b) : (a ?? b)!;
  }
  return {
    schemaVersion: Math.max(local.schemaVersion, remote.schemaVersion),
    createdAt: Math.min(local.createdAt, remote.createdAt),
    updatedAt: Math.max(local.updatedAt, remote.updatedAt),
    lastExportAt: maxNullable(local.lastExportAt, remote.lastExportAt),
    settings: local.settings,
    profile: {
      xp: Math.max(local.profile.xp, remote.profile.xp),
      streak: mergeStreak(local.profile.streak, remote.profile.streak),
      daily: mergeRecords(local.profile.daily, remote.profile.daily, mergeDay),
      achievements: mergeRecords(local.profile.achievements, remote.profile.achievements, Math.min),
      totalAnswers: Math.max(local.profile.totalAnswers, remote.profile.totalAnswers),
    },
    courses,
  };
}

function mergeCourse(a: CourseProgress, b: CourseProgress): CourseProgress {
  const newer = (a.lastSessionAt ?? 0) >= (b.lastSessionAt ?? 0) ? a : b;
  return {
    startedAt: Math.min(a.startedAt, b.startedAt),
    lastSessionAt: maxNullable(a.lastSessionAt, b.lastSessionAt),
    xp: Math.max(a.xp, b.xp),
    lessons: mergeRecords(a.lessons, b.lessons, mergeLesson),
    items: mergeRecords(a.items, b.items, mergeItem),
    confusions: mergeRecords(a.confusions, b.confusions, Math.max),
    recent: newer.recent,
    lastPracticeConfig: newer.lastPracticeConfig ?? a.lastPracticeConfig ?? b.lastPracticeConfig,
  };
}

export function mergeItem(a: ItemProgress, b: ItemProgress): ItemProgress {
  const la = a.last ?? 0;
  const lb = b.last ?? 0;
  if (la !== lb) return la > lb ? a : b;
  if (a.seen !== b.seen) return a.seen > b.seen ? a : b;
  return a.box >= b.box ? a : b;
}

function mergeLesson(a: LessonRecord, b: LessonRecord): LessonRecord {
  const better = a.bestCorrect / Math.max(1, a.bestTotal) >= b.bestCorrect / Math.max(1, b.bestTotal) ? a : b;
  return {
    completedAt: Math.min(a.completedAt, b.completedAt),
    times: Math.max(a.times, b.times),
    bestCorrect: better.bestCorrect,
    bestTotal: better.bestTotal,
  };
}

function mergeDay(a: DayActivity, b: DayActivity): DayActivity {
  return { lessons: Math.max(a.lessons, b.lessons), answers: Math.max(a.answers, b.answers), xp: Math.max(a.xp, b.xp) };
}

function mergeStreak(a: StreakState, b: StreakState): StreakState {
  const da = a.lastDay ?? '';
  const db = b.lastDay ?? '';
  const latest = da === db ? (a.current >= b.current ? a : b) : da > db ? a : b;
  return { current: latest.current, lastDay: latest.lastDay, longest: Math.max(a.longest, b.longest, latest.current) };
}

function mergeRecords<T>(a: Record<string, T>, b: Record<string, T>, pick: (x: T, y: T) => T): Record<string, T> {
  const out: Record<string, T> = { ...a };
  for (const [k, v] of Object.entries(b)) out[k] = k in a ? pick(a[k], v) : v;
  return out;
}

function maxNullable(a: number | null, b: number | null): number | null {
  if (a === null) return b;
  if (b === null) return a;
  return Math.max(a, b);
}

/** True when merging would change nothing for `target` (no upload or reload needed). */
export function sameProgress(a: ProgressRoot, b: ProgressRoot): boolean {
  const strip = (r: ProgressRoot) => stable({ ...r, updatedAt: 0, settings: null, lastExportAt: null });
  return strip(a) === strip(b);
}

/** JSON with sorted keys, so equal documents compare equal regardless of key order. */
function stable(v: unknown): string {
  if (v === null || typeof v !== 'object') return JSON.stringify(v) ?? 'null';
  if (Array.isArray(v)) return `[${v.map(stable).join(',')}]`;
  const o = v as Record<string, unknown>;
  return `{${Object.keys(o)
    .filter((k) => o[k] !== undefined)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${stable(o[k])}`)
    .join(',')}}`;
}
