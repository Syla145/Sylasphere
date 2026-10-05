import { useMemo, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { buildLesson, finalRoundTasks } from '../../domain/lessonBuilder';
import { score, type SessionState } from '../../domain/sessionEngine';
import { retaskFor } from '../../domain/taskFactory';
import { useT } from '../../i18n';
import { useProgress } from '../../store/progressStore';
import { useCourse } from '../course/useCourse';
import { recommendedPath } from '../dashboard/recommend';
import { CompleteScreen, type CompleteData } from './CompleteScreen';
import { SessionRunner } from './SessionRunner';

export function LessonRoute() {
  const { lessonId } = useParams();
  return <LessonSession key={lessonId} lessonId={lessonId!} />;
}

function LessonSession({ lessonId }: { lessonId: string }) {
  const { meta, index } = useCourse();
  const t = useT();
  const navigate = useNavigate();
  const finishLesson = useProgress((s) => s.finishLesson);
  const lesson = index.content.lessons.find((l) => l.id === lessonId);
  const [before] = useState(() => useProgress.getState().root);
  const [done, setDone] = useState<CompleteData | null>(null);

  const setup = useMemo(() => {
    if (!lesson) return null;
    const rng = Math.random;
    const items = before.courses[meta.id]?.items ?? {};
    return {
      tasks: buildLesson(index, lesson, items, rng),
      deps: { rng, retask: retaskFor(index, rng), finalRound: finalRoundTasks(index, rng) },
      deferred: new Set(lesson.newIds),
    };
  }, [lesson, index, before, meta.id]);

  if (!lesson || !setup) return <Navigate to={`/${meta.slug}/learn`} replace />;

  const onDone = (s: SessionState) => {
    const { correct, total } = score(s);
    const newItems = lesson.newIds
      .filter((id) => s.introduced.includes(id))
      .map((id) => {
        const last = [...s.outcomes].reverse().find((o) => o.itemId === id);
        return { itemId: id, solid: last ? last.result !== 'W' : false };
      });
    const unlocked = finishLesson(meta.id, lesson.id, { correct, total, newItems }, index);
    setDone({ before, after: useProgress.getState().root, session: s, unlocked });
  };

  const back = () => navigate(`/${meta.slug}`);

  if (done) {
    const cp = done.after.courses[meta.id];
    return (
      <main className="session-done">
        <CompleteScreen
          courseId={meta.id}
          index={index}
          data={done}
          lesson={lesson}
          actions={[
            { label: t('complete.continueLearning'), onClick: () => navigate(recommendedPath(meta, index, cp), { replace: true }) },
            { label: t('complete.practiceLesson'), onClick: () => navigate(`/${meta.slug}/practice/run?lesson=${lesson.id}`, { replace: true }) },
            { label: t('complete.backDashboard'), onClick: back, variant: 'ghost' },
          ]}
        />
      </main>
    );
  }

  return (
    <SessionRunner
      courseId={meta.id}
      index={index}
      tasks={setup.tasks}
      mode="learn"
      deps={setup.deps}
      deferredIds={setup.deferred}
      onDone={onDone}
      onQuit={back}
    />
  );
}
