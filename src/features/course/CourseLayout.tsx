import { useEffect } from 'react';
import { Navigate, Outlet, useLocation, useParams } from 'react-router-dom';
import { courseBySlug } from '../../content/registry';
import { useT } from '../../i18n';
import { CourseTabs, TopBar } from '../../ui/TopBar';
import { CourseContext, useCourseIndex } from './useCourse';

/** Resolves the course from the URL and provides its content index. `focus` hides navigation (sessions). */
export function CourseGate({ focus = false }: { focus?: boolean }) {
  const { slug } = useParams();
  const meta = courseBySlug(slug);
  const index = useCourseIndex(meta);
  const t = useT();
  const location = useLocation();

  useEffect(() => {
    if (!focus) window.scrollTo(0, 0);
  }, [location.pathname, focus]);

  if (!meta || meta.status !== 'available') return <Navigate to="/" replace />;

  const body = index ? (
    <CourseContext.Provider value={{ meta, index }}>
      <Outlet />
    </CourseContext.Provider>
  ) : (
    <div className="loading" role="status">
      {t('common.loading')}
    </div>
  );

  if (focus) return <div className={`focus-shell ${meta.fontClass}`}>{body}</div>;
  return (
    <div className={`app-shell ${meta.fontClass}`}>
      <TopBar course={meta} />
      <CourseTabs course={meta} />
      <main className="page">{body}</main>
    </div>
  );
}
