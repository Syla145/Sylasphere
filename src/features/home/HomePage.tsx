import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { COUNTRIES, COURSES } from '../../content/registry';
import type { CourseIndex } from '../../domain/courseIndex';
import { courseStats } from '../../domain/stats';
import type { CourseMeta } from '../../domain/types';
import { formatPercent, useLang, useT } from '../../i18n';
import { useProgress } from '../../store/progressStore';
import { Button, ProgressBar } from '../../ui/primitives';
import { TopBar } from '../../ui/TopBar';
import { loadCourseIndex } from '../course/useCourse';
import { recommendedPath } from '../dashboard/recommend';

function CourseCard({ meta }: { meta: CourseMeta }) {
  const t = useT();
  const lang = useLang();
  const navigate = useNavigate();
  const cp = useProgress((s) => s.root.courses[meta.id]);
  const [index, setIndex] = useState<CourseIndex | null>(null);
  const started = !!cp && (Object.keys(cp.items).length > 0 || Object.keys(cp.lessons).length > 0);

  useEffect(() => {
    if (meta.status === 'available' && started) loadCourseIndex(meta).then(setIndex);
  }, [meta, started]);

  const stats = index && started ? courseStats(index, cp) : null;
  const countries = meta.countryIds.map((id) => COUNTRIES[id].name[lang]).join(' · ');
  const soon = meta.status !== 'available';

  return (
    <article className={`course-card ${meta.fontClass}${soon ? ' is-soon' : ''}`}>
      <div className="course-card-glyphs" aria-hidden="true">
        {meta.sampleGlyphs}
      </div>
      <div className="course-card-body">
        <h2 className="course-card-title">
          {soon ? meta.name[lang] : <Link to={`/${meta.slug}`}>{meta.name[lang]}</Link>}
        </h2>
        <p className="course-card-countries">{countries}</p>
        {stats && (
          <div className="course-card-progress">
            <ProgressBar value={stats.mastery} size="sm" label={t('home.mastery', { n: formatPercent(stats.mastery) })} />
            <span>{t('home.mastery', { n: formatPercent(stats.mastery) })}</span>
          </div>
        )}
      </div>
      <div className="course-card-actions">
        {soon ? (
          <span className="badge">{t('home.soon')}</span>
        ) : started ? (
          <>
            <Button variant="primary" onClick={() => navigate(index ? recommendedPath(meta, index, cp) : `/${meta.slug}`)}>
              {t('home.continue')}
            </Button>
            <Button onClick={() => navigate(`/${meta.slug}/practice/run?mode=smart`)}>{t('home.practice')}</Button>
          </>
        ) : (
          <Button variant="primary" onClick={() => navigate(`/${meta.slug}`)}>
            {t('home.startLearning')}
          </Button>
        )}
      </div>
    </article>
  );
}

export function HomePage() {
  const t = useT();
  return (
    <div className="app-shell">
      <TopBar />
      <main className="page home">
        <section className="hero">
          <h1 className="hero-title">Sylareads</h1>
          <p className="hero-claim">{t('claim')}</p>
          <p className="hero-sub">{t('subline')}</p>
        </section>
        <section className="course-grid" aria-label="Courses">
          {COURSES.map((c) => (
            <CourseCard key={c.id} meta={c} />
          ))}
        </section>
        <p className="home-note">{t('home.storageNote')}</p>
      </main>
    </div>
  );
}
