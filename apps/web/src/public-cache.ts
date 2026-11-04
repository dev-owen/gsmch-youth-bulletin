const MAX_ENTRIES = 20;
const RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
type Entry = { savedAt: number; data: unknown };
type StorageAccess = () => Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export const isPublicBulletinPath = (path: string) => /^\/v1\/bulletins(?:\/(?:current|\d{4}-\d{2}-\d{2}))?(?:\?[^#]*)?$/.test(path);

export function createPublicDataCache(namespace: string, storage: StorageAccess = () => localStorage, now = Date.now) {
  const storageKey = `gsmch-public-data-v1:${namespace}`;
  const entries = new Map<string, Entry>();
  const pending = new Map<string, Promise<unknown>>();
  let hydrated = false;
  let generation = 0;

  function hydrate() {
    if (hydrated) return;
    hydrated = true;
    try {
      const stored: unknown = JSON.parse(storage().getItem(storageKey) || '[]');
      if (!Array.isArray(stored)) return;
      for (const item of stored.slice(-MAX_ENTRIES)) {
        if (!Array.isArray(item) || item.length !== 2) continue;
        const [path, entry] = item;
        if (typeof path === 'string' && isPublicBulletinPath(path) && entry && typeof entry.savedAt === 'number' &&
          Number.isFinite(entry.savedAt) && entry.savedAt <= now() && now() - entry.savedAt < RETENTION_MS &&
          entry.data && typeof entry.data === 'object') entries.set(path, entry);
      }
    } catch { /* Memory caching still works when storage is unavailable or corrupt. */ }
  }

  function read<T>(path: string): T | null {
    hydrate();
    const entry = entries.get(path);
    if (!entry || now() - entry.savedAt >= RETENTION_MS) { entries.delete(path); return null; }
    return entry.data as T;
  }

  function persist() {
    try { storage().setItem(storageKey, JSON.stringify([...entries])); } catch { /* storage may be full or disabled */ }
  }

  function remove(path: string) { hydrate(); entries.delete(path); persist(); }

  function reset() { generation++; entries.clear(); pending.clear(); hydrated = false; }
  function clear() {
    reset(); hydrated = true;
    try { storage().removeItem(storageKey); } catch { /* storage may be disabled */ }
  }

  // Revalidate on every visit, sharing duplicate requests (including Strict Mode).
  function load<T>(path: string, fetchData: () => Promise<T>): Promise<T> {
    const existing = pending.get(path);
    if (existing) return existing as Promise<T>;
    const version = generation;
    const request = Promise.resolve().then(fetchData).then((data) => {
      if (version === generation) {
        hydrate();
        entries.delete(path);
        entries.set(path, { savedAt: now(), data });
        if (entries.size > MAX_ENTRIES) entries.delete(entries.keys().next().value!);
        persist();
      }
      return data;
    }).finally(() => { if (pending.get(path) === request) pending.delete(path); });
    pending.set(path, request);
    return request;
  }

  return { storageKey, read, load, remove, reset, clear };
}
