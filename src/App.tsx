import { useEffect } from 'react';
import { HashRouter, Link, Route, Routes } from 'react-router-dom';
import { CourseGate } from './features/course/CourseLayout';
import { DashboardPage } from './features/dashboard/DashboardPage';
import { HomePage } from './features/home/HomePage';
import { LearnPage } from './features/learn/LearnPage';
import { MapPage } from './features/map/MapPage';
import { PracticeHub } from './features/practice/PracticeHub';
import { ProfilePage } from './features/profile/ProfilePage';
import { ScriptPage } from './features/script/ScriptPage';
import { LessonRoute } from './features/session/LessonRoute';
import { PracticeRoute } from './features/session/PracticeRoute';
import { useLang, useT } from './i18n';
import { TopBar } from './ui/TopBar';

function NotFound() {
  const t = useT();
  return (
    <div className="app-shell">
      <TopBar />
      <main className="page page-narrow empty-state">
        <p>{t('common.notFound')}</p>
        <Link to="/" className="btn btn-primary">
          {t('common.toHome')}
        </Link>
      </main>
    </div>
  );
}

export function App() {
  const lang = useLang();
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/:slug" element={<CourseGate />}>
          <Route index element={<DashboardPage />} />
          <Route path="learn" element={<LearnPage />} />
          <Route path="practice" element={<PracticeHub />} />
          <Route path="script" element={<ScriptPage />} />
          <Route path="map" element={<MapPage />} />
        </Route>
        <Route path="/:slug" element={<CourseGate focus />}>
          <Route path="lesson/:lessonId" element={<LessonRoute />} />
          <Route path="practice/run" element={<PracticeRoute />} />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
    </HashRouter>
  );
}
