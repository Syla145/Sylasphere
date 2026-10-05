import { useEffect, useRef } from 'react';
import { COUNTRIES } from '../../content/registry';
import { readingOf, type CourseIndex } from '../../domain/courseIndex';
import type { PlaceItem } from '../../domain/types';
import { placeNameLine, useLang, useT } from '../../i18n';
import { Button } from '../../ui/primitives';
import { mapGroupOf } from '../map/layer';
import { MapView } from '../map/MapView';

/** First contact with an item: a learning card. Enter continues. */
export function IntroCard({ index, itemId, onNext }: { index: CourseIndex; itemId: string; lower?: boolean; onNext: () => void }) {
  const t = useT();
  const lang = useLang();
  const btn = useRef<HTMLButtonElement>(null);
  const item = index.byId.get(itemId);
  useEffect(() => btn.current?.focus({ preventScroll: true }), []);
  if (!item) return null;

  return (
    <div className="intro">
      <div className="intro-badges">
        <span className="badge badge-accent">{t('session.new')}</span>
        {item.kind === 'letter' && item.falseFriend && <span className="badge badge-warn">{t('session.falseFriend')}</span>}
      </div>

      {item.kind === 'letter' && (
        <>
          <div className="plate plate-intro">
            <span className="glyph glyph-xl">{item.upper}</span>
            {item.lower !== item.upper && <span className="glyph glyph-l intro-lower">{item.lower}</span>}
          </div>
          <p className="intro-reading">
            <span className="muted">{t('session.reads')}</span> <strong>{item.reading || t('session.noSound')}</strong>
          </p>
          <p className="intro-text">{item.mnemonic[lang]}</p>
          {item.note && <p className="intro-text muted">{item.note[lang]}</p>}
        </>
      )}

      {item.kind === 'combo' && (
        <>
          <div className="plate plate-intro">
            <span className="glyph glyph-l">{item.native}</span>
          </div>
          <p className="intro-reading">
            <span className="muted">{t('session.reads')}</span> <strong>{item.reading}</strong>
          </p>
          {item.note && <p className="intro-text">{item.note[lang]}</p>}
        </>
      )}

      {(item.kind === 'word' || item.kind === 'term' || item.kind === 'element') && (
        <>
          <div className="plate plate-intro">
            <span className={`glyph glyph-${item.native.length > 9 ? 'm' : 'l'}`}>{item.native}</span>
          </div>
          <p className="intro-reading">
            <span className="muted">{t('session.reads')}</span> <strong>{readingOf(index, item)}</strong>
          </p>
          <p className="intro-names">{item.meaning[lang][0]}</p>
          {item.abbr && (
            <p className="intro-text muted">
              {t('session.abbr')}: <span className="native">{item.abbr.join('  ')}</span>
            </p>
          )}
        </>
      )}

      {(item.kind === 'city' || item.kind === 'region') && <PlaceIntro place={item} />}

      <Button ref={btn} variant="primary" className="intro-next" onClick={onNext}>
        {t('session.gotIt')}
        <kbd>{t('session.enterHint')}</kbd>
      </Button>
    </div>
  );

  function PlaceIntro({ place }: { place: PlaceItem }) {
    const group = index.mapShapes.has(place.id) ? mapGroupOf(index, place.id) : undefined;
    return (
      <>
        <div className="plate plate-intro">
          <span className={`glyph glyph-${place.native.length > 14 ? 's' : place.native.length > 9 ? 'm' : 'l'}`}>{place.native}</span>
        </div>
        <p className="intro-reading">
          <span className="muted">{t('session.transliteration')}</span> <strong>{place.translit}</strong>
        </p>
        <p className="intro-names">{placeNameLine(place, lang)}</p>
        <p className="intro-text muted">
          {COUNTRIES[place.countryId].name[lang]}
          {group?.name ? ` · ${group.name[lang]}` : ''}
          {place.hint ? ` · ${place.hint[lang]}` : ''}
        </p>
        {index.map && index.mapShapes.has(place.id) && (
          <MapView index={index} label={t('map.label')} marks={{ [place.id]: 'target' }} focus={[place.id]} minFrame={0.6} className="map-intro" />
        )}
      </>
    );
  }
}
