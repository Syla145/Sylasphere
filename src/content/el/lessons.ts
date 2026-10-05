import type { Lesson, PhaseDef, PlaceItem } from '../../domain/types';
import { CITIES, REGIONS } from './places';
import { comboId, letterId } from './translit';

export const PHASES: PhaseDef[] = [
  { id: 'easy', title: { de: 'Easy Wins', en: 'Easy Wins' } },
  { id: 'false-friends', title: { de: 'False Friends', en: 'False Friends' } },
  { id: 'shapes', title: { de: 'Neue Formen', en: 'New Shapes' } },
  { id: 'pairs', title: { de: 'Buchstabenpaare', en: 'Letter Pairs' } },
  { id: 'words', title: { de: 'Schreibweisen & Wörter', en: 'Spellings & Words' } },
  { id: 'terms', title: { de: 'GeoGuessr-Begriffe', en: 'GeoGuessr Terms' } },
  { id: 'cities', title: { de: 'Ortsnamen', en: 'Place Names' } },
  { id: 'regions', title: { de: 'Regionen & Inseln', en: 'Regions & Islands' } },
];

const L = (...s: string[]) => s.map(letterId);
const C = (...s: string[]) => s.map(comboId);
const E = (...s: string[]) => s.map((x) => `el:element:${x}`);
const T = (...s: string[]) => s.map((x) => `el:term:${x}`);

const core: Omit<Lesson, 'number'>[] = [
  {
    id: 'el-l01', phaseId: 'easy', type: 'letters',
    title: { de: 'Easy Wins', en: 'Easy Wins' },
    goal: { de: 'Sechs Buchstaben, die du schon kennst – aus dem Alphabet oder der Mathematik.', en: 'Six letters you already know – from the Latin alphabet or from maths.' },
    newIds: L('alpha', 'epsilon', 'iota', 'kappa', 'omicron', 'tau'),
  },
  {
    id: 'el-l02', phaseId: 'false-friends', type: 'letters',
    title: { de: 'False Friends I', en: 'False Friends I' },
    goal: { de: 'Η, Ρ, Ν und Β sehen vertraut aus und lesen sich anders. Danach liest du Κατερίνη.', en: 'Η, Ρ, Ν and Β look familiar but read differently. Afterwards you can read Κατερίνη.' },
    newIds: L('eta', 'rho', 'nu', 'beta'),
  },
  {
    id: 'el-l03', phaseId: 'false-friends', type: 'letters',
    title: { de: 'False Friends II', en: 'False Friends II' },
    goal: { de: 'Υ, Χ, Μ und Ζ – vor allem die Kleinbuchstaben täuschen. Danach liest du Χανιά.', en: 'Υ, Χ, Μ and Ζ – the lowercase forms are the trap. Afterwards you can read Χανιά.' },
    newIds: L('upsilon', 'chi', 'mu', 'zeta'),
  },
  {
    id: 'el-l04', phaseId: 'shapes', type: 'letters',
    title: { de: 'Neue Formen I', en: 'New Shapes I' },
    goal: { de: 'Γ, Δ, Λ, Π und Σ – danach sind Πάτρα, Βόλος und Λάρισα lesbar.', en: 'Γ, Δ, Λ, Π and Σ – afterwards Πάτρα, Βόλος and Λάρισα are readable.' },
    newIds: L('gamma', 'delta', 'lambda', 'pi', 'sigma'),
  },
  {
    id: 'el-l05', phaseId: 'shapes', type: 'letters',
    title: { de: 'Neue Formen II', en: 'New Shapes II' },
    goal: { de: 'Θ, Φ, Ψ, Ξ und Ω – danach ist das ganze Alphabet da. Αθήνα und Θεσσαλονίκη werden lesbar.', en: 'Θ, Φ, Ψ, Ξ and Ω – the alphabet is complete. Αθήνα and Θεσσαλονίκη become readable.' },
    newIds: L('theta', 'phi', 'psi', 'xi', 'omega'),
  },
  {
    id: 'el-l06', phaseId: 'pairs', type: 'combos',
    title: { de: 'Vokalpaare', en: 'Vowel Pairs' },
    goal: { de: 'αι, ει, οι und ου werden als Einheit gelesen. Ohne sie bleiben viele Ortsnamen falsch.', en: 'αι, ει, οι and ου are read as one unit. Without them many place names come out wrong.' },
    newIds: C('ai', 'ei', 'oi', 'ou'),
  },
  {
    id: 'el-l07', phaseId: 'pairs', type: 'combos',
    title: { de: 'Konsonantenpaare', en: 'Consonant Pairs' },
    goal: { de: 'αυ, ευ, μπ, ντ, γκ und γγ – danach liest du Λευκάδα und Ναύπλιο.', en: 'αυ, ευ, μπ, ντ, γκ and γγ – afterwards you can read Λευκάδα and Ναύπλιο.' },
    newIds: C('av', 'ev', 'mp', 'nt', 'gk', 'gg'),
  },
  {
    id: 'el-l08', phaseId: 'words', type: 'review',
    title: { de: 'Kleinschrift & Großschrift', en: 'Lowercase & Capitals' },
    goal: { de: 'Kleinbuchstaben-Fallen wie η, ν, υ, ω – und Wörter in Großschrift ohne Akzente, wie auf vielen Schildern.', en: 'Lowercase traps like η, ν, υ, ω – and words in capitals without accents, as on many signs.' },
    newIds: [],
    reviewIds: L('eta', 'nu', 'rho', 'upsilon', 'omega', 'mu', 'chi', 'beta', 'gamma', 'sigma'),
    lowercase: true,
    capsWords: true,
  },
  {
    id: 'el-l09', phaseId: 'words', type: 'vocab',
    title: { de: 'Ortsnamen-Bausteine', en: 'Place-Name Building Blocks' },
    goal: { de: 'Άγιος, Νέα, Άνω, Κάτω – stecken in tausenden Dorfnamen.', en: 'Άγιος, Νέα, Άνω, Κάτω – found in thousands of village names.' },
    newIds: E('agios', 'agia', 'agioi', 'nea', 'ano', 'kato', 'palaia', 'megalo'),
  },
  {
    id: 'el-l10', phaseId: 'terms', type: 'vocab',
    title: { de: 'Straße & Verkehr', en: 'Streets & Roads' },
    goal: { de: 'Οδός, Λεωφόρος, Πλατεία – die Wörter auf Straßenschildern.', en: 'Οδός, Λεωφόρος, Πλατεία – the words on street signs.' },
    newIds: T('odos', 'leoforos', 'plateia', 'gefyra', 'dromos', 'ethniki-odos', 'komvos', 'exodos'),
  },
  {
    id: 'el-l11', phaseId: 'terms', type: 'vocab',
    title: { de: 'Ort & Verwaltung', en: 'Places & Administration' },
    goal: { de: 'Δήμος steht auf fast jedem Ortsschild.', en: 'Δήμος appears on almost every place sign.' },
    newIds: T('dimos', 'perifereia', 'nomos', 'poli', 'chorio', 'kentro', 'limani', 'synora'),
  },
  {
    id: 'el-l12', phaseId: 'terms', type: 'vocab',
    title: { de: 'Natur & Richtungen', en: 'Nature & Directions' },
    goal: { de: 'Strand, Insel, Berg, See – und Norden und Süden.', en: 'Beach, island, mountain, lake – and north and south.' },
    newIds: T('paralia', 'nisi', 'oros', 'limni', 'potamos', 'thalassa', 'voreia', 'notia'),
  },
  {
    id: 'el-l13', phaseId: 'terms', type: 'vocab',
    title: { de: 'Am Straßenrand', en: 'By the Roadside' },
    goal: { de: 'Flughafen, Kloster, Apotheke, Περίπτερο – was man auf Street View ständig sieht.', en: 'Airport, monastery, pharmacy, Περίπτερο – what you keep seeing on Street View.' },
    newIds: T('aerodromio', 'stathmos', 'iera-moni', 'ekklisia', 'farmakeio', 'xenodocheio', 'taverna', 'periptero'),
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
  id: `el-city-${i + 1}`,
  phaseId: 'cities',
  type: 'places',
  title: { de: `Städte ${i + 1}`, en: `Cities ${i + 1}` },
  goal: {
    de: i === 0 ? 'Die wichtigsten Städte Griechenlands.' : 'Weitere Städte von griechischen Wegweisern.',
    en: i === 0 ? 'The most important cities of Greece.' : 'More cities from Greek direction signs.',
  },
  newIds: group.map((p) => p.id),
}));

const regionLessons: Omit<Lesson, 'number'>[] = chunk(byTier(REGIONS), 9).map((group, i) => ({
  id: `el-region-${i + 1}`,
  phaseId: 'regions',
  type: 'places',
  title: { de: `Regionen & Inseln ${i + 1}`, en: `Regions & Islands ${i + 1}` },
  goal: {
    de: 'Die 13 Regionen Griechenlands und die großen Inseln.',
    en: 'Greece’s 13 regions and the large islands.',
  },
  newIds: group.map((p) => p.id),
}));

export const LESSONS: Lesson[] = [...core, ...cityLessons, ...regionLessons].map((l, i) => ({ ...l, number: i + 1 }));
