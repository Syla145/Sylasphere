import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent, type WheelEvent } from 'react';
import type { CourseIndex } from '../../domain/courseIndex';
import type { MapLabels } from '../../domain/progress';
import type { MapShape, PlaceItem } from '../../domain/types';

export type Mark = 'target' | 'correct' | 'wrong' | 'selected';

interface Props {
  index: CourseIndex;
  /** Accessible name of the map. */
  label: string;
  marks?: Record<string, Mark>;
  labels?: MapLabels;
  /** Areas that must never be labelled (the place a task asks for). */
  hideLabels?: Set<string>;
  /** Makes areas clickable. */
  onPick?: (id: string) => void;
  /** Zoom and pan with wheel, drag, pinch and buttons. */
  zoomable?: boolean;
  /** Areas to frame at the start (with surrounding context). */
  focus?: string[];
  /** Smallest framed width as a share of the whole map (context around small areas). */
  minFrame?: number;
  className?: string;
}

type Box = { x: number; y: number; w: number; h: number };

const MIN_ZOOM = 1;
const MAX_ZOOM = 10;
const CLICK_SLOP = 6;

/**
 * Course map drawn from pre-projected SVG paths. Areas are tinted by their
 * parent group (division); borders of groups are drawn stronger. Labels follow
 * the chosen script and only appear where they fit at the current zoom.
 */
export function MapView({ index, label, marks = {}, labels = 'none', hideLabels, onPick, zoomable = false, focus, minFrame = 0.38, className = '' }: Props) {
  const map = index.map!;
  const full: Box = useMemo(() => ({ x: 0, y: 0, w: map.width, h: map.height }), [map]);
  const initial = useMemo(() => frameFor(map.width, map.height, full, (focus ?? []).map((id) => index.mapShapes.get(id)).filter(Boolean) as MapShape[], minFrame), [focus, full, index, map, minFrame]);
  const [vb, setVb] = useState<Box>(initial);
  const svgRef = useRef<SVGSVGElement>(null);
  const [px, setPx] = useState(0); // rendered width in CSS pixels
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const moved = useRef(0);
  const pinch = useRef<{ dist: number; box: Box; mid: { x: number; y: number } } | null>(null);
  const [hover, setHover] = useState<string | null>(null);

  // Re-frame when the task changes.
  useEffect(() => setVb(initial), [initial]);

  useLayoutEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const update = () => setPx(el.getBoundingClientRect().width);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const groupIndex = useMemo(() => new Map(map.groups.map((g, i) => [g.id, i])), [map]);
  const unitsPerPx = px ? vb.w / px : map.width / 600;

  const toMap = useCallback(
    (clientX: number, clientY: number) => {
      const r = svgRef.current!.getBoundingClientRect();
      // preserveAspectRatio="xMidYMid meet": the scale is the larger ratio
      const scale = Math.max(vb.w / r.width, vb.h / r.height);
      const offX = (r.width * scale - vb.w) / 2;
      const offY = (r.height * scale - vb.h) / 2;
      return { x: vb.x - offX + (clientX - r.left) * scale, y: vb.y - offY + (clientY - r.top) * scale };
    },
    [vb],
  );

  const clamp = useCallback(
    (b: Box): Box => {
      const w = Math.min(full.w, Math.max(full.w / MAX_ZOOM, b.w));
      const h = (w / b.w) * b.h;
      const x = Math.min(full.w - w * 0.25, Math.max(-w * 0.75, b.x));
      const y = Math.min(full.h - h * 0.25, Math.max(-h * 0.75, b.y));
      return { x, y, w, h };
    },
    [full],
  );

  const zoomAt = useCallback(
    (factor: number, at?: { x: number; y: number }) => {
      setVb((b) => {
        const c = at ?? { x: b.x + b.w / 2, y: b.y + b.h / 2 };
        const w = b.w / factor;
        const h = b.h / factor;
        if (w >= full.w / MIN_ZOOM) return fit(full, b);
        return clamp({ x: c.x - ((c.x - b.x) / b.w) * w, y: c.y - ((c.y - b.y) / b.h) * h, w, h });
      });
    },
    [clamp, full],
  );

  const onWheel = (e: WheelEvent<SVGSVGElement>) => {
    if (!zoomable) return;
    e.preventDefault();
    zoomAt(Math.pow(1.0018, -e.deltaY), toMap(e.clientX, e.clientY));
  };

  const onPointerDown = (e: PointerEvent<SVGSVGElement>) => {
    if (!zoomable) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 1) moved.current = 0;
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinch.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), box: vb, mid: toMap((a.x + b.x) / 2, (a.y + b.y) / 2) };
    }
  };

  const onPointerMove = (e: PointerEvent<SVGSVGElement>) => {
    const prev = pointers.current.get(e.pointerId);
    if (!zoomable || !prev) return;
    const dx = e.clientX - prev.x;
    const dy = e.clientY - prev.y;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    moved.current += Math.abs(dx) + Math.abs(dy);
    if (pointers.current.size === 2 && pinch.current) {
      const [a, b] = [...pointers.current.values()];
      const factor = Math.hypot(a.x - b.x, a.y - b.y) / pinch.current.dist;
      const { box, mid } = pinch.current;
      const w = box.w / factor;
      const h = box.h / factor;
      setVb(clamp({ x: mid.x - ((mid.x - box.x) / box.w) * w, y: mid.y - ((mid.y - box.y) / box.h) * h, w, h }));
      return;
    }
    if (moved.current > CLICK_SLOP) {
      if (!svgRef.current?.hasPointerCapture(e.pointerId)) svgRef.current?.setPointerCapture(e.pointerId);
      const r = svgRef.current!.getBoundingClientRect();
      const scale = Math.max(vb.w / r.width, vb.h / r.height);
      setVb((v) => clamp({ ...v, x: v.x - dx * scale, y: v.y - dy * scale }));
    }
  };

  const onPointerUp = (e: PointerEvent<SVGSVGElement>) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
  };

  const pick = (id: string) => {
    if (!onPick || moved.current > CLICK_SLOP) return;
    onPick(id);
  };

  const onKey = (e: KeyboardEvent<SVGPathElement>, id: string) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      e.stopPropagation();
      onPick?.(id);
    }
  };

  const zoom = vb.w ? full.w / vb.w : 1;
  const labelText = (id: string) => {
    const item = index.byId.get(id) as PlaceItem | undefined;
    if (!item) return '';
    return labels === 'native' ? item.native : item.translit;
  };
  const fontUnits = 11.5 * unitsPerPx;
  const stroke = (n: number) => n * unitsPerPx;

  return (
    <div className={`map ${className}`}>
      <svg
        ref={svgRef}
        className={`map-svg${onPick ? ' is-pickable' : ''}${zoomable ? ' is-zoomable' : ''}`}
        viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
        role="group"
        aria-label={label}
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <path d={map.outline} className="map-sea-edge" strokeWidth={stroke(5)} />
        {map.shapes.map((s) => {
          const mark = marks[s.id];
          const gi = s.group ? groupIndex.get(s.group) ?? 0 : 0;
          return (
            <path
              key={s.id}
              data-id={s.id}
              d={s.d}
              className={`map-area map-tint-${gi % 8}${mark ? ` is-${mark}` : ''}${hover === s.id ? ' is-hover' : ''}`}
              strokeWidth={stroke(0.8)}
              tabIndex={onPick ? 0 : undefined}
              role={onPick ? 'button' : undefined}
              aria-label={onPick ? `${label} ${map.shapes.indexOf(s) + 1}` : undefined}
              onClick={() => pick(s.id)}
              onKeyDown={onPick ? (e) => onKey(e, s.id) : undefined}
              onPointerEnter={onPick ? () => setHover(s.id) : undefined}
              onPointerLeave={onPick ? () => setHover((h) => (h === s.id ? null : h)) : undefined}
            />
          );
        })}
        {map.groups.map((g) => (
          <path key={g.id} d={g.d} className="map-group" strokeWidth={stroke(1.8)} />
        ))}
        {map.shapes
          .filter((s) => marks[s.id])
          .map((s) => (
            <path key={`m-${s.id}`} d={s.d} className={`map-mark is-${marks[s.id]}`} strokeWidth={stroke(2.4)} />
          ))}
        {/* A ring makes small marked areas findable when zoomed out. */}
        {map.shapes
          .filter((s) => marks[s.id] && (s.box[2] - s.box[0]) / unitsPerPx < 26)
          .map((s) => (
            <circle key={`r-${s.id}`} cx={s.label[0]} cy={s.label[1]} r={stroke(15)} className={`map-ring is-${marks[s.id]}`} strokeWidth={stroke(2)} />
          ))}
        {labels !== 'none' &&
          map.shapes.map((s) => {
            if (hideLabels?.has(s.id)) return null;
            const text = labelText(s.id);
            const boxPx = (s.box[2] - s.box[0]) / unitsPerPx;
            const textPx = Array.from(text).length * (labels === 'native' ? 7.5 : 6.6);
            if (!marks[s.id] && boxPx < textPx * 0.85) return null;
            return (
              <text
                key={`l-${s.id}`}
                x={s.label[0]}
                y={s.label[1]}
                className={`map-label${labels === 'native' ? ' is-native' : ''}${marks[s.id] ? ' is-marked' : ''}`}
                fontSize={fontUnits}
                strokeWidth={stroke(3)}
                lang={labels === 'native' ? index.content.id : undefined}
              >
                {text}
              </text>
            );
          })}
      </svg>
      {zoomable && (
        <div className="map-zoom" aria-hidden={false}>
          <button type="button" className="map-zoom-btn" aria-label="+" onClick={() => zoomAt(1.6)}>
            +
          </button>
          <button type="button" className="map-zoom-btn" aria-label="−" onClick={() => zoomAt(1 / 1.6)}>
            −
          </button>
          <button type="button" className="map-zoom-btn" aria-label="⤢" disabled={zoom <= 1.01 && !focus?.length} onClick={() => setVb(clamp(fit(full, vb)))}>
            ⤢
          </button>
        </div>
      )}
    </div>
  );
}

/** Whole map, keeping the current aspect ratio of the view box. */
function fit(full: Box, current: Box): Box {
  const ratio = current.h / current.w;
  if (full.h / full.w > ratio) {
    const w = full.h / ratio;
    return { x: (full.w - w) / 2, y: 0, w, h: full.h };
  }
  const h = full.w * ratio;
  return { x: 0, y: (full.h - h) / 2, w: full.w, h };
}

/** View box that shows the given areas with context (at least `minFrame` of the map width). */
function frameFor(width: number, height: number, full: Box, shapes: MapShape[], minFrame: number): Box {
  if (!shapes.length) return full;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const s of shapes) {
    x0 = Math.min(x0, s.box[0]);
    y0 = Math.min(y0, s.box[1]);
    x1 = Math.max(x1, s.box[2]);
    y1 = Math.max(y1, s.box[3]);
  }
  const ratio = height / width;
  let w = Math.max((x1 - x0) * 2.2, width * minFrame);
  let h = Math.max((y1 - y0) * 2.2, w * ratio);
  w = Math.max(w, h / ratio);
  h = w * ratio;
  if (w >= width) return full;
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  const x = Math.min(width - w, Math.max(0, cx - w / 2));
  const y = Math.min(height - h, Math.max(0, cy - h / 2));
  return { x, y, w, h };
}
