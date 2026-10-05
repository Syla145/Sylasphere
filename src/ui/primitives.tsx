import { useEffect, useRef, type ComponentProps, type ReactNode } from 'react';
import { Link, type LinkProps } from 'react-router-dom';
import type { MasteryState } from '../domain/srs';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

export function Button({
  variant = 'secondary',
  block,
  className = '',
  ...rest
}: ComponentProps<'button'> & { variant?: Variant; block?: boolean }) {
  return <button type="button" className={`btn btn-${variant}${block ? ' btn-block' : ''} ${className}`} {...rest} />;
}

export function ButtonLink({ variant = 'secondary', block, className = '', ...rest }: LinkProps & { variant?: Variant; block?: boolean }) {
  return <Link className={`btn btn-${variant}${block ? ' btn-block' : ''} ${className}`} {...rest} />;
}

export function ProgressBar({ value, size = 'md', label }: { value: number; size?: 'sm' | 'md'; label?: string }) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return (
    <div className={`bar bar-${size}`} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)} aria-label={label}>
      <div className="bar-fill" style={{ width: `${pct}%` }} />
    </div>
  );
}

/** Mastery bar split into Mastered / Familiar / Learning segments. */
export function MasteryBar({ total, mastered, familiar, learning, label }: { total: number; mastered: number; familiar: number; learning: number; label?: string }) {
  const w = (n: number) => `${total ? (n / total) * 100 : 0}%`;
  return (
    <div className="bar bar-md bar-segmented" role="img" aria-label={label}>
      <div className="seg seg-mastered" style={{ width: w(mastered) }} />
      <div className="seg seg-familiar" style={{ width: w(familiar) }} />
      <div className="seg seg-learning" style={{ width: w(learning) }} />
    </div>
  );
}

export function StateDot({ state }: { state: MasteryState }) {
  return <span className={`dot dot-${state}`} aria-hidden="true" />;
}

export function Card({ children, className = '', as: As = 'section' }: { children: ReactNode; className?: string; as?: 'section' | 'div' | 'article' }) {
  return <As className={`card ${className}`}>{children}</As>;
}

/** Accessible modal built on <dialog>. */
export function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      try {
        d.showModal();
      } catch {
        d.setAttribute('open', '');
      }
    }
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog ref={ref} className="modal" onClose={onClose} onCancel={onClose} aria-label={title}>
      <h2 className="modal-title">{title}</h2>
      {children}
    </dialog>
  );
}

export function Glyph({ text, size = 'l', className = '', lang }: { text: string; size?: 'xl' | 'l' | 'm' | 's'; className?: string; lang?: string }) {
  return (
    <span className={`glyph glyph-${size} ${className}`} lang={lang}>
      {text}
    </span>
  );
}
