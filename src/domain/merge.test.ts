import { describe, expect, it } from 'vitest';
import { mergeRoots, sameProgress } from './merge';
import { emptyCourse, emptyRoot, type ProgressRoot } from './progress';
import type { ItemProgress } from './srs';

const item = (box: number, last: number, seen = 1): ItemProgress => ({
  box, due: '2026-10-06', last, intro: 1, seen, ok: seen, retry: 0, wrong: 0, lapses: 0, streak: 1, promotedDay: null, days: 1, lastOkDay: null, recent: 'C',
});

function device(build: (r: ProgressRoot) => void): ProgressRoot {
  const r = emptyRoot('de', 1000);
  r.courses.bn = emptyCourse(1000);
  build(r);
  return r;
}

describe('merging progress from two devices', () => {
  const phone = device((r) => {
    r.courses.bn.items['bn:district:dhaka'] = item(3, 500);
    r.courses.bn.items['bn:district:sylhet'] = item(1, 100);
    r.courses.bn.lessons['bn-l01'] = { completedAt: 50, times: 1, bestCorrect: 20, bestTotal: 24 };
    r.profile.achievements['first-lesson'] = 50;
    r.profile.xp = 120;
    r.profile.streak = { current: 3, longest: 3, lastDay: '2026-10-05' };
    r.settings.mapLabels = 'latin';
  });
  const laptop = device((r) => {
    r.courses.bn.items['bn:district:dhaka'] = item(2, 300);
    r.courses.bn.items['bn:district:sylhet'] = item(4, 900);
    r.courses.bn.lessons['bn-l01'] = { completedAt: 40, times: 2, bestCorrect: 24, bestTotal: 24 };
    r.courses.ru = emptyCourse(2000);
    r.profile.achievements['first-city'] = 70;
    r.profile.xp = 90;
    r.profile.streak = { current: 5, longest: 6, lastDay: '2026-10-04' };
  });

  it('keeps the latest state of every item and the union of everything else', () => {
    const m = mergeRoots(phone, laptop);
    expect(m.courses.bn.items['bn:district:dhaka'].box).toBe(3); // phone answered later
    expect(m.courses.bn.items['bn:district:sylhet'].box).toBe(4); // laptop answered later
    expect(m.courses.bn.lessons['bn-l01']).toEqual({ completedAt: 40, times: 2, bestCorrect: 24, bestTotal: 24 });
    expect(Object.keys(m.courses).sort()).toEqual(['bn', 'ru']);
    expect(Object.keys(m.profile.achievements).sort()).toEqual(['first-city', 'first-lesson']);
    expect(m.profile.xp).toBe(120);
    expect(m.profile.streak).toEqual({ current: 3, longest: 6, lastDay: '2026-10-05' });
    expect(m.settings.mapLabels).toBe('latin'); // settings stay per device
  });

  it('gives both devices the same progress', () => {
    expect(sameProgress(mergeRoots(phone, laptop), mergeRoots(laptop, phone))).toBe(true);
  });

  it('is stable: merging again changes nothing', () => {
    const m = mergeRoots(phone, laptop);
    expect(sameProgress(mergeRoots(m, laptop), m)).toBe(true);
    expect(sameProgress(mergeRoots(m, m), m)).toBe(true);
  });
});
