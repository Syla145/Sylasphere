import { useState } from 'react';
import { COUNTRIES } from '../../content/registry';
import { masteryState } from '../../domain/srs';
import type { PlaceItem } from '../../domain/types';
import { placeNameLine, useLang, useT } from '../../i18n';
import { useProgress } from '../../store/progressStore';
import { ButtonLink, Card, StateDot } from '../../ui/primitives';
import { useCourse } from '../course/useCourse';
import { MapLabelToggle, useMapLabels } from './MapLabelToggle';
import { isWideMap, mapGroupOf, mapLayer } from './layer';
import { MapView } from './MapView';

const NO_ITEMS = {};

/** Explore the course map: labels in original or Latin script, tap an area for its names. */
export function MapPage() {
  const { meta, index } = useCourse();
  const t = useT();
  const lang = useLang();
  const labels = useMapLabels('mapLabels');
  const items = useProgress((s) => s.root.courses[meta.id]?.items) ?? NO_ITEMS;
  const [selected, setSelected] = useState<string | null>(null);
  if (!index.map) return null;

  const layer = mapLayer(index);
  const place = selected ? (index.byId.get(selected) as PlaceItem | undefined) : undefined;
  const group = selected ? mapGroupOf(index, selected) : undefined;
  const map = index.map;

  return (
    <div className="map-page">
      <header className="section-head">
        <h1 className="page-title">{t('map.title')}</h1>
        <p className="muted">{t('map.subtitle', { n: index.mapShapes.size, what: t(`map.what.${layer}`) })}</p>
      </header>
      <div className="map-page-tools">
        <MapLabelToggle which="mapLabels" />
        <ButtonLink to={`/${meta.slug}/practice/run?${mapPracticeQuery()}`}>{t(`map.practice.${layer}`)}</ButtonLink>
      </div>
      <div className={`map-page-body${isWideMap(index) ? ' is-wide' : ''}`}>
        <MapView
          index={index}
          label={t('map.label')}
          labels={labels}
          marks={selected ? { [selected]: 'selected' } : undefined}
          onPick={(id) => setSelected((s) => (s === id ? null : id))}
          zoomable
          className="map-explore"
        />
        <aside className="map-side">
          {place ? (
            <Card className="map-info">
              <span className={`glyph glyph-${Array.from(place.native).length > 12 ? 's' : 'm'} native`}>{place.native}</span>
              <p className="map-info-translit">{place.translit}</p>
              <p className="muted">{placeNameLine(place, lang)}</p>
              <dl className="fb-facts">
                {group && (
                  <div>
                    <dt>{t(`map.group.${layer}`)}</dt>
                    <dd>
                      {group.native && <span className="native">{group.native}</span>}
                      {group.native && group.name && ' · '}
                      {group.name?.[lang]}
                    </dd>
                  </div>
                )}
                <div>
                  <dt>{t('session.country')}</dt>
                  <dd>{COUNTRIES[place.countryId].name[lang]}</dd>
                </div>
                <div>
                  <dt>{t('map.state')}</dt>
                  <dd className="map-info-state">
                    <StateDot state={masteryState(items[place.id])} /> {t(`state.${masteryState(items[place.id])}`)}
                  </dd>
                </div>
              </dl>
            </Card>
          ) : (
            <p className="muted map-hint">{t('map.tapHint')}</p>
          )}
          <ul className="map-legend">
            {map.groups.map((g, i) => {
              const info = mapGroupOf(index, map.shapes.find((s) => s.group === g.id)!.id);
              return (
                <li key={g.id}>
                  <span className={`map-swatch map-tint-${i % 8}`} aria-hidden="true" />
                  <span className="native">{info?.native}</span>
                  <span className="muted">{info?.name?.[lang]}</span>
                  <span className="muted tabular">{map.shapes.filter((s) => s.group === g.id).length}</span>
                </li>
              );
            })}
          </ul>
          <p className="muted small map-source">
            {t('map.source')}{' '}
            <a href="https://www.geoboundaries.org" target="_blank" rel="noreferrer">
              geoBoundaries
            </a>{' '}
            (CC BY 4.0)
          </p>
        </aside>
      </div>
    </div>
  );
}

/** Practice only the map areas (districts, provinces, regions), smart selection over all of them. */
export function mapPracticeQuery(count = 20): string {
  return `c=regions&scope=all&weak=1&n=${count}&layer=map`;
}

/** Goal card on the dashboard: how many map areas are recognised reliably. */
export function MapGoal() {
  const { meta, index } = useCourse();
  const t = useT();
  const items = useProgress((s) => s.root.courses[meta.id]?.items) ?? NO_ITEMS;
  if (!index.map) return null;
  const layer = mapLayer(index);
  const ids = [...index.mapShapes.keys()];
  const sure = ids.filter((id) => ((items as Record<string, { box: number }>)[id]?.box ?? 0) >= 3).length;
  const seen = ids.filter((id) => (items as Record<string, unknown>)[id]).length;
  const base = `/${meta.slug}`;
  return (
    <Card className="goal-card">
      <h2 className="card-label">{t('map.goalTitle', { n: ids.length, what: t(`map.what.${layer}`) })}</h2>
      <div className="goal-bar" role="progressbar" aria-valuemin={0} aria-valuemax={ids.length} aria-valuenow={sure}>
        <div className="goal-bar-seen" style={{ width: `${(seen / ids.length) * 100}%` }} />
        <div className="goal-bar-sure" style={{ width: `${(sure / ids.length) * 100}%` }} />
      </div>
      <p className="muted small">{t('map.goalBody', { sure, seen })}</p>
      <div className="actions">
        <ButtonLink variant="primary" to={`${base}/practice/run?${mapPracticeQuery()}`}>
          {t(`map.practice.${layer}`)}
        </ButtonLink>
        <ButtonLink to={`${base}/map`}>{t('map.open')}</ButtonLink>
      </div>
    </Card>
  );
}
