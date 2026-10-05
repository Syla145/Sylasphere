import type { PlaceItem } from '../domain/types';

/** Attaches the generated label points to a course's places. */
export const withCoords = (places: PlaceItem[], coords: Record<string, [number, number]>): PlaceItem[] =>
  places.map((p) => (coords[p.id] ? { ...p, coords: coords[p.id] } : p));
