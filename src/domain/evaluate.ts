import { placeLayer, type CourseIndex } from './courseIndex';
import { firstMismatch, matchSegments } from './match';
import { normalize } from './normalize';
import type { GradedTask } from './tasks';
import type { Item } from './types';

export interface Evaluation {
  correct: boolean;
  /** Another item whose answer the input matches exactly (a confusion, not a typo). */
  confusedWith?: string;
  /** Native character index of the first misread character (words, combos). */
  mismatchAt?: number;
}

/** Does `input` name or read `item`? Exact match against explicit and rule-defined answers only. */
export function accepts(index: CourseIndex, item: Item, input: string): boolean {
  const norm = normalize(input);
  if (!norm) return false;
  const set = index.answers.get(item.id);
  if (set?.has(norm)) return true;
  if (item.kind === 'letter') return false;
  const segs = index.segments.get(item.id);
  if (segs && matchSegments(input, segs)) return true;
  const extra = index.extraSegments.get(item.id);
  if (extra?.some((s) => matchSegments(input, s))) return true;
  return false;
}

function acceptsMeaning(item: Item, input: string): boolean {
  if (item.kind !== 'term' && item.kind !== 'word' && item.kind !== 'element') return false;
  const norm = normalize(input);
  if (!norm) return false;
  return [...item.meaning.de, ...item.meaning.en].some((m) => normalize(m) === norm);
}

export function evaluateTyped(index: CourseIndex, task: GradedTask, input: string): Evaluation {
  const item = index.byId.get(task.itemId);
  if (!item) return { correct: false };

  if (task.kind === 'meaning') return { correct: acceptsMeaning(item, input) };

  if (accepts(index, item, input)) return { correct: true };

  const result: Evaluation = { correct: false };
  // Confusion: the input is exactly right for a different item of the same kind.
  // Places compare within their layer (a district is confused with a district, not a division).
  const peers = index.byKind[item.kind].filter((p) => placeLayer(p) === placeLayer(item));
  const other = peers.find((p) => p.id !== item.id && accepts(index, p, input));
  if (other) result.confusedWith = other.id;

  const segs = index.segments.get(item.id);
  if (segs && item.kind !== 'city' && item.kind !== 'region') {
    const at = firstMismatch(input, segs);
    if (at >= 0) result.mismatchAt = at;
  }
  return result;
}
