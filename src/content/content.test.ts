import { describe, expect, it } from 'vitest';
import { buildIndex } from '../domain/courseIndex';
import { accepts } from '../domain/evaluate';
import { normalize } from '../domain/normalize';
import type { CourseContent, PlaceItem } from '../domain/types';
import bn from './bn';
import el from './el';
import th from './th';
import ru from './ru';

/**
 * Content validation (spec section 14). These tests are the quality gate for
 * every course: they run in CI before each deployment.
 */
const courses = [ru, el, th, bn];

describe.each(courses)('course $id', (course) => {
  const index = buildIndex(course);

  it('has unique ids', () => {
    const ids = index.items.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('has 33 letters (Russian)', () => {
    if (course.id === 'ru') expect(course.letters).toHaveLength(33);
  });

  it('resolves every reference', () => {
    for (const l of course.lessons) {
      for (const id of [...l.newIds, ...(l.reviewIds ?? []), ...(l.wordIds ?? [])]) expect(index.byId.has(id), `${l.id} → ${id}`).toBe(true);
    }
    for (const s of course.contrastSets) for (const id of s.itemIds) expect(index.byId.has(id), `${s.id} → ${id}`).toBe(true);
    for (const p of course.places) if (p.regionId) expect(index.byId.has(p.regionId), `${p.id} → ${p.regionId}`).toBe(true);
  });

  it('teaches every letter exactly once in the lesson path', () => {
    const taught = course.lessons.filter((l) => l.type === 'letters').flatMap((l) => l.newIds);
    expect(new Set(taught).size).toBe(taught.length);
    expect(taught.sort()).toEqual(course.letters.map((l) => l.id).sort());
  });

  it('can decode every word and place with the course reading units', () => {
    for (const it of index.items) {
      for (const req of index.required.get(it.id) ?? []) expect(index.units.has(req), `${it.id} needs ${req}`).toBe(true);
    }
  });

  it('teaches every reading unit before the place lessons', () => {
    const taught = new Set(course.lessons.filter((l) => l.type === 'letters' || l.type === 'combos').flatMap((l) => l.newIds));
    for (const id of index.units) expect(taught.has(id), id).toBe(true);
  });

  it('accepts the stored transliteration of every word through the reading rules', () => {
    for (const w of course.words) expect(accepts(index, w, w.translit), `${w.id} ${w.translit}`).toBe(true);
    for (const c of course.combos) expect(accepts(index, c, c.reading), `${c.id} ${c.reading}`).toBe(true);
  });

  it('accepts the names and transliteration of every place', () => {
    for (const p of course.places) {
      for (const a of [p.names.de, p.names.en, p.translit, ...p.accepted]) expect(accepts(index, p, a), `${p.id} ${a}`).toBe(true);
    }
  });

  it('has no answer that identifies two places of the same layer', () => {
    // Districts are their own layer: "Dhaka" names both a division and a district.
    const layer = (p: PlaceItem) => (p.regionType === 'district' ? 'district' : p.kind);
    for (const l of ['city', 'region', 'district']) {
      const seen = new Map<string, string>();
      for (const p of course.places.filter((x) => layer(x) === l)) {
        for (const a of new Set([p.names.de, p.names.en, p.translit, ...p.accepted].map(normalize))) {
          expect(seen.get(a) ?? p.id, `"${a}" used by ${seen.get(a)} and ${p.id}`).toBe(p.id);
          seen.set(a, p.id);
        }
      }
    }
  });

  it('has 100 cities and German and English texts everywhere', () => {
    expect(course.places.filter((p) => p.kind === 'city')).toHaveLength(100);
    for (const l of course.letters) expect(l.mnemonic.de && l.mnemonic.en, l.id).toBeTruthy();
    for (const w of course.words) expect(w.meaning.de.length && w.meaning.en.length, w.id).toBeTruthy();
    for (const l of course.lessons) expect(l.title.de && l.title.en && l.goal.de && l.goal.en, l.id).toBeTruthy();
  });
});

describe('regions', () => {
  const regions = (c: CourseContent, type?: string) => c.places.filter((p) => p.kind === 'region' && (!type || p.regionType === type));
  it('covers every internationally recognised first-level region', () => {
    expect(regions(ru)).toHaveLength(83);
    expect(regions(el, 'periphery')).toHaveLength(13);
    expect(regions(th, 'province')).toHaveLength(77);
    expect(regions(bn, 'division')).toHaveLength(8);
    expect(regions(bn, 'district')).toHaveLength(64);
  });
  it('places every city in one of its country’s regions', () => {
    for (const c of courses) {
      const ids = new Set(regions(c).map((r) => r.id));
      for (const p of c.places) if (p.kind === 'city') expect(ids.has(p.regionId ?? ''), p.id).toBe(true);
    }
  });
});

describe('coordinates', () => {
  // Rough bounding boxes [south, west, north, east] – enough to catch swapped or wrong-country values.
  const BOX: Record<string, [number, number, number, number]> = {
    RU: [41, 19, 78, 180], GR: [34.7, 19.3, 41.8, 29.7], TH: [5.5, 97.3, 20.5, 105.7], BD: [20.5, 88, 26.7, 92.7],
  };
  it('gives every place a label point inside its country', () => {
    for (const c of courses) {
      for (const p of c.places) {
        expect(p.coords, p.id).toBeDefined();
        const [s, w, n, e] = BOX[p.countryId];
        const [lat, lon] = p.coords!;
        expect(lat >= s && lat <= n && lon >= w && lon <= e, `${p.id} ${lat},${lon}`).toBe(true);
      }
    }
  });
});
