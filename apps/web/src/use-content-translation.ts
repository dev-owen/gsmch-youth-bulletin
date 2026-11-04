import { useEffect, useState } from 'react';
import { api, API_BASE } from './lib';
import { createPublicDataCache } from './public-cache';
import { useLanguage } from './language';

export type TranslationStatus = 'idle' | 'pending' | 'complete' | 'unavailable';
type Metadata = { language: string; sourceHash: string; status: Exclude<TranslationStatus, 'idle'>; remaining: number };
type Localized<T> = T & { _translation: Metadata };
type State<T> = { key: string; data: T; status: TranslationStatus };
const translationCache = createPublicDataCache(`${API_BASE}:translations`);

export function useContentTranslation<T>(source: T | null, sourcePath: string | null) {
  const { language } = useLanguage();
  const sourceJson = source === null ? '' : JSON.stringify(source);
  const key = `${sourcePath}|${language}|${sourceJson}`;
  const [state, setState] = useState<State<T> | null>(null);
  const [attempt, setAttempt] = useState(0);
  const retry = () => setAttempt(value => value + 1);
  useEffect(() => {
    if (language === 'ko' || source === null || !sourcePath) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let rounds = 0;
    let lastRemaining = Infinity;
    let stalled = 0;
    const url = new URL(sourcePath, window.location.origin);
    url.searchParams.set('lang', language);
    const path = url.pathname + url.search;
    setState(previous => ({ key, data: previous?.key === key ? previous.data : source!, status: 'pending' }));
    const online = () => retry();
    window.addEventListener('online', online);
    async function load() {
      try {
        // Share duplicate requests, including Strict Mode. Late results
        // are ignored after a language, edition or source-content change.
        const response = await translationCache.load(path, () => api<Localized<T>>(path, { signal: AbortSignal.timeout(45000) }));
        if (!active) return;
        const metadata = response._translation;
        if (!metadata || metadata.language !== language || !['pending', 'complete', 'unavailable'].includes(metadata.status)) throw new Error('Invalid translation response');
        stalled = metadata.remaining >= lastRemaining ? stalled + 1 : 0;
        lastRemaining = metadata.remaining;
        const exhausted = metadata.status === 'pending' && (++rounds >= 40 || stalled >= 3);
        setState({ key, data: response, status: exhausted ? 'unavailable' : metadata.status });
        if (metadata.status === 'pending' && !exhausted) timer = setTimeout(() => { void load(); }, 700);
      } catch {
        if (active) setState(previous => ({ key, data: previous?.key === key ? previous.data : source!, status: previous?.key === key && previous.status === 'complete' ? 'complete' : 'unavailable' }));
      }
    }
    async function start() {
      const cached = translationCache.read<Localized<T>>(path);
      try {
        const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(sourceJson));
        const sourceHash = [...new Uint8Array(hash)].map(byte => byte.toString(16).padStart(2, '0')).join('');
        if (!active) return;
        if (cached?._translation?.language === language && cached._translation.sourceHash === sourceHash) {
          setState({ key, data: cached, status: cached._translation.status });
          if (cached._translation.status === 'complete') return;
        }
      } catch { /* Translation still works without the optional offline snapshot. */ }
      if (!active) return;
      if (!navigator.onLine) { setState(previous => ({ key, data: previous?.key === key ? previous.data : source!, status: 'unavailable' })); return; }
      void load();
    }
    void start();
    return () => { active = false; if (timer !== undefined) clearTimeout(timer); window.removeEventListener('online', online); };
  }, [sourceJson, sourcePath, language, attempt]);
  if (language === 'ko' || source === null || !sourcePath) return { data: source, status: 'idle' as const, retry };
  return { data: state?.key === key ? state.data : source, status: state?.key === key ? state.status : 'pending' as const, retry };
}
