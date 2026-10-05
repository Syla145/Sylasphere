import { describe, expect, it } from 'vitest';
import ru from '../content/ru';
import { buildIndex } from './courseIndex';
import { addDays, diffDays } from './dates';
import { accepts, evaluateTyped } from './evaluate';
import { levelFromXp, updateStreak, xpForLevel } from './gamification';
import { buildLesson, finalRoundTasks } from './lessonBuilder';
import { matchSegments } from './match';
import { normalize } from './normalize';
import { buildPractice, SMART_PRACTICE } from './practiceBuilder';
import { advance, createSession, submit } from './sessionEngine';
import { applyAnswer, isWeak, masteryState } from './srs';
import { retaskFor, seededRng } from './taskFactory';
import type { Task } from './tasks';

const index = buildIndex(ru);
const item = (id: string) => {
  const it = index.byId.get(id);
  if (!it) throw new Error(`missing ${id}`);
  return it;
};

describe('normalize', () => {
  it('ignores case, outer spaces, diacritics and dash variants', () => {
    expect(normalize('  MOSKAU ')).toBe('moskau');
    expect(normalize('Rostov–na–Donu')).toBe('rostov na donu');
    expect(normalize('Piräus')).toBe('piraus');
    expect(normalize('St. Petersburg.')).toBe('st. petersburg');
    expect(normalize('Perm’')).toBe("perm'");
  });
});

describe('place identification (spec section 7)', () => {
  const moskva = item('ru:city:moskva');
  it('accepts German, English and transliteration equally', () => {
    for (const a of ['Moskau', 'Moscow', 'Moskva', 'moskva ', 'MOSCOW']) expect(accepts(index, moskva, a)).toBe(true);
  });
  it('never accepts typos', () => {
    for (const a of ['Mosocw', 'Moskow', 'Moskvaa', 'Mosk', '']) expect(accepts(index, moskva, a)).toBe(false);
  });
  it('accepts defined variants and rule-based transliterations', () => {
    const ekb = item('ru:city:yekaterinburg');
    for (const a of ['Yekaterinburg', 'Ekaterinburg', 'Jekaterinburg']) expect(accepts(index, ekb, a)).toBe(true);
    const nn = item('ru:city:nizhniy-novgorod');
    for (const a of ['Nizhny Novgorod', 'Nizhniy Novgorod', 'Nischni Nowgorod', 'nizhnii novgorod']) expect(accepts(index, nn, a)).toBe(true);
    expect(accepts(index, item('ru:city:rostov-na-donu'), 'rostov-na-donu')).toBe(true);
    expect(accepts(index, item('ru:city:perm'), "Perm'")).toBe(true);
  });
  it('makes the region type word optional', () => {
    const r = item('ru:region:novosibirskaya');
    for (const a of ['Novosibirsk Oblast', 'Oblast Nowosibirsk', 'Novosibirskaya oblast', 'Novosibirskaya', 'Novosibirsk', 'Nowosibirsk']) {
      expect(accepts(index, r, a)).toBe(true);
    }
  });
  it('names a confusion with another place instead of fuzzy matching', () => {
    const task = { key: 'x', kind: 'identify', itemId: 'ru:city:omsk', display: 'Омск' } as const;
    const ev = evaluateTyped(index, task, 'Tomsk');
    expect(ev.correct).toBe(false);
    expect(ev.confusedWith).toBe('ru:city:tomsk');
  });
});

describe('reading', () => {
  it('letters accept their defined readings only', () => {
    expect(accepts(index, item('ru:letter:r'), 'r')).toBe(true);
    expect(accepts(index, item('ru:letter:r'), 'p')).toBe(false);
    expect(accepts(index, item('ru:letter:kh'), 'h')).toBe(true);
    expect(accepts(index, item('ru:letter:kh'), 'x')).toBe(false);
  });
  it('words are matched segment by segment', () => {
    const segs = ru.segments('мост');
    expect(matchSegments('most', segs)).toBe(true);
    expect(matchSegments('mocт', segs)).toBe(false);
    expect(accepts(index, item('ru:term:obyezd'), "ob'yezd")).toBe(true);
    expect(accepts(index, item('ru:term:obyezd'), 'obyezd')).toBe(true);
    expect(accepts(index, item('ru:term:posyolok'), 'poselok')).toBe(true);
  });
  it('points at the first misread character', () => {
    const task = { key: 'x', kind: 'read', itemId: 'ru:term:most', display: 'мост' } as const;
    expect(evaluateTyped(index, task, 'mozt').mismatchAt).toBe(2);
  });
});

describe('srs', () => {
  const today = '2026-10-05';
  it('promotes, demotes and limits promotions from box 3 to once a day', () => {
    let p = applyAnswer(undefined, 'C', today, 0);
    expect(p.box).toBe(1);
    p = applyAnswer(p, 'C', today, 0);
    p = applyAnswer(p, 'C', today, 0);
    expect(p.box).toBe(3);
    p = applyAnswer(p, 'C', today, 0);
    expect(p.box).toBe(4);
    p = applyAnswer(p, 'C', today, 0);
    expect(p.box).toBe(4); // same day
    p = applyAnswer(p, 'C', addDays(today, 1), 0);
    expect(p.box).toBe(5);
    expect(masteryState(p)).toBe('mastered');
    p = applyAnswer(p, 'W', addDays(today, 2), 0);
    expect(p.box).toBe(3);
    expect(p.due).toBe(addDays(today, 5));
  });
  it('flags weak items', () => {
    let p = applyAnswer(undefined, 'W', today, 0);
    p = applyAnswer(p, 'C', today, 0);
    p = applyAnswer(p, 'W', today, 0);
    expect(isWeak(p)).toBe(true);
  });
});

describe('dates and gamification', () => {
  it('counts days and levels', () => {
    expect(diffDays('2026-10-05', '2026-10-07')).toBe(2);
    expect(xpForLevel(2)).toBe(50);
    expect(xpForLevel(5)).toBe(500);
    expect(levelFromXp(149)).toBe(2);
    expect(levelFromXp(150)).toBe(3);
  });
  it('continues and restarts the streak', () => {
    let s = { current: 0, longest: 0, lastDay: null as string | null };
    s = updateStreak(s, '2026-10-05', { lessons: 1, answers: 0, xp: 0 });
    s = updateStreak(s, '2026-10-06', { lessons: 0, answers: 10, xp: 0 });
    expect(s.current).toBe(2);
    s = updateStreak(s, '2026-10-09', { lessons: 1, answers: 0, xp: 0 });
    expect(s.current).toBe(1);
    expect(s.longest).toBe(2);
    expect(updateStreak(s, '2026-10-10', { lessons: 0, answers: 9, xp: 0 }).current).toBe(1);
  });
});

describe('lesson builder', () => {
  it('builds every lesson with 15–30 interactions', () => {
    for (const lesson of ru.lessons) {
      const tasks = buildLesson(index, lesson, {}, seededRng(lesson.number));
      expect(tasks.length, lesson.id).toBeGreaterThanOrEqual(15);
      expect(tasks.length, lesson.id).toBeLessThanOrEqual(30);
      for (const t of tasks) expect(index.byId.has(t.itemId), `${lesson.id} ${t.itemId}`).toBe(true);
    }
  });
  it('only uses letters taught so far in letter lessons', () => {
    const l3 = ru.lessons.find((l) => l.id === 'ru-l03')!;
    const allowed = new Set(ru.lessons.filter((l) => l.number <= 3).flatMap((l) => l.newIds));
    const tasks = buildLesson(index, l3, {}, seededRng(3));
    for (const t of tasks) for (const req of index.required.get(t.itemId) ?? []) expect(allowed.has(req), t.itemId).toBe(true);
  });
});

describe('session engine', () => {
  const rng = seededRng(7);
  const deps = { rng, retask: retaskFor(index, rng), finalRound: finalRoundTasks(index, rng) };
  const tasks: Task[] = ['most', 'reka', 'gora', 'les', 'more', 'sever', 'yug'].map((s) => ({
    key: s,
    kind: 'read',
    itemId: `ru:term:${s}`,
    display: s,
  }));

  it('gives a second try in learn mode and re-asks after the second error', () => {
    let s = createSession(tasks, 'learn');
    s = submit(s, 'x', { correct: false }, deps);
    expect(s.phase).toBe('answer');
    expect(s.attempt).toBe(1);
    s = submit(s, 'y', { correct: false }, deps);
    expect(s.phase).toBe('feedback');
    expect(s.unsure).toContain('ru:term:most');
    const pos = s.tasks.findIndex((t, i) => i > 0 && t.itemId === 'ru:term:most');
    expect(pos).toBeGreaterThanOrEqual(4);
    expect(pos).toBeLessThanOrEqual(6);
  });
  it('re-inserts a wrong practice answer 3–7 tasks later, at most twice', () => {
    let s = createSession(tasks, 'practice');
    s = submit(s, 'x', { correct: false }, deps);
    expect(s.phase).toBe('feedback');
    expect(s.tasks.length).toBe(tasks.length + 1);
    s = advance(s, deps);
    expect(s.index).toBe(1);
  });
  it('records only the first result per item', () => {
    let s = createSession([tasks[0], { ...tasks[0], key: 'again' }], 'practice');
    s = submit(s, 'most', { correct: true }, deps);
    s = advance(s, deps);
    s = submit(s, 'x', { correct: false }, deps);
    expect(s.first['ru:term:most']).toBe('C');
  });
});

describe('practice builder', () => {
  it('returns nothing to practise for a new learner with "learned only"', () => {
    expect(buildPractice(index, SMART_PRACTICE, { items: {}, confusedTwice: new Set() }, seededRng(1))).toHaveLength(0);
  });
  it('starts unknown items with a learning card when "all content" is chosen', () => {
    const tasks = buildPractice(index, { ...SMART_PRACTICE, categories: ['cities'], scope: 'all', count: 5 }, { items: {}, confusedTwice: new Set() }, seededRng(1));
    expect(tasks[0].kind).toBe('intro');
    expect(tasks.filter((t) => t.kind === 'identify')).toHaveLength(5);
  });
});

describe('content updates', () => {
  it('ignores progress for items that no longer exist (e.g. the removed Cyprus places)', () => {
    const index = buildIndex(ru);
    const stale = { box: 2, due: '2020-01-01', ok: 3, wrong: 4, streak: 0, lastSeen: '2020-01-01' } as never;
    const items = { 'el:city:lefkosia': stale, 'ru:city:gone': stale };
    const tasks = buildPractice(index, SMART_PRACTICE, { items, confusedTwice: new Set(['ru:city:gone']) }, seededRng(2));
    expect(tasks.every((t) => !('itemId' in t) || index.byId.has(t.itemId!))).toBe(true);
  });
});
