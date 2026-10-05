import type { CourseIndex } from './courseIndex';
import type { ProgressRoot } from './progress';
import type { L10n } from './types';

/** Twelve quiet achievements (spec section 10). Conditions are pure functions over stored progress. */
export interface AchievementDef {
  id: string;
  title: L10n;
  description: L10n;
  check: (root: ProgressRoot, courseId: string, index: CourseIndex | null) => boolean;
}

const course = (root: ProgressRoot, id: string) => root.courses[id];
const anyCourse = (root: ProgressRoot, pred: (items: ProgressRoot['courses'][string]) => boolean) =>
  Object.values(root.courses).some(pred);

const citiesRecognized = (root: ProgressRoot, courseId: string, index: CourseIndex | null) => {
  const cp = course(root, courseId);
  if (!cp || !index) return 0;
  return index.byKind.city.filter((c) => (cp.items[c.id]?.box ?? 0) >= 3).length;
};

export const ACHIEVEMENTS: AchievementDef[] = [
  {
    id: 'first-steps',
    title: { de: 'Erste Schritte', en: 'First Steps' },
    description: { de: 'Erste Lektion abgeschlossen', en: 'Completed your first lesson' },
    check: (root) => anyCourse(root, (c) => Object.keys(c.lessons).length > 0),
  },
  {
    id: 'first-word',
    title: { de: 'Erstes Wort', en: 'First Word' },
    description: { de: 'Erstes Wort richtig gelesen', en: 'Read your first word correctly' },
    check: (root) => anyCourse(root, (c) => Object.entries(c.items).some(([id, p]) => /:(word|term|element):/.test(id) && p.ok > 0)),
  },
  {
    id: 'first-city',
    title: { de: 'Erste Stadt', en: 'First City' },
    description: { de: 'Erste Stadt richtig erkannt', en: 'Recognised your first city' },
    check: (root) => anyCourse(root, (c) => Object.entries(c.items).some(([id, p]) => id.includes(':city:') && p.ok > 0)),
  },
  {
    id: 'full-alphabet',
    title: { de: 'Ganzes Alphabet', en: 'Full Alphabet' },
    description: { de: 'Alle Buchstaben eines Kurses kennengelernt', en: 'Met every letter of a course' },
    check: (root, courseId, index) => {
      const cp = course(root, courseId);
      return !!cp && !!index && index.byKind.letter.every((l) => (cp.items[l.id]?.box ?? 0) >= 1);
    },
  },
  {
    id: 'false-friends',
    title: { de: 'False Friends gezähmt', en: 'False Friends Tamed' },
    description: { de: 'Alle False Friends eines Kurses gemeistert', en: 'Mastered every false friend of a course' },
    check: (root, courseId, index) => {
      const cp = course(root, courseId);
      if (!cp || !index) return false;
      const ff = index.content.letters.filter((l) => l.falseFriend);
      return ff.length > 0 && ff.every((l) => (cp.items[l.id]?.box ?? 0) >= 5);
    },
  },
  {
    id: 'city-reader-10',
    title: { de: 'Stadtleser 10', en: 'City Reader 10' },
    description: { de: '10 Städte sicher erkannt', en: 'Recognise 10 cities reliably' },
    check: (root, courseId, index) => citiesRecognized(root, courseId, index) >= 10,
  },
  {
    id: 'city-reader-25',
    title: { de: 'Stadtleser 25', en: 'City Reader 25' },
    description: { de: '25 Städte sicher erkannt', en: 'Recognise 25 cities reliably' },
    check: (root, courseId, index) => citiesRecognized(root, courseId, index) >= 25,
  },
  {
    id: 'city-reader-50',
    title: { de: 'Stadtleser 50', en: 'City Reader 50' },
    description: { de: '50 Städte sicher erkannt', en: 'Recognise 50 cities reliably' },
    check: (root, courseId, index) => citiesRecognized(root, courseId, index) >= 50,
  },
  {
    id: 'city-reader-100',
    title: { de: 'Stadtleser 100', en: 'City Reader 100' },
    description: { de: 'Alle 100 Städte eines Landes sicher erkannt', en: 'Recognise all 100 cities of a country reliably' },
    check: (root, courseId, index) => citiesRecognized(root, courseId, index) >= 100,
  },
  {
    id: 'flawless',
    title: { de: 'Fehlerfrei', en: 'Flawless' },
    description: { de: 'Eine Lektion ohne Fehler', en: 'A lesson without a single mistake' },
    check: (root) => anyCourse(root, (c) => Object.values(c.lessons).some((l) => l.bestTotal > 0 && l.bestCorrect === l.bestTotal)),
  },
  {
    id: 'comeback',
    title: { de: 'Comeback', en: 'Comeback' },
    description: { de: 'Ein schwieriges Element bis Mastered gebracht', en: 'Brought a difficult item to Mastered' },
    check: (root) => anyCourse(root, (c) => Object.values(c.items).some((p) => p.lapses >= 2 && p.box >= 5)),
  },
  {
    id: 'week-streak',
    title: { de: 'Eine Woche', en: 'Week Streak' },
    description: { de: '7 Tage in Folge gelernt', en: 'Learned 7 days in a row' },
    check: (root) => root.profile.streak.longest >= 7,
  },
  {
    id: 'month-streak',
    title: { de: 'Ein Monat', en: 'Month Streak' },
    description: { de: '30 Tage in Folge gelernt', en: 'Learned 30 days in a row' },
    check: (root) => root.profile.streak.longest >= 30,
  },
  {
    id: 'four-scripts',
    title: { de: 'Vier Schriften', en: 'Four Scripts' },
    description: { de: 'In allen vier Kursen eine Lektion abgeschlossen', en: 'Completed a lesson in all four courses' },
    check: (root) => ['ru', 'el', 'bn', 'th'].every((id) => Object.keys(root.courses[id]?.lessons ?? {}).length > 0),
  },
  {
    id: 'thousand-answers',
    title: { de: 'Tausend Antworten', en: 'Thousand Answers' },
    description: { de: '1 000 Antworten insgesamt', en: '1,000 answers in total' },
    check: (root) => root.profile.totalAnswers >= 1000,
  },
];

export function newlyUnlocked(root: ProgressRoot, courseId: string, index: CourseIndex | null): string[] {
  return ACHIEVEMENTS.filter((a) => !root.profile.achievements[a.id] && a.check(root, courseId, index)).map((a) => a.id);
}
