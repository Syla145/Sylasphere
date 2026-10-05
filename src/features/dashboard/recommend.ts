import type { CourseIndex } from '../../domain/courseIndex';
import type { CourseProgress } from '../../domain/progress';
import { courseStats } from '../../domain/stats';
import type { CourseMeta } from '../../domain/types';

/** Where "Continue" leads: the recommended next action (spec section 2). */
export function recommendedPath(meta: CourseMeta, index: CourseIndex, cp: CourseProgress | undefined): string {
  const rec = courseStats(index, cp).recommendation;
  const base = `/${meta.slug}`;
  switch (rec.kind) {
    case 'lesson':
      return `${base}/lesson/${rec.lessonId}`;
    case 'review':
      return `${base}/practice/run?mode=smart`;
    case 'weak':
      return `${base}/practice/run?mode=weak`;
    case 'mixed':
      return `${base}/practice/run?mode=mixed`;
  }
}
