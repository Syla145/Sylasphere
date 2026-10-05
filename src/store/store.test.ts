import { describe, expect, it } from 'vitest';
import { completeLesson, emptyRoot, recordAnswer, recordIntro } from '../domain/progress';
import { de } from '../i18n/de';
import { en } from '../i18n/en';
import { translate } from '../i18n';
import { exportJson, migrate, parseImport } from './persistence';

describe('i18n', () => {
  it('has the same keys in German and English', () => {
    expect(Object.keys(de).sort()).toEqual(Object.keys(en).sort());
  });
  it('fills placeholders and plurals', () => {
    expect(translate('de', 'complete.weak', { n: 1 })).toBe('1 Schwachstelle');
    expect(translate('en', 'complete.weak', { n: 3 })).toBe('3 weak items');
    expect(translate('en', 'dash.lettersLearned', { n: 28, total: 33 })).toBe('28 / 33 letters learned');
  });
});

describe('progress document', () => {
  const now = Date.UTC(2026, 9, 5, 10);
  let root = emptyRoot('de', now);
  root = recordIntro(root, 'ru', 'ru:letter:a', now);
  root = recordAnswer(root, 'ru', { itemId: 'ru:letter:a', result: 'C', applySrs: true }, now);
  root = completeLesson(root, 'ru', 'ru-l01', { correct: 1, total: 1, newItems: [{ itemId: 'ru:letter:a', solid: true }] }, now);

  it('records XP, answers, lessons and the streak', () => {
    expect(root.profile.xp).toBe(2 + 5 + 5);
    expect(root.profile.totalAnswers).toBe(1);
    expect(root.courses.ru.lessons['ru-l01'].times).toBe(1);
    expect(root.profile.streak.current).toBe(1);
    expect(root.courses.ru.items['ru:letter:a'].box).toBeGreaterThanOrEqual(2);
  });

  it('survives an export/import round trip', () => {
    const preview = parseImport(exportJson(root));
    expect(preview.root.courses.ru.items['ru:letter:a'].box).toBe(root.courses.ru.items['ru:letter:a'].box);
    expect(preview.xp).toBe(root.profile.xp);
    expect(preview.lessons).toBe(1);
  });

  it('rejects foreign or broken files with a reason', () => {
    expect(() => parseImport('not json')).toThrow('invalid-json');
    expect(() => parseImport('{"hello":1}')).toThrow('not-sylareads');
    expect(() => parseImport(JSON.stringify({ app: 'sylareads', schemaVersion: 99, courses: {} }))).toThrow('newer-version');
  });

  it('repairs missing fields instead of crashing', () => {
    const repaired = migrate({ schemaVersion: 1, courses: { ru: { items: { x: { box: 3 } } } } });
    expect(repaired.profile.streak.current).toBe(0);
    expect(repaired.courses.ru.lessons).toEqual({});
  });
});
