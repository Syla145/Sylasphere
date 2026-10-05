import { useCallback } from 'react';
import type { L10n, Lang, PlaceItem } from '../domain/types';
import { useProgress } from '../store/progressStore';
import { de } from './de';
import { en, type MessageKey } from './en';

const DICTS: Record<Lang, Record<string, string>> = { en, de };

export type Vars = Record<string, string | number>;

/**
 * Minimal i18n: typed keys, {placeholders} and a one/other plural rule
 * (keys ending in ".one" / ".other", chosen by `n`).
 */
export function translate(lang: Lang, key: string, vars?: Vars): string {
  const dict = DICTS[lang];
  let template = dict[key];
  if (template === undefined && vars && typeof vars.n === 'number') {
    template = dict[`${key}.${vars.n === 1 ? 'one' : 'other'}`];
  }
  if (template === undefined) template = (en as Record<string, string>)[key] ?? key;
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, k: string) => (vars[k] !== undefined ? String(vars[k]) : `{${k}}`));
}

export type PluralBase<K> = K extends `${infer B}.one` ? B : never;
export type TKey = MessageKey | PluralBase<MessageKey>;

export function useLang(): Lang {
  return useProgress((s) => s.root.settings.uiLang);
}

export function useT() {
  const lang = useLang();
  return useCallback((key: TKey, vars?: Vars) => translate(lang, key, vars), [lang]);
}

export const pick = (text: L10n, lang: Lang) => text[lang];

/** Place names: the UI language decides which known name comes first. */
export function placeNames(place: PlaceItem, lang: Lang): [string, string] {
  return lang === 'de' ? [place.names.de, place.names.en] : [place.names.en, place.names.de];
}

/** "Moskau · Moscow" – identical names are shown once. */
export function placeNameLine(place: PlaceItem, lang: Lang): string {
  const [a, b] = placeNames(place, lang);
  return a === b ? a : `${a} · ${b}`;
}

export function formatPercent(value: number): number {
  return Math.round(value * 100);
}

/** Time today ("15:42"), otherwise date and time. */
export function formatDateTime(ts: number, lang: Lang): string {
  const d = new Date(ts);
  const locale = lang === 'de' ? 'de-DE' : 'en-GB';
  const time = d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
  return d.toDateString() === new Date().toDateString() ? time : `${d.toLocaleDateString(locale, { day: 'numeric', month: 'short' })}, ${time}`;
}

export function formatDate(ts: number, lang: Lang): string {
  return new Date(ts).toLocaleDateString(lang === 'de' ? 'de-DE' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}
