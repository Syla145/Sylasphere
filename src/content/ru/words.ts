import type { ComboItem, TermCategory, WordItem } from '../../domain/types';

const combo = (slug: string, native: string, reading: string, note?: ComboItem['note']): ComboItem => ({
  id: `ru:combo:${slug}`,
  kind: 'combo',
  native,
  reading,
  note,
});

/**
 * Combinations: syllables and clusters for the letter lessons, plus the
 * place-name endings that make long Russian names readable at a glance.
 */
export const COMBOS: ComboItem[] = [
  combo('ma', 'ма', 'ma'), combo('ko', 'ко', 'ko'), combo('to', 'то', 'to'), combo('at', 'ат', 'at'), combo('ok', 'ок', 'ok'),
  combo('re', 'ре', 're'), combo('no', 'но', 'no'), combo('st', 'ст', 'st'), combo('sk', 'ск', 'sk'), combo('tr', 'тр', 'tr'), combo('en', 'ен', 'en'),
  combo('va', 'ва', 'va'), combo('vu', 'ву', 'vu'), combo('kho', 'хо', 'kho'), combo('ukh', 'ух', 'ukh'), combo('vs', 'вс', 'vs'),
  combo('bo', 'бо', 'bo'), combo('ga', 'га', 'ga'), combo('do', 'до', 'do'), combo('zo', 'зо', 'zo'), combo('gr', 'гр', 'gr'), combo('dr', 'др', 'dr'),
  combo('pi', 'пи', 'pi'), combo('li', 'ли', 'li'), combo('oy', 'ой', 'oy'), combo('pl', 'пл', 'pl'), combo('kl', 'кл', 'kl'),
  combo('zhi', 'жи', 'zhi'), combo('sha', 'ша', 'sha'), combo('shchi', 'щи', 'shchi'), combo('shk', 'шк', 'shk'),
  combo('tsa', 'ца', 'tsa'), combo('chi', 'чи', 'chi'), combo('fa', 'фа', 'fa'), combo('tsk', 'цк', 'tsk'),
  combo('nya', 'ня', 'nya'), combo('lyu', 'лю', 'lyu'), combo('ehto', 'это', 'eto'), combo('yol', 'ёл', 'yol'),
  combo('ty', 'ты', 'ty'), combo('my', 'мы', 'my'), combo('l-soft', 'ль', 'l'), combo('n-soft', 'нь', 'n'), combo('hard-ye', 'ъе', 'ye'),

  // Place-name endings I
  combo('suf-sk', '-ск', 'sk', { de: 'Häufigste Stadt-Endung: Омск, Томск, Мурманск.', en: 'The most common town ending: Омск, Томск, Мурманск.' }),
  combo('suf-skiy', '-ский', 'skiy', { de: 'Adjektiv-Endung („-sch“), z. B. Петропавловск-Камчатский.', en: 'Adjective ending, e.g. Петропавловск-Камчатский.' }),
  combo('suf-skaya', '-ская', 'skaya', { de: 'Weibliche Form, typisch für Oblaste: Московская область.', en: 'Feminine form, typical of oblasts: Московская область.' }),
  combo('suf-skoye', '-ское', 'skoye', { de: 'Sächliche Form, typisch für Dörfer und Seen.', en: 'Neuter form, typical of villages and lakes.' }),
  combo('suf-grad', '-град', 'grad', { de: '„Stadt“: Волгоград, Калининград.', en: '“City”: Волгоград, Калининград.' }),
  combo('suf-burg', '-бург', 'burg', { de: 'Aus dem Deutschen: Екатеринбург, Оренбург.', en: 'From German: Екатеринбург, Оренбург.' }),
  // Place-name endings II
  combo('suf-ovo', '-ово', 'ovo', { de: 'Typische Dorf- und Stadtendung: Кемерово.', en: 'Typical village and town ending: Кемерово.' }),
  combo('suf-evo', '-ево', 'yevo', { de: 'Variante von -ово nach weichen Konsonanten.', en: 'Variant of -ово after soft consonants.' }),
  combo('suf-ino', '-ино', 'ino', { de: 'Sehr häufig bei Dörfern rund um Moskau.', en: 'Very common for villages around Moscow.' }),
  combo('suf-gorod', '-город', 'gorod', { de: '„Stadt“: Белгород, Новгород.', en: '“City”: Белгород, Новгород.' }),
  combo('suf-gorsk', '-горск', 'gorsk', { de: '„Berg-Stadt“: Магнитогорск, Пятигорск.', en: '“Mountain town”: Магнитогорск, Пятигорск.' }),
  combo('suf-pol', '-поль', 'pol', { de: 'Vom griechischen polis: Ставрополь.', en: 'From Greek polis: Ставрополь.' }),
];

const w = (
  slug: string,
  native: string,
  translit: string,
  de: string[],
  en: string[],
  extra?: string[],
): WordItem => ({ id: `ru:word:${slug}`, kind: 'word', native, translit, meaning: { de, en }, extra });

/** Short everyday words: decodable early and good for practising letters. */
export const WORDS: WordItem[] = [
  w('kot', 'кот', 'kot', ['Katze', 'Kater'], ['cat']),
  w('tam', 'там', 'tam', ['dort'], ['there']),
  w('mama', 'мама', 'mama', ['Mama'], ['mom', 'mum']),
  w('atom', 'атом', 'atom', ['Atom'], ['atom']),
  w('tok', 'ток', 'tok', ['Strom'], ['current']),
  w('mak', 'мак', 'mak', ['Mohn'], ['poppy']),
  w('nos', 'нос', 'nos', ['Nase'], ['nose']),
  w('sok', 'сок', 'sok', ['Saft'], ['juice']),
  w('net', 'нет', 'net', ['nein'], ['no']),
  w('tekst', 'текст', 'tekst', ['Text'], ['text']),
  w('restoran', 'ресторан', 'restoran', ['Restaurant'], ['restaurant']),
  w('ukho', 'ухо', 'ukho', ['Ohr'], ['ear']),
  w('vot', 'вот', 'vot', ['hier ist', 'da ist'], ['here is', 'there is']),
  w('khor', 'хор', 'khor', ['Chor'], ['choir']),
  w('dom', 'дом', 'dom', ['Haus'], ['house']),
  w('bank', 'банк', 'bank', ['Bank'], ['bank']),
  w('bar', 'бар', 'bar', ['Bar'], ['bar']),
  w('zona', 'зона', 'zona', ['Zone'], ['zone']),
  w('pivo', 'пиво', 'pivo', ['Bier'], ['beer']),
  w('kino', 'кино', 'kino', ['Kino'], ['cinema']),
  w('klub', 'клуб', 'klub', ['Klub', 'Club'], ['club']),
  w('pole', 'поле', 'pole', ['Feld'], ['field']),
  w('zhuk', 'жук', 'zhuk', ['Käfer'], ['beetle']),
  w('shapka', 'шапка', 'shapka', ['Mütze'], ['hat']),
  w('shchi', 'щи', 'shchi', ['Kohlsuppe'], ['cabbage soup']),
  w('chay', 'чай', 'chay', ['Tee'], ['tea']),
  w('tsirk', 'цирк', 'tsirk', ['Zirkus'], ['circus']),
  w('foto', 'фото', 'foto', ['Foto'], ['photo']),
  w('yabloko', 'яблоко', 'yabloko', ['Apfel'], ['apple']),
  w('yumor', 'юмор', 'yumor', ['Humor'], ['humour', 'humor']),
  w('ekho', 'эхо', 'ekho', ['Echo'], ['echo']),
  w('yozh', 'ёж', 'yozh', ['Igel'], ['hedgehog']),
  w('syr', 'сыр', 'syr', ['Käse'], ['cheese']),
  w('mysh', 'мышь', 'mysh', ['Maus'], ['mouse']),
  w('den', 'день', 'den', ['Tag'], ['day']),
];

const el = (slug: string, native: string, translit: string, de: string[], en: string[]): WordItem => ({
  id: `ru:element:${slug}`,
  kind: 'element',
  native,
  translit,
  meaning: { de, en },
  category: 'element',
});

/** Adjectives that appear in hundreds of place names (masculine form). */
export const ELEMENTS: WordItem[] = [
  el('novyy', 'Новый', 'novyy', ['neu', 'Neu-'], ['new']),
  el('staryy', 'Старый', 'staryy', ['alt', 'Alt-'], ['old']),
  el('verkhniy', 'Верхний', 'verkhniy', ['Ober-', 'oberer'], ['upper']),
  el('nizhniy', 'Нижний', 'nizhniy', ['Unter-', 'unterer', 'Nieder-'], ['lower']),
  el('bolshoy', 'Большой', 'bolshoy', ['groß', 'Groß-'], ['big', 'great']),
  el('malyy', 'Малый', 'malyy', ['klein', 'Klein-'], ['small', 'little']),
  el('krasnyy', 'Красный', 'krasnyy', ['rot', 'schön'], ['red', 'beautiful']),
  el('velikiy', 'Великий', 'velikiy', ['groß', 'Groß-'], ['great']),
];

const t = (
  slug: string,
  native: string,
  translit: string,
  category: TermCategory,
  de: string[],
  en: string[],
  abbr?: string[],
  extra?: string[],
): WordItem => ({ id: `ru:term:${slug}`, kind: 'term', native, translit, category, meaning: { de, en }, abbr, extra, countryIds: ['RU'] });

/** Words that appear on Russian road, place and direction signs. */
export const TERMS: WordItem[] = [
  // Streets & addresses
  t('ulitsa', 'улица', 'ulitsa', 'road', ['Straße'], ['street'], ['ул.']),
  t('prospekt', 'проспект', 'prospekt', 'road', ['Prospekt', 'Allee', 'Hauptstraße'], ['avenue', 'prospekt'], ['пр-т', 'просп.']),
  t('pereulok', 'переулок', 'pereulok', 'road', ['Gasse'], ['lane', 'alley'], ['пер.']),
  t('shosse', 'шоссе', 'shosse', 'road', ['Chaussee', 'Landstraße', 'Schnellstraße'], ['highway', 'road'], ['ш.']),
  t('ploshchad', 'площадь', 'ploshchad', 'road', ['Platz'], ['square'], ['пл.']),
  t('bulvar', 'бульвар', 'bulvar', 'road', ['Boulevard'], ['boulevard'], ['б-р']),
  t('naberezhnaya', 'набережная', 'naberezhnaya', 'road', ['Uferstraße', 'Ufer'], ['embankment', 'waterfront'], ['наб.']),
  t('proyezd', 'проезд', 'proyezd', 'road', ['Durchfahrt'], ['passage', 'drive']),
  t('tupik', 'тупик', 'tupik', 'road', ['Sackgasse'], ['dead end', 'cul de sac']),
  t('doroga', 'дорога', 'doroga', 'road', ['Straße', 'Weg'], ['road', 'way']),
  t('trassa', 'трасса', 'trassa', 'road', ['Fernstraße'], ['highway', 'motorway']),
  t('most', 'мост', 'most', 'road', ['Brücke'], ['bridge']),
  t('obyezd', 'объезд', 'obyezd', 'road', ['Umleitung'], ['detour', 'diversion']),
  // Settlements & administration
  t('gorod', 'город', 'gorod', 'settlement', ['Stadt'], ['city', 'town'], ['г.']),
  t('selo', 'село', 'selo', 'settlement', ['Dorf'], ['village'], ['с.']),
  t('derevnya', 'деревня', 'derevnya', 'settlement', ['Dorf'], ['village'], ['д.']),
  t('posyolok', 'посёлок', 'posyolok', 'settlement', ['Siedlung'], ['settlement'], ['пос.', 'п.'], ['poselok']),
  t('stanitsa', 'станица', 'stanitsa', 'settlement', ['Kosakendorf', 'Staniza'], ['cossack village', 'stanitsa'], ['ст-ца']),
  t('rayon', 'район', 'rayon', 'settlement', ['Bezirk', 'Rajon'], ['district'], ['р-н']),
  t('oblast', 'область', 'oblast', 'settlement', ['Oblast', 'Gebiet'], ['oblast', 'region', 'province'], ['обл.']),
  t('kray', 'край', 'kray', 'settlement', ['Region', 'Krai'], ['territory', 'krai', 'region']),
  t('respublika', 'республика', 'respublika', 'settlement', ['Republik'], ['republic'], ['респ.']),
  t('okrug', 'округ', 'okrug', 'settlement', ['Kreis', 'Bezirk'], ['district', 'okrug']),
  t('granitsa', 'граница', 'granitsa', 'settlement', ['Grenze'], ['border']),
  t('tsentr', 'центр', 'tsentr', 'settlement', ['Zentrum'], ['center', 'centre']),
  // Nature & directions
  t('reka', 'река', 'reka', 'nature', ['Fluss'], ['river'], ['р.']),
  t('ozero', 'озеро', 'ozero', 'nature', ['See'], ['lake'], ['оз.']),
  t('gora', 'гора', 'gora', 'nature', ['Berg'], ['mountain'], ['г.']),
  t('more', 'море', 'more', 'nature', ['Meer'], ['sea']),
  t('les', 'лес', 'les', 'nature', ['Wald'], ['forest', 'wood']),
  t('ostrov', 'остров', 'ostrov', 'nature', ['Insel'], ['island'], ['о.']),
  t('zaliv', 'залив', 'zaliv', 'nature', ['Bucht'], ['bay', 'gulf']),
  t('sever', 'север', 'sever', 'direction', ['Norden'], ['north']),
  t('yug', 'юг', 'yug', 'direction', ['Süden'], ['south']),
  t('vostok', 'восток', 'vostok', 'direction', ['Osten'], ['east']),
  t('zapad', 'запад', 'zapad', 'direction', ['Westen'], ['west']),
  // Transport & everyday signs
  t('vokzal', 'вокзал', 'vokzal', 'transport', ['Bahnhof'], ['railway station', 'station']),
  t('stantsiya', 'станция', 'stantsiya', 'transport', ['Station', 'Bahnstation'], ['station'], ['ст.']),
  t('aeroport', 'аэропорт', 'aeroport', 'transport', ['Flughafen'], ['airport']),
  t('avtovokzal', 'автовокзал', 'avtovokzal', 'transport', ['Busbahnhof'], ['bus station']),
  t('ostanovka', 'остановка', 'ostanovka', 'transport', ['Haltestelle'], ['stop', 'bus stop']),
  t('metro', 'метро', 'metro', 'transport', ['Metro', 'U-Bahn'], ['metro', 'subway', 'underground']),
  t('azs', 'АЗС', 'AZS', 'transport', ['Tankstelle'], ['gas station', 'petrol station', 'filling station']),
  t('magazin', 'магазин', 'magazin', 'everyday', ['Geschäft', 'Laden'], ['shop', 'store']),
  t('apteka', 'аптека', 'apteka', 'everyday', ['Apotheke'], ['pharmacy']),
  t('kafe', 'кафе', 'kafe', 'everyday', ['Café'], ['cafe']),
  t('gostinitsa', 'гостиница', 'gostinitsa', 'everyday', ['Hotel'], ['hotel']),
  t('bolnitsa', 'больница', 'bolnitsa', 'everyday', ['Krankenhaus'], ['hospital']),
  t('shkola', 'школа', 'shkola', 'everyday', ['Schule'], ['school']),
  t('pochta', 'почта', 'pochta', 'everyday', ['Post'], ['post office', 'post']),
  t('tserkov', 'церковь', 'tserkov', 'everyday', ['Kirche'], ['church']),
];
