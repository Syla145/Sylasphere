import { describe, expect, it } from 'vitest';
import { buildIndex } from '../../domain/courseIndex';
import { accepts } from '../../domain/evaluate';
import { signCaps } from '../../domain/taskFactory';
import el from './index';

const index = buildIndex(el);
const ok = (id: string, answer: string) => accepts(index, index.byId.get(id)!, answer);

describe('Greek reading rules (ELOT 743 + phonetic)', () => {
  it('accepts German, English and transliteration for places', () => {
    for (const a of ['Athina', 'Athens', 'Athen']) expect(ok('el:city:athina', a)).toBe(true);
    for (const a of ['Irakleio', 'Iraklio', 'Heraklion']) expect(ok('el:city:irakleio', a)).toBe(true);
    for (const a of ['Kerkyra', 'Corfu', 'Korfu']) expect(ok('el:city:kerkyra', a)).toBe(true);
    for (const a of ['Peiraias', 'Pireas', 'Piraeus', 'Piräus']) expect(ok('el:city:peiraias', a)).toBe(true);
  });
  it('reads digraphs as units, never letter by letter', () => {
    expect(ok('el:city:lefkada', 'Leukada')).toBe(false);
    expect(ok('el:city:nafplio', 'Nafplio')).toBe(true);
    expect(ok('el:city:nafplio', 'Nauplio')).toBe(false);
    expect(ok('el:word:efcharisto', 'efcharisto')).toBe(true);
    expect(ok('el:word:efcharisto', 'eucharisto')).toBe(false);
    expect(ok('el:word:bira', 'bira')).toBe(true);
    expect(ok('el:word:bira', 'mpyra')).toBe(true);
    expect(ok('el:term:kentro', 'kentro')).toBe(true);
  });
  it('rejects false-friend readings', () => {
    expect(ok('el:city:volos', 'Bolos')).toBe(false);
    expect(ok('el:city:katerini', 'Katepinh')).toBe(false);
    expect(ok('el:letter:eta', 'h')).toBe(false);
    expect(ok('el:letter:rho', 'p')).toBe(false);
  });
  it('makes Ηράκλειο need the ει unit to be decodable', () => {
    expect(index.required.get('el:city:irakleio')).toContain('el:combo:ei');
    expect(index.required.get('el:city:katerini')).not.toContain('el:combo:ei');
  });
  it('writes sign capitals without accents', () => {
    expect(signCaps('Αθήνα')).toBe('ΑΘΗΝΑ');
    expect(signCaps('Ηράκλειο')).toBe('ΗΡΑΚΛΕΙΟ');
    expect(signCaps('Нижний')).toBe('НИЖНИЙ');
  });
});
