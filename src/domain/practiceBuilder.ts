import type { CourseIndex } from './courseIndex';
import { dayKey } from './dates';
import { isDue, isWeak, priority, type ItemProgress } from './srs';
import {
  glyphChoiceTask,
  identifyTask,
  introTask,
  meaningTask,
  readTask,
  scanTask,
  shuffle,
  type Rng,
  locateTask,
  mapChoiceTask,
} from './taskFactory';
import type { Task } from './tasks';
import { CATEGORY_KINDS, categoryOf, type Category, type Item, type PlaceItem } from './types';

export interface PracticeConfig {
  /** Selected categories. Empty + weakOnly = all weak items. */
  categories: Category[];
  weakOnly: boolean;
  scope: 'learned' | 'all';
  prioritizeWeak: boolean;
  count: number;
  /** Only the places that are areas on the course map (districts, provinces, regions). */
  layer?: 'map';
}

export const ALL_CATEGORIES: Category[] = ['letters', 'combos', 'words', 'terms', 'cities', 'regions'];

export const SMART_PRACTICE: PracticeConfig = {
  categories: ALL_CATEGORIES,
  weakOnly: false,
  scope: 'learned',
  prioritizeWeak: true,
  count: 20,
};

/** Mixed weighting (spec section 6). */
const WEIGHTS: Record<Category, number> = { letters: 0.18, combos: 0.12, words: 0.12, terms: 0.13, cities: 0.3, regions: 0.15 };

type Items = Record<string, ItemProgress | undefined>;

export interface PracticeContext {
  items: Items;
  /** Items in confusion pairs that happened at least twice. */
  confusedTwice: Set<string>;
  today?: string;
}

export function weakItemIds(index: CourseIndex, ctx: PracticeContext): string[] {
  return index.items.filter((it) => isWeak(ctx.items[it.id], ctx.confusedTwice.has(it.id))).map((it) => it.id);
}

export function poolFor(index: CourseIndex, config: PracticeConfig, ctx: PracticeContext): Item[] {
  const weak = new Set(weakItemIds(index, ctx));
  const cats = config.categories.length ? config.categories : ALL_CATEGORIES;
  const kinds = new Set(cats.flatMap((c) => CATEGORY_KINDS[c]));
  return index.items.filter((it) => {
    if (!kinds.has(it.kind)) return false;
    if (config.layer === 'map' && !index.mapShapes.has(it.id)) return false;
    if (config.weakOnly) return weak.has(it.id);
    if (config.scope === 'learned') return (ctx.items[it.id]?.box ?? 0) >= 1;
    return true;
  });
}

/** Lesson position of an item, used to order new items when "all content" is selected. */
function lessonRank(index: CourseIndex, id: string): number {
  const lessonId = index.lessonOf.get(id);
  const lesson = index.content.lessons.find((l) => l.id === lessonId);
  return lesson ? lesson.number : 999;
}

/**
 * Picks `count` items for one category following spec section 9:
 * due items by priority (≤ 70 %), weak items (≤ 20 %), control questions from
 * boxes 5–7 (≥ 1 per 10), the rest new items (all content) or lowest boxes.
 */
function selectFrom(index: CourseIndex, pool: Item[], count: number, config: PracticeConfig, ctx: PracticeContext, rng: Rng): Item[] {
  const today = ctx.today ?? dayKey();
  const weak = new Set(weakItemIds(index, ctx));
  const chosen: Item[] = [];
  const take = (list: Item[], max: number) => {
    for (const it of list) {
      if (chosen.length >= count || max <= 0) break;
      if (chosen.includes(it)) continue;
      chosen.push(it);
      max--;
    }
  };
  const prio = new Map(pool.map((it) => [it.id, priority(ctx.items[it.id], today, weak.has(it.id), rng())]));
  const byPrio = (a: Item, b: Item) => (prio.get(b.id) ?? 0) - (prio.get(a.id) ?? 0);

  if (config.weakOnly) {
    take([...pool].sort(byPrio), count);
    return chosen;
  }

  const seen = pool.filter((it) => (ctx.items[it.id]?.box ?? 0) >= 1);
  const due = seen.filter((it) => isDue(ctx.items[it.id], today)).sort(byPrio);
  take(due, Math.ceil(count * 0.7));
  if (config.prioritizeWeak) take(seen.filter((it) => weak.has(it.id)).sort(byPrio), Math.ceil(count * 0.2));
  const control = shuffle(seen.filter((it) => (ctx.items[it.id]?.box ?? 0) >= 5), rng);
  take(control, Math.max(1, Math.floor(count / 10)));
  if (config.scope === 'all') {
    const fresh = pool.filter((it) => (ctx.items[it.id]?.box ?? 0) === 0).sort((a, b) => lessonRank(index, a.id) - lessonRank(index, b.id));
    take(fresh, count);
  }
  take([...seen].sort((a, b) => (ctx.items[a.id]?.box ?? 0) - (ctx.items[b.id]?.box ?? 0) || byPrio(a, b)), count);
  return chosen;
}

/** Interleaves item lists so that no category appears more than twice in a row (best effort). */
function interleave(groups: Item[][], rng: Rng): Item[] {
  const queues = groups.map((g) => shuffle(g, rng)).filter((g) => g.length);
  const out: Item[] = [];
  while (queues.some((q) => q.length)) {
    const total = queues.reduce((s, q) => s + q.length, 0);
    let r = rng() * total;
    let qi = queues.findIndex((q) => (r -= q.length) < 0);
    if (qi < 0) qi = queues.findIndex((q) => q.length);
    const lastTwo = out.slice(-2).map((it) => categoryOf(it.kind));
    const cat = categoryOf(queues[qi][0].kind);
    if (lastTwo.length === 2 && lastTwo[0] === cat && lastTwo[1] === cat) {
      const alt = queues.findIndex((q) => q.length && categoryOf(q[0].kind) !== cat);
      if (alt >= 0) qi = alt;
    }
    out.push(queues[qi].shift()!);
  }
  return out;
}

export function selectItems(index: CourseIndex, config: PracticeConfig, ctx: PracticeContext, rng: Rng): Item[] {
  let pool = poolFor(index, config, ctx);
  if (config.weakOnly && pool.length < 5) {
    // Fewer than 5 weak items: top up with the lowest boxes and say so in the UI.
    const extra = poolFor(index, { ...config, weakOnly: false, scope: 'learned' }, ctx)
      .filter((it) => !pool.includes(it))
      .sort((a, b) => (ctx.items[a.id]?.box ?? 0) - (ctx.items[b.id]?.box ?? 0))
      .slice(0, Math.max(0, Math.min(config.count, 10) - pool.length));
    pool = [...pool, ...extra];
    return shuffle(pool, rng).slice(0, config.count);
  }
  if (!pool.length) return [];
  if (config.weakOnly) return shuffle(selectFrom(index, pool, config.count, config, ctx, rng), rng);

  const byCat = new Map<Category, Item[]>();
  for (const it of pool) {
    const c = categoryOf(it.kind);
    byCat.set(c, [...(byCat.get(c) ?? []), it]);
  }
  const cats = [...byCat.keys()];
  if (cats.length === 1) return selectFrom(index, pool, config.count, config, ctx, rng);

  const weightSum = cats.reduce((s, c) => s + WEIGHTS[c], 0);
  const quotas = new Map(cats.map((c) => [c, Math.max(1, Math.round((WEIGHTS[c] / weightSum) * config.count))]));
  const groups = cats.map((c) => selectFrom(index, byCat.get(c)!, Math.min(quotas.get(c)!, byCat.get(c)!.length), config, ctx, rng));
  let items = interleave(groups, rng).slice(0, config.count);
  // Top up if some categories were too small for their quota.
  if (items.length < config.count) {
    const extra = selectFrom(index, pool.filter((it) => !items.includes(it)), config.count - items.length, config, ctx, rng);
    items = [...items, ...extra];
  }
  return items;
}

/** The task for one practice item, by kind and mastery. New items start with their learning card. */
export function practiceTasksFor(index: CourseIndex, item: Item, p: ItemProgress | undefined, rng: Rng): Task[] {
  const box = p?.box ?? 0;
  const tasks: Task[] = [];
  if (box === 0) tasks.push(introTask(item.id));
  if (item.kind === 'letter') {
    const hasContrast = (index.contrastOf.get(item.id)?.length ?? 0) > 0;
    if (!item.functionChoice && hasContrast && box >= 2 && rng() < 0.2) tasks.push(glyphChoiceTask(index, item, rng, rng() < 0.5));
    else tasks.push(readTask(item, rng));
  } else if ((item.kind === 'city' || item.kind === 'region') && index.mapShapes.has(item.id)) {
    // Map places: finding on the map, recognising the highlighted area, and reading the name.
    const r = rng();
    if (box === 0 || r < 0.4) tasks.push(locateTask(item as PlaceItem));
    else if (r < 0.65) tasks.push(mapChoiceTask(index, item as PlaceItem, rng));
    else tasks.push(identifyTask(item as PlaceItem));
  } else if (item.kind === 'city' || item.kind === 'region') {
    if (box >= 3 && rng() < 0.2 && (index.lookalikes.get(item.id)?.length ?? 0) >= 3) tasks.push(scanTask(index, item as PlaceItem, rng));
    else tasks.push(identifyTask(item as PlaceItem));
  } else if (item.kind === 'term' && box >= 3 && rng() < 0.25) {
    tasks.push(meaningTask(item));
  } else {
    tasks.push(readTask(item, rng));
  }
  return tasks;
}

export function buildPractice(index: CourseIndex, config: PracticeConfig, ctx: PracticeContext, rng: Rng): Task[] {
  return selectItems(index, config, ctx, rng).flatMap((it) => practiceTasksFor(index, it, ctx.items[it.id], rng));
}

/** Share of the selected pool that is decodable with the letters learned so far (for the "learn more letters first" hint). */
export function poolReadability(index: CourseIndex, config: PracticeConfig, ctx: PracticeContext): number {
  const pool = poolFor(index, { ...config, scope: 'all' }, ctx).filter((it) => it.kind !== 'letter');
  if (!pool.length) return 1;
  const known = new Set([...index.units].filter((id) => (ctx.items[id]?.box ?? 0) >= 1));
  const readable = pool.filter((it) => (index.required.get(it.id) ?? []).every((id) => known.has(id)));
  return readable.length / pool.length;
}
