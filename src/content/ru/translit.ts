import type { Segment } from '../../domain/types';

/**
 * Russian transliteration rules. The first alternative is canonical
 * (BGN/PCGN-like, without diacritics, as used on Russian road signs and in
 * English-language maps). Further alternatives are established spellings
 * (German-friendly j-forms, scientific c for Ц, apostrophes for Ь/Ъ).
 *
 * The list is deliberately explicit: an input is accepted only if every
 * character is spelled with one of these alternatives.
 */
const BASE: Record<string, string[]> = {
  а: ['a'],
  б: ['b'],
  в: ['v'],
  г: ['g'],
  д: ['d'],
  ё: ['yo', 'jo', 'e'],
  ж: ['zh'],
  з: ['z'],
  и: ['i'],
  й: ['y', 'i', 'j'],
  к: ['k'],
  л: ['l'],
  м: ['m'],
  н: ['n'],
  о: ['o'],
  п: ['p'],
  р: ['r'],
  с: ['s'],
  т: ['t'],
  у: ['u'],
  ф: ['f'],
  х: ['kh', 'h'],
  ц: ['ts', 'c'],
  ч: ['ch'],
  ш: ['sh'],
  щ: ['shch', 'sch'],
  ъ: ['', "'"],
  ы: ['y'],
  ь: ['', "'"],
  э: ['e'],
  ю: ['yu', 'ju', 'iu'],
  я: ['ya', 'ja', 'ia'],
};

const VOWELS = new Set('аеёиоуыэюя');
const SEPARATORS = new Set([' ', '-', '‑', '–']);

/** Word-final -ий / -ый: the endings of Нижний, Великий, Красный. */
const ENDING_IY = ['iy', 'y', 'ii', 'i', 'ij'];
const ENDING_YY = ['y', 'yy', 'iy', 'yi', 'yj'];

function isWordEnd(chars: string[], i: number): boolean {
  return i >= chars.length || SEPARATORS.has(chars[i]);
}

export function segmentRu(native: string): Segment[] {
  const chars = Array.from(native.toLowerCase());
  const out: Segment[] = [];
  for (let i = 0; i < chars.length; i++) {
    const c = chars[i];
    if (SEPARATORS.has(c)) {
      out.push({ alts: [' '], index: i });
      continue;
    }
    // word-final -ий / -ый as one segment
    if ((c === 'и' || c === 'ы') && chars[i + 1] === 'й' && isWordEnd(chars, i + 2)) {
      out.push({ alts: c === 'и' ? ENDING_IY : ENDING_YY, index: i });
      i += 1;
      continue;
    }
    if (c === 'е') {
      const prev = chars[i - 1];
      const initial = prev === undefined || SEPARATORS.has(prev) || VOWELS.has(prev) || prev === 'ь' || prev === 'ъ';
      out.push({ alts: initial ? ['ye', 'e', 'je'] : ['e'], index: i });
      continue;
    }
    const alts = BASE[c];
    if (alts) out.push({ alts, index: i });
    // other characters (dots, brackets, digits) are not part of the reading
  }
  return out;
}

const LETTER_SLUGS: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'yo', ж: 'zh', з: 'z', и: 'i', й: 'y',
  к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f',
  х: 'kh', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'shch', ъ: 'hard', ы: 'yery', ь: 'soft', э: 'eh',
  ю: 'yu', я: 'ya',
};

export const letterId = (slug: string) => `ru:letter:${slug}`;

export function letterIdOfChar(ch: string): string | undefined {
  const slug = LETTER_SLUGS[ch.toLowerCase()];
  return slug ? letterId(slug) : undefined;
}

/** Letter ids needed to read a native string (decodability). */
export function requiredLettersRu(native: string): string[] {
  const ids = new Set<string>();
  for (const ch of Array.from(native)) {
    const id = letterIdOfChar(ch);
    if (id) ids.add(id);
  }
  return [...ids];
}
