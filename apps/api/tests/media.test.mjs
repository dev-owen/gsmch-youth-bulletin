import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
import { readImage, MAX_IMAGE_BYTES, MAX_IMAGE_DIMENSION } from '../.test-dist/media.js';

const source = await readFile(new URL('../../web/src/media.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } });
const web = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);

function imageBytes(type, width, height, length = 64) {
  const bytes = new Uint8Array(length);
  const view = new DataView(bytes.buffer);
  const write = (offset, text) => bytes.set(Buffer.from(text, 'binary'), offset);
  if (type === 'image/png') {
    write(0, '\x89PNG\r\n\x1a\n');
    view.setUint32(16, width); view.setUint32(20, height);
  } else if (type === 'image/jpeg') {
    write(0, '\xff\xd8\xff\xc0');
    view.setUint16(4, 17); bytes[6] = 8;
    view.setUint16(7, height); view.setUint16(9, width);
  } else {
    write(0, 'RIFF'); view.setUint32(4, length - 8, true); write(8, 'WEBPVP8X');
    view.setUint32(16, 10, true);
    for (let i = 0; i < 3; i++) { bytes[24 + i] = ((width - 1) >> (8 * i)) & 255; bytes[27 + i] = ((height - 1) >> (8 * i)) & 255; }
  }
  return bytes;
}
const file = (type, width = 1920, height = 1080, length = 64) => new File([imageBytes(type, width, height, length)], 'cover', { type });

test('web and API agree on optimized upload limits', () => {
  assert.equal(web.MAX_IMAGE_BYTES, MAX_IMAGE_BYTES);
  assert.equal(web.MAX_IMAGE_DIMENSION, MAX_IMAGE_DIMENSION);
});

for (const type of ['image/jpeg', 'image/png', 'image/webp']) {
  test(`${type} accepts the byte and dimension boundaries and rejects oversized originals`, async () => {
    assert.equal((await readImage(file(type, 1920, 1920, MAX_IMAGE_BYTES))).length, MAX_IMAGE_BYTES);
    await assert.rejects(readImage(file(type, 1920, 1080, MAX_IMAGE_BYTES + 1)), /512KB/);
    await assert.rejects(readImage(file(type, 1921, 1080)), /1,920px/);
    await assert.rejects(readImage(file(type, 1080, 1921)), /1,920px/);
  });
}

test('API rejects empty, unsupported, malformed, and mismatched files', async () => {
  await assert.rejects(readImage(new File([], 'empty.png', { type: 'image/png' })), /512KB/);
  await assert.rejects(readImage(new File(['gif'], 'cover.gif', { type: 'image/gif' })), /512KB/);
  await assert.rejects(readImage(new File(['invalid'], 'cover.jpg', { type: 'image/jpeg' })), /형식/);
  await assert.rejects(readImage(new File([imageBytes('image/png', 100, 100)], 'cover.jpg', { type: 'image/jpeg' })), /형식/);
  await assert.rejects(readImage(file('image/png', 0, 100)), /형식/);
});

// Model browser encoding failures and unsupported WebP without adding a DOM library.
function browser(t, { width = 4000, height = 3000, webp = true, encode, broken = false, noContext = false } = {}) {
  const draws = [], fills = [], encodes = [], revoked = [];
  let canvas;
  const context = { drawImage: (_image, _x, _y, w, h) => draws.push([w, h]), fillRect: () => fills.push(context.fillStyle) };
  class Image {
    naturalWidth = width; naturalHeight = height;
    set src(value) { if (value) queueMicrotask(() => broken ? this.onerror?.() : this.onload?.()); }
  }
  const document = { createElement: () => canvas = {
    width: 0, height: 0, getContext: () => noContext ? null : context,
    toBlob(callback, requested, quality) {
      const type = !webp && requested === 'image/webp' ? 'image/png' : requested;
      encodes.push({ type, quality, width: this.width, height: this.height });
      callback(encode ? encode(type, this.width, this.height, encodes.length) : new Blob([imageBytes(type, this.width, this.height)], { type }));
    },
  } };
  for (const [key, value] of Object.entries({ Image, document })) {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, key);
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
    t.after(() => descriptor ? Object.defineProperty(globalThis, key, descriptor) : delete globalThis[key]);
  }
  t.mock.method(URL, 'createObjectURL', () => 'blob:test-cover');
  t.mock.method(URL, 'revokeObjectURL', (url) => revoked.push(url));
  return { draws, fills, encodes, revoked, get canvas() { return canvas; } };
}

test('optimizer resizes a large source before upload and produces a file the API accepts', async (t) => {
  const state = browser(t);
  const result = await web.optimizeImage(file('image/png', 4000, 3000));
  assert.equal(result.type, 'image/webp'); assert.equal(result.name, 'cover.webp');
  assert.deepEqual(state.draws, [[1920, 1440]]); assert.deepEqual(state.fills, []);
  await readImage(result);
  assert.deepEqual(state.revoked, ['blob:test-cover']); assert.equal(state.canvas.width, 0);
});

test('optimizer keeps small images at their original dimensions', async (t) => {
  const state = browser(t, { width: 320, height: 200 });
  await web.optimizeImage(file('image/jpeg', 320, 200));
  assert.deepEqual(state.draws, [[320, 200]]);
});

test('unsupported WebP becomes a correctly named JPEG with a white background', async (t) => {
  const state = browser(t, { width: 1000, height: 1800, webp: false });
  const result = await web.optimizeImage(file('image/png', 1000, 1800));
  assert.equal(result.type, 'image/jpeg'); assert.equal(result.name, 'cover.jpg');
  assert.deepEqual(state.fills, ['#fff']); await readImage(result);
});

test('optimizer reduces resolution again when the first encoded file exceeds the byte limit', async (t) => {
  const state = browser(t, { encode: (type, w, h, attempt) => new Blob([imageBytes(type, w, h, attempt === 1 ? MAX_IMAGE_BYTES + 1 : 100)], { type }) });
  const result = await web.optimizeImage(file('image/png', 4000, 3000));
  assert.deepEqual(state.draws, [[1920, 1440], [1536, 1152]]);
  assert.ok(result.size <= MAX_IMAGE_BYTES); await readImage(result);
});

test('compression failure never returns the uncompressed source and releases browser resources', async (t) => {
  const state = browser(t, { encode: () => null });
  await assert.rejects(web.optimizeImage(file('image/png')), /압축하지 못했습니다/);
  assert.deepEqual(state.revoked, ['blob:test-cover']); assert.equal(state.canvas.height, 0);
});

test('optimizer stops if the browser cannot reach the upload limit', async (t) => {
  const state = browser(t, { encode: (type) => new Blob([new Uint8Array(MAX_IMAGE_BYTES + 1)], { type }) });
  await assert.rejects(web.optimizeImage(file('image/png')), /512KB/);
  assert.equal(state.encodes.length, 6); assert.deepEqual(state.revoked, ['blob:test-cover']);
});

test('invalid source types and sizes are rejected before decoding', async () => {
  await assert.rejects(web.optimizeImage(new File(['gif'], 'cover.gif', { type: 'image/gif' })), /20MB/);
  await assert.rejects(web.optimizeImage(new File([], 'empty.jpg', { type: 'image/jpeg' })), /20MB/);
  await assert.rejects(web.optimizeImage(new File([new Uint8Array(20 * 1024 * 1024 + 1)], 'large.jpg', { type: 'image/jpeg' })), /20MB/);
});

test('decode errors release browser resources', async (t) => {
  const state = browser(t, { broken: true });
  await assert.rejects(web.optimizeImage(file('image/png')), /읽지/);
  assert.deepEqual(state.revoked, ['blob:test-cover']);
});
