import test from 'node:test';
import assert from 'node:assert/strict';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { publicResponseCache, PUBLIC_CACHE_TTL_MS } from '../.test-dist/public-cache.js';

function fixture({ maxEntries = 50 } = {}) {
  let time = 1000;
  let reads = 0;
  let pools = 0;
  let version = 1;
  let status = 200;
  let beforeRead = async () => {};
  const app = new Hono();
  app.use('/v1/*', cors({ origin: (origin) => origin, credentials: true }));
  app.use('/v1/*', publicResponseCache({ now: () => time, maxEntries }));
  app.use('*', async (_c, next) => { pools++; await next(); });
  app.get('/v1/bulletins', async (c) => { reads++; return c.json({ query: c.req.query(), version }, status); });
  app.get('/v1/bulletins/:date', async (c) => {
    reads++;
    const snapshot = version;
    await beforeRead();
    return c.json({ date: c.req.param('date'), version: snapshot }, status);
  });
  app.all('/v1/admin/*', (c) => {
    if (c.req.method === 'GET') return c.json({ draft: true });
    if (c.req.header('Authorization') !== 'admin') return c.json({ code: 'FORBIDDEN' }, 403);
    version++;
    return c.json({ saved: true });
  });
  app.get('/v1/health', (c) => c.json({ status: 'ok' }));
  return { app, get reads() { return reads; }, get pools() { return pools; },
    advance: (ms) => { time += ms; }, setStatus: (value) => { status = value; },
    delayRead: (fn) => { beforeRead = fn; } };
}

test('public cache hits skip the database middleware and expire after one minute', async () => {
  const f = fixture();
  const first = await f.app.request('/v1/bulletins/current');
  assert.equal(first.headers.get('X-Bulletin-Cache'), 'MISS');
  const hit = await f.app.request('/v1/bulletins/current');
  assert.equal(hit.headers.get('X-Bulletin-Cache'), 'HIT');
  assert.equal(hit.headers.get('Cache-Control'), 'no-store');
  assert.deepEqual(await hit.json(), await first.json());
  assert.equal(f.pools, 1);
  f.advance(PUBLIC_CACHE_TTL_MS);
  assert.equal((await f.app.request('/v1/bulletins/current')).headers.get('X-Bulletin-Cache'), 'MISS');
  assert.equal(f.reads, 2);
});

test('dates, pagination and origins have separate entries; query order does not', async () => {
  const f = fixture();
  for (const path of ['/v1/bulletins/current', '/v1/bulletins/2026-11-01', '/v1/bulletins', '/v1/bulletins?cursor=2026-10-25&limit=12']) {
    assert.equal((await f.app.request(path)).headers.get('X-Bulletin-Cache'), 'MISS');
    assert.equal((await f.app.request(path)).headers.get('X-Bulletin-Cache'), 'HIT');
  }
  assert.equal((await f.app.request('/v1/bulletins?limit=12&cursor=2026-10-25')).headers.get('X-Bulletin-Cache'), 'HIT');
  assert.equal((await f.app.request('https://another.example/v1/bulletins/current')).headers.get('X-Bulletin-Cache'), 'MISS');
  assert.equal(f.reads, 5);
});

test('CORS is evaluated on every request and admin, auth and health responses are never cached', async () => {
  const f = fixture();
  await f.app.request('/v1/bulletins/current', { headers: { Origin: 'https://first.example' } });
  const hit = await f.app.request('/v1/bulletins/current', { headers: { Origin: 'https://second.example' } });
  assert.equal(hit.headers.get('X-Bulletin-Cache'), 'HIT');
  assert.equal(hit.headers.get('Access-Control-Allow-Origin'), 'https://second.example');
  assert.equal(hit.headers.get('Access-Control-Allow-Credentials'), 'true');
  for (const path of ['/v1/admin/bulletins', '/v1/admin/bulletins/draft', '/api/auth/get-session', '/v1/health']) {
    for (let i = 0; i < 2; i++) assert.equal((await f.app.request(path)).headers.get('X-Bulletin-Cache'), null);
  }
  assert.equal(f.pools, 9);
});

test('successful saves, publication and church info changes invalidate every public entry', async () => {
  const f = fixture();
  for (const path of ['/v1/admin/bulletins/id', '/v1/admin/bulletins/id/publish', '/v1/admin/site-info']) {
    for (const publicPath of ['/v1/bulletins/current', '/v1/bulletins/2026-11-01', '/v1/bulletins?cursor=2026-10-25']) await f.app.request(publicPath);
    await f.app.request(path, { method: path.endsWith('/publish') ? 'POST' : 'PUT', headers: { Authorization: 'admin' } });
    for (const publicPath of ['/v1/bulletins/current', '/v1/bulletins/2026-11-01', '/v1/bulletins?cursor=2026-10-25']) {
      assert.equal((await f.app.request(publicPath)).headers.get('X-Bulletin-Cache'), 'MISS');
    }
  }
});

test('failed writes preserve the cache; explicit revalidation bypasses it', async () => {
  const f = fixture();
  await f.app.request('/v1/bulletins/current');
  assert.equal((await f.app.request('/v1/admin/site-info', { method: 'PUT' })).status, 403);
  assert.equal((await f.app.request('/v1/bulletins/current')).headers.get('X-Bulletin-Cache'), 'HIT');
  assert.equal((await f.app.request('/v1/bulletins/current', { headers: { 'Cache-Control': 'no-cache' } })).headers.get('X-Bulletin-Cache'), 'MISS');
});

test('errors are not cached and the number of entries is bounded', async () => {
  const f = fixture({ maxEntries: 2 });
  for (const status of [400, 404, 500]) {
    f.setStatus(status);
    for (let i = 0; i < 2; i++) assert.equal((await f.app.request('/v1/bulletins/current')).headers.get('X-Bulletin-Cache'), null);
  }
  assert.equal(f.reads, 6);
  f.setStatus(200);
  for (const path of ['current', '2026-11-01', '2026-10-25']) await f.app.request(`/v1/bulletins/${path}`);
  assert.equal((await f.app.request('/v1/bulletins/2026-11-01')).headers.get('X-Bulletin-Cache'), 'HIT');
  assert.equal((await f.app.request('/v1/bulletins/current')).headers.get('X-Bulletin-Cache'), 'MISS');
});

test('a read racing a successful write cannot refill the cache with old content', async () => {
  const f = fixture();
  let release;
  const blocked = new Promise((resolve) => { release = resolve; });
  let began;
  const started = new Promise((resolve) => { began = resolve; });
  f.delayRead(() => { began(); return blocked; });
  const read = f.app.request('/v1/bulletins/current');
  await started;
  await f.app.request('/v1/admin/site-info', { method: 'PUT', headers: { Authorization: 'admin' } });
  release();
  assert.equal((await (await read).json()).version, 1);
  const fresh = await f.app.request('/v1/bulletins/current');
  assert.equal(fresh.headers.get('X-Bulletin-Cache'), 'MISS');
  assert.equal((await fresh.json()).version, 2);
});
