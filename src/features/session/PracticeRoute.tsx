import { useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { buildPractice, poolFor, practiceTasksFor, ALL_CATEGORIES } from '../../domain/practiceBuilder';
import { confusedTwiceSet } from '../../domain/progress';
import type { SessionState } from '../../domain/sessionEngine';
import { retaskFor, shuffle } from '../../domain/taskFactory';
import type { Task } from '../../domain/tasks';
import { useT } from '../../i18n';
import { useProgress } from '../../store/progressStore';
import { ButtonLink } from '../../ui/primitives';
import { useCourse } from '../course/useCourse';
import { parsePracticeParams } from '../practice/config';
import { CompleteScreen, type CompleteData } from './CompleteScreen';
import { SessionRunner } from './SessionRunner';

export function PracticeRoute() {
  const location = useLocation();
  return <PracticeSession key={location.key + location.search} />;
}

function PracticeSession() {
  const { meta, index } = useCourse();
  const t = useT();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const finishPractice = useProgress((s) => s.finishPractice);
  const [before] = useState(() => useProgress.getState().root);
  const [done, setDone] = useState<CompleteData | null>(null);
  const base = `/${meta.slug}`;

  const setup = useMemo(() => {
    const req = parsePracticeParams(params);
    const rng = Math.random;
    const cp = before.courses[meta.id];
    const items = cp?.items ?? {};
    const ctx = { items, confusedTwice: confusedTwiceSet(cp) };
    let tasks: Task[] = [];
    let notice: string | undefined;
    if (req.kind === 'config') {
      tasks = buildPractice(index, req.config, ctx, rng);
      if (req.config.weakOnly && poolFor(index, { ...req.config, categories: ALL_CATEGORIES }, ctx).length < 5 && tasks.length) {
        notice = t('session.weakFilled');
      }
    } else {
      const ids =
        req.kind === 'lesson'
          ? (() => {
              const l = index.content.lessons.find((x) => x.id === req.lessonId);
              return l ? (l.newIds.length ? l.newIds : l.reviewIds ?? []) : [];
            })()
          : req.ids.filter((id) => index.byId.has(id));
      const count = req.kind === 'lesson' ? req.count : ids.length;
      const list: string[] = [];
      while (ids.length && list.length < count) list.push(...shuffle(ids, rng));
      tasks = list.slice(0, count).flatMap((id) => practiceTasksFor(index, index.byId.get(id)!, items[id], rng));
    }
    return { tasks, deps: { rng, retask: retaskFor(index, rng) }, notice, req };
    // build once per session
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const goBack = () => {
    if (window.history.length > 1) navigate(-1);
    else navigate(base);
  };

  if (!setup.tasks.length) {
    const allContent = new URLSearchParams(params);
    allContent.set('scope', 'all');
    allContent.delete('mode');
    return (
      <main className="session-done empty-state">
        <p>{t('practice.emptyLearned')}</p>
        <div className="actions">
          <ButtonLink variant="primary" to={`${base}/practice/run?${allContent.toString()}`} replace>
            {t('practice.scopeAll')}
          </ButtonLink>
          <ButtonLink to={`${base}/learn`}>{t('nav.learn')}</ButtonLink>
          <Link className="btn btn-ghost" to={base}>
            {t('common.back')}
          </Link>
        </div>
      </main>
    );
  }

  const onDone = (s: SessionState) => {
    const unlocked = finishPractice(meta.id, s.outcomes.length, index);
    setDone({ before, after: useProgress.getState().root, session: s, unlocked });
  };

  if (done) {
    const mistakes = [...new Set(done.session.outcomes.filter((o) => o.result === 'W').map((o) => o.itemId))];
    const actions = [
      { label: t('complete.practiceAgain'), onClick: () => navigate(`${base}/practice/run?${params.toString()}`, { replace: true }) },
      ...(mistakes.length
        ? [{ label: t('complete.practiceMistakes'), onClick: () => navigate(`${base}/practice/run?ids=${mistakes.join(',')}`, { replace: true }) }]
        : []),
      { label: t('complete.back'), onClick: goBack, variant: 'ghost' as const },
    ];
    return (
      <main className="session-done">
        <CompleteScreen courseId={meta.id} index={index} data={done} actions={actions} />
      </main>
    );
  }

  return (
    <SessionRunner
      courseId={meta.id}
      index={index}
      tasks={setup.tasks}
      mode="practice"
      deps={setup.deps}
      notice={setup.notice}
      onDone={onDone}
      onQuit={goBack}
    />
  );
}
