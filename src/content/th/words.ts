import type { TermCategory, WordItem } from '../../domain/types';

/** Spelling variants: RTGS form, the same without spaces, and listed alternatives. */
export function variants(rtgs: string, extra: string[] = []): string[] {
  const all = [rtgs, ...extra];
  return [...new Set([...all, ...all.map((v) => v.replace(/\s+/g, ''))])];
}

const w = (slug: string, native: string, translit: string, de: string[], en: string[], extra: string[] = []): WordItem => ({
  id: `th:word:${slug}`,
  kind: 'word',
  native,
  translit,
  extra: variants(translit, extra).slice(1),
  meaning: { de, en },
});

/** Short words, grouped by the lesson in which they become readable. */
export const WORDS: WordItem[] = [
  // lesson 1: ก น ม ร ล า
  w('na', 'นา', 'na', ['Reisfeld'], ['rice field']),
  w('ma', 'มา', 'ma', ['kommen'], ['come']),
  w('la', 'ลา', 'la', ['Esel'], ['donkey']),
  w('nan-long', 'นาน', 'nan', ['lange'], ['long time']),
  w('mak', 'มาก', 'mak', ['sehr', 'viel'], ['very', 'much'], ['maak']),
  // lesson 2: บ ป ด ต ิ ี
  w('ta', 'ตา', 'ta', ['Auge'], ['eye']),
  w('di', 'ดี', 'di', ['gut'], ['good'], ['dee']),
  w('pi', 'ปี', 'pi', ['Jahr'], ['year'], ['pee']),
  w('bin', 'บิน', 'bin', ['fliegen'], ['fly']),
  w('din', 'ดิน', 'din', ['Erde'], ['soil', 'earth']),
  // lesson 3: อ ย ว ง ุ ู
  w('ya', 'ยา', 'ya', ['Medizin'], ['medicine']),
  w('ngu', 'งู', 'ngu', ['Schlange'], ['snake']),
  w('pu', 'ปู', 'pu', ['Krabbe'], ['crab'], ['poo']),
  w('du', 'ดู', 'du', ['schauen'], ['look', 'watch']),
  w('lung', 'ลุง', 'lung', ['Onkel'], ['uncle']),
  w('yao', 'ยาว', 'yao', ['lang'], ['long'], ['yaow']),
  // lesson 4: เ แ โ ไ ใ ะ
  w('pai', 'ไป', 'pai', ['gehen'], ['go']),
  w('bai', 'ใบ', 'bai', ['Blatt'], ['leaf']),
  w('daeng', 'แดง', 'daeng', ['rot'], ['red']),
  w('rong', 'โรง', 'rong', ['Halle', 'Gebäude'], ['hall', 'building']),
  w('maeo', 'แมว', 'maeo', ['Katze'], ['cat'], ['maew']),
  w('to', 'โต', 'to', ['groß', 'erwachsen'], ['big', 'grown-up']),
  // lesson 5: ข ค ช ท พ ห
  w('kha', 'ขา', 'kha', ['Bein'], ['leg']),
  w('cha', 'ชา', 'cha', ['Tee'], ['tea']),
  w('thang', 'ทาง', 'thang', ['Weg'], ['way', 'route'], ['tang']),
  w('ha', 'หา', 'ha', ['suchen'], ['look for']),
  w('thong', 'ทอง', 'thong', ['Gold'], ['gold'], ['tong']),
  w('pha', 'พา', 'pha', ['mitnehmen'], ['take along']),
  // lesson 6: ส ถ ผ ฝ ฟ จ
  w('sam', 'สาม', 'sam', ['drei'], ['three']),
  w('chan-plate', 'จาน', 'chan', ['Teller'], ['plate'], ['jan']),
  w('tham-ask', 'ถาม', 'tham', ['fragen'], ['ask'], ['tam']),
  w('si', 'สี', 'si', ['Farbe'], ['colour', 'color'], ['see']),
  w('chin', 'จีน', 'chin', ['China'], ['China'], ['jeen']),
  // lesson 7: ซ ฉ ญ ฮ ั ำ
  w('wan', 'วัน', 'wan', ['Tag'], ['day']),
  w('tham-do', 'ทำ', 'tham', ['machen'], ['do', 'make'], ['tam']),
  w('chan-i', 'ฉัน', 'chan', ['ich'], ['I']),
  w('ha-laugh', 'ฮา', 'ha', ['lachen', 'lustig'], ['laugh', 'funny']),
  // lesson 8: marks
  w('kai', 'ไก่', 'kai', ['Huhn'], ['chicken'], ['gai']),
  w('nam', 'น้ำ', 'nam', ['Wasser'], ['water']),
  w('mae', 'แม่', 'mae', ['Mutter'], ['mother']),
  w('pet', 'เป็ด', 'pet', ['Ente'], ['duck'], ['ped']),
  w('dekdek', 'เด็กๆ', 'dek dek', ['Kinder'], ['children']),
  w('krungthep', 'กรุงเทพฯ', 'Krung Thep', ['Bangkok (Kurzform)'], ['Bangkok (short form)'], ['Krungthep']),
  // lesson 9: ธ ภ ศ ษ ณ ฐ
  w('phasa', 'ภาษา', 'phasa', ['Sprache'], ['language'], ['pasa']),
  w('khun', 'คุณ', 'khun', ['Sie', 'du'], ['you'], ['kun']),
  w('than', 'ฐาน', 'than', ['Basis', 'Sockel'], ['base']),
  // lesson 10: ฆ ฌ ฎ ฏ ฑ ฒ
  w('rakhang', 'ระฆัง', 'rakhang', ['Glocke'], ['bell']),
  w('thao', 'เฒ่า', 'thao', ['alt (Mensch)'], ['old (person)']),
  // lesson 11: ฬ ึ ื
  w('chue', 'ชื่อ', 'chue', ['Name'], ['name'], ['chu']),
  w('mue', 'มือ', 'mue', ['Hand'], ['hand'], ['mu']),
  w('luek', 'ลึก', 'luek', ['tief'], ['deep'], ['luk']),
  w('chula', 'จุฬา', 'chula', ['Drachen'], ['kite']),
];

const el = (slug: string, native: string, translit: string, de: string[], en: string[], extra: string[] = []): WordItem => ({
  id: `th:element:${slug}`,
  kind: 'element',
  native,
  translit,
  extra: variants(translit, extra).slice(1),
  meaning: { de, en },
  category: 'element',
});

/** Building blocks of Thai place names. */
export const ELEMENTS: WordItem[] = [
  el('buri', 'บุรี', 'buri', ['Stadt (Endung)'], ['town (ending)'], ['buree']),
  el('nakhon', 'นคร', 'nakhon', ['Stadt', 'Großstadt'], ['city'], ['nakorn', 'nakon']),
  el('thani', 'ธานี', 'thani', ['Stadt (Endung)'], ['city (ending)'], ['tani']),
  el('chiang', 'เชียง', 'chiang', ['Stadt (Norden)'], ['town (north)'], ['chieng']),
  el('samut', 'สมุทร', 'samut', ['Meer'], ['sea'], ['samud']),
  el('si', 'ศรี', 'si', ['herrlich', 'Sri'], ['glorious', 'sri'], ['sri']),
  el('ban', 'บ้าน', 'ban', ['Dorf', 'Haus'], ['village', 'house'], ['baan']),
  el('mae', 'แม่', 'mae', ['Mutter, Fluss (in Namen)'], ['mother, river (in names)']),
];

const t = (slug: string, native: string, translit: string, category: TermCategory, de: string[], en: string[], extra: string[] = [], abbr?: string[]): WordItem => ({
  id: `th:term:${slug}`,
  kind: 'term',
  native,
  translit,
  extra: variants(translit, extra).slice(1),
  category,
  meaning: { de, en },
  abbr,
  countryIds: ['TH'],
});

/** Words from Thai road, place and shop signs. */
export const TERMS: WordItem[] = [
  t('thanon', 'ถนน', 'thanon', 'road', ['Straße'], ['road', 'street'], ['tanon'], ['ถ.']),
  t('soi', 'ซอย', 'soi', 'road', ['Gasse', 'Seitenstraße'], ['lane', 'side street']),
  t('thang-luang', 'ทางหลวง', 'thang luang', 'road', ['Fernstraße', 'Highway'], ['highway'], ['tang luang']),
  t('saphan', 'สะพาน', 'saphan', 'road', ['Brücke'], ['bridge'], ['sapan']),
  t('yaek', 'แยก', 'yaek', 'road', ['Kreuzung'], ['intersection', 'junction'], ['yak']),
  t('thang-ok', 'ทางออก', 'thang ok', 'road', ['Ausgang', 'Ausfahrt'], ['exit'], ['tang ok']),
  t('thang-khao', 'ทางเข้า', 'thang khao', 'road', ['Eingang', 'Einfahrt'], ['entrance'], ['tang kao']),
  t('kilomet', 'กิโลเมตร', 'kilomet', 'road', ['Kilometer'], ['kilometre', 'kilometer'], ['kilometre', 'kilometer'], ['กม.']),
  t('changwat', 'จังหวัด', 'changwat', 'settlement', ['Provinz'], ['province'], ['jangwat', 'changwad']),
  t('amphoe', 'อำเภอ', 'amphoe', 'settlement', ['Bezirk'], ['district'], ['amphur', 'ampoe'], ['อ.']),
  t('tambon', 'ตำบล', 'tambon', 'settlement', ['Unterbezirk', 'Gemeinde'], ['subdistrict'], ['tambol'], ['ต.']),
  t('mu-ban', 'หมู่บ้าน', 'mu ban', 'settlement', ['Dorf'], ['village'], ['moo ban', 'mooban']),
  t('mueang', 'เมือง', 'mueang', 'settlement', ['Stadt'], ['town', 'city'], ['muang', 'meuang']),
  t('thetsaban', 'เทศบาล', 'thetsaban', 'settlement', ['Gemeinde', 'Stadtverwaltung'], ['municipality'], ['tessaban']),
  t('chai-daen', 'ชายแดน', 'chai daen', 'settlement', ['Grenze'], ['border'], ['chaidaen']),
  t('sala-klang', 'ศาลากลาง', 'sala klang', 'settlement', ['Provinzverwaltung', 'Rathaus'], ['provincial hall', 'city hall']),
  t('ko', 'เกาะ', 'ko', 'nature', ['Insel'], ['island'], ['koh']),
  t('hat', 'หาด', 'hat', 'nature', ['Strand'], ['beach'], ['haad', 'had']),
  t('mae-nam', 'แม่น้ำ', 'mae nam', 'nature', ['Fluss'], ['river']),
  t('doi', 'ดอย', 'doi', 'nature', ['Berg (Norden)'], ['mountain (north)']),
  t('phu-khao', 'ภูเขา', 'phu khao', 'nature', ['Berg', 'Gebirge'], ['mountain'], ['pu khao']),
  t('nam-tok', 'น้ำตก', 'nam tok', 'nature', ['Wasserfall'], ['waterfall']),
  t('nuea', 'เหนือ', 'nuea', 'direction', ['Norden'], ['north'], ['nua', 'neua']),
  t('tai', 'ใต้', 'tai', 'direction', ['Süden'], ['south']),
  t('tawan-ok', 'ตะวันออก', 'tawan ok', 'direction', ['Osten'], ['east']),
  t('tawan-tok', 'ตะวันตก', 'tawan tok', 'direction', ['Westen'], ['west']),
  t('wat', 'วัด', 'wat', 'everyday', ['Tempel'], ['temple'], ['wad']),
  t('talat', 'ตลาด', 'talat', 'everyday', ['Markt'], ['market'], ['talad']),
  t('sathani', 'สถานี', 'sathani', 'transport', ['Station', 'Bahnhof'], ['station'], ['satani']),
  t('sanam-bin', 'สนามบิน', 'sanam bin', 'transport', ['Flughafen'], ['airport']),
  t('rong-rian', 'โรงเรียน', 'rong rian', 'everyday', ['Schule'], ['school'], ['rong rien']),
  t('rong-phayaban', 'โรงพยาบาล', 'rong phayaban', 'everyday', ['Krankenhaus'], ['hospital'], ['rong payaban']),
  t('pam-nam-man', 'ปั๊มน้ำมัน', 'pam nam man', 'transport', ['Tankstelle'], ['petrol station', 'gas station']),
  t('ran-ahan', 'ร้านอาหาร', 'ran ahan', 'everyday', ['Restaurant'], ['restaurant'], ['ran a han']),
  t('uthayan', 'อุทยานแห่งชาติ', 'uthayan haeng chat', 'nature', ['Nationalpark'], ['national park'], ['utthayan haeng chat']),
  t('tamruat', 'ตำรวจ', 'tamruat', 'everyday', ['Polizei'], ['police'], ['tamruad']),
];
