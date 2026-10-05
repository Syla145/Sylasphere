import { answerSet, canonical } from './match';
import type { ComboItem, CourseContent, CourseMap, Item, ItemKind, LetterItem, MapShape, PlaceItem, Segment, WordItem } from './types';

/**
 * Pre-computed lookups for a loaded course. Built once per course load.
 * Everything here is derived deterministically from the content data.
 */
export interface CourseIndex {
  content: CourseContent;
  items: Item[];
  byId: Map<string, Item>;
  byKind: Record<ItemKind, Item[]>;
  /** Normalised explicit answer sets (letters: readings; places: names + accepted). */
  answers: Map<string, Set<string>>;
  /** Transliteration segments for items read as text. */
  segments: Map<string, Segment[]>;
  /** Extra segment lists accepted for an item (region core names). */
  extraSegments: Map<string, Segment[][]>;
  /** Reading-unit ids needed to decode an item. */
  required: Map<string, string[]>;
  /** Reading units: all letters plus combos marked as units (digraphs). */
  units: Set<string>;
  /** Lesson that introduces an item (lesson id). */
  lessonOf: Map<string, string>;
  /** Contrast partners of a letter. */
  contrastOf: Map<string, string[]>;
  /** Similar-looking places of the same kind, for scan tasks. */
  lookalikes: Map<string, string[]>;
  /** Course map and its clickable areas by item id, once loaded (see attachMap). */
  map?: CourseMap;
  mapShapes: Map<string, MapShape>;
}

/** Adds a loaded course map to an index. Areas without a matching item are ignored. */
export function attachMap(index: CourseIndex, map: CourseMap): CourseIndex {
  index.map = map;
  index.mapShapes = new Map(map.shapes.filter((s) => index.byId.has(s.id)).map((s) => [s.id, s]));
  return index;
}

/** Places are compared within their layer: cities, regions, or districts (a district shares its name with a division). */
export function placeLayer(item: Item): string {
  return item.kind === 'region' && item.regionType === 'district' ? 'district' : item.kind;
}

export function nativeOf(item: Item, lower = false): string {
  if (item.kind === 'letter') return lower ? item.lower : item.upper;
  return item.native;
}

/** Display string for reading tasks (combos: without the leading hyphen marker kept for display). */
function readingNative(item: ComboItem | WordItem | PlaceItem): string {
  return item.native.replace(/^-/, '');
}

export function buildIndex(content: CourseContent): CourseIndex {
  const items: Item[] = [...content.letters, ...content.combos, ...content.words, ...content.places];
  const byId = new Map(items.map((i) => [i.id, i] as const));
  const byKind: Record<ItemKind, Item[]> = { letter: [], combo: [], word: [], element: [], term: [], city: [], region: [] };
  for (const it of items) byKind[it.kind].push(it);

  const answers = new Map<string, Set<string>>();
  const segments = new Map<string, Segment[]>();
  const extraSegments = new Map<string, Segment[][]>();
  const required = new Map<string, string[]>();

  for (const it of items) {
    if (it.kind === 'letter') {
      answers.set(it.id, answerSet(it.accepted));
      required.set(it.id, [it.id]);
      continue;
    }
    const native = readingNative(it);
    segments.set(it.id, content.segments(native));
    const req = content.requiredLetters(native);
    // A unit combo requires itself (a digraph is learned as one unit).
    required.set(it.id, it.kind === 'combo' && it.unit ? [...new Set([...req, it.id])] : req);
    if (it.kind === 'combo') {
      answers.set(it.id, answerSet([it.reading, ...(it.accepted ?? [])]));
    } else if (it.kind === 'city' || it.kind === 'region') {
      answers.set(it.id, answerSet([...it.accepted, it.names.de, it.names.en, it.translit]));
      if (it.core) extraSegments.set(it.id, [content.segments(it.core)]);
    } else {
      const word = it as WordItem;
      answers.set(it.id, answerSet([word.translit, ...(word.extra ?? [])]));
    }
  }

  const lessonOf = new Map<string, string>();
  for (const lesson of content.lessons) {
    for (const id of lesson.newIds) if (!lessonOf.has(id)) lessonOf.set(id, lesson.id);
  }

  const contrastOf = new Map<string, string[]>();
  for (const set of content.contrastSets) {
    for (const id of set.itemIds) {
      const others = set.itemIds.filter((x) => x !== id);
      contrastOf.set(id, [...new Set([...(contrastOf.get(id) ?? []), ...others])]);
    }
  }

  const lookalikes = new Map<string, string[]>();
  for (const kind of ['city', 'region'] as const) {
    const list = byKind[kind] as PlaceItem[];
    for (const p of list) {
      const scored = list
        .filter((o) => o.id !== p.id && placeLayer(o) === placeLayer(p))
        .map((o) => ({ id: o.id, score: similarity(p.native, o.native) }))
        .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
      lookalikes.set(p.id, scored.slice(0, 6).map((s) => s.id));
    }
  }

  const units = new Set<string>([...content.letters.map((l) => l.id), ...content.combos.filter((c) => c.unit).map((c) => c.id)]);

  return { content, items, byId, byKind, answers, segments, extraSegments, required, units, lessonOf, contrastOf, lookalikes, mapShapes: new Map() };
}

/** Visual similarity for scan distractors: shared ending, shared start, similar length. */
function similarity(a: string, b: string): number {
  const x = a.toLowerCase();
  const y = b.toLowerCase();
  let score = 0;
  let end = 0;
  while (end < Math.min(x.length, y.length) && x[x.length - 1 - end] === y[y.length - 1 - end]) end++;
  score += Math.min(end, 5) * 2;
  if (x[0] === y[0]) score += 2;
  if (x.slice(0, 2) === y.slice(0, 2)) score += 1;
  score += Math.max(0, 3 - Math.abs(x.length - y.length));
  return score;
}

/** Canonical reading shown in feedback. */
export function readingOf(index: CourseIndex, item: Item): string {
  if (item.kind === 'letter') return item.reading;
  if (item.kind === 'combo') return item.reading;
  if (item.kind === 'city' || item.kind === 'region') return item.translit;
  return item.translit || canonical(index.segments.get(item.id) ?? []);
}

/** Both forms for cased scripts (Аа), the single glyph otherwise (ก). */
export function letterGlyphs(l: LetterItem, sep = ''): string {
  return l.lower && l.lower !== l.upper ? `${l.upper}${sep}${l.lower}` : l.upper;
}

export function isLetter(item: Item): item is LetterItem {
  return item.kind === 'letter';
}
export function isPlace(item: Item): item is PlaceItem {
  return item.kind === 'city' || item.kind === 'region';
}
export function isWord(item: Item): item is WordItem {
  return item.kind === 'word' || item.kind === 'element' || item.kind === 'term';
}
