import { Children, createContext, useContext, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowLeft, ArrowRight, ChevronDown } from 'lucide-react';

const CompactContext = createContext(false);
export const useCompactBulletin = () => useContext(CompactContext);

export function BulletinBody({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [compact, setCompact] = useState(() => window.matchMedia('(max-width:760px)').matches);
  useLayoutEffect(() => {
    const body = ref.current;
    if (!body) return;
    const update = () => setCompact(body.getBoundingClientRect().width <= 47.5 * parseFloat(getComputedStyle(document.documentElement).fontSize));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(body);
    observer.observe(document.documentElement);
    return () => observer.disconnect();
  }, []);
  return <div ref={ref} className={`bulletin-body${compact ? ' is-compact' : ''}`}><CompactContext.Provider value={compact}>{children}</CompactContext.Provider></div>;
}

export function CompactDisclosure({ title, preview, meta, icon, level = 3, children, className = '' }: {
  title: string; preview?: string; meta?: string; icon: ReactNode; level?: 2 | 3; children: ReactNode; className?: string;
}) {
  const compact = useCompactBulletin();
  const [expanded, setExpanded] = useState(false);
  const id = useId();
  const Heading = level === 2 ? 'h2' : 'h3';
  const visible = !compact || expanded;
  return <div className={`compact-disclosure${expanded ? ' is-expanded' : ''} ${className}`}>
    <Heading className="compact-heading" hidden={!compact}><button type="button" aria-label={title} aria-expanded={expanded} aria-controls={id} onClick={() => setExpanded(value => !value)}>
      <span className="compact-icon" aria-hidden="true">{icon}</span><span className="compact-summary-text"><span className="compact-title">{title}</span>{preview && <span className="compact-preview">{preview}</span>}{meta && <span className="compact-meta">{meta}</span>}</span><ChevronDown className="compact-chevron" size={18} aria-hidden="true" />
    </button></Heading>
    <div id={id} className="compact-panel" aria-hidden={visible ? undefined : true} inert={!visible}><div className="compact-panel-inner"><div className="compact-panel-content">{children}</div></div></div>
  </div>;
}

export function SwipeCards({ children, label }: { children: ReactNode; label: string }) {
  const compact = useCompactBulletin();
  const items = Children.toArray(children);
  const ref = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  function updateActive() {
    const track = ref.current;
    if (!track || !track.children.length) return;
    const positions = Array.from(track.children, slide => Math.abs(slide.getBoundingClientRect().left - track.getBoundingClientRect().left));
    setActive(positions.indexOf(Math.min(...positions)));
  }
  function show(index: number) {
    const track = ref.current;
    const slide = track?.children[index] as HTMLElement | undefined;
    if (!track || !slide) return;
    track.scrollTo({ left: track.scrollLeft + slide.getBoundingClientRect().left - track.getBoundingClientRect().left, behavior: window.matchMedia('(prefers-reduced-motion:reduce)').matches ? 'instant' : 'smooth' });
  }
  return <div className="swipe-cards" role={compact ? 'region' : undefined} aria-roledescription={compact ? '캐러셀' : undefined} aria-label={compact ? label : undefined}>
    <div className="meeting-grid swipe-track" ref={ref} tabIndex={compact && items.length > 1 ? 0 : undefined} onScroll={updateActive} onKeyDown={event => {
      if (!compact || !['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
      event.preventDefault(); show(Math.max(0, Math.min(items.length - 1, active + (event.key === 'ArrowRight' ? 1 : -1))));
    }}>{items.map((item, index) => <div className="swipe-slide" key={index} role={compact ? 'group' : undefined} aria-label={compact ? `${index + 1} / ${items.length}` : undefined}>{item}</div>)}</div>
    {compact && items.length > 1 && <div className="swipe-controls"><button type="button" aria-label={`이전 ${label}`} disabled={active === 0} onClick={() => show(active - 1)}><ArrowLeft size={17} aria-hidden="true" /></button><div className="swipe-pagination">{items.map((_, index) => <button type="button" key={index} aria-label={`${index + 1}번째 ${label} 보기`} aria-current={active === index ? 'true' : undefined} onClick={() => show(index)}><span /></button>)}</div><button type="button" aria-label={`다음 ${label}`} disabled={active === items.length - 1} onClick={() => show(active + 1)}><ArrowRight size={17} aria-hidden="true" /></button></div>}
  </div>;
}
