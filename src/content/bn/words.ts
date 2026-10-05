import type { TermCategory, WordItem } from '../../domain/types';

const w = (slug: string, native: string, translit: string, de: string[], en: string[], extra: string[] = []): WordItem => ({
  id: `bn:word:${slug}`,
  kind: 'word',
  native,
  translit,
  extra,
  meaning: { de, en },
});

/** Short words, grouped by the lesson in which they become readable. */
export const WORDS: WordItem[] = [
  // 1: ক ন ম ল র া
  w('nam', 'নাম', 'nam', ['Name'], ['name']),
  w('lal', 'লাল', 'lal', ['rot'], ['red']),
  w('kal', 'কাল', 'kal', ['gestern', 'morgen'], ['yesterday', 'tomorrow']),
  w('mala', 'মালা', 'mala', ['Kette', 'Girlande'], ['garland']),
  w('kola', 'কলা', 'kola', ['Banane'], ['banana'], ['kala']),
  // 2: ব প গ ত ি
  w('baba', 'বাবা', 'baba', ['Vater'], ['father']),
  w('pani', 'পানি', 'pani', ['Wasser'], ['water']),
  w('gan', 'গান', 'gan', ['Lied'], ['song']),
  w('tal', 'তাল', 'tal', ['Palme'], ['palm']),
  w('bil', 'বিল', 'bil', ['Sumpf', 'Feuchtgebiet'], ['wetland', 'marsh']),
  // 3: দ স শ জ চ ী
  w('cha', 'চা', 'cha', ['Tee'], ['tea']),
  w('jomi', 'জমি', 'jomi', ['Land', 'Grundstück'], ['land', 'plot'], ['jami', 'zomi']),
  w('sat', 'সাত', 'sat', ['sieben'], ['seven'], ['shat']),
  w('dam', 'দাম', 'dam', ['Preis'], ['price']),
  w('shila', 'শিলা', 'shila', ['Stein', 'Fels'], ['rock'], ['sila']),
  // 4: ট ড হ য় ু ূ
  w('taka', 'টাকা', 'taka', ['Taka (Währung)'], ['taka (currency)']),
  w('dur', 'দূর', 'dur', ['weit', 'fern'], ['far']),
  w('pukur', 'পুকুর', 'pukur', ['Teich'], ['pond']),
  w('dak', 'ডাক', 'dak', ['Post'], ['post', 'mail']),
  // 5: ে ো ৈ ৌ ৃ
  w('desh', 'দেশ', 'desh', ['Land', 'Staat'], ['country'], ['des']),
  w('mela', 'মেলা', 'mela', ['Volksfest', 'Messe'], ['fair']),
  w('tel', 'তেল', 'tel', ['Öl'], ['oil']),
  w('nouka', 'নৌকা', 'nouka', ['Boot'], ['boat'], ['nauka']),
  w('krishi', 'কৃষি', 'krishi', ['Landwirtschaft'], ['agriculture'], ['krisi']),
  // 6: খ ঘ ছ ঝ ঠ ঢ
  w('ghor', 'ঘর', 'ghor', ['Haus', 'Zimmer'], ['house', 'room'], ['ghar']),
  w('khal', 'খাল', 'khal', ['Kanal'], ['canal']),
  w('machh', 'মাছ', 'machh', ['Fisch'], ['fish'], ['mach', 'mas']),
  w('thik', 'ঠিক', 'thik', ['richtig'], ['right', 'correct']),
  // 7: থ ধ ফ ভ য ণ
  w('dhan', 'ধান', 'dhan', ['Reis (Pflanze)'], ['paddy', 'rice plant']),
  w('phol', 'ফল', 'phol', ['Obst'], ['fruit'], ['fol', 'phal', 'fal']),
  w('bhat', 'ভাত', 'bhat', ['Reis (gekocht)'], ['cooked rice'], ['vat']),
  w('jog', 'যোগ', 'jog', ['Verbindung'], ['connection'], ['jok']),
  // 8: ষ ঙ ঞ ড় ঢ় ৎ
  w('bari', 'বাড়ি', 'bari', ['Haus', 'Zuhause'], ['house', 'home']),
  w('gari', 'গাড়ি', 'gari', ['Auto'], ['car']),
  w('para', 'পাড়া', 'para', ['Viertel'], ['neighbourhood', 'neighborhood']),
  w('shat', 'ষাট', 'shat', ['sechzig'], ['sixty'], ['sat']),
  // 9: ং ঃ ঁ ্
  w('bangla', 'বাংলা', 'bangla', ['Bengalisch'], ['Bengali', 'Bangla']),
  w('rong', 'রং', 'rong', ['Farbe'], ['colour', 'color'], ['rang']),
  w('chand', 'চাঁদ', 'chand', ['Mond'], ['moon'], ['chad']),
  w('ga-village', 'গাঁ', 'ga', ['Dorf'], ['village']),
  // 10: অ আ ই উ এ ও
  w('am', 'আম', 'am', ['Mango'], ['mango']),
  w('ek', 'এক', 'ek', ['eins'], ['one']),
  w('it', 'ইট', 'it', ['Ziegel'], ['brick']),
  w('onek', 'অনেক', 'onek', ['viele'], ['many'], ['anek']),
  w('ojon', 'ওজন', 'ojon', ['Gewicht'], ['weight'], ['ozon']),
  // 11: ঈ ঊ ঋ ঐ ঔ
  w('id', 'ঈদ', 'id', ['Eid (Fest)'], ['Eid'], ['eid']),
  w('rin', 'ঋণ', 'rin', ['Schuld', 'Kredit'], ['loan', 'debt']),
  w('usha', 'ঊষা', 'usha', ['Morgendämmerung'], ['dawn']),
  w('oushodh', 'ঔষধ', 'oushodh', ['Medizin'], ['medicine'], ['oushadh', 'aushadh']),
];

const t = (slug: string, native: string, translit: string, category: TermCategory, de: string[], en: string[], extra: string[] = []): WordItem => ({
  id: `bn:term:${slug}`,
  kind: 'term',
  native,
  translit,
  extra,
  category,
  meaning: { de, en },
  countryIds: ['BD'],
});

/** Words from Bangladeshi signs. Loanwords from English are frequent and quick wins. */
export const TERMS: WordItem[] = [
  // English loanwords
  t('road', 'রোড', 'rod', 'road', ['Straße'], ['road'], ['road']),
  t('station', 'স্টেশন', 'steshon', 'transport', ['Bahnhof', 'Station'], ['station'], ['station', 'stesan']),
  t('college', 'কলেজ', 'kolej', 'everyday', ['College', 'Hochschule'], ['college'], ['college', 'kolez']),
  t('school', 'স্কুল', 'skul', 'everyday', ['Schule'], ['school'], ['school', 'iskul']),
  t('bank', 'ব্যাংক', 'byank', 'everyday', ['Bank'], ['bank'], ['bank']),
  t('hotel', 'হোটেল', 'hotel', 'everyday', ['Hotel'], ['hotel']),
  t('pharmacy', 'ফার্মেসি', 'pharmesi', 'everyday', ['Apotheke'], ['pharmacy'], ['pharmacy', 'farmesi', 'pharmeshi']),
  t('bus', 'বাস', 'bas', 'transport', ['Bus'], ['bus'], ['bus', 'bash']),
  // Roads & administration
  t('sorok', 'সড়ক', 'sorok', 'road', ['Straße'], ['road'], ['sarak', 'sorak', 'shorok']),
  t('mohasorok', 'মহাসড়ক', 'mohasorok', 'road', ['Fernstraße', 'Highway'], ['highway'], ['mahasarak', 'mohasarak']),
  t('setu', 'সেতু', 'setu', 'road', ['Brücke'], ['bridge'], ['shetu']),
  t('jela', 'জেলা', 'jela', 'settlement', ['Distrikt'], ['district'], ['zila', 'zilla', 'jila']),
  t('upojela', 'উপজেলা', 'upojela', 'settlement', ['Unterdistrikt', 'Upazila'], ['subdistrict', 'upazila'], ['upazila', 'upazilla', 'upojila']),
  t('bibhag', 'বিভাগ', 'bibhag', 'settlement', ['Division (Verwaltungsbezirk)'], ['division'], ['bivag', 'bibhaag']),
  t('union', 'ইউনিয়ন', 'iuniyon', 'settlement', ['Union (Gemeindeverband)'], ['union (council)'], ['union', 'iuniyan']),
  t('pourashava', 'পৌরসভা', 'pourashava', 'settlement', ['Gemeinde', 'Stadtverwaltung'], ['municipality'], ['pourosobha', 'paurashava', 'pourashoba']),
  // Places & directions
  t('nodi', 'নদী', 'nodi', 'nature', ['Fluss'], ['river'], ['nadi']),
  t('gram', 'গ্রাম', 'gram', 'settlement', ['Dorf'], ['village'], ['gramm']),
  t('bazar', 'বাজার', 'bazar', 'everyday', ['Markt'], ['market', 'bazaar'], ['bajar', 'bazaar']),
  t('hat', 'হাট', 'hat', 'everyday', ['Wochenmarkt'], ['weekly market'], ['haat']),
  t('uttor', 'উত্তর', 'uttor', 'direction', ['Norden'], ['north'], ['uttar', 'uttara']),
  t('dokkhin', 'দক্ষিণ', 'dokkhin', 'direction', ['Süden'], ['south'], ['dakshin', 'dokhin', 'dakkhin']),
  t('purbo', 'পূর্ব', 'purbo', 'direction', ['Osten'], ['east'], ['purba', 'purb']),
  t('poshchim', 'পশ্চিম', 'poshchim', 'direction', ['Westen'], ['west'], ['paschim', 'poschim', 'pashchim']),
  // By the roadside
  t('moshjid', 'মসজিদ', 'moshjid', 'everyday', ['Moschee'], ['mosque'], ['masjid', 'mosjid', 'moshjeed']),
  t('mondir', 'মন্দির', 'mondir', 'everyday', ['Tempel'], ['temple'], ['mandir']),
  t('hashpatal', 'হাসপাতাল', 'hashpatal', 'everyday', ['Krankenhaus'], ['hospital'], ['haspatal', 'hospital']),
  t('thana', 'থানা', 'thana', 'everyday', ['Polizeistation'], ['police station'], ['tana']),
  t('madrasa', 'মাদ্রাসা', 'madrasa', 'everyday', ['Koranschule', 'Madrasa'], ['madrasa', 'religious school'], ['madrasah', 'madrasha']),
  t('police', 'পুলিশ', 'pulish', 'everyday', ['Polizei'], ['police'], ['police', 'pulis']),
  t('dokan', 'দোকান', 'dokan', 'everyday', ['Laden', 'Geschäft'], ['shop'], ['dokaan']),
  t('pump', 'পেট্রোল পাম্প', 'petrol pamp', 'transport', ['Tankstelle'], ['petrol pump', 'gas station'], ['petrol pump']),
];
