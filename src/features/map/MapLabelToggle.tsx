import type { MapLabels } from '../../domain/progress';
import { useT } from '../../i18n';
import { useProgress } from '../../store/progressStore';

const OPTIONS: MapLabels[] = ['none', 'latin', 'native'];

/** Segmented control for map labels; `which` selects the explore map or map tasks. */
export function MapLabelToggle({ which, compact = false }: { which: 'mapLabels' | 'taskMapLabels'; compact?: boolean }) {
  const t = useT();
  const value = useMapLabels(which);
  const set = useProgress((s) => s.setMapLabels);
  const text = (o: MapLabels) => (o === 'none' ? t('map.labelsNone') : o === 'latin' ? t('map.labelsLatin') : compact ? t('map.labelsNativeShort') : t('map.labelsNative'));
  return (
    <div className="ltoggle" role="radiogroup" aria-label={t('map.labels')}>
      {!compact && <span className="ltoggle-label">{t('map.labels')}</span>}
      {OPTIONS.map((o) => (
        <button key={o} type="button" role="radio" aria-checked={value === o} className={`ltoggle-btn${value === o ? ' is-on' : ''}`} onClick={() => set(which, o)}>
          {text(o)}
        </button>
      ))}
    </div>
  );
}

export function useMapLabels(which: 'mapLabels' | 'taskMapLabels'): MapLabels {
  return useProgress((s) => s.root.settings[which]) ?? (which === 'mapLabels' ? 'native' : 'none');
}
