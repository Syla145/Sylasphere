import type { CourseContent, CourseMap } from '../../domain/types';
import { CONTRAST_SETS, LETTERS } from './letters';
import { LESSONS, PHASES } from './lessons';
import { CITIES, REGIONS } from './places';
import { requiredLettersRu, segmentRu } from './translit';
import { COMBOS, ELEMENTS, TERMS, WORDS } from './words';
import { withCoords } from '../coords';
import { COORDS } from './coords';

const content: CourseContent = {
  id: 'ru',
  letters: LETTERS,
  combos: COMBOS,
  words: [...WORDS, ...ELEMENTS, ...TERMS],
  places: withCoords([...CITIES, ...REGIONS], COORDS),
  contrastSets: CONTRAST_SETS,
  phases: PHASES,
  lessons: LESSONS,
  segments: segmentRu,
  requiredLetters: requiredLettersRu,
  loadMap: () => import('./map.json').then((m) => m.default as unknown as CourseMap),
  hasCase: true,
};

export default content;
