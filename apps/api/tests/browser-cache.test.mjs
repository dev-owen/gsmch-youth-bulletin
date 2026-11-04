import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const source = await readFile(new URL('../../web/src/public-cache.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } });
const { createPublicDataCache, isPublicBulletinPath } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
const path = '/v1/bulletins/current';
const storage = () => {
  const values = new Map();
  return { getItem: (key) => values.get(key) || null, setItem: (key, value) => values.set(key, value), removeItem: (key) => values.delete(key) };
};

test('only public bulletin GET paths are eligible for the browser cache', () => {
  for (const path of ['/v1/bulletins', '/v1/bulletins?cursor=2026-11-01', '/v1/bulletins/current', '/v1/bulletins/2026-11-01']) assert.equal(isPublicBulletinPath(path), true);
  for (const path of ['/v1/admin/bulletins', '/api/auth/get-session', '/v1/health', '/v1/media/file.jpg', '/v1/bulletins/private', '/v1/bulletins/current/extra']) assert.equal(isPublicBulletinPath(path), false);
});

test('saved data is available synchronously across reloads and API origins stay isolated', async () => {
  const local = storage();
  const first = createPublicDataCache('https://api.example', () => local);
  assert.equal(first.read(path), null);
  await first.load(path, async () => ({ theme: 'saved' }));
  assert.deepEqual(createPublicDataCache('https://api.example', () => local).read(path), { theme: 'saved' });
  assert.equal(createPublicDataCache('https://other.example', () => local).read(path), null);
});

test('concurrent reads share one request and a later visit revalidates without losing the saved copy', async () => {
  const cache = createPublicDataCache('', storage);
  let resolve;
  let calls = 0;
  const fetchData = () => { calls++; return new Promise((done) => { resolve = done; }); };
  const first = cache.load(path, fetchData);
  const duplicate = cache.load(path, fetchData);
  assert.equal(first, duplicate);
  await Promise.resolve();
  assert.equal(calls, 1);
  resolve({ theme: 'first' });
  await first;
  const refreshed = cache.load(path, async () => ({ theme: 'updated' }));
  assert.deepEqual(cache.read(path), { theme: 'first' });
  await refreshed;
  assert.deepEqual(cache.read(path), { theme: 'updated' });
});

test('network failure retains the saved data and does not poison retries', async () => {
  const cache = createPublicDataCache('', storage);
  await cache.load(path, async () => ({ theme: 'saved' }));
  await assert.rejects(cache.load(path, async () => { throw new TypeError('offline'); }));
  assert.deepEqual(cache.read(path), { theme: 'saved' });
  await cache.load(path, async () => ({ theme: 'online again' }));
  assert.deepEqual(cache.read(path), { theme: 'online again' });
});

test('invalidation survives reloads and prevents old in-flight responses from being saved', async () => {
  const local = storage();
  const cache = createPublicDataCache('', () => local);
  await cache.load(path, async () => ({ theme: 'saved' }));
  let resolve;
  const pending = cache.load(path, () => new Promise((done) => { resolve = done; }));
  await Promise.resolve();
  cache.clear();
  assert.equal(cache.read(path), null);
  assert.equal(createPublicDataCache('', () => local).read(path), null);
  await cache.load(path, async () => ({ theme: 'after save' }));
  resolve({ theme: 'before save' });
  await pending;
  assert.deepEqual(cache.read(path), { theme: 'after save' });
  const otherTab = createPublicDataCache('', () => local);
  assert.deepEqual(otherTab.read(path), { theme: 'after save' });
  cache.clear();
  otherTab.reset();
  assert.equal(otherTab.read(path), null);
});

test('storage failures and corrupt data do not prevent memory caching', async () => {
  const local = storage();
  const cache = createPublicDataCache('', () => local);
  for (const value of ['invalid JSON', '{}', '[null, [null], ["/v1/bulletins/current", null]]']) {
    local.setItem(cache.storageKey, value);
    cache.reset();
    assert.equal(cache.read(path), null);
  }
  const disabled = createPublicDataCache('', () => { throw new Error('storage disabled'); });
  await disabled.load(path, async () => ({ theme: 'memory only' }));
  assert.deepEqual(disabled.read(path), { theme: 'memory only' });
});

test('stored entries are bounded and expire after thirty days', async () => {
  const local = storage();
  let time = 1000;
  const cache = createPublicDataCache('', () => local, () => time);
  for (let day = 1; day <= 21; day++) await cache.load(`/v1/bulletins/2026-11-${String(day).padStart(2, '0')}`, async () => ({ day }));
  assert.equal(cache.read('/v1/bulletins/2026-11-01'), null);
  assert.deepEqual(cache.read('/v1/bulletins/2026-11-21'), { day: 21 });
  assert.equal(JSON.parse(local.getItem(cache.storageKey)).length, 20);
  time += 30 * 24 * 60 * 60 * 1000;
  assert.equal(cache.read('/v1/bulletins/2026-11-21'), null);
  assert.equal(createPublicDataCache('', () => local, () => time).read('/v1/bulletins/2026-11-20'), null);
});
