import { useEffect, useState, type RefObject } from 'react';
import type { CordColor } from '../lib/cords';

interface CordProps {
  container: RefObject<HTMLElement | null>;
  from: RefObject<HTMLElement | null>;
  to: RefObject<HTMLElement | null>;
  color: CordColor;
  deps: unknown[];
}

interface Points {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

const center = (element: HTMLElement, origin: DOMRect) => {
  const rect = element.getBoundingClientRect();
  return { x: rect.left + rect.width / 2 - origin.left, y: rect.top + rect.height / 2 - origin.top, rect };
};

export const Cord = ({ container, from, to, color, deps }: CordProps) => {
  const [points, setPoints] = useState<Points | null>(null);

  useEffect(() => {
    let frame = 0;
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const root = container.current;
        const start = from.current;
        const end = to.current;
        if (!root || !start || !end || start.offsetParent === null || end.offsetParent === null) {
          setPoints(null);
          return;
        }
        const origin = root.getBoundingClientRect();
        const a = center(start, origin);
        const b = center(end, origin);
        const list = start.closest('.jacks')?.getBoundingClientRect();
        const visible = !list || (a.rect.bottom > list.top && a.rect.top < list.bottom);
        setPoints(visible ? { x1: a.x, y1: a.y, x2: b.x, y2: b.y } : null);
      });
    };

    measure();
    const list = from.current?.closest('.jacks');
    const observer = new ResizeObserver(measure);
    if (container.current) {
      observer.observe(container.current);
    }
    window.addEventListener('resize', measure);
    list?.addEventListener('scroll', measure, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener('resize', measure);
      list?.removeEventListener('scroll', measure);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  if (!points) {
    return null;
  }

  const { x1, y1, x2, y2 } = points;
  const sag = Math.max(40, Math.abs(y1 - y2) * 0.35);
  const path = `M ${x1} ${y1} C ${x1 + 30} ${y1 + sag}, ${x2 - 40} ${y2 + sag * 0.6}, ${x2} ${y2}`;

  return (
    <svg className="cord" aria-hidden="true">
      <path d={path} style={{ stroke: `var(--cord-${color})` }} />
      <circle cx={x1} cy={y1} r={5} style={{ fill: `var(--cord-${color})` }} />
      <circle cx={x2} cy={y2} r={7} style={{ fill: `var(--cord-${color})` }} />
    </svg>
  );
};
