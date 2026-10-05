import { letterGlyphs } from '../../domain/courseIndex';
import { useState } from 'react';
import { masteryState } from '../../domain/srs';
import type { LetterItem } from '../../domain/types';
import { useLang, useT } from '../../i18n';
import { useProgress } from '../../store/progressStore';
import { Modal, StateDot } from '../../ui/primitives';
import { useCourse } from '../course/useCourse';

/** Stable fallback: a fresh `{}` inside the selector would re-render forever. */
const NO_ITEMS = {};

/** All reading units with reading and mastery – also a quick reference while playing. */
export function ScriptPage() {
  const { meta, index } = useCourse();
  const t = useT();
  const lang = useLang();
  const items = useProgress((s) => s.root.courses[meta.id]?.items) ?? NO_ITEMS;
  const [open, setOpen] = useState<LetterItem | null>(null);
  // Alphabetical order here (the lesson path teaches in didactic order). Scripts
  // without case (Thai, Bengali) list their units in traditional order already.
  const letters = index.content.hasCase
    ? [...index.content.letters].sort((a, b) => a.upper.localeCompare(b.upper, index.content.id))
    : index.content.letters;
  const endings = index.content.combos.filter((c) => c.native.startsWith('-'));
  const pairs = index.content.combos.filter((c) => c.unit);
  const plain = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f\u25cc]/g, '').toLowerCase();

  const examples = (l: LetterItem) =>
    [...index.byKind.city, ...index.byKind.term]
      .filter((it) => it.kind !== 'letter' && 'native' in it && plain(it.native).includes(plain(l.lower)))
      .slice(0, 4);

  return (
    <div className="script-page">
      <header className="section-head">
        <h1 className="page-title">{t('script.title')}</h1>
        <p className="muted">{t('script.subtitle')}</p>
      </header>
      <div className="letter-grid">
        {letters.map((l) => (
          <button key={l.id} type="button" className="letter-tile" onClick={() => setOpen(l)}>
            <span className={`glyph letter-tile-glyph${[...l.upper].length > 4 ? ' letter-tile-glyph--long' : ''}`}>
              {l.upper}
              {l.lower !== l.upper && <span className="letter-tile-lower">{l.lower}</span>}
            </span>
            <span className="letter-tile-reading">{l.reading || '–'}</span>
            <StateDot state={masteryState(items[l.id])} />
          </button>
        ))}
      </div>

      {pairs.length > 0 && (
        <>
          <h2 className="section-label">{t('script.pairs')}</h2>
          <div className="ending-list">
            {pairs.map((c) => (
              <div key={c.id} className="ending-row">
                <span className="glyph glyph-s">{c.native}</span>
                <span className="ending-reading">{c.reading}</span>
                <span className="muted small">{c.note?.[lang]}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {endings.length > 0 && (
        <>
          <h2 className="section-label">{t('script.endings')}</h2>
          <div className="ending-list">
            {endings.map((c) => (
              <div key={c.id} className="ending-row">
                <span className="glyph glyph-s">{c.native}</span>
                <span className="ending-reading">-{c.reading}</span>
                <span className="muted small">{c.note?.[lang]}</span>
              </div>
            ))}
          </div>
        </>
      )}

      <Modal open={!!open} onClose={() => setOpen(null)} title={open ? letterGlyphs(open, ' ') : ''}>
        {open && (
          <div className="letter-detail">
            <div className="plate plate-intro">
              <span className="glyph glyph-xl">{open.upper}</span>
              {open.lower !== open.upper && <span className="glyph glyph-l intro-lower">{open.lower}</span>}
            </div>
            <p className="intro-reading">
              <span className="muted">{t('session.reads')}</span> <strong>{open.reading || t('session.noSound')}</strong>
            </p>
            <h3 className="card-label">{t('script.mnemonic')}</h3>
            <p>{open.mnemonic[lang]}</p>
            {open.note && <p className="muted">{open.note[lang]}</p>}
            {(index.contrastOf.get(open.id)?.length ?? 0) > 0 && (
              <>
                <h3 className="card-label">{t('script.contrast')}</h3>
                <p className="chip-row">
                  {index.contrastOf.get(open.id)!.map((id) => {
                    const o = index.byId.get(id) as LetterItem;
                    return (
                      <span key={id} className="glyph-chip">
                        {letterGlyphs(o)} <span className="muted">{o.reading || '–'}</span>
                      </span>
                    );
                  })}
                </p>
              </>
            )}
            {examples(open).length > 0 && (
              <>
                <h3 className="card-label">{t('script.examples')}</h3>
                <ul className="example-list">
                  {examples(open).map((it) => (
                    <li key={it.id}>
                      <span className="native">{'native' in it ? it.native : ''}</span>
                      <span className="muted">{'translit' in it ? it.translit : ''}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
            <div className="actions">
              <button type="button" className="btn btn-secondary" onClick={() => setOpen(null)}>
                {t('common.close')}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
