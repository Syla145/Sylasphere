import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CourseIndex } from '../../domain/courseIndex';
import { evaluateTyped, type Evaluation } from '../../domain/evaluate';
import { advance, createSession, currentTask, submit, type EngineDeps, type SessionMode, type SessionState } from '../../domain/sessionEngine';
import type { Task } from '../../domain/tasks';
import { useT } from '../../i18n';
import { useProgress } from '../../store/progressStore';
import { Button, Modal } from '../../ui/primitives';
import { FeedbackPanel } from './FeedbackPanel';
import { IntroCard } from './IntroCard';
import { TaskPrompt } from './TaskPrompt';
import { isWideMap } from '../map/layer';

interface Props {
  courseId: string;
  index: CourseIndex;
  tasks: Task[];
  mode: SessionMode;
  deps: EngineDeps;
  /** Items whose long-term state is settled at the end (new lesson items). */
  deferredIds?: Set<string>;
  notice?: string;
  onDone: (s: SessionState) => void;
  onQuit: (s: SessionState) => void;
}

/**
 * Runs a lesson or practice session. Keyboard: Enter checks, Enter continues,
 * digits 1–4 pick a choice, Esc asks to quit. The mouse is never required.
 */
export function SessionRunner({ courseId, index, tasks, mode, deps, deferredIds, notice, onDone, onQuit }: Props) {
  const t = useT();
  const recordAnswer = useProgress((s) => s.answer);
  const recordIntro = useProgress((s) => s.intro);
  const [state, setState] = useState<SessionState>(() => createSession(tasks, mode));
  const [input, setInput] = useState('');
  const [quitOpen, setQuitOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const stateRef = useRef(state);
  stateRef.current = state;
  const inputValueRef = useRef(input);
  inputValueRef.current = input;
  const quitRef = useRef(quitOpen);
  quitRef.current = quitOpen;

  const task = currentTask(state);

  /** Persist a final answer (every final answer counts for XP; only the first per item for SRS). */
  const persist = useCallback(
    (before: SessionState, after: SessionState) => {
      if (after.outcomes.length === before.outcomes.length) return;
      const o = after.outcomes[after.outcomes.length - 1];
      const isFirst = !before.first[o.itemId];
      recordAnswer(courseId, {
        itemId: o.itemId,
        result: o.result,
        applySrs: isFirst && !deferredIds?.has(o.itemId),
        confusedWith: o.confusedWith,
      });
    },
    [courseId, deferredIds, recordAnswer],
  );

  const doSubmit = useCallback(
    (value: string, evaluation: Evaluation, choiceIndex?: number) => {
      const before = stateRef.current;
      const after = submit(before, value, evaluation, deps, choiceIndex);
      persist(before, after);
      setState(after);
    },
    [deps, persist],
  );

  const submitTyped = useCallback(() => {
    const s = stateRef.current;
    const tk = currentTask(s);
    if (!tk || tk.kind === 'intro' || tk.kind === 'choice' || tk.kind === 'locate' || s.phase !== 'answer') return;
    const value = inputValueRef.current;
    if (!value.trim()) return;
    doSubmit(value, evaluateTyped(index, tk, value));
  }, [doSubmit, index]);

  const choose = useCallback(
    (i: number) => {
      const s = stateRef.current;
      const tk = currentTask(s);
      if (!tk || tk.kind !== 'choice' || s.phase !== 'answer' || s.eliminated.includes(i)) return;
      const opt = tk.options[i];
      if (!opt) return;
      doSubmit(opt.label ?? '', { correct: opt.correct, confusedWith: opt.correct ? undefined : opt.itemId }, i);
    },
    [doSubmit],
  );

  /** A click on the map: the clicked area's id is the answer. */
  const locate = useCallback(
    (id: string) => {
      const s = stateRef.current;
      const tk = currentTask(s);
      if (!tk || tk.kind !== 'locate' || s.phase !== 'answer') return;
      if (s.attempt === 1 && id === s.lastInput) return; // same wrong area again
      const correct = id === tk.itemId;
      doSubmit(id, { correct, confusedWith: correct ? undefined : id });
    },
    [doSubmit],
  );

  const dontKnow = useCallback(() => {
    const s = stateRef.current;
    const tk = currentTask(s);
    if (!tk || tk.kind === 'intro' || s.phase !== 'answer') return;
    // "I don't know" is an honest wrong answer: no second try.
    const forced = { ...s, attempt: 1 as const };
    const after = submit(forced, '', { correct: false }, deps);
    persist(s, after);
    setState(after);
  }, [deps, persist]);

  const next = useCallback(() => {
    const s = stateRef.current;
    const tk = currentTask(s);
    if (tk?.kind === 'intro') recordIntro(courseId, tk.itemId);
    const after = advance(s, deps);
    setInput('');
    setState(after);
    if (after.phase === 'done') onDone(after);
  }, [courseId, deps, onDone, recordIntro]);

  // Clear the input when a second try starts so the learner retypes.
  useEffect(() => {
    if (state.attempt === 1 && state.phase === 'answer') {
      setInput('');
    }
  }, [state.attempt, state.phase]);

  // Focus the input for every typed task (keeps the phone keyboard open).
  useEffect(() => {
    if (task && task.kind !== 'intro' && task.kind !== 'choice' && task.kind !== 'locate') inputRef.current?.focus({ preventScroll: true });
  }, [task, state.phase, state.attempt]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (quitRef.current) return;
      const s = stateRef.current;
      const tk = currentTask(s);
      if (!tk) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        setQuitOpen(true);
        return;
      }
      if (e.key === 'Enter') {
        if (e.repeat) return;
        const target = e.target as HTMLElement | null;
        if (target?.tagName === 'BUTTON' && s.phase === 'answer' && tk.kind === 'choice') return; // native button press
        if (s.phase === 'answer' && tk.kind === 'locate') return; // areas handle Enter themselves
        e.preventDefault();
        if (tk.kind === 'intro' || s.phase === 'feedback') next();
        else submitTyped();
        return;
      }
      if (tk.kind === 'choice' && s.phase === 'answer' && /^[1-4]$/.test(e.key)) {
        e.preventDefault();
        choose(Number(e.key) - 1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [choose, next, submitTyped]);

  const progress = useMemo(() => {
    const total = state.plannedGraded + state.extraGraded;
    return { done: state.outcomes.length, planned: state.plannedGraded, extra: state.extraGraded, ratio: total ? state.outcomes.length / total : 0 };
  }, [state]);

  if (!task) return null;

  const showFeedback = state.phase === 'feedback';
  const showRetry = state.phase === 'answer' && state.attempt === 1;

  return (
    <div className="session">
      <header className="session-bar">
        <button type="button" className="icon-btn" aria-label={t('session.quitTitle')} onClick={() => setQuitOpen(true)}>
          <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
            <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
          </svg>
        </button>
        <div className="session-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress.ratio * 100)}>
          <div className="session-progress-fill" style={{ width: `${progress.ratio * 100}%` }} />
        </div>
        <span className="session-count tabular">
          {progress.done} / {progress.planned}
          {progress.extra > 0 && <span className="muted"> +{progress.extra}</span>}
        </span>
      </header>

      {notice && state.index === 0 && <p className="session-notice">{notice}</p>}

      <main className={`session-main${isMapTask(task) && isWideMap(index) ? ' is-wide' : ''}`} key={task.key}>
        {task.kind === 'intro' ? (
          <IntroCard index={index} itemId={task.itemId} lower={task.lower} onNext={next} />
        ) : (
          <>
            <TaskPrompt
              index={index}
              task={task}
              state={state}
              input={input}
              setInput={setInput}
              inputRef={inputRef}
              onChoose={choose}
              onSubmit={submitTyped}
              onLocate={locate}
            />
            <div className="session-response" aria-live="polite">
              {showRetry && <RetryHint index={index} task={task} evaluation={state.evaluation} input={state.lastInput} />}
              {showFeedback && <FeedbackPanel index={index} task={task} state={state} />}
            </div>
            <div className="session-actions">
              {showFeedback ? (
                <Button variant="primary" block onClick={next} autoFocus={task.kind === 'choice' || task.kind === 'locate'}>
                  {t('session.continue')}
                  <kbd>{t('session.enterHint')}</kbd>
                </Button>
              ) : task.kind === 'choice' || task.kind === 'locate' ? (
                <Button variant="ghost" block onClick={dontKnow}>
                  {t('session.dontKnow')}
                </Button>
              ) : (
                <>
                  <Button variant="primary" block onClick={submitTyped} disabled={!input.trim()}>
                    {t('session.check')}
                    <kbd>{t('session.enterHint')}</kbd>
                  </Button>
                  <Button variant="ghost" block onClick={dontKnow}>
                    {t('session.dontKnow')}
                  </Button>
                </>
              )}
            </div>
          </>
        )}
      </main>

      <Modal open={quitOpen} onClose={() => setQuitOpen(false)} title={t('session.quitTitle')}>
        <p className="muted">{t('session.quitBody')}</p>
        <div className="actions">
          <Button variant="primary" onClick={() => setQuitOpen(false)}>
            {t('session.quitCancel')}
          </Button>
          <Button onClick={() => { setQuitOpen(false); onQuit(stateRef.current); }}>{t('session.quitConfirm')}</Button>
        </div>
      </Modal>
    </div>
  );
}

function RetryHint({ index, task, evaluation, input }: { index: CourseIndex; task: Task; evaluation: Evaluation | null; input: string }) {
  const t = useT();
  const item = index.byId.get(task.itemId);
  let hint: string | null = null;
  if (item?.kind === 'letter') {
    hint = item.falseFriend && item.looksLike ? t('session.hintFalseFriend', { x: item.looksLike }) : null;
  } else if (task.kind === 'meaning') {
    hint = t('session.hintMeaning');
  } else if (item && (item.kind === 'city' || item.kind === 'region')) {
    hint = t('session.hintStartsWith', { s: item.translit.slice(0, 2) });
  } else if (evaluation?.mismatchAt !== undefined) {
    hint = t('session.hintCheckChar', { n: evaluation.mismatchAt + 1 });
  }
  if (task.kind === 'locate') {
    return (
      <div className="retry">
        <p className="retry-title">{t('session.tryAgain')}</p>
        <ClickedLine index={index} id={input} />
      </div>
    );
  }
  return (
    <div className="retry">
      <p className="retry-title">{t('session.tryAgain')}</p>
      {input && task.kind !== 'choice' && <p className="retry-input">{input}</p>}
      {hint && <p className="retry-hint">{hint}</p>}
      {evaluation?.confusedWith && task.kind !== 'choice' && <ConfusionLine index={index} input={input} otherId={evaluation.confusedWith} />}
    </div>
  );
}

export function ConfusionLine({ index, input, otherId }: { index: CourseIndex; input: string; otherId: string }) {
  const t = useT();
  const other = index.byId.get(otherId);
  if (!other || !input) return null;
  const native = other.kind === 'letter' ? other.upper : other.native;
  return <p className="confusion">{t('session.thatWouldBe', { input, native })}</p>;
}

/** Names the area that was clicked instead (map tasks). */
export function ClickedLine({ index, id }: { index: CourseIndex; id: string }) {
  const t = useT();
  const other = index.byId.get(id);
  if (!other || other.kind !== 'region') return null;
  return (
    <p className="confusion">
      {t('session.clickedOther', { native: other.native, name: other.translit })}
    </p>
  );
}

const isMapTask = (task: Task) => task.kind === 'locate' || (task.kind === 'choice' && task.question === 'map');
