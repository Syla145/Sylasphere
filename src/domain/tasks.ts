import type { L10n } from './types';

/**
 * Tasks are generated per session. They reference content items by id and
 * carry only what the view needs to render.
 */
export interface ChoiceOption {
  /** Plain label (glyph or reading) … */
  label?: string;
  /** … or a translated label (function questions). */
  l10n?: L10n;
  correct: boolean;
  /** Item the option stands for (used to name confusions). */
  itemId?: string;
}

export type Task =
  | { key: string; kind: 'intro'; itemId: string; lower?: boolean }
  /** Type the reading (letters, combos, words, terms; places in letter lessons). */
  | { key: string; kind: 'read'; itemId: string; display: string }
  /** Type a name for a place (DE, EN or transliteration). */
  | { key: string; kind: 'identify'; itemId: string; display: string }
  /** Type a meaning (DE or EN) for a GeoGuessr term. */
  | { key: string; kind: 'meaning'; itemId: string; display: string }
  /** Read the name, then click the place on the course map. */
  | { key: string; kind: 'locate'; itemId: string; display: string }
  /**
   * Choice tasks:
   * - reading: glyph shown, pick the reading (first contact only)
   * - glyph: reading shown, pick the glyph (reverse direction, contrast)
   * - function: letters without a sound of their own (Ь, Ъ)
   * - scan: find the named place among similar-looking names
   * - map: a place is highlighted on the map, pick its native name
   */
  | {
      key: string;
      kind: 'choice';
      itemId: string;
      question: 'reading' | 'glyph' | 'function' | 'scan' | 'map';
      display: string;
      options: ChoiceOption[];
    };

export type GradedTask = Exclude<Task, { kind: 'intro' }>;

export const isGraded = (t: Task): t is GradedTask => t.kind !== 'intro';

let counter = 0;
export const taskKey = (prefix: string) => `${prefix}-${++counter}`;
