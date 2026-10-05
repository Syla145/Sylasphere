import type { CourseIndex } from '../../domain/courseIndex';
import type { Item, L10n } from '../../domain/types';

/** What the clickable areas of a map are called: districts (BD), provinces (TH) or regions (RU). */
export type MapLayer = 'district' | 'province' | 'region';

export function layerOfItem(item: Item | undefined): MapLayer {
  if (item?.kind === 'region' && item.regionType === 'district') return 'district';
  if (item?.kind === 'region' && item.regionType === 'province') return 'province';
  return 'region';
}

export function mapLayer(index: CourseIndex): MapLayer {
  const first = index.mapShapes.keys().next().value;
  return layerOfItem(first ? index.byId.get(first) : undefined);
}

/** The parent area of a map area (division, federal district, region of Thailand). */
export function mapGroupOf(index: CourseIndex, id: string): { native?: string; name?: L10n } | undefined {
  const groupId = index.mapShapes.get(id)?.group;
  if (!groupId) return undefined;
  const item = index.byId.get(groupId);
  if (item && item.kind === 'region') return { native: item.core ?? item.native, name: item.names };
  const meta = index.map?.groups.find((g) => g.id === groupId);
  return meta ? { native: meta.native, name: meta.name } : undefined;
}

/** Wide maps (Russia) get a wider session layout. */
export const isWideMap = (index: CourseIndex) => !!index.map && index.map.width > index.map.height * 1.2;
