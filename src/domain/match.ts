import { normalize } from './normalize';
import type { Segment } from './types';

/**
 * Exact matching against explicitly defined alternatives.
 *
 * A native word is split into segments, each with a fixed list of accepted
 * Latin spellings (e.g. Е → "e" | "ye"). An input is accepted only if it can be
 * cut into exactly those segments. This is deterministic and exact: every
 * accepted spelling is the product of rules written down in the content, and
 * nothing is guessed by similarity.
 */
export function matchSegments(input: string, segments: Segment[]): boolean {
  const text = normalize(input);
  return reachable(text, segments).last.has(text.length);
}

interface Reach {
  /** reach[i] = input positions reachable after consuming i segments */
  steps: Set<number>[];
  last: Set<number>;
}

function reachable(text: string, segments: Segment[]): Reach {
  let current = new Set<number>([0]);
  const steps: Set<number>[] = [current];
  for (const seg of segments) {
    const next = new Set<number>();
    for (const pos of current) {
      for (const alt of seg.alts) {
        if (alt === '') {
          next.add(pos);
        } else if (text.startsWith(alt, pos)) {
          next.add(pos + alt.length);
        }
      }
    }
    steps.push(next);
    current = next;
    if (current.size === 0) break;
  }
  return { steps, last: steps.length === segments.length + 1 ? current : new Set() };
}

/**
 * For hints: the native character index of the first segment that the input
 * no longer matches, or -1 if the input matches completely or only lacks an
 * ending. Used for "check the 3rd character".
 */
export function firstMismatch(input: string, segments: Segment[]): number {
  const text = normalize(input);
  const { steps } = reachable(text, segments);
  for (let i = 0; i < segments.length; i++) {
    if (steps[i + 1] === undefined || steps[i + 1].size === 0) return segments[i].index;
  }
  return steps[segments.length].has(text.length) ? -1 : segments.length > 0 ? segments[segments.length - 1].index : -1;
}

/** Canonical (first alternative) transliteration of segments. */
export function canonical(segments: Segment[]): string {
  return segments.map((s) => s.alts[0]).join('');
}

/** Set of normalised explicit answers. */
export function answerSet(answers: string[]): Set<string> {
  return new Set(answers.map(normalize).filter(Boolean));
}
