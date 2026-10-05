import type { Segment } from '../../domain/types';

/**
 * Greek transliteration. The first alternative follows ELOT 743, the standard
 * used on Greek road signs (Αθήνα → Athina, Ηράκλειο → Irakleio). Further
 * alternatives are established phonetic spellings (Iraklio, Pireas) so that a
 * learner who reads correctly is never marked wrong for choosing the other
 * common form. Stress accents are ignored; a diaeresis (ϊ, ϋ) splits a digraph.
 *
 * Digraphs are reading units of their own: ου is "ou", never "o" + "y".
 */

const VOWELS = new Set('αεηιουω');
const VOICED_AFTER_AU = new Set('βγδζλμνρ'); // αυ/ευ → av/ev before these and before vowels
const FRONT = new Set('εηιυ');
const SEPARATORS = new Set([' ', '-', '‑', '–']);

const LETTER_SLUGS: Record<string, string> = {
  α: 'alpha', β: 'beta', γ: 'gamma', δ: 'delta', ε: 'epsilon', ζ: 'zeta', η: 'eta', θ: 'theta',
  ι: 'iota', κ: 'kappa', λ: 'lambda', μ: 'mu', ν: 'nu', ξ: 'xi', ο: 'omicron', π: 'pi',
  ρ: 'rho', σ: 'sigma', τ: 'tau', υ: 'upsilon', φ: 'phi', χ: 'chi', ψ: 'psi', ω: 'omega',
};

export const letterId = (slug: string) => `el:letter:${slug}`;
export const comboId = (slug: string) => `el:combo:${slug}`;

/** Digraphs that are taught as reading units, with their combo slugs. */
const UNIT_DIGRAPHS: Record<string, string> = {
  αι: 'ai', ει: 'ei', οι: 'oi', ου: 'ou', αυ: 'av', ευ: 'ev', μπ: 'mp', ντ: 'nt', γκ: 'gk', γγ: 'gg',
};

interface Ch {
  c: string;
  dia: boolean;
}

/** Lower case, sigma unified, accents dropped, diaeresis remembered per letter. */
function chars(native: string): Ch[] {
  const out: Ch[] = [];
  for (const ch of native.normalize('NFD').toLowerCase()) {
    if (/\p{M}/u.test(ch)) {
      if (ch === '̈' && out.length) out[out.length - 1].dia = true;
      continue;
    }
    out.push({ c: ch === 'ς' ? 'σ' : ch, dia: false });
  }
  return out;
}

interface Piece {
  alts: string[];
  index: number;
  units: string[];
}

function scan(native: string): Piece[] {
  const cs = chars(native);
  const out: Piece[] = [];
  const atStart = (i: number) => i === 0 || SEPARATORS.has(cs[i - 1].c);
  const atEnd = (i: number) => i >= cs.length || SEPARATORS.has(cs[i].c);
  const letter = (c: string) => (LETTER_SLUGS[c] ? [letterId(LETTER_SLUGS[c])] : []);

  for (let i = 0; i < cs.length; i++) {
    const { c } = cs[i];
    if (SEPARATORS.has(c)) {
      out.push({ alts: [' '], index: i, units: [] });
      continue;
    }
    if (!LETTER_SLUGS[c]) continue; // punctuation, brackets, Latin
    const next = cs[i + 1];
    const pair = next && !next.dia && LETTER_SLUGS[next.c] ? c + next.c : '';
    const pairUnits = [...letter(c), ...(next ? letter(next.c) : [])];
    const unit = UNIT_DIGRAPHS[pair] ? [comboId(UNIT_DIGRAPHS[pair])] : [];
    const after = cs[i + 2];

    let alts: string[] | null = null;
    switch (pair) {
      case 'αι':
        alts = ['ai', 'e'];
        break;
      case 'ει':
        alts = ['ei', 'i'];
        break;
      case 'οι':
        alts = ['oi', 'i'];
        break;
      case 'υι':
        alts = ['yi', 'i'];
        break;
      case 'ου':
        alts = ['ou', 'u'];
        break;
      case 'αυ':
      case 'ευ':
      case 'ηυ': {
        const base = pair === 'αυ' ? 'a' : pair === 'ευ' ? 'e' : 'i';
        const voiced = !atEnd(i + 2) && after && (VOWELS.has(after.c) || VOICED_AFTER_AU.has(after.c));
        alts = voiced ? [`${base}v`, `${base}f`] : [`${base}f`, `${base}v`];
        break;
      }
      case 'μπ':
        alts = atStart(i) ? ['b', 'mp', 'mb'] : ['mp', 'b', 'mb'];
        break;
      case 'ντ':
        alts = atStart(i) ? ['d', 'nt', 'nd'] : ['nt', 'd', 'nd'];
        break;
      case 'γκ':
        alts = atStart(i) ? ['g', 'gk'] : ['gk', 'g', 'ng', 'nk'];
        break;
      case 'γγ':
        alts = ['ng', 'gg'];
        break;
      case 'γχ':
        alts = ['nch', 'nkh', 'nh'];
        break;
      case 'γξ':
        alts = ['nx', 'nks'];
        break;
    }
    if (alts) {
      out.push({ alts, index: i, units: [...pairUnits, ...unit] });
      i += 1;
      continue;
    }

    let single: string[];
    switch (c) {
      case 'α': single = ['a']; break;
      case 'β': single = ['v']; break;
      case 'γ': {
        const front = next && (FRONT.has(next.c) || ((next.c === 'α' || next.c === 'ο' || next.c === 'ε') && after?.c === 'ι'));
        single = front ? ['g', 'y', 'gh'] : ['g', 'gh'];
        break;
      }
      case 'δ': single = ['d', 'dh']; break;
      case 'ε': single = ['e']; break;
      case 'ζ': single = ['z']; break;
      case 'η': single = ['i']; break;
      case 'θ': single = ['th']; break;
      case 'ι': single = ['i']; break;
      case 'κ': single = ['k']; break;
      case 'λ': single = ['l']; break;
      case 'μ': single = ['m']; break;
      case 'ν': single = ['n']; break;
      case 'ξ': single = ['x', 'ks']; break;
      case 'ο': single = ['o']; break;
      case 'π': single = ['p']; break;
      case 'ρ': single = atStart(i) ? ['r', 'rh'] : ['r']; break;
      case 'σ': single = ['s']; break;
      case 'τ': single = ['t']; break;
      case 'υ': single = ['y', 'i']; break;
      case 'φ': single = ['f', 'ph']; break;
      case 'χ': single = ['ch', 'kh', 'h']; break;
      case 'ψ': single = ['ps']; break;
      case 'ω': single = ['o']; break;
      default: single = [c];
    }
    out.push({ alts: single, index: i, units: letter(c) });
  }
  return out;
}

export function segmentEl(native: string): Segment[] {
  return scan(native).map(({ alts, index }) => ({ alts, index }));
}

/** Reading units needed to read a word: letters plus taught digraphs. */
export function requiredUnitsEl(native: string): string[] {
  return [...new Set(scan(native).flatMap((p) => p.units))];
}
