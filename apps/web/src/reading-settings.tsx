import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { Minus, Plus, Settings2, X } from 'lucide-react';
import './reading-settings.css';

const STORAGE_KEY = 'gsmch-reading-text-size-v1';
const MIN_SIZE = 80;
const MAX_SIZE = 200;
const STEP = 10;

function readTextSize() {
  try {
    const value = Number(localStorage.getItem(STORAGE_KEY));
    return Number.isInteger(value) && value >= MIN_SIZE && value <= MAX_SIZE && value % STEP === 0 ? value : 100;
  } catch {
    return 100;
  }
}

export function ReadingSettings() {
  const [open, setOpen] = useState(false);
  const [textSize, setTextSize] = useState(readTextSize);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const nativeSizeRef = useRef<HTMLSpanElement>(null);
  const id = useId();

  useLayoutEffect(() => {
    const probe = nativeSizeRef.current;
    if (!probe) return;
    const root = document.documentElement;
    const previousSize = root.style.getPropertyValue('font-size');
    const previousPriority = root.style.getPropertyPriority('font-size');
    const restoreSize = () => {
      if (previousSize) root.style.setProperty('font-size', previousSize, previousPriority);
      else root.style.removeProperty('font-size');
    };
    const updateSize = () => {
      // The probe uses medium / Dynamic Type independently of the root size,
      // so the reader's adjustment stays relative to their OS/browser setting.
      const nativeSize = parseFloat(getComputedStyle(probe).fontSize);
      if (!Number.isFinite(nativeSize) || nativeSize <= 0) return;
      wrapperRef.current?.style.setProperty('--native-reading-font-size', `${nativeSize}px`);
      if (textSize === 100) restoreSize();
      else root.style.setProperty('font-size', `${nativeSize * textSize / 100}px`);
    };
    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(probe);
    window.addEventListener('focus', updateSize);
    window.addEventListener('pageshow', updateSize);
    document.addEventListener('visibilitychange', updateSize);
    return () => {
      observer.disconnect();
      window.removeEventListener('focus', updateSize);
      window.removeEventListener('pageshow', updateSize);
      document.removeEventListener('visibilitychange', updateSize);
      restoreSize();
    };
  }, [textSize]);

  useEffect(() => {
    try {
      if (textSize === 100) localStorage.removeItem(STORAGE_KEY);
      else localStorage.setItem(STORAGE_KEY, String(textSize));
    } catch { /* Reading controls still work when device storage is unavailable. */ }
  }, [textSize]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && !wrapperRef.current?.contains(event.target)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      setOpen(false);
      triggerRef.current?.focus({ preventScroll: true });
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  function close() {
    setOpen(false);
    triggerRef.current?.focus({ preventScroll: true });
  }

  return <div className="reading-settings" ref={wrapperRef}>
    <span className="reading-native-size" ref={nativeSizeRef} aria-hidden="true">A</span>
    <button ref={triggerRef} type="button" className="reading-settings-trigger" aria-label="읽기 설정" title="읽기 설정" aria-expanded={open} aria-controls={id} onClick={() => setOpen((value) => !value)}>
      <Settings2 size={19} aria-hidden="true" /><span>설정</span>
    </button>
    {open && <section className="reading-settings-panel" id={id} aria-labelledby={`${id}-title`}>
      <div className="reading-settings-heading"><h2 id={`${id}-title`}>읽기 설정</h2><button type="button" className="reading-settings-close" aria-label="읽기 설정 닫기" onClick={close}><X size={19} aria-hidden="true" /></button></div>
      <p className="reading-settings-label">글자 크기</p>
      <div className="reading-size-controls" role="group" aria-label="글자 크기 조절">
        <button type="button" aria-label="글자 작게" disabled={textSize === MIN_SIZE} onClick={() => setTextSize((value) => Math.max(MIN_SIZE, value - STEP))}><Minus size={22} aria-hidden="true" /></button>
        <output aria-label="글자 크기" aria-live="polite" aria-atomic="true">{textSize}%</output>
        <button type="button" aria-label="글자 크게" disabled={textSize === MAX_SIZE} onClick={() => setTextSize((value) => Math.min(MAX_SIZE, value + STEP))}><Plus size={22} aria-hidden="true" /></button>
      </div>
      <button type="button" className="reading-size-reset" disabled={textSize === 100} onClick={() => setTextSize(100)}>기본 크기로</button>
      <p className="reading-settings-help">선택한 크기는 이 기기에 저장됩니다.</p>
    </section>}
  </div>;
}
