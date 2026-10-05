import type { ComboItem, ContrastSet, LetterItem } from '../../domain/types';
import { comboId, letterId } from './translit';

type L = Omit<LetterItem, 'id' | 'kind'> & { slug: string };
const def = ({ slug, ...rest }: L): LetterItem => ({ id: letterId(slug), kind: 'letter', ...rest });

/** The 24 Greek letters in didactic order (familiar → false friends → new shapes). */
export const LETTERS: LetterItem[] = [
  // Lesson 1 – Easy Wins
  def({ slug: 'alpha', upper: 'Α', lower: 'α', reading: 'a', accepted: ['a'],
    mnemonic: { de: 'Wie das lateinische A.', en: 'Just like Latin A.' } }),
  def({ slug: 'epsilon', upper: 'Ε', lower: 'ε', reading: 'e', accepted: ['e'],
    mnemonic: { de: 'Wie E. Klein ε, wie ein rundes E.', en: 'Like E. Lowercase ε is a rounded E.' } }),
  def({ slug: 'iota', upper: 'Ι', lower: 'ι', reading: 'i', accepted: ['i'],
    mnemonic: { de: 'Wie I, klein ohne Punkt: ι.', en: 'Like I, lowercase without a dot: ι.' } }),
  def({ slug: 'kappa', upper: 'Κ', lower: 'κ', reading: 'k', accepted: ['k'],
    mnemonic: { de: 'Wie K.', en: 'Like K.' } }),
  def({ slug: 'omicron', upper: 'Ο', lower: 'ο', reading: 'o', accepted: ['o'],
    mnemonic: { de: 'Wie O. Das „kleine o“ – Ω ist das „große o“.', en: 'Like O. The “small o” – Ω is the “big o”.' } }),
  def({ slug: 'tau', upper: 'Τ', lower: 'τ', reading: 't', accepted: ['t'],
    mnemonic: { de: 'Wie T. Klein τ ist ein kleines Dach.', en: 'Like T. Lowercase τ is a small roof.' } }),

  // Lesson 2 – False Friends I
  def({ slug: 'eta', upper: 'Η', lower: 'η', reading: 'i', accepted: ['i'], falseFriend: true, looksLike: 'H',
    mnemonic: { de: 'Sieht aus wie H, liest sich i. Klein η sieht aus wie n. Ηράκλειο = Irakleio.', en: 'Looks like H, reads i. Lowercase η looks like n. Ηράκλειο = Irakleio.' } }),
  def({ slug: 'rho', upper: 'Ρ', lower: 'ρ', reading: 'r', accepted: ['r'], falseFriend: true, looksLike: 'P',
    mnemonic: { de: 'Sieht aus wie P, ist aber R. Ρόδος = Rodos.', en: 'Looks like P, but reads R. Ρόδος = Rodos.' } }),
  def({ slug: 'nu', upper: 'Ν', lower: 'ν', reading: 'n', accepted: ['n'], falseFriend: true, looksLike: 'v',
    mnemonic: { de: 'Groß wie N. Klein ν sieht aus wie v – ist aber n. νερό = nero.', en: 'Capital like N. Lowercase ν looks like v – but reads n. νερό = nero.' } }),
  def({ slug: 'beta', upper: 'Β', lower: 'β', reading: 'v', accepted: ['v'], falseFriend: true, looksLike: 'B',
    mnemonic: { de: 'Sieht aus wie B, liest sich v. Βόλος = Volos.', en: 'Looks like B, reads v. Βόλος = Volos.' } }),

  // Lesson 3 – False Friends II
  def({ slug: 'upsilon', upper: 'Υ', lower: 'υ', reading: 'y', accepted: ['y', 'i'], falseFriend: true, looksLike: 'u',
    mnemonic: { de: 'Groß wie Y. Klein υ sieht aus wie u – liest sich aber y (gesprochen i). Κέρκυρα = Kerkyra.', en: 'Capital like Y. Lowercase υ looks like u – but reads y (spoken i). Κέρκυρα = Kerkyra.' } }),
  def({ slug: 'chi', upper: 'Χ', lower: 'χ', reading: 'ch', accepted: ['ch', 'kh', 'h'], falseFriend: true, looksLike: 'X',
    mnemonic: { de: 'Sieht aus wie X, liest sich ch (wie in „Bach“). Χανιά = Chania.', en: 'Looks like X, reads ch (as in “loch”). Χανιά = Chania.' } }),
  def({ slug: 'mu', upper: 'Μ', lower: 'μ', reading: 'm', accepted: ['m'], falseFriend: true, looksLike: 'u',
    mnemonic: { de: 'Groß wie M. Klein μ sieht aus wie u mit Stiel – ist aber m.', en: 'Capital like M. Lowercase μ looks like a u with a stem – but is m.' } }),
  def({ slug: 'zeta', upper: 'Ζ', lower: 'ζ', reading: 'z', accepted: ['z'],
    mnemonic: { de: 'Groß wie Z, klein ein geschwungenes ζ.', en: 'Capital like Z, lowercase a curly ζ.' } }),

  // Lesson 4 – New Shapes I
  def({ slug: 'gamma', upper: 'Γ', lower: 'γ', reading: 'g', accepted: ['g', 'gh', 'y'],
    note: { de: 'Vor e- und i-Lauten klingt γ wie j; auf Schildern steht trotzdem g (Άγιος = Agios).', en: 'Before e and i sounds γ sounds like y; signs still write g (Άγιος = Agios).' },
    mnemonic: { de: 'Ein Galgen: Γ = g. Klein γ sieht aus wie ein y.', en: 'A gallows: Γ = g. Lowercase γ looks like a y.' } }),
  def({ slug: 'delta', upper: 'Δ', lower: 'δ', reading: 'd', accepted: ['d', 'dh'],
    mnemonic: { de: 'Ein Dreieck: Δ = d (gesprochen wie englisches th in „this“). Δράμα = Drama.', en: 'A triangle: Δ = d (spoken like th in “this”). Δράμα = Drama.' } }),
  def({ slug: 'lambda', upper: 'Λ', lower: 'λ', reading: 'l', accepted: ['l'],
    mnemonic: { de: 'Ein Dach ohne Querstrich: Λ = l. Λάρισα = Larisa.', en: 'A roof without a crossbar: Λ = l. Λάρισα = Larisa.' } }),
  def({ slug: 'pi', upper: 'Π', lower: 'π', reading: 'p', accepted: ['p'],
    mnemonic: { de: 'Das Pi aus der Mathematik: Π = p. Πάτρα = Patra.', en: 'Pi from maths: Π = p. Πάτρα = Patra.' } }),
  def({ slug: 'sigma', upper: 'Σ', lower: 'σ', reading: 's', accepted: ['s'],
    note: { de: 'Am Wortende schreibt man ς statt σ: Βόλος.', en: 'At the end of a word σ is written ς: Βόλος.' },
    mnemonic: { de: 'Das Summenzeichen: Σ = s. Klein σ, am Wortende ς.', en: 'The sum sign: Σ = s. Lowercase σ, at word ends ς.' } }),

  // Lesson 5 – New Shapes II
  def({ slug: 'theta', upper: 'Θ', lower: 'θ', reading: 'th', accepted: ['th'],
    mnemonic: { de: 'Ein O mit Querstrich: Θ = th. Αθήνα = Athina.', en: 'An O with a bar: Θ = th. Αθήνα = Athina.' } }),
  def({ slug: 'phi', upper: 'Φ', lower: 'φ', reading: 'f', accepted: ['f', 'ph'],
    mnemonic: { de: 'Ein Kreis mit Strich: Φ = f. Φλώρινα = Florina.', en: 'A circle with a stroke: Φ = f. Φλώρινα = Florina.' } }),
  def({ slug: 'psi', upper: 'Ψ', lower: 'ψ', reading: 'ps', accepted: ['ps'],
    mnemonic: { de: 'Ein Dreizack: Ψ = ps. ψωμί = psomi, Brot.', en: 'A trident: Ψ = ps. ψωμί = psomi, bread.' } }),
  def({ slug: 'xi', upper: 'Ξ', lower: 'ξ', reading: 'x', accepted: ['x', 'ks'],
    mnemonic: { de: 'Drei Querstriche: Ξ = x (ks). Ξάνθη = Xanthi.', en: 'Three bars: Ξ = x (ks). Ξάνθη = Xanthi.' } }),
  def({ slug: 'omega', upper: 'Ω', lower: 'ω', reading: 'o', accepted: ['o'], falseFriend: true, looksLike: 'w',
    mnemonic: { de: 'Ein Hufeisen: Ω = o. Klein ω sieht aus wie w – ist aber o.', en: 'A horseshoe: Ω = o. Lowercase ω looks like w – but is o.' } }),
];

const combo = (slug: string, native: string, reading: string, note: ComboItem['note']): ComboItem => ({
  id: comboId(slug),
  kind: 'combo',
  native,
  reading,
  note,
  unit: true,
});

/** Letter pairs that are read as one unit. ELOT spelling first, the spoken form accepted too. */
export const DIGRAPHS: ComboItem[] = [
  combo('ai', 'αι', 'ai', { de: 'Gesprochen e. Auf Schildern meist ai: Αιγαίο = Aigaio. Beides gilt.', en: 'Spoken e. Signs usually write ai: Αιγαίο = Aigaio. Both count.' }),
  combo('ei', 'ει', 'ei', { de: 'Gesprochen i. Auf Schildern ei: Ηράκλειο = Irakleio. Beides gilt.', en: 'Spoken i. Signs write ei: Ηράκλειο = Irakleio. Both count.' }),
  combo('oi', 'οι', 'oi', { de: 'Gesprochen i. Auf Schildern oi: Βέροια = Veroia. Beides gilt.', en: 'Spoken i. Signs write oi: Βέροια = Veroia. Both count.' }),
  combo('ou', 'ου', 'ou', { de: 'Gesprochen u, geschrieben ou: Ηγουμενίτσα = Igoumenitsa.', en: 'Spoken u, written ou: Ηγουμενίτσα = Igoumenitsa.' }),
  combo('av', 'αυ', 'av', { de: 'av vor Vokalen und weichen Konsonanten, sonst af: Ναύπλιο = Nafplio.', en: 'av before vowels and soft consonants, otherwise af: Ναύπλιο = Nafplio.' }),
  combo('ev', 'ευ', 'ev', { de: 'ev oder ef, nie „eu“: Λευκάδα = Lefkada.', en: 'ev or ef, never “eu”: Λευκάδα = Lefkada.' }),
  combo('mp', 'μπ', 'b', { de: 'Am Wortanfang b, sonst mp: μπύρα = bira, Όλυμπος = Olympos.', en: 'b at the start of a word, otherwise mp: μπύρα = bira, Όλυμπος = Olympos.' }),
  combo('nt', 'ντ', 'd', { de: 'Am Wortanfang d, sonst nt: Κέντρο = Kentro.', en: 'd at the start of a word, otherwise nt: Κέντρο = Kentro.' }),
  combo('gk', 'γκ', 'g', { de: 'Am Wortanfang g, sonst gk oder ng.', en: 'g at the start of a word, otherwise gk or ng.' }),
  combo('gg', 'γγ', 'ng', { de: 'Gesprochen ng: Μεσολόγγι = Mesolongi.', en: 'Spoken ng: Μεσολόγγι = Mesolongi.' }),
];

const sy = (slug: string, native: string, reading: string): ComboItem => ({ id: comboId(`s-${slug}`), kind: 'combo', native, reading });

/** Syllables for the letter lessons. */
export const SYLLABLES: ComboItem[] = [
  sy('ka', 'κα', 'ka'), sy('to', 'το', 'to'), sy('ti', 'τι', 'ti'), sy('ke', 'κε', 'ke'),
  sy('ro', 'ρο', 'ro'), sy('ni', 'νη', 'ni'), sy('va', 'βα', 'va'), sy('ne', 'νε', 'ne'),
  sy('cha', 'χα', 'cha'), sy('my', 'μυ', 'my'), sy('za', 'ζα', 'za'), sy('cho', 'χο', 'cho'),
  sy('ga', 'γα', 'ga'), sy('de', 'δε', 'de'), sy('la', 'λα', 'la'), sy('pa', 'πα', 'pa'), sy('so', 'σο', 'so'),
  sy('tha', 'θα', 'tha'), sy('fi', 'φι', 'fi'), sy('psa', 'ψα', 'psa'), sy('xe', 'ξε', 'xe'), sy('mo', 'μω', 'mo'),
];

const ids = (...slugs: string[]) => slugs.map(letterId);

export const CONTRAST_SETS: ContrastSet[] = [
  { id: 'el:cs:eta-nu', itemIds: ids('eta', 'nu', 'upsilon'), note: { de: 'Klein: η = i (wie n), ν = n (wie v), υ = y (wie u).', en: 'Lowercase: η = i (like n), ν = n (like v), υ = y (like u).' } },
  { id: 'el:cs:rho-pi', itemIds: ids('rho', 'pi'), note: { de: 'Ρ = r (wie P), Π = p.', en: 'Ρ = r (like P), Π = p.' } },
  { id: 'el:cs:chi-xi', itemIds: ids('chi', 'xi', 'kappa'), note: { de: 'Χ = ch (wie X), Ξ = x, Κ = k.', en: 'Χ = ch (like X), Ξ = x, Κ = k.' } },
  { id: 'el:cs:o', itemIds: ids('omega', 'omicron', 'theta'), note: { de: 'Ω und Ο = o, Θ = th (O mit Strich).', en: 'Ω and Ο = o, Θ = th (O with a bar).' } },
  { id: 'el:cs:beta-delta', itemIds: ids('beta', 'delta', 'gamma'), note: { de: 'Β = v (wie B), Δ = d, Γ = g.', en: 'Β = v (like B), Δ = d, Γ = g.' } },
  { id: 'el:cs:round', itemIds: ids('theta', 'phi', 'psi'), note: { de: 'Θ = th, Φ = f, Ψ = ps.', en: 'Θ = th, Φ = f, Ψ = ps.' } },
  { id: 'el:cs:mu-nu', itemIds: ids('mu', 'nu', 'upsilon'), note: { de: 'Klein: μ = m (u mit Stiel), ν = n, υ = y.', en: 'Lowercase: μ = m (u with a stem), ν = n, υ = y.' } },
  { id: 'el:cs:lambda-delta', itemIds: ids('lambda', 'delta'), note: { de: 'Λ = l (ohne Boden), Δ = d (Dreieck).', en: 'Λ = l (no base), Δ = d (triangle).' } },
];
