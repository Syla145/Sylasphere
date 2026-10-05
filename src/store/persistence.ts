import { emptyCourse, emptyRoot, SCHEMA_VERSION, type MapLabels, type ProgressRoot } from '../domain/progress';
import type { Lang } from '../domain/types';

/**
 * Persistence: one versioned JSON document in localStorage (≈ 225 KB at full
 * size, far below the ~5 MB limit). Every read and write is wrapped, so the
 * app keeps working in memory where storage is blocked (private windows,
 * sandboxed previews).
 */
export const STORAGE_KEY = 'sylareads.progress';
const BACKUP_KEY = 'sylareads.backup';

const memory = new Map<string, string>();

function getItem(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return memory.get(key) ?? null;
  }
}

function setItem(key: string, value: string): boolean {
  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch {
    memory.set(key, value);
    return false;
  }
}

function removeItem(key: string) {
  try {
    window.localStorage.removeItem(key);
  } catch {
    memory.delete(key);
  }
}

export function defaultLang(): Lang {
  try {
    return navigator.language?.toLowerCase().startsWith('de') ? 'de' : 'en';
  } catch {
    return 'en';
  }
}

type Json = Record<string, unknown>;
const isObj = (v: unknown): v is Json => typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * Brings any stored or imported document to the current schema. Unknown or
 * missing fields fall back to defaults so a partly broken file never crashes
 * the app. Future schema versions add one step per version here.
 */
export function migrate(raw: unknown): ProgressRoot {
  if (!isObj(raw)) throw new Error('not-an-object');
  const version = typeof raw.schemaVersion === 'number' ? raw.schemaVersion : 0;
  if (version > SCHEMA_VERSION) throw new Error('newer-version');
  const settings = isObj(raw.settings) ? raw.settings : {};
  const uiLang: Lang = settings.uiLang === 'de' || settings.uiLang === 'en' ? settings.uiLang : defaultLang();
  const base = emptyRoot(uiLang, typeof raw.createdAt === 'number' ? raw.createdAt : Date.now());
  const profile = isObj(raw.profile) ? raw.profile : {};
  const streak = isObj(profile.streak) ? profile.streak : {};
  const courses: ProgressRoot['courses'] = {};
  if (isObj(raw.courses)) {
    for (const [id, c] of Object.entries(raw.courses)) {
      if (!isObj(c)) continue;
      const empty = emptyCourse(typeof c.startedAt === 'number' ? c.startedAt : Date.now());
      courses[id] = {
        ...empty,
        lastSessionAt: typeof c.lastSessionAt === 'number' ? c.lastSessionAt : null,
        xp: typeof c.xp === 'number' ? c.xp : 0,
        lessons: isObj(c.lessons) ? (c.lessons as ProgressRoot['courses'][string]['lessons']) : {},
        items: isObj(c.items) ? (c.items as ProgressRoot['courses'][string]['items']) : {},
        confusions: isObj(c.confusions) ? (c.confusions as Record<string, number>) : {},
        recent: typeof c.recent === 'string' ? c.recent : '',
        lastPracticeConfig: isObj(c.lastPracticeConfig) ? (c.lastPracticeConfig as never) : undefined,
      };
    }
  }
  const labels = (v: unknown): MapLabels | undefined => (v === 'native' || v === 'latin' || v === 'none' ? v : undefined);
  return {
    ...base,
    settings: { uiLang, mapLabels: labels(settings.mapLabels), taskMapLabels: labels(settings.taskMapLabels) },
    updatedAt: typeof raw.updatedAt === 'number' ? raw.updatedAt : Date.now(),
    lastExportAt: typeof raw.lastExportAt === 'number' ? raw.lastExportAt : null,
    profile: {
      xp: typeof profile.xp === 'number' ? profile.xp : 0,
      streak: {
        current: typeof streak.current === 'number' ? streak.current : 0,
        longest: typeof streak.longest === 'number' ? streak.longest : 0,
        lastDay: typeof streak.lastDay === 'string' ? streak.lastDay : null,
      },
      daily: isObj(profile.daily) ? (profile.daily as ProgressRoot['profile']['daily']) : {},
      achievements: isObj(profile.achievements) ? (profile.achievements as Record<string, number>) : {},
      totalAnswers: typeof profile.totalAnswers === 'number' ? profile.totalAnswers : 0,
    },
    courses,
  };
}

export function loadRoot(): ProgressRoot {
  const text = getItem(STORAGE_KEY);
  if (!text) return emptyRoot(defaultLang());
  try {
    return migrate(JSON.parse(text));
  } catch {
    // Keep the unreadable document instead of silently overwriting it.
    setItem(`${STORAGE_KEY}.corrupt.${Date.now()}`, text);
    return emptyRoot(defaultLang());
  }
}

let timer: ReturnType<typeof setTimeout> | null = null;
let pending: ProgressRoot | null = null;

export function saveRoot(root: ProgressRoot, immediate = false) {
  pending = root;
  if (immediate) return flush();
  if (timer) return;
  timer = setTimeout(flush, 500);
}

export function flush() {
  if (timer) clearTimeout(timer);
  timer = null;
  if (pending) setItem(STORAGE_KEY, JSON.stringify(pending));
  pending = null;
}

export function installFlushHandlers() {
  try {
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') flush();
    });
    navigator.storage?.persist?.().catch(() => undefined);
  } catch {
    /* non-browser environment */
  }
}

export function exportJson(root: ProgressRoot): string {
  return JSON.stringify({ app: 'sylareads', exportedAt: new Date().toISOString(), ...root }, null, 2);
}

export interface ImportPreview {
  root: ProgressRoot;
  courses: number;
  xp: number;
  lessons: number;
}

export function parseImport(text: string): ImportPreview {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('invalid-json');
  }
  if (!isObj(data) || (data.app !== undefined && data.app !== 'sylareads') || !('courses' in data)) throw new Error('not-sylareads');
  const root = migrate(data);
  return {
    root,
    courses: Object.keys(root.courses).length,
    xp: root.profile.xp,
    lessons: Object.values(root.courses).reduce((s, c) => s + Object.keys(c.lessons).length, 0),
  };
}

/** Keeps the current state as a backup before an import replaces it. */
export function backupCurrent(root: ProgressRoot) {
  setItem(BACKUP_KEY, JSON.stringify(root));
}

export function clearAll() {
  removeItem(STORAGE_KEY);
}
