import type { CourseIndex } from './courseIndex';
import { dayKey } from './dates';
import { isDecodable, knownUnits } from './lessonBuilder';
import { weakItemIds } from './practiceBuilder';
import { confusedTwiceSet, type CourseProgress } from './progress';
import { isDue, masteryState, masteryValue } from './srs';
import { CATEGORY_KINDS, type Category } from './types';

export interface CategoryStat {
  total: number;
  value: number; // mean mastery value 0–1
  learning: number;
  familiar: number;
  mastered: number;
}

export type Recommendation =
  | { kind: 'review'; due: number }
  | { kind: 'lesson'; lessonId: string }
  | { kind: 'weak'; count: number }
  | { kind: 'mixed' };

export interface CourseStats {
  started: boolean;
  mastery: number; // 0–1, core curriculum
  lettersLearned: number;
  lettersTotal: number;
  accuracy: number | null; // 0–1
  citiesRecognized: number;
  citiesTotal: number;
  citiesReadable: number;
  categories: Record<Category, CategoryStat>;
  weakIds: string[];
  dueCount: number;
  completedLessons: number;
  recommendation: Recommendation;
}

/** Reading units (letters, digraph units) introduced so far (box ≥ 1). */
export function knownLetters(index: CourseIndex, cp: CourseProgress | undefined): Set<string> {
  return knownUnits(index, cp?.items ?? {});
}

export function readableCities(index: CourseIndex, known: Set<string>): string[] {
  return index.byKind.city.filter((c) => isDecodable(index, c.id, known)).map((c) => c.id);
}

export function courseStats(index: CourseIndex, cp: CourseProgress | undefined, today = dayKey()): CourseStats {
  const items = cp?.items ?? {};
  const core = [...index.byKind.letter, ...index.byKind.combo, ...index.byKind.word, ...index.byKind.element];
  const mastery = core.length ? core.reduce((s, it) => s + masteryValue(items[it.id]), 0) / core.length : 0;

  const categories = {} as Record<Category, CategoryStat>;
  for (const cat of Object.keys(CATEGORY_KINDS) as Category[]) {
    const list = index.items.filter((it) => CATEGORY_KINDS[cat].includes(it.kind));
    const stat: CategoryStat = { total: list.length, value: 0, learning: 0, familiar: 0, mastered: 0 };
    for (const it of list) {
      const st = masteryState(items[it.id]);
      if (st !== 'new') stat[st] += 1;
      stat.value += masteryValue(items[it.id]);
    }
    stat.value = list.length ? stat.value / list.length : 0;
    categories[cat] = stat;
  }

  const recent = cp?.recent ?? '';
  const accuracy = recent.length ? [...recent].filter((r) => r === 'C').length / recent.length : null;
  const weakIds = weakItemIds(index, { items, confusedTwice: confusedTwiceSet(cp) });
  const dueCount = index.items.filter((it) => isDue(items[it.id], today)).length;
  const completed = index.content.lessons.filter((l) => cp?.lessons[l.id]);

  let recommendation: Recommendation;
  const nextLesson = index.content.lessons.find((l) => !cp?.lessons[l.id]);
  if (dueCount > 15) recommendation = { kind: 'review', due: dueCount };
  else if (nextLesson) recommendation = { kind: 'lesson', lessonId: nextLesson.id };
  else if (weakIds.length >= 5) recommendation = { kind: 'weak', count: weakIds.length };
  else recommendation = { kind: 'mixed' };

  return {
    started: !!cp && (Object.keys(cp.items).length > 0 || Object.keys(cp.lessons).length > 0),
    mastery,
    lettersLearned: index.byKind.letter.filter((l) => (items[l.id]?.box ?? 0) >= 2).length,
    lettersTotal: index.byKind.letter.length,
    accuracy,
    citiesRecognized: index.byKind.city.filter((c) => (items[c.id]?.box ?? 0) >= 3).length,
    citiesTotal: index.byKind.city.length,
    citiesReadable: readableCities(index, knownLetters(index, cp)).length,
    categories,
    weakIds,
    dueCount,
    completedLessons: completed.length,
    recommendation,
  };
}
