import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ALL_CATEGORIES, poolFor, poolReadability, type PracticeConfig } from '../../domain/practiceBuilder';
import { confusedTwiceSet } from '../../domain/progress';
import { CATEGORY_KINDS, type Category } from '../../domain/types';
import { formatPercent, useT } from '../../i18n';
import { useProgress } from '../../store/progressStore';
import { Button, Card } from '../../ui/primitives';
import { useCourse } from '../course/useCourse';
import { practiceQuery } from './config';

const COUNTS = [10, 20, 30, 50];

export function PracticeHub() {
  const { meta, index } = useCourse();
  const t = useT();
  const navigate = useNavigate();
  const cp = useProgress((s) => s.root.courses[meta.id]);
  const saveConfig = useProgress((s) => s.savePracticeConfig);
  const items = cp?.items ?? {};
  const ctx = useMemo(() => ({ items, confusedTwice: confusedTwiceSet(cp) }), [items, cp]);
  const base = `/${meta.slug}`;

  const stored = cp?.lastPracticeConfig;
  const [config, setConfig] = useState<PracticeConfig>({
    categories: (stored?.categories.filter((c) => (ALL_CATEGORIES as string[]).includes(c)) as Category[]) ?? ['letters'],
    weakOnly: false,
    scope: stored?.scope ?? 'learned',
    prioritizeWeak: stored?.prioritizeWeak ?? true,
    count: stored?.count ?? 20,
  });
  const [confirmLow, setConfirmLow] = useState(false);

  const learned = (cat: Category) => index.items.filter((it) => CATEGORY_KINDS[cat].includes(it.kind) && (items[it.id]?.box ?? 0) >= 1).length;
  const weakCount = poolFor(index, { ...config, categories: ALL_CATEGORIES, weakOnly: true }, ctx).length;
  const pool = poolFor(index, config, ctx);
  const readability = poolReadability(index, config, ctx);

  const toggle = (cat: Category) => {
    setConfirmLow(false);
    setConfig((c) => {
      const has = c.categories.includes(cat);
      const categories = has ? c.categories.filter((x) => x !== cat) : [...c.categories, cat];
      return { ...c, categories: categories.length ? categories : [cat] };
    });
  };

  const start = (force = false) => {
    if (!force && readability < 0.7 && config.scope === 'all') {
      setConfirmLow(true);
      return;
    }
    saveConfig(meta.id, config);
    navigate(`${base}/practice/run?${practiceQuery(config)}`);
  };

  const modes: { key: Category | 'weak' | 'mixed'; to: string; count: number }[] = [
    ...ALL_CATEGORIES.map((c) => ({ key: c, to: `?c=${c}&scope=learned`, count: learned(c) })),
    { key: 'weak', to: '?mode=weak', count: weakCount },
    { key: 'mixed', to: '?mode=mixed', count: ALL_CATEGORIES.reduce((s, c) => s + learned(c), 0) },
  ];

  return (
    <div className="practice-hub">
      <header className="section-head">
        <h1 className="page-title">{t('practice.title')}</h1>
      </header>

      <Card className="smart-card">
        <div>
          <h2 className="card-title">{t('practice.smart')}</h2>
          <p className="muted">{t('practice.smartDesc')}</p>
          <p className="muted small">{t('practice.tasks', { n: 20 })}</p>
        </div>
        <Button variant="primary" onClick={() => navigate(`${base}/practice/run?mode=smart`)}>
          {t('practice.start')}
        </Button>
      </Card>

      <h2 className="section-label">{t('practice.modes')}</h2>
      <div className="mode-grid">
        {modes.map((m) => (
          <button key={m.key} type="button" className="mode-tile" onClick={() => navigate(`${base}/practice/run${m.to}`)}>
            <span className="mode-title">{t(`cat.${m.key}`)}</span>
            <span className="muted small">{t(`practice.desc.${m.key}`)}</span>
            <span className="mode-count tabular">{t('practice.learnedCount', { n: m.count })}</span>
          </button>
        ))}
      </div>

      <h2 className="section-label">{t('practice.free')}</h2>
      <Card className="free-config">
        <fieldset>
          <legend>{t('practice.categories')}</legend>
          <div className="toggle-row">
            {ALL_CATEGORIES.map((c) => (
              <button key={c} type="button" className={`toggle${config.categories.includes(c) ? ' is-on' : ''}`} aria-pressed={config.categories.includes(c)} onClick={() => toggle(c)}>
                {t(`cat.${c}`)}
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend>{t('practice.scope')}</legend>
          <div className="segmented">
            {(['learned', 'all'] as const).map((s) => (
              <button key={s} type="button" className={config.scope === s ? 'is-on' : ''} aria-pressed={config.scope === s} onClick={() => { setConfirmLow(false); setConfig((c) => ({ ...c, scope: s })); }}>
                {s === 'learned' ? t('practice.scopeLearned') : t('practice.scopeAll')}
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend>{t('practice.count')}</legend>
          <div className="segmented">
            {COUNTS.map((n) => (
              <button key={n} type="button" className={config.count === n ? 'is-on' : ''} aria-pressed={config.count === n} onClick={() => setConfig((c) => ({ ...c, count: n }))}>
                {n}
              </button>
            ))}
          </div>
        </fieldset>
        <label className="switch">
          <input type="checkbox" checked={config.prioritizeWeak} onChange={(e) => setConfig((c) => ({ ...c, prioritizeWeak: e.target.checked }))} />
          <span className="switch-track" aria-hidden="true" />
          <span>{t('practice.prioritizeWeak')}</span>
        </label>

        {config.scope === 'learned' && pool.length === 0 && <p className="notice">{t('practice.emptyLearned')}</p>}
        {confirmLow && (
          <div className="notice notice-accent">
            <p>{t('practice.recommendLetters', { n: formatPercent(readability) })}</p>
          </div>
        )}
        <div className="actions">
          {confirmLow ? (
            <Button variant="primary" onClick={() => start(true)}>
              {t('practice.startAnyway')}
            </Button>
          ) : (
            <Button variant="primary" disabled={pool.length === 0} onClick={() => start()}>
              {t('practice.start')}
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}
