import type { ComboItem, ContrastSet, L10n, LetterItem } from '../../domain/types';

/**
 * Thai reading units: 42 consonants, 15 vowel signs and 5 marks.
 *
 * Readings follow RTGS, the official romanisation used on Thai road signs.
 * RTGS marks neither tone nor vowel length, so tone marks and consonant
 * classes are not needed for reading place names (spec section 5). Readings
 * are listed explicitly: Thai cannot be romanised character by character
 * (pre-posed vowels, unwritten vowels, different values at the syllable end).
 */

export const unitId = (slug: string) => `th:letter:${slug}`;

interface C {
  slug: string;
  ch: string;
  reading: string;
  accepted?: string[];
  word: string; // traditional name word
  roman: string;
  de: string;
  en: string;
  final?: string; // value at the end of a syllable when different
  confuse?: L10n;
}

const consonant = ({ slug, ch, reading, accepted, word, roman, de, en, final, confuse }: C): LetterItem => {
  const finalNote: L10n | undefined = final
    ? { de: `Am Silbenende liest sich ${ch} als ${final}.`, en: `At the end of a syllable ${ch} reads ${final}.` }
    : undefined;
  return {
    id: unitId(slug),
    kind: 'letter',
    upper: ch,
    lower: ch,
    reading,
    accepted: accepted ?? [reading],
    mnemonic: {
      de: `Merkwort ${word} (${roman}, ${de}): ${ch} = ${reading}.${confuse ? ` ${confuse.de}` : ''}`,
      en: `Name word ${word} (${roman}, ${en}): ${ch} = ${reading}.${confuse ? ` ${confuse.en}` : ''}`,
    },
    note: finalNote,
  };
};

export const CONSONANTS: LetterItem[] = [
  consonant({ slug: 'ko', ch: 'ก', reading: 'k', accepted: ['k', 'g'], word: 'ไก่', roman: 'kai', de: 'Huhn', en: 'chicken' }),
  consonant({ slug: 'kho-khai', ch: 'ข', reading: 'kh', word: 'ไข่', roman: 'khai', de: 'Ei', en: 'egg', final: 'k' }),
  consonant({ slug: 'kho-khwai', ch: 'ค', reading: 'kh', word: 'ควาย', roman: 'khwai', de: 'Wasserbüffel', en: 'water buffalo', final: 'k' }),
  consonant({ slug: 'kho-rakhang', ch: 'ฆ', reading: 'kh', word: 'ระฆัง', roman: 'rakhang', de: 'Glocke', en: 'bell', final: 'k' }),
  consonant({ slug: 'ngo', ch: 'ง', reading: 'ng', word: 'งู', roman: 'ngu', de: 'Schlange', en: 'snake' }),
  consonant({ slug: 'cho-chan', ch: 'จ', reading: 'ch', accepted: ['ch', 'j'], word: 'จาน', roman: 'chan', de: 'Teller', en: 'plate', final: 't' }),
  consonant({ slug: 'cho-ching', ch: 'ฉ', reading: 'ch', word: 'ฉิ่ง', roman: 'ching', de: 'Zimbel', en: 'cymbal' }),
  consonant({ slug: 'cho-chang', ch: 'ช', reading: 'ch', word: 'ช้าง', roman: 'chang', de: 'Elefant', en: 'elephant', final: 't',
    confuse: { de: 'Nicht mit ซ (s) verwechseln – ซ hat oben eine Kerbe.', en: 'Don’t confuse with ซ (s) – ซ has a notch at the top.' } }),
  consonant({ slug: 'so-so', ch: 'ซ', reading: 's', word: 'โซ่', roman: 'so', de: 'Kette', en: 'chain', final: 't' }),
  consonant({ slug: 'cho-choe', ch: 'ฌ', reading: 'ch', word: 'เฌอ', roman: 'choe', de: 'Baum', en: 'tree' }),
  consonant({ slug: 'yo-ying', ch: 'ญ', reading: 'y', word: 'หญิง', roman: 'ying', de: 'Frau', en: 'woman', final: 'n' }),
  consonant({ slug: 'do-chada', ch: 'ฎ', reading: 'd', word: 'ชฎา', roman: 'chada', de: 'Krone', en: 'headdress', final: 't' }),
  consonant({ slug: 'to-patak', ch: 'ฏ', reading: 't', word: 'ปฏัก', roman: 'patak', de: 'Treibstock', en: 'goad', final: 't' }),
  consonant({ slug: 'tho-than', ch: 'ฐ', reading: 'th', word: 'ฐาน', roman: 'than', de: 'Sockel', en: 'pedestal', final: 't' }),
  consonant({ slug: 'tho-montho', ch: 'ฑ', reading: 'th', word: 'มณโฑ', roman: 'montho', de: 'Montho (Sagengestalt)', en: 'Montho (a character from the Ramakien)', final: 't' }),
  consonant({ slug: 'tho-phuthao', ch: 'ฒ', reading: 'th', word: 'ผู้เฒ่า', roman: 'phu thao', de: 'alter Mann', en: 'old man', final: 't' }),
  consonant({ slug: 'no-nen', ch: 'ณ', reading: 'n', word: 'เณร', roman: 'nen', de: 'Novize', en: 'novice monk' }),
  consonant({ slug: 'do-dek', ch: 'ด', reading: 'd', word: 'เด็ก', roman: 'dek', de: 'Kind', en: 'child', final: 't',
    confuse: { de: 'ต (t) hat oben eine Zacke, ด nicht.', en: 'ต (t) has a notch at the top, ด does not.' } }),
  consonant({ slug: 'to-tao', ch: 'ต', reading: 't', word: 'เต่า', roman: 'tao', de: 'Schildkröte', en: 'turtle', final: 't' }),
  consonant({ slug: 'tho-thung', ch: 'ถ', reading: 'th', word: 'ถุง', roman: 'thung', de: 'Sack', en: 'sack', final: 't' }),
  consonant({ slug: 'tho-thahan', ch: 'ท', reading: 'th', word: 'ทหาร', roman: 'thahan', de: 'Soldat', en: 'soldier', final: 't' }),
  consonant({ slug: 'tho-thong', ch: 'ธ', reading: 'th', word: 'ธง', roman: 'thong', de: 'Flagge', en: 'flag', final: 't' }),
  consonant({ slug: 'no-nu', ch: 'น', reading: 'n', word: 'หนู', roman: 'nu', de: 'Maus', en: 'mouse' }),
  consonant({ slug: 'bo', ch: 'บ', reading: 'b', word: 'ใบไม้', roman: 'bai mai', de: 'Blatt', en: 'leaf', final: 'p',
    confuse: { de: 'ป (p) hat einen langen Strich nach oben, บ nicht.', en: 'ป (p) has a long stroke going up, บ does not.' } }),
  consonant({ slug: 'po', ch: 'ป', reading: 'p', word: 'ปลา', roman: 'pla', de: 'Fisch', en: 'fish', final: 'p' }),
  consonant({ slug: 'pho-phueng', ch: 'ผ', reading: 'ph', word: 'ผึ้ง', roman: 'phueng', de: 'Biene', en: 'bee',
    confuse: { de: 'ฝ (f) ist ผ mit langem Strich nach oben.', en: 'ฝ (f) is ผ with a long stroke going up.' } }),
  consonant({ slug: 'fo-fa', ch: 'ฝ', reading: 'f', word: 'ฝา', roman: 'fa', de: 'Deckel', en: 'lid' }),
  consonant({ slug: 'pho-phan', ch: 'พ', reading: 'ph', word: 'พาน', roman: 'phan', de: 'Schale', en: 'offering tray', final: 'p',
    confuse: { de: 'ฟ (f) ist พ mit langem Strich nach oben.', en: 'ฟ (f) is พ with a long stroke going up.' } }),
  consonant({ slug: 'fo-fan', ch: 'ฟ', reading: 'f', word: 'ฟัน', roman: 'fan', de: 'Zahn', en: 'tooth', final: 'p' }),
  consonant({ slug: 'pho-samphao', ch: 'ภ', reading: 'ph', word: 'สำเภา', roman: 'samphao', de: 'Dschunke', en: 'junk (ship)', final: 'p' }),
  consonant({ slug: 'mo', ch: 'ม', reading: 'm', word: 'ม้า', roman: 'ma', de: 'Pferd', en: 'horse' }),
  consonant({ slug: 'yo-yak', ch: 'ย', reading: 'y', word: 'ยักษ์', roman: 'yak', de: 'Riese', en: 'giant',
    confuse: { de: 'Am Silbenende bildet ย mit dem Vokal ein i (ไทย = Thai).', en: 'At the end of a syllable ย forms an i with the vowel (ไทย = Thai).' } }),
  consonant({ slug: 'ro', ch: 'ร', reading: 'r', word: 'เรือ', roman: 'ruea', de: 'Boot', en: 'boat', final: 'n' }),
  consonant({ slug: 'lo-ling', ch: 'ล', reading: 'l', word: 'ลิง', roman: 'ling', de: 'Affe', en: 'monkey', final: 'n' }),
  consonant({ slug: 'wo', ch: 'ว', reading: 'w', word: 'แหวน', roman: 'waen', de: 'Ring', en: 'ring', final: 'o' }),
  consonant({ slug: 'so-sala', ch: 'ศ', reading: 's', word: 'ศาลา', roman: 'sala', de: 'Pavillon', en: 'pavilion', final: 't' }),
  consonant({ slug: 'so-ruesi', ch: 'ษ', reading: 's', word: 'ฤๅษี', roman: 'ruesi', de: 'Einsiedler', en: 'hermit', final: 't' }),
  consonant({ slug: 'so-suea', ch: 'ส', reading: 's', word: 'เสือ', roman: 'suea', de: 'Tiger', en: 'tiger', final: 't' }),
  consonant({ slug: 'ho-hip', ch: 'ห', reading: 'h', word: 'หีบ', roman: 'hip', de: 'Truhe', en: 'chest',
    confuse: { de: 'Vor น ม ย ร ล ว ง ist ห stumm (หนอง = nong).', en: 'Before น ม ย ร ล ว ง the ห is silent (หนอง = nong).' } }),
  consonant({ slug: 'lo-chula', ch: 'ฬ', reading: 'l', word: 'จุฬา', roman: 'chula', de: 'Drachen', en: 'kite', final: 'n' }),
  consonant({ slug: 'o-ang', ch: 'อ', reading: 'o', word: 'อ่าง', roman: 'ang', de: 'Schüssel', en: 'basin',
    confuse: { de: 'Am Silbenanfang stumm (Träger für Vokale: อุดร = Udon), sonst o.', en: 'Silent at the start of a syllable (vowel carrier: อุดร = Udon), otherwise o.' } }),
  consonant({ slug: 'ho-nokhuk', ch: 'ฮ', reading: 'h', word: 'นกฮูก', roman: 'nok huk', de: 'Eule', en: 'owl' }),
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

/** Vowel signs, shown with ◌ as the consonant's place. */
export const VOWELS: LetterItem[] = [
  vowel('v-aa', '◌า', 'a', ['aa'], 'Steht rechts vom Konsonanten: นา = na.', 'Sits right of the consonant: นา = na.'),
  vowel('v-a', '◌ะ', 'a', [], 'Kurzes a, steht rechts: ระยอง = Rayong.', 'Short a, sits on the right: ระยอง = Rayong.'),
  vowel('v-mai-han', '◌ั', 'a', [], 'Kurzes a über dem Konsonanten, danach folgt ein Endlaut: วัด = wat.', 'Short a above the consonant, followed by a final: วัด = wat.'),
  vowel('v-i', '◌ิ', 'i', [], 'Kurzes i über dem Konsonanten: บิน = bin.', 'Short i above the consonant: บิน = bin.'),
  vowel('v-ii', '◌ี', 'i', ['ii', 'ee'], 'Langes i über dem Konsonanten: ดี = di.', 'Long i above the consonant: ดี = di.'),
  vowel('v-ue', '◌ึ', 'ue', ['u'], 'Kurzes ue (ein ungerundetes u): ลึก = luek.', 'Short ue (an unrounded u): ลึก = luek.'),
  vowel('v-uue', '◌ื', 'ue', ['uee'], 'Langes ue: มือ = mue.', 'Long ue: มือ = mue.'),
  vowel('v-u', '◌ุ', 'u', [], 'Kurzes u unter dem Konsonanten: ลุง = lung.', 'Short u below the consonant: ลุง = lung.'),
  vowel('v-uu', '◌ู', 'u', ['uu', 'oo'], 'Langes u unter dem Konsonanten: งู = ngu.', 'Long u below the consonant: งู = ngu.'),
  vowel('v-e', 'เ◌', 'e', ['ee'], 'Steht VOR dem Konsonanten, wird danach gelesen: เด็ก = dek.', 'Written BEFORE the consonant, read after it: เด็ก = dek.'),
  vowel('v-ae', 'แ◌', 'ae', [], 'Doppeltes เ, steht vor dem Konsonanten: แดง = daeng.', 'A double เ, written before the consonant: แดง = daeng.'),
  vowel('v-o', 'โ◌', 'o', ['oh'], 'Steht vor dem Konsonanten: โรง = rong.', 'Written before the consonant: โรง = rong.'),
  vowel('v-ai-malai', 'ไ◌', 'ai', ['ay'], 'Steht vor dem Konsonanten: ไป = pai. Die häufigere der beiden ai-Formen.', 'Written before the consonant: ไป = pai. The more common of the two ai forms.'),
  vowel('v-ai-muan', 'ใ◌', 'ai', ['ay'], 'Steht vor dem Konsonanten: ใบ = bai, ใหญ่ = yai.', 'Written before the consonant: ใบ = bai, ใหญ่ = yai.'),
  vowel('v-am', '◌ำ', 'am', [], 'am rechts vom Konsonanten: ลำปาง = Lampang.', 'am right of the consonant: ลำปาง = Lampang.'),
];

const mark = (slug: string, glyph: string, de: string, en: string, correct: L10n, wrong: L10n[]): LetterItem => ({
  id: unitId(slug),
  kind: 'letter',
  upper: glyph,
  lower: glyph,
  reading: '',
  accepted: [''],
  mnemonic: { de, en },
  functionChoice: { correct, wrong },
});

const IGNORE_TONE: L10n = { de: 'Tonzeichen – für die Umschrift ignorieren', en: 'Tone mark – ignore it when romanising' };
const SILENT: L10n = { de: 'Macht den Buchstaben darunter stumm', en: 'Silences the letter below it' };
const REPEAT: L10n = { de: 'Wiederholt das vorige Wort', en: 'Repeats the previous word' };
const ABBR: L10n = { de: 'Kürzt ein langes Wort ab', en: 'Abbreviates a long word' };
const SHORT: L10n = { de: 'Kürzt den Vokal – ändert die Umschrift nicht', en: 'Shortens the vowel – no change in romanisation' };

export const MARKS: LetterItem[] = [
  mark('m-tone', '◌่◌้◌๊◌๋', 'Die vier Tonzeichen. RTGS schreibt keine Töne: einfach überlesen. น้ำ = nam.', 'The four tone marks. RTGS writes no tones: just read past them. น้ำ = nam.', IGNORE_TONE, [SILENT, REPEAT]),
  mark('m-karan', '◌์', 'Karan: der Buchstabe darunter wird nicht gelesen. สุรินทร์ = Surin.', 'Karan: the letter below is not read. สุรินทร์ = Surin.', SILENT, [IGNORE_TONE, ABBR]),
  mark('m-taikhu', '◌็', 'Mai taikhu: kürzt den Vokal. เป็ด = pet.', 'Mai taikhu: shortens the vowel. เป็ด = pet.', SHORT, [SILENT, REPEAT]),
  mark('m-yamok', 'ๆ', 'Mai yamok: das Wort davor wird wiederholt. เด็กๆ = dek dek.', 'Mai yamok: the word before is repeated. เด็กๆ = dek dek.', REPEAT, [ABBR, SILENT]),
  mark('m-paiyannoi', 'ฯ', 'Paiyannoi: Abkürzung. กรุงเทพฯ = Krung Thep (Bangkok).', 'Paiyannoi: abbreviation. กรุงเทพฯ = Krung Thep (Bangkok).', ABBR, [REPEAT, IGNORE_TONE]),
];

export const UNITS: LetterItem[] = [...CONSONANTS, ...VOWELS, ...MARKS];

/** Code point → unit id (decodability). Tone marks share one unit. */
const CHAR_UNIT = new Map<string, string>();
for (const c of CONSONANTS) CHAR_UNIT.set(c.upper, c.id);
for (const v of VOWELS) CHAR_UNIT.set(v.upper.replace('◌', ''), v.id);
for (const t of ['่', '้', '๊', '๋']) CHAR_UNIT.set(t, unitId('m-tone'));
CHAR_UNIT.set('์', unitId('m-karan'));
CHAR_UNIT.set('็', unitId('m-taikhu'));
CHAR_UNIT.set('ๆ', unitId('m-yamok'));
CHAR_UNIT.set('ฯ', unitId('m-paiyannoi'));

export function requiredUnitsTh(native: string): string[] {
  const out = new Set<string>();
  for (const ch of Array.from(native.normalize('NFC'))) {
    const id = CHAR_UNIT.get(ch);
    if (id) out.add(id);
  }
  return [...out];
}

const combo = (slug: string, native: string, reading: string, accepted: string[], de: string, en: string): ComboItem => ({
  id: `th:combo:${slug}`,
  kind: 'combo',
  native,
  reading,
  accepted,
  note: { de, en },
});

const sy = (slug: string, native: string, reading: string, accepted: string[] = []): ComboItem => ({
  id: `th:combo:s-${slug}`,
  kind: 'combo',
  native,
  reading,
  accepted,
});

/** Open syllables for the letter lessons: consonant + vowel, read exactly as written. */
export const SYLLABLES: ComboItem[] = [
  sy('ka', 'กา', 'ka'), sy('ni', 'นิ', 'ni'), sy('mi', 'มี', 'mi', ['mee']), sy('ra', 'รา', 'ra'),
  sy('bi', 'บิ', 'bi'), sy('pa', 'ปา', 'pa'), sy('do', 'ดุ', 'du'), sy('ti', 'ตี', 'ti', ['tee']),
  sy('yu', 'ยู', 'yu'), sy('wa', 'วา', 'wa'), sy('ngi', 'งิ', 'ngi'), sy('o', 'อา', 'a'),
  sy('le', 'เล', 'le'), sy('kae', 'แก', 'kae'), sy('mo', 'โม', 'mo'), sy('nai', 'ไน', 'nai'),
  sy('khi', 'ขี', 'khi'), sy('chu', 'ชู', 'chu'), sy('tho', 'โท', 'tho'), sy('pho', 'พู', 'phu'),
  sy('su', 'สุ', 'su'), sy('ja', 'จา', 'cha', ['ja']), sy('fa', 'ฟา', 'fa'), sy('thue', 'ถู', 'thu'),
];

/** Syllables that teach the three things character-by-character reading gets wrong. */
export const COMBOS: ComboItem[] = [
  // Final consonants
  combo('baht', 'บาท', 'bat', ['baht'], 'ท am Ende = t. Die Währung Baht.', 'ท at the end = t. The currency baht.'),
  combo('rat', 'ราช', 'rat', ['raj', 'rach'], 'ช am Ende = t: ราชบุรี = Ratchaburi.', 'ช at the end = t: ราชบุรี = Ratchaburi.'),
  combo('thit', 'ทิศ', 'thit', ['tit'], 'ศ am Ende = t. Bedeutet „Richtung“.', 'ศ at the end = t. Means “direction”.'),
  combo('lap', 'ลาบ', 'lap', ['larb', 'laab'], 'บ am Ende = p.', 'บ at the end = p.'),
  combo('chok', 'โชค', 'chok', ['chock'], 'ค am Ende = k.', 'ค at the end = k.'),
  combo('kan', 'การ', 'kan', ['karn', 'kaan'], 'ร am Ende = n.', 'ร at the end = n.'),
  // Composite vowels
  combo('ruea', 'เรือ', 'ruea', ['rua', 'reua'], 'เ-ือ = uea: das Wort für Boot.', 'เ-ือ = uea: the word for boat.'),
  combo('tua', 'ตัว', 'tua', [], '-ัว = ua.', '-ัว = ua.'),
  combo('khao', 'เขา', 'khao', ['kao'], 'เ-า = ao. Bedeutet auch „Berg“ (เขาใหญ่ = Khao Yai).', 'เ-า = ao. Also means “mountain” (เขาใหญ่ = Khao Yai).'),
  combo('doen', 'เดิน', 'doen', ['dern'], 'เ-ิ = oe.', 'เ-ิ = oe.'),
  combo('loei', 'เลย', 'loei', ['loey'], 'เ-ย = oei: wie die Provinz Loei.', 'เ-ย = oei: like Loei province.'),
  combo('mia', 'เมีย', 'mia', [], 'เ-ีย = ia: wie in เชียงใหม่ = Chiang Mai.', 'เ-ีย = ia: as in เชียงใหม่ = Chiang Mai.'),
  // Unwritten vowels
  combo('thanon', 'ถนน', 'thanon', ['tanon'], 'Kein Vokal geschrieben: zwischen den Konsonanten a bzw. o ergänzen. Bedeutet „Straße“.', 'No vowel written: add a or o between the consonants. Means “road”.'),
  combo('chon', 'ชล', 'chon', [], 'Geschlossene Silbe ohne Vokalzeichen = o. ชลบุรี = Chon Buri.', 'Closed syllable without a vowel sign = o. ชลบุรี = Chon Buri.'),
  combo('sakon', 'สกล', 'sakon', ['sakol'], 'สกลนคร = Sakon Nakhon.', 'สกลนคร = Sakon Nakhon.'),
  combo('phom', 'ผม', 'phom', ['pom'], 'ผ + ม mit unsichtbarem o.', 'ผ + ม with an invisible o.'),
  combo('khon', 'คน', 'khon', ['kon'], 'Bedeutet „Mensch“.', 'Means “person”.'),
  combo('lop', 'ลพ', 'lop', [], 'พ am Ende = p, unsichtbares o: ลพบุรี = Lop Buri.', 'พ at the end = p, invisible o: ลพบุรี = Lop Buri.'),
];

const ids = (...s: string[]) => s.map(unitId);

export const CONTRAST_SETS: ContrastSet[] = [
  { id: 'th:cs:bo-po', itemIds: ids('bo', 'po'), note: { de: 'บ = b, ป = p (langer Strich nach oben).', en: 'บ = b, ป = p (long stroke up).' } },
  { id: 'th:cs:do-to', itemIds: ids('do-dek', 'to-tao', 'kho-khwai', 'so-sala'), note: { de: 'ด = d, ต = t (Zacke oben), ค = kh, ศ = s.', en: 'ด = d, ต = t (notch on top), ค = kh, ศ = s.' } },
  { id: 'th:cs:pho-fo', itemIds: ids('pho-phan', 'fo-fan'), note: { de: 'พ = ph, ฟ = f (langer Strich).', en: 'พ = ph, ฟ = f (long stroke).' } },
  { id: 'th:cs:phueng-fa', itemIds: ids('pho-phueng', 'fo-fa'), note: { de: 'ผ = ph, ฝ = f (langer Strich).', en: 'ผ = ph, ฝ = f (long stroke).' } },
  { id: 'th:cs:kh-ch-s', itemIds: ids('kho-khai', 'cho-chang', 'so-so'), note: { de: 'ข = kh, ช = ch, ซ = s.', en: 'ข = kh, ช = ch, ซ = s.' } },
  { id: 'th:cs:thung-samphao', itemIds: ids('tho-thung', 'pho-samphao'), note: { de: 'ถ = th, ภ = ph.', en: 'ถ = th, ภ = ph.' } },
  { id: 'th:cs:m-n-h', itemIds: ids('mo', 'no-nu', 'ho-hip'), note: { de: 'ม = m, น = n, ห = h.', en: 'ม = m, น = n, ห = h.' } },
  { id: 'th:cs:o-h', itemIds: ids('o-ang', 'ho-nokhuk'), note: { de: 'อ = o / stumm, ฮ = h.', en: 'อ = o / silent, ฮ = h.' } },
  { id: 'th:cs:r-th', itemIds: ids('ro', 'tho-thong'), note: { de: 'ร = r, ธ = th.', en: 'ร = r, ธ = th.' } },
  { id: 'th:cs:l-s', itemIds: ids('lo-ling', 'so-suea'), note: { de: 'ล = l, ส = s.', en: 'ล = l, ส = s.' } },
];
