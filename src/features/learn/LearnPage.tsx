import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { nativeOf } from '../../domain/courseIndex';
import { knownLettersFor, knownUnits, isDecodable } from '../../domain/lessonBuilder';
import type { Lesson } from '../../domain/types';
import { useLang, useT } from '../../i18n';
import { useProgress } from '../../store/progressStore';
import { Button, ButtonLink } from '../../ui/primitives';
import { useCourse } from '../course/useCourse';

export function LearnPage() {
  const { meta, index } = useCourse();
  const t = useT();
  const lang = useLang();
  const navigate = useNavigate();
  const cp = useProgress((s) => s.root.courses[meta.id]);
  const [ahead, setAhead] = useState<Lesson | null>(null);
  const lessons = index.content.lessons;
  const next = lessons.find((l) => !cp?.lessons[l.id]);
  const base = `/${meta.slug}`;

  /** A lesson is "ahead" if it needs letters that are neither known nor taught in it. */
  const isAhead = (lesson: Lesson) => {
    if (!next || lesson.number <= next.number) return false;
    const known = knownUnits(index, cp?.items ?? {});
    const taughtHere = lesson.type === 'letters' ? knownLettersFor(index, lesson, cp?.items ?? {}) : known;
    const ids = lesson.newIds.length ? lesson.newIds : lesson.reviewIds ?? [];
    return ids.some((id) => !isDecodable(index, id, lesson.type === 'letters' ? taughtHere : known));
  };

  const open = (lesson: Lesson) => {
    if (lesson.type !== 'letters' ? isAhead(lesson) : lesson.number > (next?.number ?? 0) + 1) {
      setAhead(lesson);
      return;
    }
    navigate(`${base}/lesson/${lesson.id}`);
  };

  const preview = (lesson: Lesson) =>
    (lesson.newIds.length ? lesson.newIds : lesson.reviewIds ?? [])
      .slice(0, 6)
      .map((id) => {
        const it = index.byId.get(id)!;
        return it.kind === 'letter' ? (lesson.lowercase ? it.lower : it.upper) : nativeOf(it);
      });

  return (
    <div className="learn">
      <header className="section-head">
        <h1 className="page-title">{t('learn.title')}</h1>
        <p className="muted">{t('learn.subtitle')}</p>
      </header>

      {index.content.phases.map((phase) => {
        const list = lessons.filter((l) => l.phaseId === phase.id);
        if (!list.length) return null;
        return (
          <section key={phase.id} className="phase">
            <h2 className="phase-title">{phase.title[lang]}</h2>
            <ol className="lesson-list">
              {list.map((lesson) => {
                const rec = cp?.lessons[lesson.id];
                const isNext = next?.id === lesson.id;
                const glyphs = preview(lesson);
                const short = lesson.type === 'letters' || lesson.type === 'review';
                return (
                  <li key={lesson.id} className={`lesson-row${isNext ? ' is-next' : ''}${rec ? ' is-done' : ''}`}>
                    <button type="button" className="lesson-row-btn" onClick={() => open(lesson)}>
                      <span className="lesson-num tabular">{lesson.number}</span>
                      <span className="lesson-main">
                        <span className="lesson-title">{lesson.title[lang]}</span>
                        <span className={`lesson-preview${short ? ' is-glyphs' : ''}`}>{glyphs.join(short ? ' ' : ' · ')}</span>
                      </span>
                      <span className="lesson-status">
                        {isNext && <span className="badge badge-accent">{t('learn.recommended')}</span>}
                        {rec && <span className="muted small">{t('learn.done', { c: rec.bestCorrect, t: rec.bestTotal })}</span>}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </section>
        );
      })}

      {ahead && next && (
        <div className="sheet" role="dialog" aria-label={t('learn.aheadHint', { n: next.number })}>
          <p>{t('learn.aheadHint', { n: next.number })}</p>
          <div className="actions">
            <ButtonLink variant="primary" to={`${base}/lesson/${next.id}`}>
              {t('learn.goRecommended', { n: next.number })}
            </ButtonLink>
            <Button onClick={() => navigate(`${base}/lesson/${ahead.id}`)}>{t('learn.startAnyway')}</Button>
            <Button variant="ghost" onClick={() => setAhead(null)}>
              {t('common.cancel')}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
