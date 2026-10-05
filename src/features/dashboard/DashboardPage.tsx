import { Link, useNavigate } from 'react-router-dom';
import { letterGlyphs, nativeOf } from '../../domain/courseIndex';
import { courseStats } from '../../domain/stats';
import type { Category } from '../../domain/types';
import { formatPercent, useLang, useT } from '../../i18n';
import { useProgress } from '../../store/progressStore';
import { Button, ButtonLink, Card, MasteryBar } from '../../ui/primitives';
import { useCourse } from '../course/useCourse';
import { MapGoal } from '../map/MapPage';
import { recommendedPath } from './recommend';

const BAR_ORDER: Category[] = ['letters', 'combos', 'words', 'terms', 'cities', 'regions'];

export function DashboardPage() {
  const { meta, index } = useCourse();
  const t = useT();
  const lang = useLang();
  const navigate = useNavigate();
  const cp = useProgress((s) => s.root.courses[meta.id]);
  const stats = courseStats(index, cp);
  const base = `/${meta.slug}`;
  const firstLesson = index.content.lessons[0];

  if (!stats.started) {
    return (
      <div className="dashboard">
        <header className="dash-head">
          <h1 className="page-title">{meta.name[lang]}</h1>
        </header>
        <Card className="first-run">
          <div className="first-run-glyphs" aria-hidden="true">
            {index.content.lessons[0].newIds.map((id) => nativeOf(index.byId.get(id)!)).join(' ')}
          </div>
          <div>
            <p className="eyebrow-quiet">
              {t('learn.lesson', { n: 1 })} · {t('common.minutes', { n: 4 })}
            </p>
            <h2 className="card-title">{firstLesson.title[lang]}</h2>
            <p className="muted">{firstLesson.goal[lang]}</p>
            <p className="muted small">{t('dash.firstIntro')}</p>
            <div className="actions">
              <ButtonLink variant="primary" to={`${base}/lesson/${firstLesson.id}`}>
                {t('dash.startLesson1')}
              </ButtonLink>
              <ButtonLink to={`${base}/learn`}>{t('dash.allLessons')}</ButtonLink>
            </div>
          </div>
        </Card>
        <MapGoal />
      </div>
    );
  }

  const rec = stats.recommendation;
  const recLesson = rec.kind === 'lesson' ? index.content.lessons.find((l) => l.id === rec.lessonId) : undefined;
  const weakItems = stats.weakIds.slice(0, 8).map((id) => index.byId.get(id)!);

  return (
    <div className="dashboard">
      <header className="dash-head">
        <h1 className="page-title">{meta.name[lang]}</h1>
        <div className="dash-hero">
          <div className="big-number">
            {formatPercent(stats.mastery)}
            <span className="big-number-unit">%</span>
          </div>
          <div className="big-number-label">{t('dash.mastery')}</div>
        </div>
        <ul className="dash-facts">
          <li>{t('dash.lettersLearned', { n: stats.lettersLearned, total: stats.lettersTotal })}</li>
          <li>{stats.accuracy === null ? t('dash.accuracyNone') : t('dash.accuracy', { n: formatPercent(stats.accuracy) })}</li>
          <li>{t('dash.citiesRecognized', { n: stats.citiesRecognized })}</li>
        </ul>
        <div className="actions">
          <Button variant="primary" onClick={() => navigate(recommendedPath(meta, index, cp))}>
            {t('dash.continueLearning')}
          </Button>
          <ButtonLink to={`${base}/practice/run?mode=smart`}>{t('dash.practice')}</ButtonLink>
        </div>
      </header>

      <div className="dash-grid">
        <MapGoal />
        <Card className="card-recommended">
          <h2 className="card-label">{t('dash.recommended')}</h2>
          {recLesson ? (
            <Link className="rec-link" to={`${base}/lesson/${recLesson.id}`}>
              <span className="rec-title">
                {t('learn.lesson', { n: recLesson.number })} · {recLesson.title[lang]}
              </span>
              <span className="muted">{recLesson.goal[lang]}</span>
            </Link>
          ) : (
            <Link className="rec-link" to={recommendedPath(meta, index, cp)}>
              <span className="rec-title">
                {rec.kind === 'review'
                  ? t('dash.rec.review', { n: rec.due })
                  : rec.kind === 'weak'
                    ? t('dash.rec.weak', { n: rec.count })
                    : t('dash.rec.mixed')}
              </span>
              <span className="muted">
                {rec.kind === 'review' ? t('dash.rec.reviewWhy') : rec.kind === 'weak' ? t('dash.rec.weakWhy') : t('dash.rec.mixedWhy')}
              </span>
            </Link>
          )}
          <p className="muted small">
            {t('dash.lessons', { n: stats.completedLessons, total: index.content.lessons.length })} ·{' '}
            {t('dash.readable', { n: stats.citiesReadable, total: stats.citiesTotal })}
          </p>
        </Card>

        <Card>
          <h2 className="card-label">{t('dash.weak')}</h2>
          {weakItems.length ? (
            <>
              <div className="chip-row">
                {weakItems.map((it) => (
                  <span key={it.id} className="glyph-chip">
                    {it.kind === 'letter' ? letterGlyphs(it) : nativeOf(it)}
                  </span>
                ))}
              </div>
              <ButtonLink to={`${base}/practice/run?mode=weak`}>{t('dash.trainWeak')}</ButtonLink>
            </>
          ) : (
            <p className="muted">{t('dash.weakEmpty')}</p>
          )}
        </Card>

        <Card className="card-progress">
          <h2 className="card-label">{t('dash.progress')}</h2>
          <ul className="progress-list">
            {BAR_ORDER.map((cat) => {
              const s = stats.categories[cat];
              return (
                <li key={cat}>
                  <div className="progress-row-head">
                    <span>{t(`cat.${cat}`)}</span>
                    <span className="muted tabular">
                      {s.mastered + s.familiar + s.learning} / {s.total}
                    </span>
                  </div>
                  <MasteryBar total={s.total} mastered={s.mastered} familiar={s.familiar} learning={s.learning} label={t(`cat.${cat}`)} />
                </li>
              );
            })}
          </ul>
          <div className="legend">
            <span><i className="dot dot-learning" /> {t('state.learning')}</span>
            <span><i className="dot dot-familiar" /> {t('state.familiar')}</span>
            <span><i className="dot dot-mastered" /> {t('state.mastered')}</span>
          </div>
        </Card>
      </div>
    </div>
  );
}
