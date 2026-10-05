import { useRef, useState } from 'react';
import { ACHIEVEMENTS } from '../../domain/achievements';
import { dayKey } from '../../domain/dates';
import { displayedStreak, levelProgress } from '../../domain/gamification';
import { formatDate, useLang, useT, type TKey } from '../../i18n';
import { exportJson, parseImport, type ImportPreview } from '../../store/persistence';
import { useProgress } from '../../store/progressStore';
import { Button, Card, Modal, ProgressBar } from '../../ui/primitives';
import { LangToggle, TopBar } from '../../ui/TopBar';
import { SyncCard } from '../../sync/SyncCard';
import { useSync } from '../../sync/syncStore';

export function ProfilePage() {
  const t = useT();
  const lang = useLang();
  const root = useProgress((s) => s.root);
  const replaceAll = useProgress((s) => s.replaceAll);
  const markExported = useProgress((s) => s.markExported);
  const reset = useProgress((s) => s.reset);
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [resetStep, setResetStep] = useState(0);
  // Reset and import replace the online copy too (a merge would bring the old progress back).
  const overwriteCloud = useSync((s) => s.overwriteCloud);
  const signedIn = useSync((s) => !!s.user);

  const lp = levelProgress(root.profile.xp);
  const streak = displayedStreak(root.profile.streak, dayKey());

  const doExport = () => {
    const blob = new Blob([exportJson(root)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sylareads-progress.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    markExported();
  };

  const onFile = async (file: File | undefined) => {
    setMessage(null);
    if (!file) return;
    try {
      setPreview(parseImport(await file.text()));
    } catch (e) {
      setMessage(t(`profile.importError.${(e as Error).message}` as TKey));
    }
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <div className="app-shell">
      <TopBar />
      <main className="page profile">
        <header className="section-head">
          <h1 className="page-title">{t('profile.title')}</h1>
        </header>

        <div className="profile-grid">
          <Card>
            <h2 className="card-label">{t('profile.level', { n: lp.level })}</h2>
            <p className="big-number small-big">{root.profile.xp} XP</p>
            <ProgressBar value={lp.into / lp.span} label={t('profile.xpToNext', { n: lp.span - lp.into, l: lp.level + 1 })} />
            <p className="muted small">
              {t('profile.xpToNext', { n: lp.span - lp.into, l: lp.level + 1 })} · {t('profile.answers', { n: root.profile.totalAnswers })}
            </p>
          </Card>
          <Card>
            <h2 className="card-label">{t('profile.streak')}</h2>
            <p className="big-number small-big">{t('profile.streakDays', { n: streak })}</p>
            <p className="muted small">
              {t('profile.streakLongest', { n: t('profile.streakDays', { n: root.profile.streak.longest }) })}
            </p>
            <p className="muted small">{t('profile.streakRule')}</p>
          </Card>
        </div>

        <Card>
          <h2 className="card-label">{t('profile.achievements')}</h2>
          <ul className="achievement-list">
            {ACHIEVEMENTS.map((a) => {
              const at = root.profile.achievements[a.id];
              return (
                <li key={a.id} className={at ? 'is-unlocked' : ''}>
                  <span className="ach-mark" aria-hidden="true">
                    {at ? '✓' : ''}
                  </span>
                  <span>
                    <strong>{a.title[lang]}</strong>
                    <span className="muted small">{a.description[lang]}</span>
                  </span>
                  {at && <span className="muted small">{formatDate(at, lang)}</span>}
                </li>
              );
            })}
          </ul>
        </Card>

        <Card>
          <h2 className="card-label">{t('profile.language')}</h2>
          <LangToggle />
          <p className="muted small">{t('profile.languageNote')}</p>
        </Card>

        <SyncCard />

        <Card>
          <h2 className="card-label">{t('profile.data')}</h2>
          <p className="muted">{t('profile.dataNote')}</p>
          <p className="small">{root.lastExportAt ? t('profile.lastExport', { d: formatDate(root.lastExportAt, lang) }) : t('profile.neverExported')}</p>
          <div className="actions">
            <Button variant="primary" onClick={doExport}>
              {t('profile.export')}
            </Button>
            <Button onClick={() => fileRef.current?.click()}>{t('profile.import')}</Button>
            <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => onFile(e.target.files?.[0])} />
          </div>
          {message && (
            <p className="notice" role="status">
              {message}
            </p>
          )}
          <div className="danger-zone">
            {resetStep === 0 ? (
              <button type="button" className="link-danger" onClick={() => setResetStep(1)}>
                {t('profile.reset')}
              </button>
            ) : (
              <div className="notice notice-error">
                <p>{t('profile.resetConfirm')}</p>
                <div className="actions">
                  <Button variant="danger" onClick={() => { reset(); if (signedIn) void overwriteCloud(); setResetStep(0); setMessage(t('profile.resetDone')); }}>
                    {t('profile.resetFinal')}
                  </Button>
                  <Button variant="ghost" onClick={() => setResetStep(0)}>
                    {t('common.cancel')}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </Card>

        <Modal open={!!preview} onClose={() => setPreview(null)} title={t('profile.import')}>
          {preview && (
            <>
              <p>{t('profile.importPreview', { c: preview.courses, l: preview.lessons, x: preview.xp })}</p>
              <div className="actions">
                <Button variant="primary" onClick={() => { replaceAll(preview.root); if (signedIn) void overwriteCloud(); setPreview(null); setMessage(t('profile.importDone')); }}>
                  {t('profile.importConfirm')}
                </Button>
                <Button variant="ghost" onClick={() => setPreview(null)}>
                  {t('common.cancel')}
                </Button>
              </div>
            </>
          )}
        </Modal>
      </main>
    </div>
  );
}
