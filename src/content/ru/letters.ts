import type { ContrastSet, LetterItem } from '../../domain/types';
import { letterId } from './translit';

type L = Omit<LetterItem, 'id' | 'kind'> & { slug: string };

const def = (l: L): LetterItem => {
  const { slug, ...rest } = l;
  return { id: letterId(slug), kind: 'letter', ...rest };
};

/**
 * The 33 letters of the Russian alphabet. Order here is the didactic order of
 * the lessons, not the alphabet. Mnemonics favour place names and sign words.
 */
export const LETTERS: LetterItem[] = [
  // Lesson 1 – Easy Wins
  def({ slug: 'a', upper: 'А', lower: 'а', reading: 'a', accepted: ['a'],
    mnemonic: { de: 'Wie das lateinische A.', en: 'Just like Latin A.' } }),
  def({ slug: 'o', upper: 'О', lower: 'о', reading: 'o', accepted: ['o'],
    mnemonic: { de: 'Wie das lateinische O.', en: 'Just like Latin O.' } }),
  def({ slug: 'k', upper: 'К', lower: 'к', reading: 'k', accepted: ['k'],
    mnemonic: { de: 'Wie das lateinische K. Klein ist es ein kleines Großbuchstaben-K: к.', en: 'Like Latin K. Lowercase к is simply a small capital.' } }),
  def({ slug: 'm', upper: 'М', lower: 'м', reading: 'm', accepted: ['m'],
    mnemonic: { de: 'Wie M. Achtung: klein ist es ein eckiges м, kein rundes m.', en: 'Like M. Careful: lowercase is an angular м, not a round m.' } }),
  def({ slug: 't', upper: 'Т', lower: 'т', reading: 't', accepted: ['t'],
    mnemonic: { de: 'Wie T. Klein ist es ein kleines Dach: т.', en: 'Like T. Lowercase is a small roof: т.' } }),

  // Lesson 2 – False Friends I
  def({ slug: 'e', upper: 'Е', lower: 'е', reading: 'e', accepted: ['e', 'ye', 'je'],
    mnemonic: { de: 'Wie E. Am Wortanfang schreibt man im Englischen oft ye: Екатеринбург → Yekaterinburg.', en: 'Like E. At the start of a word English often writes ye: Екатеринбург → Yekaterinburg.' } }),
  def({ slug: 'r', upper: 'Р', lower: 'р', reading: 'r', accepted: ['r'], falseFriend: true, looksLike: 'P',
    mnemonic: { de: 'Sieht aus wie P, ist aber R. Denk an РЕСТОРАН = restoran.', en: 'Looks like P, but reads R. Think of РЕСТОРАН = restoran.' } }),
  def({ slug: 's', upper: 'С', lower: 'с', reading: 's', accepted: ['s'], falseFriend: true, looksLike: 'C',
    mnemonic: { de: 'Sieht aus wie C, ist aber immer S. Denk an СССР = SSSR, die Sowjetunion.', en: 'Looks like C, but is always S. Think of СССР = SSSR, the USSR.' } }),
  def({ slug: 'n', upper: 'Н', lower: 'н', reading: 'n', accepted: ['n'], falseFriend: true, looksLike: 'H',
    mnemonic: { de: 'Sieht aus wie H, ist aber N. Denk an НЕТ = net, „nein“.', en: 'Looks like H, but reads N. Think of НЕТ = net, “no”.' } }),

  // Lesson 3 – False Friends II
  def({ slug: 'v', upper: 'В', lower: 'в', reading: 'v', accepted: ['v'], falseFriend: true, looksLike: 'B',
    mnemonic: { de: 'Sieht aus wie B, ist aber V. Denk an ВОДКА = vodka. Das b ist Б.', en: 'Looks like B, but reads V. Think of ВОДКА = vodka. The b is Б.' } }),
  def({ slug: 'u', upper: 'У', lower: 'у', reading: 'u', accepted: ['u'], falseFriend: true, looksLike: 'Y',
    mnemonic: { de: 'Sieht aus wie Y, ist aber U. Denk an УРАЛ = Ural.', en: 'Looks like Y, but reads U. Think of УРАЛ = Ural.' } }),
  def({ slug: 'kh', upper: 'Х', lower: 'х', reading: 'kh', accepted: ['kh', 'h'], falseFriend: true, looksLike: 'X',
    mnemonic: { de: 'Sieht aus wie X, ist aber kh (wie ch in „Bach“). Denk an ХАБАРОВСК = Khabarovsk.', en: 'Looks like X, but reads kh (like ch in “loch”). Think of ХАБАРОВСК = Khabarovsk.' } }),

  // Lesson 4 – New Shapes I
  def({ slug: 'b', upper: 'Б', lower: 'б', reading: 'b', accepted: ['b'],
    mnemonic: { de: 'Wie eine 6 mit Dach: Б = b. Nicht verwechseln mit В (v).', en: 'Like a 6 with a roof: Б = b. Don’t mix it up with В (v).' } }),
  def({ slug: 'g', upper: 'Г', lower: 'г', reading: 'g', accepted: ['g'],
    mnemonic: { de: 'Ein Galgen: Г = g, wie das griechische Gamma. Steckt in -ГРАД und ГОРОД.', en: 'A gallows: Г = g, like Greek gamma. Found in -ГРАД and ГОРОД.' } }),
  def({ slug: 'd', upper: 'Д', lower: 'д', reading: 'd', accepted: ['d'],
    mnemonic: { de: 'Ein Haus mit Füßen: Д = d, wie das griechische Delta.', en: 'A house on little feet: Д = d, like Greek delta.' } }),
  def({ slug: 'z', upper: 'З', lower: 'з', reading: 'z', accepted: ['z'], looksLike: '3',
    mnemonic: { de: 'Sieht aus wie die Ziffer 3: З = z (weiches s wie in „Sonne“).', en: 'Looks like the digit 3: З = z.' } }),

  // Lesson 5 – New Shapes II
  def({ slug: 'p', upper: 'П', lower: 'п', reading: 'p', accepted: ['p'],
    mnemonic: { de: 'Ein Tor wie das griechische Pi: П = p. Klein п sieht aus wie n – ist aber p.', en: 'A gate like Greek pi: П = p. Lowercase п looks like n – but is p.' } }),
  def({ slug: 'l', upper: 'Л', lower: 'л', reading: 'l', accepted: ['l'],
    mnemonic: { de: 'Ein spitzes Dach ohne Querstrich: Л = l, wie das griechische Lambda.', en: 'A pointed roof without a crossbar: Л = l, like Greek lambda.' } }),
  def({ slug: 'i', upper: 'И', lower: 'и', reading: 'i', accepted: ['i'], falseFriend: true, looksLike: 'N',
    mnemonic: { de: 'Ein gespiegeltes N: И = i. Klein и sieht aus wie ein kleines gespiegeltes N.', en: 'A mirrored N: И = i. Lowercase и is a small mirrored N.' } }),
  def({ slug: 'y', upper: 'Й', lower: 'й', reading: 'y', accepted: ['y', 'i', 'j'],
    mnemonic: { de: 'И mit Häkchen, das „kurze i“: Й = y. Typisch am Wortende: -ий, -ый, -ой (Нижний → Nizhny).', en: 'И with a little hook, the “short i”: Й = y. Typical at word ends: -ий, -ый, -ой (Нижний → Nizhny).' } }),

  // Lesson 6 – Sibilants I
  def({ slug: 'zh', upper: 'Ж', lower: 'ж', reading: 'zh', accepted: ['zh'],
    mnemonic: { de: 'Ein Käfer mit Beinen: Ж = zh (wie j in „Journal“). Ижевск → Izhevsk.', en: 'A beetle with legs: Ж = zh (like s in “measure”). Ижевск → Izhevsk.' } }),
  def({ slug: 'sh', upper: 'Ш', lower: 'ш', reading: 'sh', accepted: ['sh'],
    mnemonic: { de: 'Ein Kamm mit drei Zinken: Ш = sh (wie „sch“). ШОССЕ = shosse, Landstraße.', en: 'A comb with three teeth: Ш = sh. ШОССЕ = shosse, highway.' } }),
  def({ slug: 'shch', upper: 'Щ', lower: 'щ', reading: 'shch', accepted: ['shch', 'sch'],
    mnemonic: { de: 'Ш mit Schwänzchen: Щ = shch. Nur der kleine Schwanz unterscheidet es von Ш.', en: 'Ш with a little tail: Щ = shch. Only the tail tells it apart from Ш.' } }),

  // Lesson 7 – Sibilants II
  def({ slug: 'ts', upper: 'Ц', lower: 'ц', reading: 'ts', accepted: ['ts', 'c'],
    mnemonic: { de: 'Ein Becher mit Schwänzchen: Ц = ts (wie z in „Zahn“). Ц hat zwei Säulen, Щ hat drei.', en: 'A cup with a tail: Ц = ts. Ц has two posts, Щ has three.' } }),
  def({ slug: 'ch', upper: 'Ч', lower: 'ч', reading: 'ch', accepted: ['ch'], looksLike: '4',
    mnemonic: { de: 'Sieht aus wie eine 4: Ч = ch (wie „tsch“). СОЧИ = Sochi.', en: 'Looks like a 4: Ч = ch. СОЧИ = Sochi.' } }),
  def({ slug: 'f', upper: 'Ф', lower: 'ф', reading: 'f', accepted: ['f'],
    mnemonic: { de: 'Ein Kreis mit Strich, wie das griechische Phi: Ф = f. УФА = Ufa.', en: 'A circle with a stroke, like Greek phi: Ф = f. УФА = Ufa.' } }),

  // Lesson 8 – Y-vowels
  def({ slug: 'ya', upper: 'Я', lower: 'я', reading: 'ya', accepted: ['ya', 'ja', 'ia'], falseFriend: true, looksLike: 'R',
    mnemonic: { de: 'Ein gespiegeltes R: Я = ya. Häufig in Endungen: -ская.', en: 'A mirrored R: Я = ya. Common in endings: -ская.' } }),
  def({ slug: 'yu', upper: 'Ю', lower: 'ю', reading: 'yu', accepted: ['yu', 'ju', 'iu'],
    mnemonic: { de: 'Ein I, das an einem O klebt: Ю = yu. ЮГ = yug, „Süden“.', en: 'An I glued to an O: Ю = yu. ЮГ = yug, “south”.' } }),
  def({ slug: 'eh', upper: 'Э', lower: 'э', reading: 'e', accepted: ['e'],
    mnemonic: { de: 'Ein gespiegeltes C mit Strich: Э = e. ЭХО = ekho, Echo. Selten, aber in АЭРОПОРТ.', en: 'A mirrored C with a stroke: Э = e. ЭХО = ekho, echo. Rare, but in АЭРОПОРТ.' } }),
  def({ slug: 'yo', upper: 'Ё', lower: 'ё', reading: 'yo', accepted: ['yo', 'jo'],
    note: { de: 'Auf Schildern fehlen die Punkte meist – dann steht Е.', en: 'Signs usually omit the dots – then it is written Е.' },
    mnemonic: { de: 'Е mit zwei Punkten: Ё = yo. ПОСЁЛОК = posyolok, Siedlung.', en: 'Е with two dots: Ё = yo. ПОСЁЛОК = posyolok, settlement.' } }),

  // Lesson 9 – Special signs
  def({ slug: 'yery', upper: 'Ы', lower: 'ы', reading: 'y', accepted: ['y'],
    mnemonic: { de: 'Ein b mit Strich daneben – aber ein einziger Buchstabe: Ы = y (dunkles i). СЫКТЫВКАР = Syktyvkar.', en: 'A b with a bar beside it – but one single letter: Ы = y. СЫКТЫВКАР = Syktyvkar.' } }),
  def({ slug: 'soft', upper: 'Ь', lower: 'ь', reading: '', accepted: [''],
    note: { de: 'In der Transliteration meist weggelassen oder als Apostroph: Пермь → Perm oder Perm’.', en: 'Usually dropped in transliteration or written as an apostrophe: Пермь → Perm or Perm’.' },
    mnemonic: { de: 'Weichheitszeichen: kein eigener Laut, macht den Konsonanten davor weich.', en: 'Soft sign: no sound of its own, it softens the consonant before it.' },
    functionChoice: {
      correct: { de: 'Kein eigener Laut – macht den Konsonanten davor weich', en: 'No sound of its own – softens the consonant before it' },
      wrong: [
        { de: 'Wird wie b gelesen', en: 'Read like b' },
        { de: 'Kein eigener Laut – trennt Konsonant und Vokal', en: 'No sound of its own – separates consonant and vowel' },
      ],
    } }),
  def({ slug: 'hard', upper: 'Ъ', lower: 'ъ', reading: '', accepted: [''],
    note: { de: 'Selten, aber auf Schildern: ОБЪЕЗД = obyezd, Umleitung.', en: 'Rare, but on signs: ОБЪЕЗД = obyezd, detour.' },
    mnemonic: { de: 'Härtezeichen: kein eigener Laut, trennt Konsonant und folgenden Vokal.', en: 'Hard sign: no sound of its own, separates a consonant from the following vowel.' },
    functionChoice: {
      correct: { de: 'Kein eigener Laut – trennt Konsonant und Vokal', en: 'No sound of its own – separates consonant and vowel' },
      wrong: [
        { de: 'Wird wie b gelesen', en: 'Read like b' },
        { de: 'Kein eigener Laut – macht den Konsonanten davor weich', en: 'No sound of its own – softens the consonant before it' },
      ],
    } }),
];

const ids = (...slugs: string[]) => slugs.map(letterId);

export const CONTRAST_SETS: ContrastSet[] = [
  { id: 'ru:cs:v-b', itemIds: ids('v', 'b'), note: { de: 'В = v, Б = b. Das lateinische B ist im Russischen ein V.', en: 'В = v, Б = b. The Latin-looking B is a V in Russian.' } },
  { id: 'ru:cs:sh-shch-ts', itemIds: ids('sh', 'shch', 'ts'), note: { de: 'Ш = sh, Щ = shch (Ш mit Schwanz), Ц = ts (zwei Säulen mit Schwanz).', en: 'Ш = sh, Щ = shch (Ш with a tail), Ц = ts (two posts with a tail).' } },
  { id: 'ru:cs:i-y', itemIds: ids('i', 'y'), note: { de: 'И = i, Й = y (mit Häkchen).', en: 'И = i, Й = y (with a little hook).' } },
  { id: 'ru:cs:zh-kh', itemIds: ids('zh', 'kh'), note: { de: 'Ж = zh (Käfer mit Beinen), Х = kh (ein X).', en: 'Ж = zh (beetle with legs), Х = kh (an X).' } },
  { id: 'ru:cs:z-eh', itemIds: ids('z', 'eh'), note: { de: 'З = z (wie 3), Э = e (gespiegeltes C mit Strich).', en: 'З = z (like 3), Э = e (mirrored C with a bar).' } },
  { id: 'ru:cs:n-p-i-l', itemIds: ids('n', 'p', 'i', 'l'), note: { de: 'Klein: н = n (wie H), п = p (wie n), и = i, л = l.', en: 'Lowercase: н = n (like H), п = p (like n), и = i, л = l.' } },
  { id: 'ru:cs:r-ya', itemIds: ids('r', 'ya'), note: { de: 'Р = r (wie P), Я = ya (gespiegeltes R).', en: 'Р = r (like P), Я = ya (mirrored R).' } },
  { id: 'ru:cs:e-yo-eh', itemIds: ids('e', 'yo', 'eh'), note: { de: 'Е = e, Ё = yo (zwei Punkte), Э = e (gespiegelt).', en: 'Е = e, Ё = yo (two dots), Э = e (mirrored).' } },
  { id: 'ru:cs:signs', itemIds: ids('soft', 'hard', 'yery', 'b'), note: { de: 'Ь weich, Ъ hart, Ы = y, Б = b.', en: 'Ь soft, Ъ hard, Ы = y, Б = b.' } },
  { id: 'ru:cs:ch-u', itemIds: ids('ch', 'u'), note: { de: 'Ч = ch (wie 4), У = u (wie Y).', en: 'Ч = ch (like 4), У = u (like Y).' } },
  { id: 'ru:cs:g-t', itemIds: ids('g', 't', 'p'), note: { de: 'Г = g (Galgen), Т = t (Dach), П = p (Tor).', en: 'Г = g (gallows), Т = t (roof), П = p (gate).' } },
];
