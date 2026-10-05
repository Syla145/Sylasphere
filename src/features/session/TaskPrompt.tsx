import type { RefObject } from 'react';
import type { CourseIndex } from '../../domain/courseIndex';
import type { SessionState } from '../../domain/sessionEngine';
import type { GradedTask } from '../../domain/tasks';
import type { PlaceItem } from '../../domain/types';
import { placeNames, useLang, useT } from '../../i18n';
import { MapLabelToggle, useMapLabels } from '../map/MapLabelToggle';
import { layerOfItem } from '../map/layer';
import { MapView, type Mark } from '../map/MapView';

/** Glyph size by length so long names never overflow and nothing jumps. */
export function sizeFor(text: string): 'xl' | 'l' | 'm' | 's' {
  const n = Array.from(text).length;
  if (n <= 2) return 'xl';
  if (n <= 9) return 'l';
  if (n <= 16) return 'm';
  return 's';
}

interface Props {
  index: CourseIndex;
  task: GradedTask;
  state: SessionState;
  input: string;
  setInput: (v: string) => void;
  inputRef: RefObject<HTMLInputElement | null>;
  onChoose: (i: number) => void;
  onSubmit: () => void;
  onLocate: (id: string) => void;
}

export function TaskPrompt({ index, task, state, input, setInput, inputRef, onChoose, onLocate }: Props) {
  const t = useT();
  const lang = useLang();
  const item = index.byId.get(task.itemId);
  const feedback = state.phase === 'feedback';
  const taskLabels = useMapLabels('taskMapLabels');
  const layer = layerOfItem(item);
  const onMap = index.mapShapes.has(task.itemId);

  let prompt: string;
  if (task.kind === 'identify')
    prompt = item?.kind === 'city' ? t('session.identifyCity') : layer === 'district' ? t('session.identifyDistrict') : layer === 'province' ? t('session.identifyProvince') : t('session.identifyRegion');
  else if (task.kind === 'locate')
    prompt = !onMap ? t('session.locate') : layer === 'district' ? t('session.locateDistrict') : layer === 'province' ? t('session.locateProvince') : t('session.locateRegion');
  else if (task.kind === 'meaning') prompt = t('session.meaning');
  else if (task.kind === 'read') prompt = item?.kind === 'letter' ? t('session.readLetter') : t('session.read');
  else if (task.question === 'reading') prompt = t('session.choiceReading');
  else if (task.question === 'glyph') prompt = t('session.choiceGlyph', { r: task.display });
  else if (task.question === 'function') prompt = t('session.choiceFunction');
  else if (task.question === 'map')
    prompt = layer === 'district' ? t('session.choiceMapDistrict') : layer === 'province' ? t('session.choiceMapProvince') : t('session.choiceMapRegion');
  else prompt = t('session.scan', { name: placeNames(item as PlaceItem, lang)[0] });

  const isScan = task.kind === 'choice' && task.question === 'scan';
  const isGlyphChoice = task.kind === 'choice' && task.question === 'glyph';
  const isMapChoice = task.kind === 'choice' && task.question === 'map';
  const nativeChoice = isScan || isGlyphChoice || isMapChoice;
  const display = task.kind === 'choice' && nativeChoice ? null : task.display;

  // Marks on the map: the wrong first click stays red; feedback shows the answer in green.
  const marks: Record<string, Mark> = {};
  if (task.kind === 'locate') {
    const clicked = state.lastInput;
    if (clicked && clicked !== task.itemId && (feedback || state.attempt === 1)) marks[clicked] = 'wrong';
    if (feedback) marks[task.itemId] = state.lastResult === 'W' ? 'target' : 'correct';
  }
  if (isMapChoice) marks[task.itemId] = feedback ? (state.lastResult === 'W' ? 'target' : 'correct') : 'target';
  const hidden = new Set([task.itemId]);

  const inputState = feedback ? (state.lastResult === 'W' ? ' is-wrong' : ' is-correct') : '';
  const placeholder =
    task.kind === 'identify' ? t('session.placeholderPlace') : task.kind === 'meaning' ? t('session.placeholderMeaning') : t('session.placeholderRead');

  return (
    <div className="task">
      <p className="task-prompt">{prompt}</p>
      {display !== null && (
        <div className={`plate${task.kind === 'locate' ? ' plate-compact' : ''}`}>
          <span className={`glyph glyph-${task.kind === 'locate' && sizeFor(display) !== 's' ? 'm' : sizeFor(display)}`} lang={index.content.id}>
            {display}
          </span>
        </div>
      )}
      {isGlyphChoice && (
        <div className="plate plate-latin">
          <span className="glyph glyph-l latin">{task.display}</span>
        </div>
      )}

      {(task.kind === 'locate' || isMapChoice) && index.map && (
        <div className="task-map">
          <MapView
            index={index}
            label={t('map.label')}
            marks={marks}
            labels={taskLabels}
            hideLabels={feedback ? undefined : hidden}
            onPick={task.kind === 'locate' && !feedback ? onLocate : undefined}
            focus={isMapChoice ? [task.itemId] : undefined}
            zoomable
          />
          <MapLabelToggle which="taskMapLabels" compact />
        </div>
      )}

      {task.kind === 'locate' ? null : task.kind === 'choice' ? (
        <div className={`choices${isScan || isMapChoice ? ' choices-sign' : ''}${task.question === 'function' ? ' choices-text' : ''}`} role="group" aria-label={prompt}>
          {task.options.map((opt, i) => {
            const eliminated = state.eliminated.includes(i);
            const reveal = feedback && opt.correct;
            const chosenWrong = feedback && eliminated;
            const label = opt.l10n ? opt.l10n[lang] : opt.label ?? '';
            return (
              <button
                key={i}
                type="button"
                className={`choice${eliminated ? ' is-out' : ''}${reveal ? ' is-correct' : ''}${chosenWrong ? ' is-wrong' : ''}`}
                disabled={feedback || eliminated}
                onClick={() => onChoose(i)}
              >
                <kbd aria-hidden="true">{i + 1}</kbd>
                <span className={opt.l10n ? 'choice-text' : nativeChoice ? 'choice-native' : 'choice-latin'} lang={nativeChoice ? index.content.id : undefined}>
                  {label === '' ? '–' : label}
                </span>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="answer">
          <input
            ref={inputRef}
            className={`answer-input${inputState}`}
            value={input}
            onChange={(e) => !feedback && setInput(e.target.value)}
            readOnly={feedback}
            placeholder={placeholder}
            aria-label={placeholder}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="none"
            spellCheck={false}
            enterKeyHint={feedback ? 'next' : 'go'}
            inputMode="text"
          />
        </div>
      )}
    </div>
  );
}
