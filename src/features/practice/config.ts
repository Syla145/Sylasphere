import { ALL_CATEGORIES, SMART_PRACTICE, type PracticeConfig } from '../../domain/practiceBuilder';
import type { Category } from '../../domain/types';

/**
 * Practice sessions are described entirely by the URL, so every session can be
 * restarted ("Practice again") and linked:
 *   ?mode=smart | weak | mixed
 *   ?c=letters,cities&scope=all&weak=1&n=30   (free practice)
 *   ?lesson=<lessonId>                         (practice this lesson)
 *   ?ids=<id>,<id>                              (practice mistakes)
 */
export type PracticeRequest =
  | { kind: 'config'; config: PracticeConfig; mode: 'smart' | 'weak' | 'mixed' | 'custom' }
  | { kind: 'lesson'; lessonId: string; count: number }
  | { kind: 'ids'; ids: string[] };

const isCategory = (c: string): c is Category => (ALL_CATEGORIES as string[]).includes(c);

export function parsePracticeParams(params: URLSearchParams): PracticeRequest {
  const lesson = params.get('lesson');
  if (lesson) return { kind: 'lesson', lessonId: lesson, count: Number(params.get('n')) || 10 };
  const ids = params.get('ids');
  if (ids) return { kind: 'ids', ids: ids.split(',').filter(Boolean) };
  const mode = params.get('mode');
  const count = Math.min(50, Math.max(5, Number(params.get('n')) || 20));
  if (mode === 'smart') return { kind: 'config', mode, config: { ...SMART_PRACTICE, count } };
  if (mode === 'weak') return { kind: 'config', mode, config: { ...SMART_PRACTICE, weakOnly: true, count } };
  if (mode === 'mixed') return { kind: 'config', mode, config: { ...SMART_PRACTICE, count } };
  const categories = (params.get('c') ?? '').split(',').filter(isCategory);
  return {
    kind: 'config',
    mode: 'custom',
    config: {
      categories: categories.length ? categories : ALL_CATEGORIES,
      weakOnly: params.get('only') === 'weak',
      scope: params.get('scope') === 'all' ? 'all' : 'learned',
      prioritizeWeak: params.get('weak') !== '0',
      count,
      // 'district' was the first name of the map layer; old links keep working
      layer: params.get('layer') === 'map' || params.get('layer') === 'district' ? 'map' : undefined,
    },
  };
}

export function practiceQuery(config: PracticeConfig): string {
  const p = new URLSearchParams();
  p.set('c', config.categories.join(','));
  p.set('scope', config.scope);
  p.set('weak', config.prioritizeWeak ? '1' : '0');
  p.set('n', String(config.count));
  if (config.weakOnly) p.set('only', 'weak');
  if (config.layer) p.set('layer', config.layer);
  return p.toString();
}
