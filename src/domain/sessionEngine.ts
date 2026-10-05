import type { Evaluation } from './evaluate';
import type { Result } from './srs';
import { isGraded, type Task } from './tasks';

/**
 * Pure session state machine shared by lessons and practice.
 *
 * Learn mode:   1st error → hint + second try; 2nd error → solution, item marked
 *               unsure, re-asked 3–5 tasks later and once more in a final round.
 * Practice mode: an error is evaluated at once; the task returns 3–7 tasks later.
 * Each item is re-inserted at most twice per session.
 */

export type SessionMode = 'learn' | 'practice';

export interface Outcome {
  itemId: string;
  result: Result;
  taskKind: Task['kind'];
  confusedWith?: string;
}

export interface SessionState {
  mode: SessionMode;
  tasks: Task[];
  index: number;
  phase: 'answer' | 'feedback' | 'done';
  attempt: 0 | 1;
  lastInput: string;
  lastResult: Result | null;
  evaluation: Evaluation | null;
  /** Choice options ruled out after a first wrong pick (learn mode). */
  eliminated: number[];
  /** First graded result per item: this is what updates long-term progress. */
  first: Record<string, Result>;
  outcomes: Outcome[];
  reinserts: Record<string, number>;
  unsure: string[];
  introduced: string[];
  finalRoundAdded: boolean;
  /** Graded tasks planned at the start (for the "12 / 20 + 2" counter). */
  plannedGraded: number;
  extraGraded: number;
}

export interface EngineDeps {
  rng: () => number;
  /** Builds a fresh typed task for an item (used for re-asking). */
  retask: (task: Task) => Task;
  /** Tasks for the final round of a lesson (unsure items still wrong). */
  finalRound?: (itemIds: string[]) => Task[];
}

export function createSession(tasks: Task[], mode: SessionMode): SessionState {
  return {
    mode,
    tasks,
    index: 0,
    phase: tasks.length ? 'answer' : 'done',
    attempt: 0,
    lastInput: '',
    lastResult: null,
    evaluation: null,
    eliminated: [],
    first: {},
    outcomes: [],
    reinserts: {},
    unsure: [],
    introduced: [],
    finalRoundAdded: false,
    plannedGraded: tasks.filter(isGraded).length,
    extraGraded: 0,
  };
}

export const currentTask = (s: SessionState): Task | undefined => s.tasks[s.index];

function randInt(rng: () => number, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

/** Submit an answer for the current graded task. `choiceIndex` is set for choice tasks. */
export function submit(
  s: SessionState,
  input: string,
  evaluation: Evaluation,
  deps: EngineDeps,
  choiceIndex?: number,
): SessionState {
  const task = currentTask(s);
  if (!task || !isGraded(task) || s.phase !== 'answer') return s;

  if (!evaluation.correct && s.mode === 'learn' && s.attempt === 0) {
    return {
      ...s,
      attempt: 1,
      lastInput: input,
      evaluation,
      eliminated: choiceIndex !== undefined ? [...s.eliminated, choiceIndex] : s.eliminated,
    };
  }

  const result: Result = evaluation.correct ? (s.attempt === 0 ? 'C' : 'R') : 'W';
  const next: SessionState = {
    ...s,
    phase: 'feedback',
    lastInput: input,
    lastResult: result,
    evaluation,
    eliminated: choiceIndex !== undefined && !evaluation.correct ? [...s.eliminated, choiceIndex] : s.eliminated,
    first: s.first[task.itemId] ? s.first : { ...s.first, [task.itemId]: result },
    outcomes: [...s.outcomes, { itemId: task.itemId, result, taskKind: task.kind, confusedWith: evaluation.confusedWith }],
  };

  if (result === 'W') {
    const count = s.reinserts[task.itemId] ?? 0;
    if (s.mode === 'learn' && !next.unsure.includes(task.itemId)) next.unsure = [...next.unsure, task.itemId];
    if (count < 2) {
      const gap = s.mode === 'learn' ? randInt(deps.rng, 3, 5) : randInt(deps.rng, 3, 7);
      const pos = Math.min(s.index + 1 + gap, s.tasks.length);
      const tasks = [...s.tasks];
      tasks.splice(pos, 0, deps.retask(task));
      next.tasks = tasks;
      next.reinserts = { ...s.reinserts, [task.itemId]: count + 1 };
      next.extraGraded = s.extraGraded + 1;
    }
  }
  return next;
}

/** Continue after feedback or an intro card. */
export function advance(s: SessionState, deps: EngineDeps): SessionState {
  const task = currentTask(s);
  let introduced = s.introduced;
  if (task?.kind === 'intro' && !introduced.includes(task.itemId)) introduced = [...introduced, task.itemId];

  let tasks = s.tasks;
  let finalRoundAdded = s.finalRoundAdded;
  let extraGraded = s.extraGraded;
  const index = s.index + 1;

  if (index >= tasks.length && s.mode === 'learn' && !finalRoundAdded && deps.finalRound) {
    // Final round: unsure items whose latest answer in this lesson was still wrong.
    const stillWrong = s.unsure.filter((id) => {
      const last = [...s.outcomes].reverse().find((o) => o.itemId === id);
      return last?.result === 'W';
    });
    const extra = stillWrong.length ? deps.finalRound(stillWrong) : [];
    tasks = [...tasks, ...extra];
    extraGraded += extra.filter(isGraded).length;
    finalRoundAdded = true;
  }

  return {
    ...s,
    tasks,
    index,
    introduced,
    finalRoundAdded,
    extraGraded,
    phase: index >= tasks.length ? 'done' : 'answer',
    attempt: 0,
    lastInput: '',
    lastResult: null,
    evaluation: null,
    eliminated: [],
  };
}

/** Answered graded tasks so far (for the counter). */
export function answeredCount(s: SessionState): number {
  return s.outcomes.length;
}

/** First-try correct / graded tasks (lesson complete "18 / 20"). */
export function score(s: SessionState): { correct: number; total: number } {
  const graded = s.tasks.slice(0, s.index).filter(isGraded).length;
  return { correct: s.outcomes.filter((o) => o.result === 'C').length, total: Math.max(graded, s.outcomes.length) };
}
