import type { CourseIndex } from './courseIndex';
import type { ItemProgress } from './srs';
import {
  functionTask,
  glyphChoiceTask,
  identifyTask,
  introTask,
  readingChoiceTask,
  readTask,
  shuffle,
  signCaps,
  type Rng,
  locateTask,
  mapChoiceTask,
} from './taskFactory';
import type { Task } from './tasks';
import type { ComboItem, Item, LetterItem, Lesson, PlaceItem } from './types';

type Items = Record<string, ItemProgress | undefined>;

/**
 * Reading units (letters and digraph units) known when a lesson starts: taught
 * in this or an earlier lesson, or already seen in practice.
 */
export function knownLettersFor(index: CourseIndex, lesson: Lesson, items: Items): Set<string> {
  const known = new Set<string>();
  for (const l of index.content.lessons) {
    if (l.number <= lesson.number && (l.type === 'letters' || l.type === 'combos')) {
      l.newIds.filter((id) => index.units.has(id)).forEach((id) => known.add(id));
    }
  }
  for (const id of index.units) if ((items[id]?.box ?? 0) >= 1) known.add(id);
  return known;
}

/** Reading units the learner has met (box ≥ 1). */
export function knownUnits(index: CourseIndex, items: Items): Set<string> {
  return new Set([...index.units].filter((id) => (items[id]?.box ?? 0) >= 1));
}

export function isDecodable(index: CourseIndex, itemId: string, known: Set<string>): boolean {
  const req = index.required.get(itemId) ?? [];
  return req.every((id) => known.has(id));
}

/** Words, terms and places that are decodable with `known` and contain at least one of `focus`. */
function pickReadables(index: CourseIndex, known: Set<string>, focus: string[], count: number, rng: Rng, exclude: Set<string>): Item[] {
  const pool = [...index.byKind.word, ...index.byKind.element, ...index.byKind.term, ...index.byKind.city].filter(
    (it) => !exclude.has(it.id) && isDecodable(index, it.id, known),
  );
  const scored = shuffle(pool, rng).map((it) => {
    const req = index.required.get(it.id) ?? [];
    const hasFocus = focus.some((f) => req.includes(f));
    let score = hasFocus ? 4 : 0;
    if (it.kind === 'city') score += 3 + (4 - (it as PlaceItem).tier) * 0.3;
    else if (it.kind === 'term') score += 2;
    else if (it.kind === 'element') score += 1.5;
    else score += 1;
    return { it, score };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, count).map((s) => s.it);
}

function letterLesson(index: CourseIndex, lesson: Lesson, items: Items, rng: Rng): Task[] {
  const letters = lesson.newIds.map((id) => index.byId.get(id) as LetterItem);
  const known = knownLettersFor(index, lesson, items);
  const n = letters.length;
  const tasks: Task[] = [];

  // A – get to know: card → recognise; first typing only after the next letter (interleaved)
  letters.forEach((l, i) => {
    tasks.push(introTask(l.id));
    tasks.push(l.functionChoice ? functionTask(l, rng) : readingChoiceTask(index, l, rng, known));
    if (i > 0) tasks.push(readTask(letters[i - 1], rng, { lower: false }));
  });
  tasks.push(readTask(letters[n - 1], rng, { lower: false }));

  // B – recall again, now in lower case, mixed with an earlier letter
  const recall = n >= 5 ? shuffle(letters, rng).slice(0, 3) : letters;
  const earlier = index.content.letters.filter((l) => known.has(l.id) && !lesson.newIds.includes(l.id) && !l.functionChoice);
  const review = shuffle(earlier, rng)
    .sort((a, b) => (items[a.id]?.box ?? 0) - (items[b.id]?.box ?? 0))
    .slice(0, n <= 3 ? 1 : 0);
  tasks.push(...shuffle([...recall.map((l) => readTask(l, rng, { lower: true })), ...review.map((l) => readTask(l, rng))], rng));

  // C – contrast: reading shown, pick the right glyph among look-alikes
  const withContrast = letters.filter((l) => !l.functionChoice && (index.contrastOf.get(l.id)?.length ?? 0) > 0);
  const contrastPool = withContrast.length ? withContrast : letters.filter((l) => !l.functionChoice);
  shuffle(contrastPool, rng)
    .sort((a, b) => Number(!!b.falseFriend) - Number(!!a.falseFriend))
    .slice(0, 2)
    .forEach((l) => tasks.push(glyphChoiceTask(index, l, rng, rng() < 0.5, known)));

  // D – combinations built from new and known letters
  const comboCount = n === 3 ? 3 : 2;
  // Only plain syllables: combos taught in a later rules lesson (endings, finals, composite vowels) wait for it.
  const lessonNo = (id: string) => index.content.lessons.find((l) => l.id === index.lessonOf.get(id))?.number ?? 0;
  const combos = (index.byKind.combo as ComboItem[]).filter(
    (c) => !c.native.startsWith('-') && !c.unit && lessonNo(c.id) <= lesson.number && isDecodable(index, c.id, known),
  );
  const focusCombos = shuffle(combos, rng).sort((a, b) => {
    const fa = (index.required.get(a.id) ?? []).some((x) => lesson.newIds.includes(x)) ? 0 : 1;
    const fb = (index.required.get(b.id) ?? []).some((x) => lesson.newIds.includes(x)) ? 0 : 1;
    return fa - fb;
  });
  focusCombos.slice(0, comboCount).forEach((c) => tasks.push(readTask(c, rng)));

  // E – first real words (geographic ones preferred)
  const used = new Set<string>();
  const wordCount = n >= 5 ? 2 : 3;
  // Curated words first (scripts where only a hand-picked list is safe to read at this stage).
  const curated = (lesson.wordIds ?? []).map((id) => index.byId.get(id)!).filter((it) => it && isDecodable(index, it.id, known));
  const words = curated.length ? shuffle(curated, rng).slice(0, wordCount) : pickReadables(index, known, lesson.newIds, wordCount, rng, used);
  words.forEach((w) => {
    used.add(w.id);
    tasks.push(readTask(w, rng));
  });

  // G – closing round: each new letter once more, inside a new word where possible
  const closing = n >= 5 ? 1 : 2;
  shuffle(letters, rng)
    .slice(0, closing)
    .forEach((l) => {
      const word = curated.length
        ? shuffle(curated, rng).find((w) => !used.has(w.id) && (index.required.get(w.id) ?? []).includes(l.id))
        : pickReadables(index, known, [l.id], 1, rng, used)[0];
      if (word && (index.required.get(word.id) ?? []).includes(l.id)) {
        used.add(word.id);
        tasks.push(readTask(word, rng));
      } else {
        tasks.push(readTask(l, rng));
      }
    });
  return tasks;
}

function reviewLesson(index: CourseIndex, lesson: Lesson, items: Items, rng: Rng): Task[] {
  const letters = (lesson.reviewIds ?? []).map((id) => index.byId.get(id) as LetterItem);
  const known = knownLettersFor(index, lesson, items);
  const lower = !!lesson.lowercase;
  const tasks: Task[] = [];
  shuffle(letters, rng).forEach((l) => tasks.push(readTask(l, rng, { lower })));
  shuffle(letters.filter((l) => !l.functionChoice), rng)
    .slice(0, 4)
    .forEach((l) => tasks.push(glyphChoiceTask(index, l, rng, lower, known)));
  const words = pickReadables(index, known, lesson.reviewIds ?? [], 6, rng, new Set());
  words.forEach((w, i) => {
    const t = readTask(w, rng, { caseMix: false });
    tasks.push(lesson.capsWords && i % 2 === 0 && t.kind === 'read' ? { ...t, display: signCaps(t.display) } : t);
  });
  return tasks;
}

/** Groups of k: cards, then recall shifted by one card (spaced within the lesson). */
function cardsThenRecall(ids: string[], groupSize: number, card: (id: string) => Task, recall: (id: string) => Task): Task[] {
  const tasks: Task[] = [];
  for (let g = 0; g < ids.length; g += groupSize) {
    const group = ids.slice(g, g + groupSize);
    group.forEach((id, i) => {
      tasks.push(card(id));
      if (i > 0) tasks.push(recall(group[i - 1]));
    });
    tasks.push(recall(group[group.length - 1]));
  }
  return tasks;
}

function comboLesson(index: CourseIndex, lesson: Lesson, items: Items, rng: Rng): Task[] {
  // Endings lessons come after the whole alphabet; digraph lessons only know what was taught so far.
  const known = new Set([...index.content.letters.map((l) => l.id), ...knownLettersFor(index, lesson, items)]);
  const tasks = cardsThenRecall(lesson.newIds, 3, (id) => introTask(id), (id) => readTask(index.byId.get(id)!, rng));
  // Places that carry the endings
  const places = [...index.byKind.city, ...index.byKind.region] as PlaceItem[];
  const used = new Set<string>();
  const words = [...places, ...index.byKind.term, ...index.byKind.word] as Item[];
  shuffle(lesson.newIds, rng).forEach((id) => {
    const combo = index.byId.get(id) as ComboItem;
    const suffix = combo.native.replace(/^-/, '').toLowerCase();
    const carries = (it: Item) =>
      combo.native.startsWith('-')
        ? 'native' in it && it.native.toLowerCase().split(/[\s-]/).some((part) => part.endsWith(suffix))
        : (index.required.get(it.id) ?? []).includes(id);
    const match = shuffle(combo.unit ? words : places, rng).find((p) => !used.has(p.id) && carries(p) && isDecodable(index, p.id, known));
    if (match) {
      used.add(match.id);
      tasks.push(readTask(match, rng));
    }
  });
  shuffle(lesson.newIds, rng)
    .slice(0, 4)
    .forEach((id) => tasks.push(readTask(index.byId.get(id)!, rng)));
  return tasks;
}

function vocabLesson(index: CourseIndex, lesson: Lesson, rng: Rng): Task[] {
  const tasks = cardsThenRecall(lesson.newIds, 4, (id) => introTask(id), (id) => readTask(index.byId.get(id)!, rng, { caseMix: false }));
  shuffle(lesson.newIds, rng).forEach((id) => tasks.push(readTask(index.byId.get(id)!, rng)));
  return tasks;
}

/**
 * Places with a map area (districts): every card is followed by finding the
 * place on the map; then each name is read (typed), and a few are recognised
 * from their highlighted area.
 */
function mapPlaceLesson(index: CourseIndex, lesson: Lesson, rng: Rng): Task[] {
  const place = (id: string) => index.byId.get(id) as PlaceItem;
  const tasks = cardsThenRecall(lesson.newIds, 3, (id) => introTask(id), (id) => locateTask(place(id)));
  shuffle(lesson.newIds, rng).forEach((id) => tasks.push(identifyTask(place(id))));
  shuffle(lesson.newIds, rng)
    .slice(0, 4)
    .forEach((id) => tasks.push(mapChoiceTask(index, place(id), rng)));
  shuffle(lesson.newIds, rng)
    .slice(0, 4)
    .forEach((id) => tasks.push(locateTask(place(id))));
  return tasks;
}

function placeLesson(index: CourseIndex, lesson: Lesson, rng: Rng): Task[] {
  if (lesson.newIds.length && lesson.newIds.every((id) => index.mapShapes.has(id))) return mapPlaceLesson(index, lesson, rng);
  const tasks = cardsThenRecall(lesson.newIds, 3, (id) => introTask(id), (id) => identifyTask(index.byId.get(id) as PlaceItem));
  shuffle(lesson.newIds, rng)
    .slice(0, 6)
    .forEach((id) => tasks.push(identifyTask(index.byId.get(id) as PlaceItem)));
  return tasks;
}

export function buildLesson(index: CourseIndex, lesson: Lesson, items: Items, rng: Rng): Task[] {
  switch (lesson.type) {
    case 'letters':
      return letterLesson(index, lesson, items, rng);
    case 'review':
      return reviewLesson(index, lesson, items, rng);
    case 'combos':
      return comboLesson(index, lesson, items, rng);
    case 'vocab':
      return vocabLesson(index, lesson, rng);
    case 'places':
      return placeLesson(index, lesson, rng);
  }
}

/** Final-round tasks for items still wrong at the end of a lesson. */
export function finalRoundTasks(index: CourseIndex, rng: Rng) {
  return (ids: string[]): Task[] =>
    ids.map((id) => {
      const item = index.byId.get(id)!;
      if (item.kind === 'city' || item.kind === 'region') return identifyTask(item);
      return readTask(item, rng);
    });
}
