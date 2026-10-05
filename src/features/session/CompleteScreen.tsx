import { useEffect, useState } from 'react';
import { ACHIEVEMENTS } from '../../domain/achievements';
import type { CourseIndex } from '../../domain/courseIndex';
import { levelFromXp } from '../../domain/gamification';
import { confusedTwiceSet, type ProgressRoot } from '../../domain/progress';
import type { SessionState } from '../../domain/sessionEngine';
import { isWeak } from '../../domain/srs';
import { knownLetters, readableCities } from '../../domain/stats';
import type { Item, Lesson } from '../../domain/types';
import { useLang, useT, type TKey } from '../../i18n';
import { Button } from '../../ui/primitives';

export interface CompleteData {
  before: ProgressRoot;
  after: ProgressRoot;
  session: SessionState;
  unlocked: string[];
}

/** Counts up a number once (respects reduced motion). */
function useCountUp(target: number, ms = 300) {
  const [v, setV] = useState(target);
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return setV(target);
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / ms);
      setV(Math.round(target * p));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return v;
}

const glyphOf = (it: Item) => (it.kind === 'letter' ? it.upper : it.native);

const NEW_KEY: Record<Lesson['type'], TKey | null> = {
  letters: 'complete.new.letters',
  combos: 'complete.new.combos',
  vocab: 'complete.new.words',
  places: 'complete.new.places',
  review: null,
};

export function CompleteScreen({
  courseId,
  index,
  data,
  lesson,
  actions,
}: {
  courseId: string;
  index: CourseIndex;
  data: CompleteData;
  lesson?: Lesson;
  actions: { label: string; onClick: () => void; variant?: 'primary' | 'secondary' | 'ghost' }[];
}) {
  const t = useT();
  const lang = useLang();
  const { before, after, session } = data;
  const cb = before.courses[courseId];
  const ca = after.courses[courseId];

  const correct = session.outcomes.filter((o) => o.result === 'C').length;
  const total = session.outcomes.length;
  const xp = after.profile.xp - before.profile.xp;
  const xpShown = useCountUp(xp);

  const seenIds = [...new Set([...session.outcomes.map((o) => o.itemId), ...session.introduced])];
  const improved = seenIds
    .filter((id) => (ca?.items[id]?.box ?? 0) > (cb?.items[id]?.box ?? 0))
    .map((id) => index.byId.get(id)!)
    .filter(Boolean);
  const confused = confusedTwiceSet(ca);
  const weak = seenIds.filter((id) => isWeak(ca?.items[id], confused.has(id)));
  const newCount = lesson ? lesson.newIds.filter((id) => session.introduced.includes(id)).length : 0;
  const isPairs = !!lesson && lesson.type === 'combos' && lesson.newIds.some((id) => index.units.has(id));
  const newKey = lesson ? (isPairs ? 'complete.new.pairs' : NEW_KEY[lesson.type]) : null;

  const readableBefore = new Set(readableCities(index, knownLetters(index, cb)));
  const readableAfter = readableCities(index, knownLetters(index, ca));
  const newlyReadable = readableAfter.filter((id) => !readableBefore.has(id)).map((id) => index.byId.get(id)!);
  const showReadable = lesson?.type === 'letters' || isPairs;

  const levelBefore = levelFromXp(before.profile.xp);
  const levelAfter = levelFromXp(after.profile.xp);

  return (
    <div className="complete">
      <h1 className="complete-title">{lesson ? t('complete.lesson') : t('complete.practice')}</h1>
      {lesson && <p className="muted">{t('learn.lesson', { n: lesson.number })} · {lesson.title[lang]}</p>}
      <p className="complete-score tabular">{t('complete.correct', { c: correct, t: total })}</p>

      <ul className="complete-facts">
        <li className="accent tabular">{t('complete.xp', { n: xpShown })}</li>
        {newKey && newCount > 0 && <li>{t(newKey, { n: newCount })}</li>}
        {weak.length > 0 && <li>{t('complete.weak', { n: weak.length })}</li>}
        {levelAfter > levelBefore && <li className="accent">{t('complete.levelUp', { n: levelAfter })}</li>}
      </ul>

      {improved.length > 0 && (
        <section className="complete-block">
          <h2 className="card-label">{t('complete.masteryImproved')}</h2>
          <div className="chip-row">
            {improved.slice(0, 10).map((it) => (
              <span key={it.id} className="glyph-chip">
                {glyphOf(it)} <span className="up" aria-hidden="true">↑</span>
              </span>
            ))}
          </div>
        </section>
      )}

      {showReadable && (
        <section className="complete-block">
          <h2 className="card-label">{t('complete.readable', { n: readableAfter.length, total: index.byKind.city.length })}</h2>
          {newlyReadable.length > 0 && (
            <div className="chip-row">
              {newlyReadable.slice(0, 8).map((c) => (
                <span key={c.id} className="glyph-chip">
                  {glyphOf(c)}
                </span>
              ))}
              {newlyReadable.length > 8 && <span className="muted small">+{newlyReadable.length - 8}</span>}
            </div>
          )}
        </section>
      )}

      {data.unlocked.length > 0 && (
        <section className="complete-block achievement-toast" role="status">
          <h2 className="card-label">{t('complete.achievement')}</h2>
          {data.unlocked.map((id) => {
            const a = ACHIEVEMENTS.find((x) => x.id === id);
            return a ? (
              <p key={id}>
                <strong>{a.title[lang]}</strong> <span className="muted">{a.description[lang]}</span>
              </p>
            ) : null;
          })}
        </section>
      )}

      <div className="complete-actions">
        {actions.map((a, i) => (
          <Button key={a.label} variant={a.variant ?? (i === 0 ? 'primary' : 'secondary')} block onClick={a.onClick} autoFocus={i === 0}>
            {a.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
