import type { CourseContent, CourseMap } from '../../domain/types';
import { LESSONS, PHASES } from './lessons';
import { CITIES, PROVINCES } from './places';
import { COMBOS, CONTRAST_SETS, requiredUnitsTh, SYLLABLES, UNITS } from './units';
import { ELEMENTS, TERMS, WORDS } from './words';
import { withCoords } from '../coords';
import { COORDS } from './coords';

/**
 * Thai: readings are listed explicitly for every unit, word and place
 * (no rule-based segmentation), because Thai spelling does not map to
 * romanisation character by character.
 */
const content: CourseContent = {
  id: 'th',
  letters: UNITS,
  combos: [...SYLLABLES, ...COMBOS],
  words: [...WORDS, ...ELEMENTS, ...TERMS],
  places: withCoords([...CITIES, ...PROVINCES], COORDS),
  contrastSets: CONTRAST_SETS,
  phases: PHASES,
  lessons: LESSONS,
  segments: () => [],
  requiredLetters: requiredUnitsTh,
  loadMap: () => import('./map.json').then((m) => m.default as unknown as CourseMap),
  hasCase: false,
};

export default content;
