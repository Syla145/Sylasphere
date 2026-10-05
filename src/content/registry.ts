import type { CountryDef, CourseMeta, LanguageDef, ScriptDef } from '../domain/types';

export const SCRIPTS: Record<string, ScriptDef> = {
  Cyrl: { id: 'Cyrl', name: { de: 'Kyrillisch', en: 'Cyrillic' }, type: 'alphabet' },
  Grek: { id: 'Grek', name: { de: 'Griechisch', en: 'Greek' }, type: 'alphabet' },
  Beng: { id: 'Beng', name: { de: 'Bengalisch', en: 'Bengali' }, type: 'abugida' },
  Thai: { id: 'Thai', name: { de: 'Thai', en: 'Thai' }, type: 'abugida' },
};

export const LANGUAGES: Record<string, LanguageDef> = {
  ru: { id: 'ru', name: { de: 'Russisch', en: 'Russian' }, scriptId: 'Cyrl' },
  el: { id: 'el', name: { de: 'Griechisch', en: 'Greek' }, scriptId: 'Grek' },
  bn: { id: 'bn', name: { de: 'Bengalisch', en: 'Bengali' }, scriptId: 'Beng' },
  th: { id: 'th', name: { de: 'Thai', en: 'Thai' }, scriptId: 'Thai' },
};

export const COUNTRIES: Record<string, CountryDef> = {
  RU: { id: 'RU', name: { de: 'Russland', en: 'Russia' } },
  GR: { id: 'GR', name: { de: 'Griechenland', en: 'Greece' } },
  BD: { id: 'BD', name: { de: 'Bangladesch', en: 'Bangladesh' } },
  IN: { id: 'IN', name: { de: 'Indien', en: 'India' } },
  TH: { id: 'TH', name: { de: 'Thailand', en: 'Thailand' } },
};

/** Courses shown on the home page. A course links one script, one language and its countries. */
export const COURSES: CourseMeta[] = [
  {
    id: 'ru',
    slug: 'russian',
    name: { de: 'Russian Cyrillic', en: 'Russian Cyrillic' },
    scriptId: 'Cyrl',
    languageId: 'ru',
    countryIds: ['RU'],
    sampleGlyphs: 'А Б В Г Д',
    fontClass: 'font-native-latin',
    status: 'available',
    hasMap: true,
    load: () => import('./ru').then((m) => m.default),
  },
  {
    id: 'el',
    slug: 'greek',
    name: { de: 'Greek', en: 'Greek' },
    scriptId: 'Grek',
    languageId: 'el',
    countryIds: ['GR'],
    sampleGlyphs: 'Α Β Γ Δ Ε',
    fontClass: 'font-native-latin',
    status: 'available',
    load: () => import('./el').then((m) => m.default),
  },
  {
    id: 'bn',
    slug: 'bengali',
    name: { de: 'Bengali', en: 'Bengali' },
    scriptId: 'Beng',
    languageId: 'bn',
    countryIds: ['BD'],
    sampleGlyphs: 'অ আ ই ঈ',
    fontClass: 'font-native-bengali',
    status: 'available',
    hasMap: true,
    load: () => import('./bn').then((m) => m.default),
  },
  {
    id: 'th',
    slug: 'thai',
    name: { de: 'Thai', en: 'Thai' },
    scriptId: 'Thai',
    languageId: 'th',
    countryIds: ['TH'],
    sampleGlyphs: 'ก ข ค ง',
    fontClass: 'font-native-thai',
    status: 'available',
    hasMap: true,
    load: () => import('./th').then((m) => m.default),
  },
];

export const courseBySlug = (slug: string | undefined) => COURSES.find((c) => c.slug === slug);
export const courseById = (id: string) => COURSES.find((c) => c.id === id);
