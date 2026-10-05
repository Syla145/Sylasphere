import type { TermCategory, WordItem } from '../../domain/types';

const w = (slug: string, native: string, translit: string, de: string[], en: string[]): WordItem => ({
  id: `el:word:${slug}`,
  kind: 'word',
  native,
  translit,
  meaning: { de, en },
});

/** Everyday words, ordered roughly by when they become decodable. */
export const WORDS: WordItem[] = [
  w('kota', 'κότα', 'kota', ['Huhn'], ['hen', 'chicken']),
  w('tote', 'τότε', 'tote', ['dann', 'damals'], ['then']),
  w('kati', 'κάτι', 'kati', ['etwas'], ['something']),
  w('nero', 'νερό', 'nero', ['Wasser'], ['water']),
  w('treno', 'τρένο', 'treno', ['Zug'], ['train']),
  w('machi', 'μάχη', 'machi', ['Schlacht', 'Kampf'], ['battle']),
  w('zachari', 'ζάχαρη', 'zachari', ['Zucker'], ['sugar']),
  w('nychta', 'νύχτα', 'nychta', ['Nacht'], ['night']),
  w('gala', 'γάλα', 'gala', ['Milch'], ['milk']),
  w('spiti', 'σπίτι', 'spiti', ['Haus'], ['house', 'home']),
  w('portokali', 'πορτοκάλι', 'portokali', ['Orange'], ['orange']),
  w('kalimera', 'καλημέρα', 'kalimera', ['Guten Morgen'], ['good morning']),
  w('psomi', 'ψωμί', 'psomi', ['Brot'], ['bread']),
  w('fos', 'φως', 'fos', ['Licht'], ['light']),
  w('thea', 'θέα', 'thea', ['Aussicht'], ['view']),
  w('xenos', 'ξένος', 'xenos', ['fremd', 'Fremder'], ['foreign', 'stranger']),
  w('nai', 'ναι', 'nai', ['ja'], ['yes']),
  w('kai', 'και', 'kai', ['und'], ['and']),
  w('efcharisto', 'ευχαριστώ', 'efcharisto', ['danke'], ['thank you', 'thanks']),
  w('bira', 'μπύρα', 'bira', ['Bier'], ['beer']),
];

const el = (slug: string, native: string, translit: string, de: string[], en: string[]): WordItem => ({
  id: `el:element:${slug}`,
  kind: 'element',
  native,
  translit,
  meaning: { de, en },
  category: 'element',
});

/** Parts of countless Greek village and town names. */
export const ELEMENTS: WordItem[] = [
  el('agios', 'Άγιος', 'Agios', ['heilig', 'Sankt'], ['saint', 'holy']),
  el('agia', 'Αγία', 'Agia', ['heilige', 'Sankt'], ['saint', 'holy']),
  el('agioi', 'Άγιοι', 'Agioi', ['Heilige'], ['saints']),
  el('nea', 'Νέα', 'Nea', ['Neu-', 'neu'], ['new']),
  el('ano', 'Άνω', 'Ano', ['Ober-', 'oben'], ['upper']),
  el('kato', 'Κάτω', 'Kato', ['Unter-', 'unten'], ['lower']),
  el('palaia', 'Παλαιά', 'Palaia', ['Alt-', 'alt'], ['old']),
  el('megalo', 'Μεγάλο', 'Megalo', ['Groß-', 'groß'], ['big', 'great']),
];

const t = (slug: string, native: string, translit: string, category: TermCategory, de: string[], en: string[], abbr?: string[]): WordItem => ({
  id: `el:term:${slug}`,
  kind: 'term',
  native,
  translit,
  category,
  meaning: { de, en },
  abbr,
  countryIds: ['GR'],
});

/** Words from Greek road, place and shop signs. */
export const TERMS: WordItem[] = [
  // Streets & addresses
  t('odos', 'Οδός', 'Odos', 'road', ['Straße'], ['street', 'road'], ['Οδ.']),
  t('leoforos', 'Λεωφόρος', 'Leoforos', 'road', ['Allee', 'Boulevard', 'Hauptstraße'], ['avenue', 'boulevard'], ['Λεωφ.']),
  t('plateia', 'Πλατεία', 'Plateia', 'road', ['Platz'], ['square'], ['Πλ.']),
  t('gefyra', 'Γέφυρα', 'Gefyra', 'road', ['Brücke'], ['bridge']),
  t('dromos', 'Δρόμος', 'Dromos', 'road', ['Straße', 'Weg'], ['road', 'way']),
  t('ethniki-odos', 'Εθνική Οδός', 'Ethniki Odos', 'road', ['Nationalstraße'], ['national road', 'national highway']),
  t('komvos', 'Κόμβος', 'Komvos', 'road', ['Knotenpunkt', 'Kreuzung'], ['junction', 'interchange']),
  t('exodos', 'Έξοδος', 'Exodos', 'road', ['Ausfahrt', 'Ausgang'], ['exit']),
  // Settlements & administration
  t('dimos', 'Δήμος', 'Dimos', 'settlement', ['Gemeinde'], ['municipality']),
  t('perifereia', 'Περιφέρεια', 'Perifereia', 'settlement', ['Region'], ['region']),
  t('nomos', 'Νομός', 'Nomos', 'settlement', ['Präfektur', 'Bezirk'], ['prefecture']),
  t('poli', 'Πόλη', 'Poli', 'settlement', ['Stadt'], ['city', 'town']),
  t('chorio', 'Χωριό', 'Chorio', 'settlement', ['Dorf'], ['village']),
  t('kentro', 'Κέντρο', 'Kentro', 'settlement', ['Zentrum'], ['centre', 'center']),
  t('limani', 'Λιμάνι', 'Limani', 'settlement', ['Hafen'], ['port', 'harbour', 'harbor']),
  t('synora', 'Σύνορα', 'Synora', 'settlement', ['Grenze'], ['border']),
  // Nature & directions
  t('paralia', 'Παραλία', 'Paralia', 'nature', ['Strand'], ['beach']),
  t('nisi', 'Νησί', 'Nisi', 'nature', ['Insel'], ['island']),
  t('oros', 'Όρος', 'Oros', 'nature', ['Berg', 'Gebirge'], ['mountain']),
  t('limni', 'Λίμνη', 'Limni', 'nature', ['See'], ['lake']),
  t('potamos', 'Ποταμός', 'Potamos', 'nature', ['Fluss'], ['river']),
  t('thalassa', 'Θάλασσα', 'Thalassa', 'nature', ['Meer'], ['sea']),
  t('voreia', 'Βόρεια', 'Voreia', 'direction', ['Norden', 'nördlich'], ['north', 'northern']),
  t('notia', 'Νότια', 'Notia', 'direction', ['Süden', 'südlich'], ['south', 'southern']),
  t('anatolika', 'Ανατολικά', 'Anatolika', 'direction', ['Osten', 'östlich'], ['east', 'eastern']),
  t('dytika', 'Δυτικά', 'Dytika', 'direction', ['Westen', 'westlich'], ['west', 'western']),
  t('vouno', 'Βουνό', 'Vouno', 'nature', ['Berg'], ['mountain']),
  t('kolpos', 'Κόλπος', 'Kolpos', 'nature', ['Golf', 'Bucht'], ['gulf', 'bay']),
  // Transport & everyday
  t('aerodromio', 'Αεροδρόμιο', 'Aerodromio', 'transport', ['Flughafen'], ['airport']),
  t('stathmos', 'Σταθμός', 'Stathmos', 'transport', ['Bahnhof', 'Station'], ['station']),
  t('iera-moni', 'Ιερά Μονή', 'Iera Moni', 'everyday', ['Kloster'], ['monastery'], ['Ι.Μ.']),
  t('ekklisia', 'Εκκλησία', 'Ekklisia', 'everyday', ['Kirche'], ['church']),
  t('farmakeio', 'Φαρμακείο', 'Farmakeio', 'everyday', ['Apotheke'], ['pharmacy']),
  t('xenodocheio', 'Ξενοδοχείο', 'Xenodocheio', 'everyday', ['Hotel'], ['hotel']),
  t('taverna', 'Ταβέρνα', 'Taverna', 'everyday', ['Taverne'], ['tavern', 'taverna']),
  t('periptero', 'Περίπτερο', 'Periptero', 'everyday', ['Kiosk'], ['kiosk']),
  t('scholeio', 'Σχολείο', 'Scholeio', 'everyday', ['Schule'], ['school']),
  t('nosokomeio', 'Νοσοκομείο', 'Nosokomeio', 'everyday', ['Krankenhaus'], ['hospital']),
];
