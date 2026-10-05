import { create } from 'zustand';
import { newlyUnlocked } from '../domain/achievements';
import type { CourseIndex } from '../domain/courseIndex';
import {
  completeLesson,
  completePractice,
  emptyCourse,
  emptyRoot,
  recordAnswer,
  recordIntro,
  unlockAchievements,
  type AnswerInput,
  type MapLabels,
  type PracticeConfigStored,
  type ProgressRoot,
} from '../domain/progress';
import type { Lang } from '../domain/types';
import { backupCurrent, clearAll, loadRoot, saveRoot } from './persistence';

interface ProgressState {
  root: ProgressRoot;
  setLang: (lang: Lang) => void;
  setMapLabels: (which: 'mapLabels' | 'taskMapLabels', value: MapLabels) => void;
  startCourse: (courseId: string) => void;
  intro: (courseId: string, itemId: string) => void;
  answer: (courseId: string, a: AnswerInput) => void;
  finishLesson: (
    courseId: string,
    lessonId: string,
    info: { correct: number; total: number; newItems: { itemId: string; solid: boolean }[] },
    index: CourseIndex,
  ) => string[];
  finishPractice: (courseId: string, answered: number, index: CourseIndex) => string[];
  savePracticeConfig: (courseId: string, config: PracticeConfigStored) => void;
  replaceAll: (root: ProgressRoot) => void;
  /** Progress merged with the cloud copy (no backup: nothing is lost by a merge). */
  applyMerged: (root: ProgressRoot) => void;
  markExported: () => void;
  reset: () => void;
}

export const useProgress = create<ProgressState>((set, get) => {
  const commit = (root: ProgressRoot, immediate = false) => {
    set({ root });
    saveRoot(root, immediate);
  };
  const unlock = (courseId: string, index: CourseIndex) => {
    const ids = newlyUnlocked(get().root, courseId, index);
    if (ids.length) commit(unlockAchievements(get().root, ids), true);
    return ids;
  };
  return {
    root: loadRoot(),
    setLang: (uiLang) => commit({ ...get().root, settings: { ...get().root.settings, uiLang } }, true),
    setMapLabels: (which, value) => commit({ ...get().root, settings: { ...get().root.settings, [which]: value } }, true),
    startCourse: (courseId) => {
      const root = get().root;
      if (!root.courses[courseId]) commit({ ...root, courses: { ...root.courses, [courseId]: emptyCourse() } }, true);
    },
    intro: (courseId, itemId) => commit(recordIntro(get().root, courseId, itemId)),
    answer: (courseId, a) => commit(recordAnswer(get().root, courseId, a)),
    finishLesson: (courseId, lessonId, info, index) => {
      commit(completeLesson(get().root, courseId, lessonId, info), true);
      return unlock(courseId, index);
    },
    finishPractice: (courseId, answered, index) => {
      commit(completePractice(get().root, courseId, answered), true);
      return unlock(courseId, index);
    },
    savePracticeConfig: (courseId, config) => {
      const root = get().root;
      const course = root.courses[courseId] ?? emptyCourse();
      commit({ ...root, courses: { ...root.courses, [courseId]: { ...course, lastPracticeConfig: config } } });
    },
    replaceAll: (root) => {
      backupCurrent(get().root);
      commit(root, true);
    },
    applyMerged: (root) => commit(root, true),
    markExported: () => commit({ ...get().root, lastExportAt: Date.now() }, true),
    reset: () => {
      backupCurrent(get().root);
      clearAll();
      commit(emptyRoot(get().root.settings.uiLang), true);
    },
  };
});
