import { type CourseIndex, nativeOf } from './courseIndex';
import { taskKey, type ChoiceOption, type Task } from './tasks';
import type { Item, LetterItem, PlaceItem } from './types';

export type Rng = () => number;

export function shuffle<T>(list: T[], rng: Rng): T[] {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function pick<T>(list: T[], rng: Rng): T | undefined {
  return list.length ? list[Math.floor(rng() * list.length)] : undefined;
}

/** Deterministic seeded RNG (mulberry32), used for reproducible tests. */
export function seededRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const introTask = (itemId: string, lower?: boolean): Task => ({ key: taskKey('intro'), kind: 'intro', itemId, lower });

/**
 * Capitals as on signs: upper case without stress accents (Αθήνα → ΑΘΗΝΑ).
 * Only the acute/tonos is removed; letters such as Й and Ё keep their marks.
 */
export function signCaps(text: string): string {
  return text.toUpperCase().normalize('NFD').replace(/\u0301/g, '').normalize('NFC');
}

/** Text shown for reading tasks. Words appear in lower case like on most signs, sometimes in capitals. */
export function displayFor(item: Item, rng: Rng, opts: { lower?: boolean; caseMix?: boolean } = {}): string {
  if (item.kind === 'letter') {
    if (opts.lower !== undefined) return opts.lower ? item.lower : item.upper;
    return rng() < 0.5 ? item.upper : item.lower;
  }
  const native = nativeOf(item);
  if (opts.caseMix && (item.kind === 'word' || item.kind === 'term' || item.kind === 'element') && rng() < 0.25) {
    return signCaps(native);
  }
  return native;
}

export function readTask(item: Item, rng: Rng, opts: { lower?: boolean; caseMix?: boolean } = {}): Task {
  if (item.kind === 'letter' && item.functionChoice) return functionTask(item, rng);
  return { key: taskKey('read'), kind: 'read', itemId: item.id, display: displayFor(item, rng, { caseMix: true, ...opts }) };
}

export function identifyTask(place: PlaceItem): Task {
  return { key: taskKey('identify'), kind: 'identify', itemId: place.id, display: place.native };
}

export function meaningTask(item: Item): Task {
  return { key: taskKey('meaning'), kind: 'meaning', itemId: item.id, display: nativeOf(item) };
}

export function functionTask(letter: LetterItem, rng: Rng): Task {
  const fc = letter.functionChoice!;
  const options: ChoiceOption[] = shuffle(
    [{ l10n: fc.correct, correct: true }, ...fc.wrong.map((w) => ({ l10n: w, correct: false }))],
    rng,
  );
  return { key: taskKey('fn'), kind: 'choice', itemId: letter.id, question: 'function', display: rng() < 0.5 ? letter.upper : letter.lower, options };
}

function distractorLetters(index: CourseIndex, letter: LetterItem, rng: Rng, pool?: Set<string>): LetterItem[] {
  const all = index.content.letters.filter((l) => l.id !== letter.id && !l.functionChoice);
  const contrast = (index.contrastOf.get(letter.id) ?? [])
    .map((id) => index.byId.get(id) as LetterItem | undefined)
    .filter((l): l is LetterItem => !!l && !l.functionChoice && (!pool || pool.has(l.id)));
  const preferred = shuffle(contrast, rng);
  const known = shuffle(all.filter((l) => !pool || pool.has(l.id)), rng);
  const rest = shuffle(all, rng);
  const out: LetterItem[] = [];
  const readings = new Set([letter.reading]);
  for (const l of [...preferred, ...known, ...rest]) {
    if (out.length >= 2) break;
    if (out.includes(l) || readings.has(l.reading)) continue;
    readings.add(l.reading);
    out.push(l);
  }
  return out;
}

/** First contact: glyph shown, choose its reading out of three. */
export function readingChoiceTask(index: CourseIndex, letter: LetterItem, rng: Rng, known?: Set<string>): Task {
  if (letter.functionChoice) return functionTask(letter, rng);
  const others = distractorLetters(index, letter, rng, known);
  const options: ChoiceOption[] = shuffle(
    [{ label: letter.reading, correct: true, itemId: letter.id }, ...others.map((o) => ({ label: o.reading, correct: false, itemId: o.id }))],
    rng,
  );
  return { key: taskKey('choice'), kind: 'choice', itemId: letter.id, question: 'reading', display: letter.upper, options };
}

/** Reverse direction / contrast: reading shown, choose the glyph. */
export function glyphChoiceTask(index: CourseIndex, letter: LetterItem, rng: Rng, lower = false, known?: Set<string>): Task {
  if (letter.functionChoice) return functionTask(letter, rng);
  const others = distractorLetters(index, letter, rng, known);
  const glyph = (l: LetterItem) => (lower ? l.lower : l.upper);
  const options: ChoiceOption[] = shuffle(
    [{ label: glyph(letter), correct: true, itemId: letter.id }, ...others.map((o) => ({ label: glyph(o), correct: false, itemId: o.id }))],
    rng,
  );
  return { key: taskKey('glyph'), kind: 'choice', itemId: letter.id, question: 'glyph', display: letter.reading, options };
}

/** Find the place among four similar-looking names. The prompt is the place's known name. */
export function scanTask(index: CourseIndex, place: PlaceItem, rng: Rng): Task {
  const candidates = (index.lookalikes.get(place.id) ?? []).map((id) => index.byId.get(id) as PlaceItem);
  const distractors = shuffle(candidates.slice(0, 5), rng).slice(0, 3);
  const options: ChoiceOption[] = shuffle(
    [{ label: place.native, correct: true, itemId: place.id }, ...distractors.map((d) => ({ label: d.native, correct: false, itemId: d.id }))],
    rng,
  );
  return { key: taskKey('scan'), kind: 'choice', itemId: place.id, question: 'scan', display: '', options };
}

/** Read the name and click the place on the map. */
export function locateTask(place: PlaceItem): Task {
  return { key: taskKey('locate'), kind: 'locate', itemId: place.id, display: place.native };
}

/** The place is highlighted on the map; pick its name among nearby places (all in native script). */
export function mapChoiceTask(index: CourseIndex, place: PlaceItem, rng: Rng): Task {
  const own = index.mapShapes.get(place.id);
  const dist = (id: string) => {
    const s = index.mapShapes.get(id)!;
    return Math.hypot(s.label[0] - own!.label[0], s.label[1] - own!.label[1]);
  };
  // Neighbours make the choice about position, not about a random name.
  const near = [...index.mapShapes.keys()].filter((id) => id !== place.id).sort((a, b) => dist(a) - dist(b));
  const distractors = shuffle(near.slice(0, 6), rng).slice(0, 3).map((id) => index.byId.get(id) as PlaceItem);
  const options: ChoiceOption[] = shuffle(
    [{ label: place.native, correct: true, itemId: place.id }, ...distractors.map((d) => ({ label: d.native, correct: false, itemId: d.id }))],
    rng,
  );
  return { key: taskKey('mapchoice'), kind: 'choice', itemId: place.id, question: 'map', display: '', options };
}

/** A fresh typed task for re-asking an item later in the session. */
export function retaskFor(index: CourseIndex, rng: Rng) {
  return (task: Task): Task => {
    const item = index.byId.get(task.itemId);
    if (!item) return { ...task, key: taskKey('re') };
    if (task.kind === 'choice' && task.question === 'function' && item.kind === 'letter') return functionTask(item, rng);
    if (item.kind === 'city' || item.kind === 'region') {
      if (task.kind === 'locate' || (task.kind === 'choice' && task.question === 'map')) return locateTask(item);
      return task.kind === 'read' ? { ...task, key: taskKey('re') } : identifyTask(item);
    }
    if (task.kind === 'meaning') return meaningTask(item);
    if (task.kind === 'read') return { ...task, key: taskKey('re') };
    return readTask(item, rng);
  };
}
