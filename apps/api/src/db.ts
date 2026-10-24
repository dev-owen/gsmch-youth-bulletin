import type { Pool, PoolClient } from 'pg';
import type { BulletinRow } from './types';
import type { BulletinInput } from './validation';

type Queryable = Pick<Pool, 'query'> | PoolClient;

export async function transaction<T>(pool: Pool, run: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await run(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
}

const bulletinSelect = `SELECT b.id, b.service_date::text, b.theme, b.cover_media_id,
  m.object_key AS cover_object_key, m.alt_text AS cover_alt_text,
  b.sermon_title, b.scripture, b.preacher, b.status, b.published_at
  FROM bulletins b LEFT JOIN media_assets m ON m.id = b.cover_media_id`;

export async function getBulletin(db: Queryable, condition: string, value: string) {
  const result = await db.query<BulletinRow>(`${bulletinSelect} WHERE ${condition}`, [value]);
  if (!result.rows[0]) return null;
  const b = result.rows[0];
  const [items, promotions] = await Promise.all([
    db.query<{ label: string; assignee: string }>('SELECT label, assignee FROM worship_items WHERE bulletin_id = $1 ORDER BY position', [b.id]),
    db.query<{ title: string; body: string; url: string | null }>('SELECT title, body, url FROM promotions WHERE bulletin_id = $1 ORDER BY position', [b.id]),
  ]);
  return {
    id: b.id, serviceDate: b.service_date, theme: b.theme, coverMediaId: b.cover_media_id,
    cover: b.cover_object_key ? { objectKey: b.cover_object_key, altText: b.cover_alt_text } : null,
    sermonTitle: b.sermon_title, scripture: b.scripture, preacher: b.preacher,
    status: b.status, publishedAt: b.published_at,
    worshipItems: items.rows, promotions: promotions.rows.map((p) => ({ ...p, url: p.url ?? '' })),
  };
}

export async function getSiteInfo(db: Queryable) {
  const result = await db.query<{ church_name: string; worship_time: string; gathering_time: string; introduction: string; vision: string; address: string; map_url: string }>(
    'SELECT church_name, worship_time, gathering_time, introduction, vision, address, map_url FROM site_info WHERE id = 1'
  );
  const row = result.rows[0];
  if (!row) throw new Error('site_info row is missing');
  return { churchName: row.church_name, worshipTime: row.worship_time, gatheringTime: row.gathering_time,
    introduction: row.introduction, vision: row.vision, address: row.address, mapUrl: row.map_url };
}

export async function replaceBulletin(client: PoolClient, id: string, data: BulletinInput) {
  await client.query(
    `UPDATE bulletins SET service_date = $2, theme = $3, cover_media_id = $4,
      sermon_title = $5, scripture = $6, preacher = $7, updated_at = now() WHERE id = $1`,
    [id, data.serviceDate, data.theme, data.coverMediaId, data.sermonTitle, data.scripture, data.preacher]
  );
  await client.query('DELETE FROM worship_items WHERE bulletin_id = $1', [id]);
  await client.query('DELETE FROM promotions WHERE bulletin_id = $1', [id]);
  for (const [position, item] of data.worshipItems.entries()) {
    await client.query('INSERT INTO worship_items (bulletin_id, position, label, assignee) VALUES ($1, $2, $3, $4)', [id, position, item.label, item.assignee]);
  }
  for (const [position, item] of data.promotions.entries()) {
    await client.query('INSERT INTO promotions (bulletin_id, position, title, body, url) VALUES ($1, $2, $3, $4, $5)', [id, position, item.title, item.body, item.url || null]);
  }
}
