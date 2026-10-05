/**
 * Answer normalisation. Applied identically to user input and to every
 * accepted answer. It removes only technical differences; it never forgives
 * a typo. Steps (spec section 7):
 *
 * 1. Unicode NFKC, then NFD and removal of combining marks (é → e, ä → a).
 * 2. ß → ss.
 * 3. Lower case.
 * 4. All dash variants → "-", all apostrophe variants → "'".
 * 5. Hyphen and space are equivalent (both become a single space).
 * 6. Collapse whitespace, trim.
 * 7. Drop a single trailing full stop.
 */

const DASHES = /[‐‑‒–—―−﹘﹣－]/g;
const APOSTROPHES = /[’‘ʼʻ`´′]/g;
const COMBINING = /\p{M}+/gu;

export function normalize(input: string): string {
  let s = input.normalize('NFKC').normalize('NFD').replace(COMBINING, '');
  s = s.replace(/ß/g, 'ss').replace(/ẞ/g, 'ss');
  s = s.toLowerCase();
  s = s.replace(DASHES, '-').replace(APOSTROPHES, "'");
  s = s.replace(/-/g, ' ');
  s = s.replace(/\s+/g, ' ').trim();
  if (s.endsWith('.')) s = s.slice(0, -1).trimEnd();
  return s;
}
