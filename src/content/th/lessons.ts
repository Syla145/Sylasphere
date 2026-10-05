import type { L10n, Lesson, PhaseDef, PlaceItem } from '../../domain/types';
import { CITIES } from './places';
import { unitId } from './units';

export const PHASES: PhaseDef[] = [
  { id: 'first', title: { de: 'Erste Silben', en: 'First Syllables' } },
  { id: 'vowels', title: { de: 'Vokale rund um den Konsonanten', en: 'Vowels Around the Consonant' } },
  { id: 'consonants', title: { de: 'Weitere Konsonanten', en: 'More Consonants' } },
  { id: 'marks', title: { de: 'Zeichen ohne Laut', en: 'Silent Marks' } },
  { id: 'rare', title: { de: 'Seltene Zeichen', en: 'Rare Letters' } },
  { id: 'rules', title: { de: 'Leseregeln', en: 'Reading Rules' } },
  { id: 'terms', title: { de: 'GeoGuessr-Begriffe', en: 'GeoGuessr Terms' } },
  { id: 'cities', title: { de: 'Ortsnamen', en: 'Place Names' } },
  { id: 'regions', title: { de: 'Provinzen', en: 'Provinces' } },
];

const U = (...s: string[]) => s.map(unitId);
const C = (...s: string[]) => s.map((x) => `th:combo:${x}`);
const W = (...s: string[]) => s.map((x) => `th:word:${x}`);
const E = (...s: string[]) => s.map((x) => `th:element:${x}`);
const T = (...s: string[]) => s.map((x) => `th:term:${x}`);

const core: Omit<Lesson, 'number'>[] = [
  {
    id: 'th-l01', phaseId: 'first', type: 'letters',
    title: { de: 'Erste Silben', en: 'First Syllables' },
    goal: { de: 'Fünf häufige Konsonanten und das lange a: นา = na. Thai liest man in Silben, nicht Buchstabe für Buchstabe.', en: 'Five common consonants and long a: นา = na. Thai is read in syllables, not letter by letter.' },
    newIds: U('ko', 'no-nu', 'mo', 'ro', 'lo-ling', 'v-aa'),
    wordIds: W('na', 'ma', 'la', 'nan-long', 'mak'),
  },
  {
    id: 'th-l02', phaseId: 'first', type: 'letters',
    title: { de: 'Ähnliche Paare', en: 'Look-alike Pairs' },
    goal: { de: 'บ/ป und ด/ต unterscheiden sich nur durch einen Strich. Dazu i und langes i über dem Konsonanten.', en: 'บ/ป and ด/ต differ by a single stroke. Plus i and long i above the consonant.' },
    newIds: U('bo', 'po', 'do-dek', 'to-tao', 'v-i', 'v-ii'),
    wordIds: W('ta', 'di', 'pi', 'bin', 'din'),
  },
  {
    id: 'th-l03', phaseId: 'first', type: 'letters',
    title: { de: 'Träger und Gleitlaute', en: 'Carrier and Glides' },
    goal: { de: 'อ als stummer Vokalträger, ย, ว, ง und die u-Laute unter dem Konsonanten.', en: 'อ as a silent vowel carrier, ย, ว, ง and the u sounds below the consonant.' },
    newIds: U('o-ang', 'yo-yak', 'wo', 'ngo', 'v-u', 'v-uu'),
    wordIds: W('ya', 'ngu', 'pu', 'du', 'lung', 'yao'),
  },
  {
    id: 'th-l04', phaseId: 'vowels', type: 'letters',
    title: { de: 'Vokale davor', en: 'Vowels in Front' },
    goal: { de: 'เ แ โ ไ ใ stehen VOR dem Konsonanten, werden aber danach gelesen: ไป = pai.', en: 'เ แ โ ไ ใ are written BEFORE the consonant but read after it: ไป = pai.' },
    newIds: U('v-e', 'v-ae', 'v-o', 'v-ai-malai', 'v-ai-muan', 'v-a'),
    wordIds: W('pai', 'bai', 'daeng', 'rong', 'maeo', 'to'),
  },
  {
    id: 'th-l05', phaseId: 'consonants', type: 'letters',
    title: { de: 'Behauchte Laute', en: 'Aspirated Sounds' },
    goal: { de: 'ข ค ช ท พ – geschrieben kh, ch, th, ph – und ห. th ist kein englisches th, ph kein f.', en: 'ข ค ช ท พ – written kh, ch, th, ph – and ห. th is not English th, ph is not f.' },
    newIds: U('kho-khai', 'kho-khwai', 'cho-chang', 'tho-thahan', 'pho-phan', 'ho-hip'),
    wordIds: W('kha', 'cha', 'thang', 'ha', 'thong', 'pha'),
  },
  {
    id: 'th-l06', phaseId: 'consonants', type: 'letters',
    title: { de: 'S, F und Ch', en: 'S, F and Ch' },
    goal: { de: 'ส, ถ, ผ/ฝ und จ – danach sind viele Provinznamen lesbar.', en: 'ส, ถ, ผ/ฝ and จ – many province names become readable.' },
    newIds: U('so-suea', 'tho-thung', 'pho-phueng', 'fo-fa', 'fo-fan', 'cho-chan'),
    wordIds: W('sam', 'chan-plate', 'tham-ask', 'si', 'chin'),
  },
  {
    id: 'th-l07', phaseId: 'consonants', type: 'letters',
    title: { de: 'Kurzes a und am', en: 'Short a and am' },
    goal: { de: '◌ั und ◌ำ, dazu ซ, ฉ, ญ und ฮ. วัด = wat, ซอย = soi.', en: '◌ั and ◌ำ, plus ซ, ฉ, ญ and ฮ. วัด = wat, ซอย = soi.' },
    newIds: U('so-so', 'cho-ching', 'yo-ying', 'ho-nokhuk', 'v-mai-han', 'v-am'),
    wordIds: [...W('wan', 'tham-do', 'chan-i', 'ha-laugh'), ...T('wat', 'soi')],
  },
  {
    id: 'th-l08', phaseId: 'marks', type: 'letters',
    title: { de: 'Zeichen ohne Laut', en: 'Silent Marks' },
    goal: { de: 'Tonzeichen überliest man, ์ macht stumm, ๆ wiederholt, ฯ kürzt ab.', en: 'Read past tone marks, ์ silences, ๆ repeats, ฯ abbreviates.' },
    newIds: U('m-tone', 'm-karan', 'm-taikhu', 'm-yamok', 'm-paiyannoi'),
    wordIds: W('kai', 'nam', 'mae', 'pet', 'dekdek', 'krungthep'),
  },
  {
    id: 'th-l09', phaseId: 'rare', type: 'letters',
    title: { de: 'Zeichen aus Pali und Sanskrit', en: 'Pali and Sanskrit Letters' },
    goal: { de: 'Im Alltag selten, in Ortsnamen ständig: ธ in ธานี, ภ in ภูเก็ต, ศ in ศรี.', en: 'Rare in daily life, constant in place names: ธ in ธานี, ภ in ภูเก็ต, ศ in ศรี.' },
    newIds: U('tho-thong', 'pho-samphao', 'so-sala', 'so-ruesi', 'no-nen', 'tho-than'),
    wordIds: W('phasa', 'khun', 'than'),
  },
  {
    id: 'th-l10', phaseId: 'rare', type: 'letters',
    title: { de: 'Seltene Konsonanten I', en: 'Rare Consonants I' },
    goal: { de: 'ฆ ฌ ฎ ฏ ฑ ฒ – erkennen reicht, sie lesen sich wie ihre häufigen Geschwister.', en: 'ฆ ฌ ฎ ฏ ฑ ฒ – recognising them is enough; they read like their common siblings.' },
    newIds: U('kho-rakhang', 'cho-choe', 'do-chada', 'to-patak', 'tho-montho', 'tho-phuthao'),
    wordIds: W('rakhang', 'thao'),
  },
  {
    id: 'th-l11', phaseId: 'rare', type: 'letters',
    title: { de: 'Letzte Zeichen', en: 'Last Letters' },
    goal: { de: 'ฬ und die ue-Laute ◌ึ ◌ื – danach ist das ganze Alphabet da.', en: 'ฬ and the ue sounds ◌ึ ◌ื – the whole alphabet is complete.' },
    newIds: U('lo-chula', 'v-ue', 'v-uue'),
    wordIds: W('chue', 'mue', 'luek', 'chula'),
  },
  {
    id: 'th-l12', phaseId: 'rules', type: 'combos',
    title: { de: 'Endkonsonanten', en: 'Final Consonants' },
    goal: { de: 'Am Silbenende gibt es nur wenige Laute: ด ต จ ช ส ศ → t, บ ป พ → p, ร ล ญ ณ → n, ก ข ค → k.', en: 'Only a few sounds end a syllable: ด ต จ ช ส ศ → t, บ ป พ → p, ร ล ญ ณ → n, ก ข ค → k.' },
    newIds: C('baht', 'rat', 'thit', 'lap', 'chok', 'kan'),
  },
  {
    id: 'th-l13', phaseId: 'rules', type: 'combos',
    title: { de: 'Zusammengesetzte Vokale', en: 'Composite Vowels' },
    goal: { de: 'เ-ีย, เ-ือ, -ัว, เ-า, เ-ิ, เ-ย – ohne sie bleiben Chiang Mai und viele andere Namen unlesbar.', en: 'เ-ีย, เ-ือ, -ัว, เ-า, เ-ิ, เ-ย – without them Chiang Mai and many other names stay unreadable.' },
    newIds: C('ruea', 'tua', 'khao', 'doen', 'loei', 'mia'),
  },
  {
    id: 'th-l14', phaseId: 'rules', type: 'combos',
    title: { de: 'Unsichtbare Vokale', en: 'Invisible Vowels' },
    goal: { de: 'Steht kein Vokal da, ergänzt man a oder o: ถนน = thanon, นคร = nakhon.', en: 'If no vowel is written, add a or o: ถนน = thanon, นคร = nakhon.' },
    newIds: C('thanon', 'chon', 'sakon', 'phom', 'khon', 'lop'),
  },
  {
    id: 'th-l15', phaseId: 'terms', type: 'vocab',
    title: { de: 'Ortsnamen-Bausteine', en: 'Place-Name Building Blocks' },
    goal: { de: 'บุรี, นคร, ธานี, เชียง, สมุทร – erkennen statt buchstabieren.', en: 'บุรี, นคร, ธานี, เชียง, สมุทร – recognise them instead of spelling them out.' },
    newIds: E('buri', 'nakhon', 'thani', 'chiang', 'samut', 'si', 'ban', 'mae'),
  },
  {
    id: 'th-l16', phaseId: 'terms', type: 'vocab',
    title: { de: 'Straße & Verkehr', en: 'Roads' },
    goal: { de: 'ถนน, ซอย, ทางหลวง – die Wörter auf Straßenschildern.', en: 'ถนน, ซอย, ทางหลวง – the words on road signs.' },
    newIds: T('thanon', 'soi', 'thang-luang', 'saphan', 'yaek', 'thang-ok', 'thang-khao', 'kilomet'),
  },
  {
    id: 'th-l17', phaseId: 'terms', type: 'vocab',
    title: { de: 'Verwaltung', en: 'Administration' },
    goal: { de: 'จังหวัด, อำเภอ, ตำบล – auf fast jedem Ortsschild.', en: 'จังหวัด, อำเภอ, ตำบล – on almost every place sign.' },
    newIds: T('changwat', 'amphoe', 'tambon', 'mu-ban', 'mueang', 'thetsaban', 'chai-daen', 'sala-klang'),
  },
  {
    id: 'th-l18', phaseId: 'terms', type: 'vocab',
    title: { de: 'Natur & Richtungen', en: 'Nature & Directions' },
    goal: { de: 'Insel, Strand, Fluss, Berg – und Norden und Süden.', en: 'Island, beach, river, mountain – and north and south.' },
    newIds: T('ko', 'hat', 'mae-nam', 'doi', 'phu-khao', 'nam-tok', 'nuea', 'tai'),
  },
  {
    id: 'th-l19', phaseId: 'terms', type: 'vocab',
    title: { de: 'Am Straßenrand', en: 'By the Roadside' },
    goal: { de: 'Tempel, Markt, Bahnhof, Tankstelle – was man auf Street View ständig sieht.', en: 'Temple, market, station, petrol station – what you keep seeing on Street View.' },
    newIds: T('wat', 'talat', 'sathani', 'sanam-bin', 'rong-rian', 'rong-phayaban', 'pam-nam-man', 'ran-ahan'),
  },
];

function chunk<T>(list: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  if (out.length > 1 && out[out.length - 1].length < 4) {
    const tail = out.pop()!;
    out[out.length - 1].push(...tail);
  }
  return out;
}

const byTier = (list: PlaceItem[]) => [...list].sort((a, b) => a.tier - b.tier);

const cityLessons: Omit<Lesson, 'number'>[] = chunk(byTier(CITIES), 9).map((group, i) => ({
  id: `th-city-${i + 1}`,
  phaseId: 'cities',
  type: 'places',
  title: { de: `Städte ${i + 1}`, en: `Cities ${i + 1}` },
  goal: {
    de: i === 0 ? 'Die wichtigsten Städte Thailands.' : 'Weitere Städte von Wegweisern.',
    en: i === 0 ? 'Thailand’s most important cities.' : 'More cities from direction signs.',
  },
  newIds: group.map((p) => p.id),
}));

/** Provinces are taught on the map, region by region, so neighbours are learned together. */
const PROVINCE_GROUPS: { title: L10n; slugs: string[] }[] = [
  { title: { de: 'Der Norden', en: 'The North' }, slugs: ['chiang-mai', 'chiang-rai', 'mae-hong-son', 'lamphun', 'lampang', 'phayao', 'nan', 'phrae', 'uttaradit'] },
  { title: { de: 'Bangkok & Umland', en: 'Bangkok & Surroundings' }, slugs: ['bangkok', 'nonthaburi', 'pathum-thani', 'samut-prakan', 'samut-sakhon', 'samut-songkhram', 'nakhon-pathom'] },
  { title: { de: 'Ayutthaya & die Ebene', en: 'Ayutthaya & the Plain' }, slugs: ['phra-nakhon-si-ayutthaya', 'ang-thong', 'sing-buri', 'chai-nat', 'lop-buri', 'saraburi', 'nakhon-nayok', 'suphan-buri'] },
  { title: { de: 'Unterer Norden', en: 'The Lower North' }, slugs: ['nakhon-sawan', 'uthai-thani', 'kamphaeng-phet', 'sukhothai', 'phitsanulok', 'phichit', 'phetchabun'] },
  { title: { de: 'Der Westen', en: 'The West' }, slugs: ['tak', 'kanchanaburi', 'ratchaburi', 'phetchaburi', 'prachuap-khiri-khan'] },
  { title: { de: 'Der Osten', en: 'The East' }, slugs: ['chon-buri', 'rayong', 'chanthaburi', 'trat', 'chachoengsao', 'prachin-buri', 'sa-kaeo'] },
  { title: { de: 'Isan: am Mekong', en: 'Isan: Along the Mekong' }, slugs: ['loei', 'nong-bua-lam-phu', 'udon-thani', 'nong-khai', 'bueng-kan', 'sakon-nakhon', 'nakhon-phanom'] },
  { title: { de: 'Isan: die Mitte', en: 'Isan: the Centre' }, slugs: ['khon-kaen', 'kalasin', 'mukdahan', 'maha-sarakham', 'roi-et', 'yasothon', 'chaiyaphum'] },
  { title: { de: 'Isan: der Süden', en: 'Isan: the South' }, slugs: ['nakhon-ratchasima', 'buri-ram', 'surin', 'si-sa-ket', 'ubon-ratchathani', 'amnat-charoen'] },
  { title: { de: 'Der Süden: Andamanen & Golf', en: 'The South: Andaman & Gulf' }, slugs: ['chumphon', 'ranong', 'surat-thani', 'phang-nga', 'phuket', 'krabi', 'nakhon-si-thammarat'] },
  { title: { de: 'Der tiefe Süden', en: 'The Deep South' }, slugs: ['trang', 'phatthalung', 'satun', 'songkhla', 'pattani', 'yala', 'narathiwat'] },
];

const provinceLessons: Omit<Lesson, 'number'>[] = PROVINCE_GROUPS.map((g, i) => ({
  id: `th-province-${i + 1}`,
  phaseId: 'regions',
  type: 'places',
  title: g.title,
  goal: {
    de: `${g.slugs.length} Provinzen lesen und auf der Karte finden. Die Provinz heißt fast immer wie ihre Hauptstadt.`,
    en: `Read ${g.slugs.length} provinces and find them on the map. A province is almost always named after its capital.`,
  },
  newIds: g.slugs.map((s) => `th:region:${s}`),
}));

export const LESSONS: Lesson[] = [...core, ...cityLessons, ...provinceLessons].map((l, i) => ({ ...l, number: i + 1 }));
