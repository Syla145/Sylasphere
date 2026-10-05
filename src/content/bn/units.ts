import type { ComboItem, ContrastSet, L10n, LetterItem } from '../../domain/types';

/**
 * Bengali reading units: 36 consonants, 11 independent vowels, 10 vowel
 * signs, 4 marks, plus phala/reph forms and the conjuncts that occur in the
 * course's place names.
 *
 * Every consonant carries an inherent vowel (o/a). Whether it is pronounced
 * depends on the word, so readings of words and places are listed explicitly
 * instead of being generated (spec section 5). Bangladesh has no single
 * romanisation standard; conventional English spellings are accepted
 * alongside a simple transliteration.
 */

export const unitId = (slug: string) => `bn:letter:${slug}`;

const consonant = (slug: string, ch: string, base: string, example: string, exampleRoman: string, extra: string[] = [], note?: L10n): LetterItem => ({
  id: unitId(slug),
  kind: 'letter',
  upper: ch,
  lower: ch,
  reading: base,
  // the consonant alone, or with its inherent vowel (k, ko, ka)
  accepted: [...new Set([base, `${base}o`, `${base}a`, ...extra])],
  mnemonic: { de: `${ch} = ${base}, mit inhärentem Vokal ${base}o. Beispiel: ${example} = ${exampleRoman}.`, en: `${ch} = ${base}, with its inherent vowel ${base}o. Example: ${example} = ${exampleRoman}.` },
  note,
});

const SAME_SOUND = (a: string, b: string): L10n => ({
  de: `Klingt heute wie ${a}; in Ortsnamen ebenfalls ${b} geschrieben.`,
  en: `Sounds like ${a} today; also written ${b} in place names.`,
});

export const CONSONANTS: LetterItem[] = [
  consonant('ka', 'ক', 'k', 'কুমিল্লা', 'Cumilla'),
  consonant('kha', 'খ', 'kh', 'খুলনা', 'Khulna'),
  consonant('ga', 'গ', 'g', 'গাজীপুর', 'Gazipur'),
  consonant('gha', 'ঘ', 'gh', 'ঘর', 'ghor'),
  consonant('nga', 'ঙ', 'ng', 'টাঙ্গাইল', 'Tangail'),
  consonant('ca', 'চ', 'ch', 'চাঁদপুর', 'Chandpur', ['c']),
  consonant('cha', 'ছ', 'chh', 'মাছ', 'machh', ['ch']),
  consonant('ja', 'জ', 'j', 'জামালপুর', 'Jamalpur', ['z']),
  consonant('jha', 'ঝ', 'jh', 'ঝিনাইদহ', 'Jhenaidah'),
  consonant('nya', 'ঞ', 'n', '-গঞ্জ', '-ganj', ['ny'], { de: 'Fast nur in Konjunkten wie ঞ্জ (nj) und ঞ্চ (nch).', en: 'Almost only inside conjuncts like ঞ্জ (nj) and ঞ্চ (nch).' }),
  consonant('tta', 'ট', 't', 'টাঙ্গাইল', 'Tangail', [], { de: 'Retroflexes t; in Ortsnamen einfach t, wie ত.', en: 'Retroflex t; in place names simply t, like ত.' }),
  consonant('ttha', 'ঠ', 'th', 'ঠাকুরগাঁও', 'Thakurgaon'),
  consonant('dda', 'ড', 'd', 'ডাক', 'dak', [], { de: 'Mit Punkt darunter wird es ড় (r).', en: 'With a dot below it becomes ড় (r).' }),
  consonant('ddha', 'ঢ', 'dh', 'ঢাকা', 'Dhaka'),
  consonant('nna', 'ণ', 'n', 'নারায়ণগঞ্জ', 'Narayanganj', [], SAME_SOUND('ন', 'n')),
  consonant('ta', 'ত', 't', 'সাতক্ষীরা', 'Satkhira'),
  consonant('tha', 'থ', 'th', 'থানা', 'thana'),
  consonant('da', 'দ', 'd', 'দিনাজপুর', 'Dinajpur'),
  consonant('dha', 'ধ', 'dh', 'গাইবান্ধা', 'Gaibandha'),
  consonant('na', 'ন', 'n', 'নাটোর', 'Natore'),
  consonant('pa', 'প', 'p', 'পাবনা', 'Pabna'),
  consonant('pha', 'ফ', 'ph', 'ফেনী', 'Feni', ['f']),
  consonant('ba', 'ব', 'b', 'বরিশাল', 'Barishal', [], { de: 'ব = b, র = r: Der Punkt unten macht den Unterschied.', en: 'ব = b, র = r: the dot below makes the difference.' }),
  consonant('bha', 'ভ', 'bh', 'ভোলা', 'Bhola', ['v']),
  consonant('ma', 'ম', 'm', 'মাগুরা', 'Magura'),
  consonant('ya', 'য', 'j', 'যশোর', 'Jashore', ['y', 'z'], { de: 'Klingt wie জ (j). Mit Punkt darunter wird es য় (y).', en: 'Sounds like জ (j). With a dot below it becomes য় (y).' }),
  consonant('ra', 'র', 'r', 'রংপুর', 'Rangpur', [], { de: 'র hat einen Punkt unten, ব nicht.', en: 'র has a dot below, ব does not.' }),
  consonant('la', 'ল', 'l', 'লালমনিরহাট', 'Lalmonirhat'),
  consonant('sha', 'শ', 'sh', 'শেরপুর', 'Sherpur', ['s']),
  consonant('ssa', 'ষ', 'sh', 'কুষ্টিয়া', 'Kushtia', ['s'], SAME_SOUND('শ', 'sh')),
  consonant('sa', 'স', 's', 'সিলেট', 'Sylhet', ['sh']),
  consonant('ha', 'হ', 'h', 'হবিগঞ্জ', 'Habiganj'),
  consonant('rra', 'ড়', 'r', 'বগুড়া', 'Bogura', ['rr'], { de: 'ড mit Punkt: ein r-Laut.', en: 'ড with a dot: an r sound.' }),
  consonant('rha', 'ঢ়', 'rh', 'আষাঢ়', 'asharh', ['r'], { de: 'ঢ mit Punkt; selten.', en: 'ঢ with a dot; rare.' }),
  consonant('yya', 'য়', 'y', 'ময়মনসিংহ', 'Mymensingh', [], { de: 'য mit Punkt: y, oft zwischen Vokalen.', en: 'য with a dot: y, often between vowels.' }),
  {
    id: unitId('khanda-ta'),
    kind: 'letter',
    upper: 'ৎ',
    lower: 'ৎ',
    reading: 't',
    accepted: ['t'],
    mnemonic: { de: 'Khanda ta: ein t ohne Vokal, nur am Silbenende.', en: 'Khanda ta: a t without a vowel, only at the end of a syllable.' },
  },
];

const vowel = (slug: string, glyph: string, reading: string, accepted: string[], de: string, en: string): LetterItem => ({
  id: unitId(slug),
  kind: 'letter',
  upper: glyph,
  lower: glyph,
  reading,
  accepted: [reading, ...accepted],
  mnemonic: { de, en },
});

/** Independent vowels: only at the start of a word or after another vowel. */
export const INDEPENDENT: LetterItem[] = [
  vowel('v-o', 'অ', 'o', ['a'], 'Der inhärente Vokal als eigener Buchstabe, am Wortanfang: অনেক = onek.', 'The inherent vowel as a letter of its own, at the start of a word: অনেক = onek.'),
  vowel('v-aa', 'আ', 'a', ['aa'], 'Am Wortanfang: আম = am (Mango).', 'At the start of a word: আম = am (mango).'),
  vowel('v-i', 'ই', 'i', [], 'Am Wortanfang: ইট = it.', 'At the start of a word: ইট = it.'),
  vowel('v-ii', 'ঈ', 'i', ['ee', 'ii'], 'Langes i, klingt heute wie ই: ঈদ = Id (Eid).', 'Long i, sounds like ই today: ঈদ = Id (Eid).'),
  vowel('v-u', 'উ', 'u', [], 'Am Wortanfang: উপজেলা = upazila.', 'At the start of a word: উপজেলা = upazila.'),
  vowel('v-uu', 'ঊ', 'u', ['oo', 'uu'], 'Langes u, klingt heute wie উ.', 'Long u, sounds like উ today.'),
  vowel('v-ri', 'ঋ', 'ri', [], 'Silbischer r-Laut: ri.', 'Syllabic r: ri.'),
  vowel('v-e', 'এ', 'e', [], 'Am Wortanfang: এক = ek.', 'At the start of a word: এক = ek.'),
  vowel('v-oi', 'ঐ', 'oi', ['ai'], 'Diphthong oi.', 'Diphthong oi.'),
  vowel('v-oo', 'ও', 'o', [], 'Am Wortanfang: ও = o. Auch in নওগাঁ = Naogaon.', 'At the start of a word: ও = o. Also in নওগাঁ = Naogaon.'),
  vowel('v-ou', 'ঔ', 'ou', ['au'], 'Diphthong ou: ঔষধ = oushodh.', 'Diphthong ou: ঔষধ = oushodh.'),
];

/** Vowel signs (kar), shown with ◌ as the consonant’s place. */
export const SIGNS: LetterItem[] = [
  vowel('k-aa', '◌া', 'a', ['aa'], 'Rechts vom Konsonanten: ঢাকা = Dhaka.', 'Right of the consonant: ঢাকা = Dhaka.'),
  vowel('k-i', '◌ি', 'i', [], 'Steht LINKS vom Konsonanten, wird aber danach gelesen: সিলেট = Sylhet.', 'Written LEFT of the consonant but read after it: সিলেট = Sylhet.'),
  vowel('k-ii', '◌ী', 'i', ['ee', 'ii'], 'Rechts, mit Haken nach oben: রাজশাহী = Rajshahi.', 'On the right, with a hook up: রাজশাহী = Rajshahi.'),
  vowel('k-u', '◌ু', 'u', [], 'Unter dem Konsonanten: খুলনা = Khulna.', 'Below the consonant: খুলনা = Khulna.'),
  vowel('k-uu', '◌ূ', 'u', ['oo', 'uu'], 'Unter dem Konsonanten, langes u: পূর্ব = purbo.', 'Below the consonant, long u: পূর্ব = purbo.'),
  vowel('k-ri', '◌ৃ', 'ri', [], 'Unter dem Konsonanten: কৃষি = krishi.', 'Below the consonant: কৃষি = krishi.'),
  vowel('k-e', '◌ে', 'e', [], 'Steht LINKS vom Konsonanten: ফেনী = Feni.', 'Written LEFT of the consonant: ফেনী = Feni.'),
  vowel('k-oi', '◌ৈ', 'oi', ['ai'], 'Links, mit Schleife: সৈয়দপুর = Saidpur.', 'On the left, with a loop: সৈয়দপুর = Saidpur.'),
  vowel('k-o', '◌ো', 'o', [], 'Umklammert den Konsonanten (ে + া): ভোলা = Bhola.', 'Wraps around the consonant (ে + া): ভোলা = Bhola.'),
  vowel('k-ou', '◌ৌ', 'ou', ['au'], 'Umklammert den Konsonanten: মৌলভীবাজার = Moulvibazar.', 'Wraps around the consonant: মৌলভীবাজার = Moulvibazar.'),
];

const NASAL: L10n = { de: 'Macht den Vokal nasal – in der Umschrift meist weggelassen', en: 'Nasalises the vowel – usually left out in romanisation' };
const NO_VOWEL: L10n = { de: 'Nimmt dem Konsonanten den Vokal, verbindet Konsonanten', en: 'Removes the consonant’s vowel, joins consonants' };
const LONG: L10n = { de: 'Verlängert den Vokal', en: 'Lengthens the vowel' };

export const MARKS: LetterItem[] = [
  { id: unitId('anusvar'), kind: 'letter', upper: '◌ং', lower: '◌ং', reading: 'ng', accepted: ['ng'],
    mnemonic: { de: 'Anusvar: ng am Silbenende. রংপুর = Rangpur, বাংলা = Bangla.', en: 'Anusvar: ng at the end of a syllable. রংপুর = Rangpur, বাংলা = Bangla.' } },
  { id: unitId('bisarga'), kind: 'letter', upper: '◌ঃ', lower: '◌ঃ', reading: 'h', accepted: ['h'],
    mnemonic: { de: 'Bisarga: ein kurzer Hauchlaut; selten.', en: 'Bisarga: a short breath; rare.' } },
  { id: unitId('chandrabindu'), kind: 'letter', upper: '◌ঁ', lower: '◌ঁ', reading: '', accepted: [''],
    mnemonic: { de: 'Chandrabindu (Mondpunkt): nasaler Vokal. চাঁদপুর = Chandpur.', en: 'Chandrabindu (moon dot): nasal vowel. চাঁদপুর = Chandpur.' },
    functionChoice: { correct: NASAL, wrong: [NO_VOWEL, LONG] } },
  { id: unitId('hasanta'), kind: 'letter', upper: '◌্', lower: '◌্', reading: '', accepted: [''],
    mnemonic: { de: 'Hasanta: kein Vokal nach dem Konsonanten. Meist unsichtbar in Konjunkten verbaut.', en: 'Hasanta: no vowel after the consonant. Usually hidden inside conjuncts.' },
    functionChoice: { correct: NO_VOWEL, wrong: [NASAL, LONG] } },
];

export const UNITS: LetterItem[] = [...INDEPENDENT, ...CONSONANTS, ...SIGNS, ...MARKS];

/* ---------- Combos: phala/reph, conjuncts (units), syllables, endings ---------- */

const unitCombo = (slug: string, native: string, reading: string, accepted: string[], de: string, en: string): ComboItem => ({
  id: `bn:combo:${slug}`,
  kind: 'combo',
  native,
  reading,
  accepted,
  note: { de, en },
  unit: true,
});

export const PHALAS: ComboItem[] = [
  unitCombo('raphala', '◌্র', 'r', ['ro'], 'Ra-phala: ein r hängt unten am Konsonanten. গ্রাম = gram.', 'Ra-phala: an r hangs below the consonant. গ্রাম = gram.'),
  unitCombo('yaphala', '◌্য', 'y', ['ya'], 'Ya-phala: Haken rechts; färbt den Vokal oder verdoppelt. ব্যাংক = bank.', 'Ya-phala: a hook on the right; changes the vowel or doubles. ব্যাংক = bank.'),
  unitCombo('baphala', '◌্ব', 'b', ['bo'], 'Ba-phala: verdoppelt meist nur den Konsonanten davor.', 'Ba-phala: usually just doubles the consonant before it.'),
  unitCombo('reph', 'র্◌', 'r', [], 'Reph: ein r als Strich über dem nächsten Konsonanten. পূর্ব = purbo.', 'Reph: an r as a stroke above the next consonant. পূর্ব = purbo.'),
];

export const CONJUNCTS: ComboItem[] = [
  unitCombo('tt', 'ট্ট', 'tt', ['t'], 'ট + ট: চট্টগ্রাম = Chattogram.', 'ট + ট: চট্টগ্রাম = Chattogram.'),
  unitCombo('ll', 'ল্ল', 'll', ['l'], 'ল + ল: কুমিল্লা = Cumilla.', 'ল + ল: কুমিল্লা = Cumilla.'),
  unitCombo('ks', 'ক্স', 'ks', ['x'], 'ক + স: কক্সবাজার = Cox’s Bazar.', 'ক + স: কক্সবাজার = Cox’s Bazar.'),
  unitCombo('nj', 'ঞ্জ', 'nj', ['nz'], 'ঞ + জ: Endung -গঞ্জ = -ganj.', 'ঞ + জ: the ending -গঞ্জ = -ganj.'),
  unitCombo('ngg', 'ঙ্গ', 'ng', ['ngg'], 'ঙ + গ: টাঙ্গাইল = Tangail.', 'ঙ + গ: টাঙ্গাইল = Tangail.'),
  unitCombo('kkh', 'ক্ষ', 'kkh', ['kh', 'ksh'], 'ক + ষ, gesprochen kh: সাতক্ষীরা = Satkhira.', 'ক + ষ, spoken kh: সাতক্ষীরা = Satkhira.'),
  unitCombo('sht', 'ষ্ট', 'sht', ['st'], 'ষ + ট: কুষ্টিয়া = Kushtia.', 'ষ + ট: কুষ্টিয়া = Kushtia.'),
  unitCombo('hm', 'হ্ম', 'hm', ['mh'], 'হ + ম, gesprochen mh: ব্রাহ্মণবাড়িয়া = Brahmanbaria.', 'হ + ম, spoken mh: ব্রাহ্মণবাড়িয়া = Brahmanbaria.'),
  unitCombo('ndh', 'ন্ধ', 'ndh', [], 'ন + ধ: গাইবান্ধা = Gaibandha.', 'ন + ধ: গাইবান্ধা = Gaibandha.'),
  unitCombo('nch', 'ঞ্চ', 'nch', [], 'ঞ + চ: পঞ্চগড় = Panchagarh.', 'ঞ + চ: পঞ্চগড় = Panchagarh.'),
  unitCombo('st', 'স্ট', 'st', [], 'স + ট, in Lehnwörtern: স্টেশন = station.', 'স + ট, in loanwords: স্টেশন = station.'),
  unitCombo('sk', 'স্ক', 'sk', [], 'স + ক: স্কুল = school.', 'স + ক: স্কুল = school.'),
];

const sy = (slug: string, native: string, reading: string, accepted: string[] = []): ComboItem => ({
  id: `bn:combo:s-${slug}`,
  kind: 'combo',
  native,
  reading,
  accepted,
});

/** Consonant + vowel sign: the basic reading unit (akshara). */
export const SYLLABLES: ComboItem[] = [
  sy('ka', 'কা', 'ka'), sy('na', 'না', 'na'), sy('ma', 'মা', 'ma'), sy('ra', 'রা', 'ra'), sy('la', 'লা', 'la'),
  sy('bi', 'বি', 'bi'), sy('pi', 'পি', 'pi'), sy('gi', 'গি', 'gi'), sy('ti', 'তি', 'ti'),
  sy('di', 'দী', 'di', ['dee']), sy('si', 'সী', 'si', ['shi']), sy('ji', 'জী', 'ji', ['zi']), sy('cha', 'চা', 'cha'),
  sy('tu', 'টু', 'tu'), sy('hu', 'হু', 'hu'), sy('du', 'ডু', 'du'),
  sy('ke', 'কে', 'ke'), sy('lo', 'লো', 'lo'), sy('noi', 'নৈ', 'noi'), sy('mou', 'মৌ', 'mou', ['mau']),
  sy('kha', 'খা', 'kha'), sy('gha', 'ঘা', 'gha'), sy('dha', 'ঢা', 'dha'),
  sy('tha', 'থা', 'tha'), sy('bha', 'ভা', 'bha', ['va']), sy('pha', 'ফা', 'pha', ['fa']),
];

const ending = (slug: string, native: string, reading: string, accepted: string[], de: string, en: string): ComboItem => ({
  id: `bn:combo:${slug}`,
  kind: 'combo',
  native,
  reading,
  accepted,
  note: { de, en },
});

/** Place-name endings: recognising them makes long names readable at a glance. */
export const ENDINGS: ComboItem[] = [
  ending('suf-pur', '-পুর', 'pur', [], '„Stadt“: দিনাজপুর, রংপুর, ফরিদপুর.', '“Town”: দিনাজপুর, রংপুর, ফরিদপুর.'),
  ending('suf-ganj', '-গঞ্জ', 'ganj', ['gonj', 'gang'], '„Marktort“: নারায়ণগঞ্জ, হবিগঞ্জ.', '“Market town”: নারায়ণগঞ্জ, হবিগঞ্জ.'),
  ending('suf-bazar', '-বাজার', 'bazar', ['bajar'], '„Markt“: কক্সবাজার, মৌলভীবাজার.', '“Market”: কক্সবাজার, মৌলভীবাজার.'),
  ending('suf-hat', '-হাট', 'hat', [], '„Wochenmarkt“: বাগেরহাট, লালমনিরহাট.', '“Weekly market”: বাগেরহাট, লালমনিরহাট.'),
  ending('suf-gram', '-গ্রাম', 'gram', [], '„Dorf“: চট্টগ্রাম, কুড়িগ্রাম.', '“Village”: চট্টগ্রাম, কুড়িগ্রাম.'),
  ending('suf-khali', '-খালী', 'khali', [], '„Kanal“: নোয়াখালী, পটুয়াখালী.', '“Canal”: নোয়াখালী, পটুয়াখালী.'),
];

/* ---------- Decodability ---------- */

const CONSONANT_SET = new Set(CONSONANTS.map((c) => c.upper.normalize('NFC')));
const CHAR_UNIT = new Map<string, string>();
for (const u of UNITS) CHAR_UNIT.set(u.upper.replace('◌', '').normalize('NFC'), u.id);
const CONJ = new Map(CONJUNCTS.map((c) => [c.native.normalize('NFC'), c.id] as const));
const HASANTA = '্';
const NUKTA = '়';
const RA = 'র';

/** Splits text into consonant clusters with nukta forms joined (ড + ় = ড়). */
function tokens(native: string): string[] {
  const out: string[] = [];
  for (const ch of Array.from(native.normalize('NFC'))) {
    if (ch === NUKTA && out.length) out[out.length - 1] += ch;
    else out.push(ch);
  }
  return out.map((t) => t.normalize('NFC'));
}

export function requiredUnitsBn(native: string): string[] {
  const t = tokens(native);
  const out = new Set<string>();
  const add = (s: string) => {
    const id = CHAR_UNIT.get(s);
    if (id) out.add(id);
  };
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (c === HASANTA) {
      const prev = t[i - 1];
      const next = t[i + 1];
      if (prev && next && CONSONANT_SET.has(prev) && CONSONANT_SET.has(next)) {
        const pair = `${prev}${HASANTA}${next}`.normalize('NFC');
        if (prev === RA) out.add('bn:combo:reph');
        else if (CONJ.has(pair)) out.add(CONJ.get(pair)!);
        else if (next === RA) out.add('bn:combo:raphala');
        else if (next === 'য') out.add('bn:combo:yaphala');
        else if (next === 'ব') out.add('bn:combo:baphala');
        else out.add(unitId('hasanta'));
      } else {
        out.add(unitId('hasanta'));
      }
      continue;
    }
    add(c);
  }
  // A reph replaces the written ra; a phala replaces the full letter form.
  return [...out];
}

const ids = (...s: string[]) => s.map(unitId);

export const CONTRAST_SETS: ContrastSet[] = [
  { id: 'bn:cs:ba-ra', itemIds: ids('ba', 'ra'), note: { de: 'ব = b, র = r (Punkt unten).', en: 'ব = b, র = r (dot below).' } },
  { id: 'bn:cs:da-rra', itemIds: ids('dda', 'rra'), note: { de: 'ড = d, ড় = r (Punkt unten).', en: 'ড = d, ড় = r (dot below).' } },
  { id: 'bn:cs:ya-yya', itemIds: ids('ya', 'yya'), note: { de: 'য = j, য় = y (Punkt unten).', en: 'য = j, য় = y (dot below).' } },
  { id: 'bn:cs:dha-rha', itemIds: ids('ddha', 'rha'), note: { de: 'ঢ = dh, ঢ় = rh (Punkt unten).', en: 'ঢ = dh, ঢ় = rh (dot below).' } },
  { id: 'bn:cs:tta-ttha', itemIds: ids('tta', 'ttha'), note: { de: 'ট = t, ঠ = th.', en: 'ট = t, ঠ = th.' } },
  { id: 'bn:cs:ma-sa', itemIds: ids('ma', 'sa'), note: { de: 'ম = m, স = s.', en: 'ম = m, স = s.' } },
  { id: 'bn:cs:la-na', itemIds: ids('la', 'na'), note: { de: 'ল = l, ন = n.', en: 'ল = l, ন = n.' } },
  { id: 'bn:cs:kha-tha', itemIds: ids('kha', 'tha'), note: { de: 'খ = kh, থ = th.', en: 'খ = kh, থ = th.' } },
  { id: 'bn:cs:sibilants', itemIds: ids('sha', 'ssa', 'sa'), note: { de: 'শ und ষ = sh, স = s (oft auch sh).', en: 'শ and ষ = sh, স = s (often sh too).' } },
];
