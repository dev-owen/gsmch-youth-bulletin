import type { MiddlewareHandler } from 'hono';
import type { AppEnv } from './types';

export const PUBLIC_CACHE_TTL_MS = 60_000;

// Keep only completed JSON bodies: Workers must not share request-bound I/O promises.
// This is a best-effort cache per Worker instance; no additional service is required.
export function publicResponseCache({ now = Date.now, maxEntries = 50 } = {}): MiddlewareHandler<AppEnv> {
  const entries = new Map<string, { body: string; expiresAt: number }>();
  let generation = 0;
  return async (c, next) => {
    const path = c.req.path;
    if (path.startsWith('/v1/admin/') && !['GET', 'HEAD', 'OPTIONS'].includes(c.req.method)) {
      await next();
      if (c.res.ok) { generation++; entries.clear(); }
      return;
    }
    if (c.req.method !== 'GET' || !/^\/v1\/bulletins(?:\/(?:current|\d{4}-\d{2}-\d{2}))?$/.test(path)) {
      await next();
      return;
    }
    const url = new URL(c.req.url);
    url.searchParams.sort();
    const key = url.href;
    const cached = entries.get(key);
    const bypass = /(?:no-cache|no-store|max-age\s*=\s*0)/i.test(c.req.header('Cache-Control') || '');
    if (!bypass && cached && cached.expiresAt > now()) {
      return c.body(cached.body, 200, { 'Content-Type': 'application/json; charset=UTF-8', 'Cache-Control': 'no-store', 'X-Bulletin-Cache': 'HIT' });
    }
    entries.delete(key);
    const startedAt = now();
    const version = generation;
    await next();
    if (c.res.status !== 200 || c.res.headers.has('Set-Cookie') || !c.res.headers.get('Content-Type')?.includes('application/json')) return;
    c.header('X-Bulletin-Cache', 'MISS');
    const body = await c.res.clone().text();
    // Bound memory and avoid repopulating the cache with a read that raced a save.
    if (version !== generation || startedAt + PUBLIC_CACHE_TTL_MS <= now() || body.length > 128 * 1024) return;
    for (const [entryKey, entry] of entries) if (entry.expiresAt <= now()) entries.delete(entryKey);
    if (entries.size >= maxEntries) entries.delete(entries.keys().next().value!);
    entries.set(key, { body, expiresAt: startedAt + PUBLIC_CACHE_TTL_MS });
  };
}
