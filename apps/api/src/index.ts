import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { Pool } from 'pg';
import { ZodError } from 'zod';
import { createAuth } from './auth';
import { getBulletin, getSiteInfo, replaceBulletin, transaction } from './db';
import { readImage } from './media';
import type { AppEnv } from './types';
import { bulletinInput, dateSchema, siteInfoInput } from './validation';

const app = new Hono<AppEnv>();
const noStore = { 'Cache-Control': 'no-store' };
const fail = (code: string, message: string, status: 400 | 401 | 403 | 404 | 409 | 422 | 500 | 503) =>
  Response.json({ code, message }, { status, headers: noStore });
const publicationError = '날짜·주제·설교와 예배 순서 담당자를 모두 입력해 주세요.';

app.use('*', async (c, next) => {
  const connectionString = c.env.HYPERDRIVE?.connectionString || c.env.DATABASE_URL;
  if (!connectionString) return fail('CONFIG_ERROR', '데이터베이스 연결이 설정되지 않았습니다.', 503);
  const pool = new Pool({ connectionString, max: 3, idleTimeoutMillis: 1000 });
  c.set('pool', pool);
  try { await next(); } finally { await pool.end(); }
});

app.use('/api/auth/*', (c, next) => cors({ origin: c.env.WEB_ORIGIN, credentials: true })(c, next));
app.use('/v1/*', (c, next) => cors({ origin: c.env.WEB_ORIGIN, credentials: true })(c, next));
app.all('/api/auth/*', (c) => createAuth(c.env, c.get('pool')).handler(c.req.raw));

app.get('/v1/health', async (c) => {
  await c.get('pool').query('SELECT 1');
  return c.json({ status: 'ok' }, 200, noStore);
});

app.use('/v1/admin/*', async (c, next) => {
  const session = await createAuth(c.env, c.get('pool')).api.getSession({ headers: c.req.raw.headers });
  if (!session) return fail('UNAUTHENTICATED', '로그인이 필요합니다.', 401);
  const result = await c.get('pool').query('SELECT 1 FROM admin_users WHERE user_id = $1', [session.user.id]);
  if (!result.rowCount) return fail('FORBIDDEN', '관리자 권한이 없습니다.', 403);
  c.set('adminUserId', session.user.id);
  await next();
  c.header('Cache-Control', 'no-store');
});

app.get('/v1/bulletins/current', async (c) => {
  const pool = c.get('pool');
  const [current, siteInfo] = await Promise.all([
    pool.query<{ current_bulletin_id: string | null }>('SELECT current_bulletin_id FROM site_settings WHERE id = 1'),
    getSiteInfo(pool),
  ]);
  const id = current.rows[0]?.current_bulletin_id;
  const bulletin = id ? await getBulletin(pool, "b.id = $1 AND b.status = 'published'", id) : null;
  return c.json({ bulletin, siteInfo }, 200, noStore);
});

app.get('/v1/bulletins', async (c) => {
  const cursor = c.req.query('cursor');
  if (cursor && !dateSchema.safeParse(cursor).success) return fail('INVALID_CURSOR', '목록 위치가 올바르지 않습니다.', 400);
  const rawLimit = Number(c.req.query('limit') || 12);
  if (!Number.isInteger(rawLimit) || rawLimit < 1) return fail('INVALID_LIMIT', '목록 크기가 올바르지 않습니다.', 400);
  const limit = Math.min(rawLimit, 20);
  const result = await c.get('pool').query<{ id: string; service_date: string; theme: string; published_at: string }>(
    `SELECT id, service_date::text, theme, published_at FROM bulletins
      WHERE status = 'published' AND id <> COALESCE((SELECT current_bulletin_id FROM site_settings WHERE id = 1), '00000000-0000-0000-0000-000000000000'::uuid)
      AND ($1::date IS NULL OR service_date < $1::date)
      ORDER BY service_date DESC LIMIT $2`, [cursor || null, limit + 1]
  );
  const rows = result.rows.slice(0, limit);
  return c.json({ items: rows.map((r) => ({ id: r.id, serviceDate: r.service_date, theme: r.theme, publishedAt: r.published_at })),
    nextCursor: result.rows.length > limit ? rows.at(-1)?.service_date : null }, 200, noStore);
});

app.get('/v1/bulletins/:date', async (c) => {
  const date = c.req.param('date');
  if (!dateSchema.safeParse(date).success) return fail('INVALID_DATE', '날짜가 올바르지 않습니다.', 400);
  const bulletin = await getBulletin(c.get('pool'), "b.service_date = $1 AND b.status = 'published'", date);
  if (!bulletin) return fail('NOT_FOUND', '해당 날짜의 주보가 없습니다.', 404);
  return c.json({ bulletin, siteInfo: await getSiteInfo(c.get('pool')) }, 200, noStore);
});

app.get('/v1/admin/me', (c) => c.json({ userId: c.get('adminUserId') }, 200, noStore));

app.get('/v1/admin/bulletins', async (c) => {
  const result = await c.get('pool').query<{ id: string; service_date: string; theme: string; status: string }>(
    'SELECT id, service_date::text, theme, status FROM bulletins ORDER BY service_date DESC LIMIT 100'
  );
  return c.json({ items: result.rows.map((r) => ({ id: r.id, serviceDate: r.service_date, theme: r.theme, status: r.status })) }, 200, noStore);
});

app.get('/v1/admin/bulletins/:id', async (c) => {
  const bulletin = await getBulletin(c.get('pool'), 'b.id = $1', c.req.param('id'));
  if (!bulletin) return fail('NOT_FOUND', '주보를 찾을 수 없습니다.', 404);
  return c.json({ bulletin }, 200, noStore);
});

app.post('/v1/admin/bulletins', async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = dateSchema.safeParse(body?.serviceDate);
  if (!parsed.success) return fail('INVALID_DATE', '예배 날짜를 입력해 주세요.', 422);
  const id = await transaction(c.get('pool'), async (client) => {
    const inserted = await client.query<{ id: string }>('INSERT INTO bulletins (service_date) VALUES ($1) RETURNING id', [parsed.data]);
    const nextId = inserted.rows[0].id;
    await client.query(`INSERT INTO worship_items (bulletin_id, position, label, assignee)
      SELECT $1, position, label, '' FROM worship_items
      WHERE bulletin_id = (SELECT id FROM bulletins WHERE status = 'published' AND service_date < $2 ORDER BY service_date DESC LIMIT 1) ORDER BY position`, [nextId, parsed.data]);
    return nextId;
  });
  return c.json({ id }, 201, noStore);
});

app.put('/v1/admin/bulletins/:id', async (c) => {
  const input = bulletinInput.parse(await c.req.json());
  const id = c.req.param('id');
  const found = await transaction(c.get('pool'), async (client) => {
    const row = await client.query<{ id: string; service_date: string; status: string }>('SELECT id, service_date::text, status FROM bulletins WHERE id = $1 FOR UPDATE', [id]);
    if (!row.rowCount) return false;
    if (row.rows[0].status === 'published' && row.rows[0].service_date !== input.serviceDate) throw new InputError('발행된 주보의 날짜는 바꿀 수 없습니다.');
    if (row.rows[0].status === 'published' && (!input.theme || !input.sermonTitle || !input.scripture || !input.preacher ||
      !input.worshipItems.length || input.worshipItems.some((item) => !item.assignee))) throw new InputError(publicationError);
    if (input.coverMediaId) {
      const media = await client.query('SELECT id FROM media_assets WHERE id = $1', [input.coverMediaId]);
      if (!media.rowCount) throw new InputError('대표 이미지를 찾을 수 없습니다.');
      if (!input.coverAltText) throw new InputError('이미지 대체 텍스트를 입력해 주세요.');
      await client.query('UPDATE media_assets SET alt_text = $2 WHERE id = $1', [input.coverMediaId, input.coverAltText]);
    }
    await replaceBulletin(client, id, input);
    return true;
  });
  if (!found) return fail('NOT_FOUND', '주보를 찾을 수 없습니다.', 404);
  return c.json({ bulletin: await getBulletin(c.get('pool'), 'b.id = $1', id) }, 200, noStore);
});

app.post('/v1/admin/bulletins/:id/publish', async (c) => {
  const id = c.req.param('id');
  const result = await transaction(c.get('pool'), async (client) => {
    const settings = await client.query<{ current_bulletin_id: string | null }>('SELECT current_bulletin_id FROM site_settings WHERE id = 1 FOR UPDATE');
    const row = await client.query<{ service_date: string; theme: string; sermon_title: string; scripture: string; preacher: string; status: string }>(
      'SELECT service_date::text, theme, sermon_title, scripture, preacher, status FROM bulletins WHERE id = $1 FOR UPDATE', [id]
    );
    if (!row.rows[0]) return 'missing';
    const b = row.rows[0];
    if (b.status === 'published') return settings.rows[0]?.current_bulletin_id === id ? 'published' : 'already-published';
    const items = await client.query<{ label: string; assignee: string }>('SELECT label, assignee FROM worship_items WHERE bulletin_id = $1', [id]);
    if (!dateSchema.safeParse(b.service_date).success || !b.theme.trim() || !b.sermon_title.trim() || !b.scripture.trim() || !b.preacher.trim() ||
      !items.rows.length || items.rows.some((item) => !item.label.trim() || !item.assignee.trim())) return 'incomplete';
    await client.query("UPDATE bulletins SET status = 'published', published_at = COALESCE(published_at, now()), updated_at = now() WHERE id = $1", [id]);
    await client.query('UPDATE site_settings SET current_bulletin_id = $1 WHERE id = 1', [id]);
    return 'published';
  });
  if (result === 'missing') return fail('NOT_FOUND', '주보를 찾을 수 없습니다.', 404);
  if (result === 'already-published') return fail('ALREADY_PUBLISHED', '이미 발행된 지난 주보는 최신 주보로 다시 발행할 수 없습니다.', 409);
  if (result === 'incomplete') return fail('INCOMPLETE_BULLETIN', publicationError, 422);
  return c.json({ bulletin: await getBulletin(c.get('pool'), 'b.id = $1', id) }, 200, noStore);
});

app.get('/v1/admin/site-info', async (c) => c.json({ siteInfo: await getSiteInfo(c.get('pool')) }, 200, noStore));
app.put('/v1/admin/site-info', async (c) => {
  const input = siteInfoInput.parse(await c.req.json());
  await c.get('pool').query(`UPDATE site_info SET church_name = $1, worship_time = $2, gathering_time = $3,
    introduction = $4, vision = $5, address = $6, map_url = $7, updated_at = now() WHERE id = 1`,
    [input.churchName, input.worshipTime, input.gatheringTime, input.introduction, input.vision, input.address, input.mapUrl]);
  return c.json({ siteInfo: input }, 200, noStore);
});

app.post('/v1/admin/media', async (c) => {
  const form = await c.req.formData();
  const file = form.get('file');
  const altText = String(form.get('altText') || '').trim();
  if (!(file instanceof File) || !altText || altText.length > 200) return fail('INVALID_MEDIA', '이미지와 대체 텍스트를 입력해 주세요.', 422);
  let bytes: Uint8Array;
  try { bytes = await readImage(file); } catch (error) { return fail('INVALID_MEDIA', (error as Error).message, 422); }
  const id = crypto.randomUUID();
  const extension = file.type === 'image/jpeg' ? 'jpg' : file.type === 'image/png' ? 'png' : 'webp';
  const objectKey = `${id}.${extension}`;
  await c.env.MEDIA.put(objectKey, bytes, { httpMetadata: { contentType: file.type } });
  try {
    await c.get('pool').query('INSERT INTO media_assets (id, object_key, content_type, size_bytes, alt_text) VALUES ($1, $2, $3, $4, $5)',
      [id, objectKey, file.type, file.size, altText]);
  } catch (error) { await c.env.MEDIA.delete(objectKey); throw error; }
  return c.json({ id, url: `${c.env.PUBLIC_MEDIA_BASE_URL.replace(/\/$/, '')}/${objectKey}` }, 201, noStore);
});

app.get('/v1/media/:key', async (c) => {
  const key = c.req.param('key');
  if (!/^[a-f0-9-]{36}\.(jpg|png|webp)$/.test(key)) return fail('NOT_FOUND', '이미지를 찾을 수 없습니다.', 404);
  const object = await c.env.MEDIA.get(key);
  if (!object) return fail('NOT_FOUND', '이미지를 찾을 수 없습니다.', 404);
  return new Response(object.body, { headers: { 'Content-Type': object.httpMetadata?.contentType || 'application/octet-stream', 'Cache-Control': 'public, max-age=31536000, immutable' } });
});

class InputError extends Error {}
app.onError((error, c) => {
  if (error instanceof ZodError) return fail('VALIDATION_ERROR', error.issues[0]?.message || '입력 내용을 확인해 주세요.', 422);
  if (error instanceof InputError) return fail('VALIDATION_ERROR', error.message, 422);
  const pgError = error as Error & { code?: string };
  if (pgError.code === '23505') return fail('DUPLICATE_DATE', '이미 해당 날짜의 주보가 있습니다.', 409);
  if (pgError.code === '22P02') return fail('INVALID_ID', '요청한 항목을 찾을 수 없습니다.', 404);
  console.error(error);
  return fail('SERVER_ERROR', '요청을 처리하지 못했습니다.', 500);
});

export default app;
