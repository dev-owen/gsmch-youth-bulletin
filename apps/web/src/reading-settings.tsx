import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { Minus, Moon, Plus, Settings2, X } from 'lucide-react';
import './reading-settings.css';
import { useLanguage } from './language';

const STORAGE_KEY = 'gsmch-reading-text-size-v1';
const THEME_KEY = 'gsmch-reading-theme-v1';
type ReadingTheme = 'light' | 'dark';
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

function readThemePreference(): ReadingTheme | null {
  try {
    const value = localStorage.getItem(THEME_KEY);
    return value === 'light' || value === 'dark' ? value : null;
  } catch {
    return null;
  }
}

export function ReadingSettings() {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [textSize, setTextSize] = useState(readTextSize);
  const [themePreference, setThemePreference] = useState(readThemePreference);
  const [systemDark, setSystemDark] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches);
  const darkMode = themePreference ? themePreference === 'dark' : systemDark;
  const wrapperRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const nativeSizeRef = useRef<HTMLSpanElement>(null);
  const id = useId();

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const updateSystemTheme = () => setSystemDark(media.matches);
    const updateStoredTheme = (event: StorageEvent) => {
      if (event.key === THEME_KEY || event.key === null) setThemePreference(readThemePreference());
    };
    updateSystemTheme();
    media.addEventListener('change', updateSystemTheme);
    window.addEventListener('storage', updateStoredTheme);
    return () => {
      media.removeEventListener('change', updateSystemTheme);
      window.removeEventListener('storage', updateStoredTheme);
    };
  }, []);

  useLayoutEffect(() => {
    const root = document.documentElement;
    const previousTheme = root.getAttribute('data-reading-theme');
    const themeColor = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    const previousColor = themeColor?.getAttribute('content') ?? null;
    root.dataset.readingTheme = darkMode ? 'dark' : 'light';
    themeColor?.setAttribute('content', darkMode ? '#0f1720' : '#f5f8fb');
    return () => {
      if (previousTheme === null) root.removeAttribute('data-reading-theme');
      else root.setAttribute('data-reading-theme', previousTheme);
      if (previousColor === null) themeColor?.removeAttribute('content');
      else themeColor?.setAttribute('content', previousColor);
    };
  }, [darkMode]);

  useEffect(() => {
    if (themePreference === null) return;
    try { localStorage.setItem(THEME_KEY, themePreference); }
    catch { /* Theme switching still works when device storage is unavailable. */ }
  }, [themePreference]);

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
    <button ref={triggerRef} type="button" className="reading-settings-trigger" aria-label={t('읽기 설정')} title={t('읽기 설정')} aria-expanded={open} aria-controls={id} onClick={() => setOpen((value) => !value)}>
      <Settings2 size={19} aria-hidden="true" /><span>{t('설정')}</span>
    </button>
    {open && <section className="reading-settings-panel" id={id} aria-labelledby={`${id}-title`}>
      <div className="reading-settings-heading"><h2 id={`${id}-title`}>{t('읽기 설정')}</h2><button type="button" className="reading-settings-close" aria-label={t('읽기 설정 닫기')} onClick={close}><X size={19} aria-hidden="true" /></button></div>
      <p className="reading-settings-label">{t('글자 크기')}</p>
      <div className="reading-size-controls" role="group" aria-label={t('글자 크기 조절')}>
        <button type="button" aria-label={t('글자 작게')} disabled={textSize === MIN_SIZE} onClick={() => setTextSize((value) => Math.max(MIN_SIZE, value - STEP))}><Minus size={22} aria-hidden="true" /></button>
        <output aria-label={t('글자 크기')} aria-live="polite" aria-atomic="true">{textSize}%</output>
        <button type="button" aria-label={t('글자 크게')} disabled={textSize === MAX_SIZE} onClick={() => setTextSize((value) => Math.min(MAX_SIZE, value + STEP))}><Plus size={22} aria-hidden="true" /></button>
      </div>
      <button type="button" className="reading-size-reset" disabled={textSize === 100} onClick={() => setTextSize(100)}>{t('기본 크기로')}</button>
      <div className="reading-theme-setting">
        <button type="button" className="reading-theme-toggle" role="switch" aria-label={t('다크 모드')} aria-checked={darkMode} onClick={() => setThemePreference(darkMode ? 'light' : 'dark')}>
          <span className="reading-theme-label"><Moon size={18} aria-hidden="true" /><span>{t('다크 모드')}</span></span>
          <span className="reading-theme-control"><span className="reading-theme-status" aria-hidden="true">{t(darkMode ? '켜짐' : '꺼짐')}</span><span className="reading-theme-track" aria-hidden="true"><span /></span></span>
        </button>
      </div>
      <p className="reading-settings-help">{t('선택한 설정은 이 기기에 저장됩니다.')}</p>
    </section>}
  </div>;
}
