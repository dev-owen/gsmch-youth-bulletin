import { useEffect, useState } from 'react';
import { api, ApiError, onPublicCacheInvalidated, readPublicApi } from './lib';

type State<T> = { path: string | null; data: T | null; offline: boolean; error: Error | null };

export function usePublicApi<T>(path: string | null) {
  const snapshot = (): State<T> => ({ path, data: path ? readPublicApi<T>(path) : null, offline: !navigator.onLine, error: null });
  const [state, setState] = useState(snapshot);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!path) return;
    let active = true;
    let sequence = 0;
    let lastRefresh = 0;
    setState(snapshot());
    const refresh = () => {
      const request = ++sequence;
      lastRefresh = Date.now();
      api<T>(path).then((data) => {
        if (active && request === sequence) setState({ path, data, offline: false, error: null });
      }).catch((reason: Error) => {
        if (!active || request !== sequence) return;
        const cached = readPublicApi<T>(path);
        const canUseSaved = cached && (!(reason instanceof ApiError) || reason.status >= 500);
        setState({ path, data: canUseSaved ? cached : null, offline: Boolean(canUseSaved), error: canUseSaved ? null : reason });
      });
    };
    const focus = () => { if (document.visibilityState !== 'hidden' && Date.now() - lastRefresh > 10_000) refresh(); };
    refresh();
    window.addEventListener('online', refresh);
    window.addEventListener('focus', focus);
    const unsubscribe = onPublicCacheInvalidated(refresh);
    return () => { active = false; window.removeEventListener('online', refresh); window.removeEventListener('focus', focus); unsubscribe(); };
  }, [path, retry]);
  return { ...(state.path === path ? state : snapshot()), reload: () => setRetry((value) => value + 1) };
}
