import type { L10n, Lesson, PhaseDef, PlaceItem } from '../../domain/types';
import { letterId } from './translit';
import { CITIES } from './places';

export const PHASES: PhaseDef[] = [
  { id: 'easy', title: { de: 'Easy Wins', en: 'Easy Wins' } },
  { id: 'false-friends', title: { de: 'False Friends', en: 'False Friends' } },
  { id: 'shapes', title: { de: 'Neue Formen', en: 'New Shapes' } },
  { id: 'complex', title: { de: 'Komplexe Zeichen', en: 'Complex Letters' } },
  { id: 'combos', title: { de: 'Kombinationen', en: 'Combinations' } },
  { id: 'words', title: { de: 'Wörter', en: 'Words' } },
  { id: 'terms', title: { de: 'GeoGuessr-Begriffe', en: 'GeoGuessr Terms' } },
  { id: 'cities', title: { de: 'Ortsnamen', en: 'Place Names' } },
  { id: 'regions', title: { de: 'Regionen', en: 'Regions' } },
];

const L = (...slugs: string[]) => slugs.map(letterId);
const C = (...slugs: string[]) => slugs.map((s) => `ru:combo:${s}`);
const E = (...slugs: string[]) => slugs.map((s) => `ru:element:${s}`);
const T = (...slugs: string[]) => slugs.map((s) => `ru:term:${s}`);

const letterLessons: Omit<Lesson, 'number'>[] = [
  {
    id: 'ru-l01', phaseId: 'easy', type: 'letters',
    title: { de: 'Easy Wins', en: 'Easy Wins' },
    goal: { de: 'Fünf Buchstaben, die aussehen und klingen wie im Lateinischen.', en: 'Five letters that look and sound like Latin ones.' },
    newIds: L('a', 'o', 'k', 'm', 't'),
  },
  {
    id: 'ru-l02', phaseId: 'false-friends', type: 'letters',
    title: { de: 'False Friends I', en: 'False Friends I' },
    goal: { de: 'Р, С und Н sehen lateinisch aus, lesen sich aber anders. Danach sind Омск und Томск lesbar.', en: 'Р, С and Н look Latin but read differently. Afterwards you can read Омск and Томск.' },
    newIds: L('e', 'r', 's', 'n'),
  },
  {
    id: 'ru-l03', phaseId: 'false-friends', type: 'letters',
    title: { de: 'False Friends II', en: 'False Friends II' },
    goal: { de: 'В, У und Х – danach liest du Москва.', en: 'В, У and Х – afterwards you can read Москва.' },
    newIds: L('v', 'u', 'kh'),
  },
  {
    id: 'ru-l04', phaseId: 'shapes', type: 'letters',
    title: { de: 'Neue Formen I', en: 'New Shapes I' },
    goal: { de: 'Б, Г, Д und З öffnen -град und город.', en: 'Б, Г, Д and З unlock -град and город.' },
    newIds: L('b', 'g', 'd', 'z'),
  },
  {
    id: 'ru-l05', phaseId: 'shapes', type: 'letters',
    title: { de: 'Neue Formen II', en: 'New Shapes II' },
    goal: { de: 'П, Л, И und Й – sehr häufig auf Schildern.', en: 'П, Л, И and Й – very common on signs.' },
    newIds: L('p', 'l', 'i', 'y'),
  },
  {
    id: 'ru-l06', phaseId: 'complex', type: 'letters',
    title: { de: 'Zischlaute I', en: 'Sibilants I' },
    goal: { de: 'Ж, Ш und Щ als Familie – Ш und Щ unterscheidest du am Schwänzchen.', en: 'Ж, Ш and Щ as a family – tell Ш and Щ apart by the tail.' },
    newIds: L('zh', 'sh', 'shch'),
  },
  {
    id: 'ru-l07', phaseId: 'complex', type: 'letters',
    title: { de: 'Zischlaute II', en: 'Sibilants II' },
    goal: { de: 'Ц, Ч und Ф – danach liest du улица und центр.', en: 'Ц, Ч and Ф – afterwards you can read улица and центр.' },
    newIds: L('ts', 'ch', 'f'),
  },
  {
    id: 'ru-l08', phaseId: 'complex', type: 'letters',
    title: { de: 'Jot-Vokale', en: 'Y-Vowels' },
    goal: { de: 'Я, Ю, Э und Ё: „y + Vokal“ und das seltene Э.', en: 'Я, Ю, Э and Ё: “y + vowel” and the rare Э.' },
    newIds: L('ya', 'yu', 'eh', 'yo'),
  },
  {
    id: 'ru-l09', phaseId: 'complex', type: 'letters',
    title: { de: 'Sonderzeichen', en: 'Special Signs' },
    goal: { de: 'Ы, Ь und Ъ – danach ist das ganze Alphabet lesbar.', en: 'Ы, Ь and Ъ – afterwards the whole alphabet is readable.' },
    newIds: L('yery', 'soft', 'hard'),
  },
  {
    id: 'ru-l10', phaseId: 'combos', type: 'review',
    title: { de: 'Kleinbuchstaben-Fallen', en: 'Lowercase Traps' },
    goal: { de: 'Auf Schildern dominiert Kleinschrift: н, п, т, в, и, б, д sehen anders aus als groß.', en: 'Signs are mostly lowercase: н, п, т, в, и, б, д look different from their capitals.' },
    newIds: [],
    reviewIds: L('n', 'p', 't', 'v', 'i', 'b', 'd', 'g', 'l', 'soft'),
    lowercase: true,
  },
  {
    id: 'ru-l11', phaseId: 'combos', type: 'combos',
    title: { de: 'Ortsnamen-Endungen I', en: 'Place-Name Endings I' },
    goal: { de: 'Endungen verraten den Ortstyp und machen lange Namen schnell lesbar.', en: 'Endings reveal the type of place and make long names quick to read.' },
    newIds: C('suf-sk', 'suf-skiy', 'suf-skaya', 'suf-skoye', 'suf-grad', 'suf-burg'),
  },
  {
    id: 'ru-l12', phaseId: 'combos', type: 'combos',
    title: { de: 'Ortsnamen-Endungen II', en: 'Place-Name Endings II' },
    goal: { de: 'Dorf- und Stadtendungen: -ово, -ево, -ино, -город, -горск, -поль.', en: 'Village and town endings: -ово, -ево, -ино, -город, -горск, -поль.' },
    newIds: C('suf-ovo', 'suf-evo', 'suf-ino', 'suf-gorod', 'suf-gorsk', 'suf-pol'),
  },
  {
    id: 'ru-l13', phaseId: 'words', type: 'vocab',
    title: { de: 'Ortsnamen-Bausteine', en: 'Place-Name Building Blocks' },
    goal: { de: 'Neu, alt, ober, unter, groß, klein – stecken in hunderten Ortsnamen.', en: 'New, old, upper, lower, big, small – found in hundreds of place names.' },
    newIds: E('novyy', 'staryy', 'verkhniy', 'nizhniy', 'bolshoy', 'malyy', 'krasnyy', 'velikiy'),
  },
  {
    id: 'ru-l14', phaseId: 'terms', type: 'vocab',
    title: { de: 'Straße & Adresse', en: 'Streets & Addresses' },
    goal: { de: 'Die Wörter auf Straßenschildern.', en: 'The words on street signs.' },
    newIds: T('ulitsa', 'prospekt', 'pereulok', 'shosse', 'ploshchad', 'most', 'doroga', 'trassa'),
  },
  {
    id: 'ru-l15', phaseId: 'terms', type: 'vocab',
    title: { de: 'Siedlung & Verwaltung', en: 'Settlements & Administration' },
    goal: { de: 'Ortsschilder und Wegweiser: Stadt, Dorf, Bezirk, Oblast.', en: 'Place and direction signs: town, village, district, oblast.' },
    newIds: T('gorod', 'selo', 'derevnya', 'posyolok', 'rayon', 'oblast', 'kray', 'respublika'),
  },
  {
    id: 'ru-l16', phaseId: 'terms', type: 'vocab',
    title: { de: 'Natur & Richtungen', en: 'Nature & Directions' },
    goal: { de: 'Flüsse, Seen, Berge und die vier Himmelsrichtungen.', en: 'Rivers, lakes, mountains and the four directions.' },
    newIds: T('reka', 'ozero', 'gora', 'more', 'sever', 'yug', 'vostok', 'zapad'),
  },
  {
    id: 'ru-l17', phaseId: 'terms', type: 'vocab',
    title: { de: 'Verkehr & Alltag', en: 'Transport & Everyday' },
    goal: { de: 'Bahnhof, Flughafen, Tankstelle – und was sonst am Straßenrand steht.', en: 'Station, airport, petrol station – and what else lines the road.' },
    newIds: T('vokzal', 'stantsiya', 'aeroport', 'avtovokzal', 'azs', 'magazin', 'apteka', 'tsentr'),
  },
];

/** Cities and regions follow tier order, in chunks of 8–9 per lesson. */
function chunk<T>(list: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  // merge a tiny tail into the previous chunk
  if (out.length > 1 && out[out.length - 1].length < 4) {
    const tail = out.pop()!;
    out[out.length - 1].push(...tail);
  }
  return out;
}

const byTier = (list: PlaceItem[]) => [...list].sort((a, b) => a.tier - b.tier);


const cityLessons: Omit<Lesson, 'number'>[] = chunk(byTier(CITIES), 9).map((group, i) => ({
  id: `ru-city-${i + 1}`,
  phaseId: 'cities',
  type: 'places',
  title: { de: `Städte ${i + 1}`, en: `Cities ${i + 1}` },
  goal: {
    de: i === 0 ? 'Die wichtigsten Städte Russlands erkennen.' : 'Weitere Städte, die auf Wegweisern auftauchen.',
    en: i === 0 ? 'Recognise Russia’s most important cities.' : 'More cities that appear on direction signs.',
  },
  newIds: group.map((p) => p.id),
}));

/**
 * Regions are taught on the map, federal district by federal district, so
 * neighbours are learned together. The type word (oblast, krai) is optional.
 */
const REGION_GROUPS: { title: L10n; slugs: string[] }[] = [
  { title: { de: 'Moskau & Goldener Ring', en: 'Moscow & the Golden Ring' }, slugs: ['moskva', 'moskovskaya', 'tverskaya', 'yaroslavskaya', 'vladimirskaya', 'ivanovskaya', 'kostromskaya', 'ryazanskaya', 'tulskaya'] },
  { title: { de: 'Zentralrussland: Westen & Süden', en: 'Central Russia: West & South' }, slugs: ['smolenskaya', 'kaluzhskaya', 'bryanskaya', 'orlovskaya', 'kurskaya', 'belgorodskaya', 'voronezhskaya', 'lipetskaya', 'tambovskaya'] },
  { title: { de: 'Nordwesten: St. Petersburg bis Kaliningrad', en: 'Northwest: St Petersburg to Kaliningrad' }, slugs: ['sankt-peterburg', 'leningradskaya', 'novgorodskaya', 'pskovskaya', 'kaliningradskaya', 'karelia'] },
  { title: { de: 'Der hohe Norden', en: 'The Far North' }, slugs: ['murmanskaya', 'arkhangelskaya', 'nenetsky', 'komi', 'vologodskaya'] },
  { title: { de: 'Südrussland', en: 'Southern Russia' }, slugs: ['krasnodarsky', 'adygea', 'rostovskaya', 'volgogradskaya', 'astrakhanskaya', 'kalmykia'] },
  { title: { de: 'Nordkaukasus', en: 'North Caucasus' }, slugs: ['stavropolsky', 'karachay-cherkessia', 'kabardino-balkaria', 'north-ossetia', 'ingushetia', 'chechnya', 'dagestan'] },
  { title: { de: 'Wolga: Nischni Nowgorod bis Kasan', en: 'Volga: Nizhny Novgorod to Kazan' }, slugs: ['nizhegorodskaya', 'chuvashia', 'mari-el', 'mordovia', 'penzenskaya', 'ulyanovskaya', 'tatarstan'] },
  { title: { de: 'Wolga & Vorural', en: 'Volga & the Cis-Urals' }, slugs: ['samarskaya', 'saratovskaya', 'orenburgskaya', 'bashkortostan', 'udmurtia', 'permsky', 'kirovskaya'] },
  { title: { de: 'Ural', en: 'Urals' }, slugs: ['sverdlovskaya', 'chelyabinskaya', 'kurganskaya', 'tyumenskaya', 'khanty-mansiysky', 'yamalo-nenetsky'] },
  { title: { de: 'Westsibirien', en: 'Western Siberia' }, slugs: ['omskaya', 'novosibirskaya', 'tomskaya', 'kemerovskaya', 'altaysky'] },
  { title: { de: 'Südsibirien & Krasnojarsk', en: 'Southern Siberia & Krasnoyarsk' }, slugs: ['altai-republic', 'khakassia', 'tuva', 'krasnoyarsky', 'irkutskaya'] },
  { title: { de: 'Ferner Osten: Baikal bis Pazifik', en: 'Far East: Baikal to the Pacific' }, slugs: ['buryatia', 'zabaykalsky', 'amurskaya', 'yevreyskaya', 'khabarovsky', 'primorsky'] },
  { title: { de: 'Ferner Osten: Jakutien bis Tschukotka', en: 'Far East: Yakutia to Chukotka' }, slugs: ['sakha', 'magadanskaya', 'chukotsky', 'kamchatsky', 'sakhalinskaya'] },
];

const regionLessons: Omit<Lesson, 'number'>[] = REGION_GROUPS.map((g, i) => ({
  id: `ru-region-${i + 1}`,
  phaseId: 'regions',
  type: 'places',
  title: g.title,
  goal: {
    de: `${g.slugs.length} Regionen lesen und auf der Karte finden. Das Typwort (Oblast, Krai) ist optional.`,
    en: `Read ${g.slugs.length} regions and find them on the map. The type word (oblast, krai) is optional.`,
  },
  newIds: g.slugs.map((s) => `ru:region:${s}`),
}));

export const LESSONS: Lesson[] = [...letterLessons, ...cityLessons, ...regionLessons].map((l, i) => ({ ...l, number: i + 1 }));
