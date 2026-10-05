import { Link, NavLink } from 'react-router-dom';
import { COURSES } from '../content/registry';
import { dayKey } from '../domain/dates';
import { displayedStreak, levelFromXp } from '../domain/gamification';
import type { CourseMeta } from '../domain/types';
import { useLang, useT } from '../i18n';
import { useProgress } from '../store/progressStore';

export function LangToggle() {
  const lang = useLang();
  const setLang = useProgress((s) => s.setLang);
  return (
    <div className="lang-toggle" role="group" aria-label="Language / Sprache">
      {(['de', 'en'] as const).map((l) => (
        <button key={l} type="button" className={lang === l ? 'is-active' : ''} aria-pressed={lang === l} onClick={() => setLang(l)}>
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

function FlameIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="currentColor" d="M12 2c1 3.5-1.5 5.5-1.5 8 0 1.4 1 2.5 2.3 2.5 1.6 0 2.4-1.4 2.2-3.3C17.6 11 19 13.2 19 15.5 19 19.6 15.9 22 12 22s-7-2.4-7-6.3C5 10.4 10.4 7.8 12 2z" />
    </svg>
  );
}

function ProfileIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="8.5" r="3.75" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M4.5 20c1.2-3.6 4-5.5 7.5-5.5s6.3 1.9 7.5 5.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function TopBar({ course }: { course?: CourseMeta }) {
  const t = useT();
  const lang = useLang();
  const profile = useProgress((s) => s.root.profile);
  const streak = displayedStreak(profile.streak, dayKey());
  const level = levelFromXp(profile.xp);
  const available = COURSES.filter((c) => c.status === 'available');

  return (
    <header className="topbar">
      <div className="topbar-inner">
        <div className="topbar-left">
          <Link to="/" className="wordmark" aria-label="Sylareads – Home">
            Sylareads
          </Link>
          {course && (
            <details className="course-switch">
              <summary aria-label={t('nav.switchCourse')}>
                <span>{course.name[lang]}</span>
                <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
                  <path d="M3 4.5 6 7.5 9 4.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
                </svg>
              </summary>
              <div className="course-switch-menu">
                {COURSES.map((c) =>
                  c.status === 'available' ? (
                    <Link key={c.id} to={`/${c.slug}`} className={c.id === course.id ? 'is-active' : ''}>
                      {c.name[lang]}
                    </Link>
                  ) : (
                    <span key={c.id} className="is-disabled">
                      {c.name[lang]} · {t('home.soon')}
                    </span>
                  ),
                )}
                {available.length === 0 && null}
              </div>
            </details>
          )}
        </div>
        <div className="topbar-right">
          <span className={`chip chip-streak${streak > 0 ? ' is-on' : ''}`} title={t('chip.streak', { n: streak })}>
            <FlameIcon />
            {streak}
          </span>
          <span className="chip" title={t('chip.level', { n: level })}>
            Lv {level}
          </span>
          <LangToggle />
          <NavLink to="/profile" className="icon-btn" aria-label={t('nav.profile')} title={t('nav.profile')}>
            <ProfileIcon />
          </NavLink>
        </div>
      </div>
    </header>
  );
}

export function CourseTabs({ course }: { course: CourseMeta }) {
  const t = useT();
  const base = `/${course.slug}`;
  return (
    <nav className="course-tabs" aria-label={course.name.en}>
      <div className="course-tabs-inner">
        <NavLink end to={base}>
          {t('nav.overview')}
        </NavLink>
        <NavLink to={`${base}/learn`}>{t('nav.learn')}</NavLink>
        <NavLink end to={`${base}/practice`}>
          {t('nav.practice')}
        </NavLink>
        <NavLink to={`${base}/script`}>{t('nav.script')}</NavLink>
        {course.hasMap && <NavLink to={`${base}/map`}>{t('nav.map')}</NavLink>}
      </div>
    </nav>
  );
}
