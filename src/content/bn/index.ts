import type { CourseContent, CourseMap } from '../../domain/types';
import { LESSONS, PHASES } from './lessons';
import { CITIES, DISTRICTS, DIVISIONS } from './places';
import { CONJUNCTS, CONTRAST_SETS, ENDINGS, PHALAS, requiredUnitsBn, SYLLABLES, UNITS } from './units';
import { TERMS, WORDS } from './words';
import { withCoords } from '../coords';
import { COORDS } from './coords';

/**
 * Bengali: readings are listed explicitly (no rule-based segmentation),
 * because the inherent vowel is pronounced or dropped depending on the word.
 */
const content: CourseContent = {
  id: 'bn',
  letters: UNITS,
  combos: [...SYLLABLES, ...PHALAS, ...CONJUNCTS, ...ENDINGS],
  words: [...WORDS, ...TERMS],
  places: withCoords([...CITIES, ...DIVISIONS, ...DISTRICTS], COORDS),
  contrastSets: CONTRAST_SETS,
  phases: PHASES,
  lessons: LESSONS,
  segments: () => [],
  requiredLetters: requiredUnitsBn,
  hasCase: false,
  loadMap: () => import('./map.json').then((m) => m.default as unknown as CourseMap),
};

export default content;
