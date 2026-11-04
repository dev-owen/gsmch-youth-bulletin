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
  const [items, community, promotions] = await Promise.all([
    db.query<{ label: string; content: string; assignee: string }>('SELECT label, content, assignee FROM worship_items WHERE bulletin_id = $1 ORDER BY position', [b.id]),
    db.query<{ category: string; content: string; details: Pick<BulletinInput['communityNews'][number], 'people' | 'wedding' | 'weddings'> }>('SELECT category, content, details FROM community_news WHERE bulletin_id = $1 ORDER BY position', [b.id]),
    db.query<{ title: string; body: string; details: BulletinInput['promotions'][number]['details']; url: string | null }>('SELECT title, body, details, url FROM promotions WHERE bulletin_id = $1 ORDER BY position', [b.id]),
  ]);
  return {
    id: b.id, serviceDate: b.service_date, theme: b.theme, coverMediaId: b.cover_media_id,
    cover: b.cover_object_key ? { objectKey: b.cover_object_key, altText: b.cover_alt_text } : null,
    sermonTitle: b.sermon_title, scripture: b.scripture, preacher: b.preacher,
    status: b.status, publishedAt: b.published_at,
    worshipItems: items.rows, communityNews: community.rows.map(({ details, ...news }) => ({ ...news, ...details })),
    promotions: promotions.rows.map((p) => ({ ...p, url: p.url ?? '' })),
  };
}

// Read from the source advertisements so edits and removals cannot leave stale calendar entries.
export async function getPromotionCalendarEvents(db: Queryable) {
  const result = await db.query<{ bulletin_id: string; title: string; body: string; details: BulletinInput['promotions'][number]['details']; url: string | null }>(
    `SELECT p.bulletin_id, p.title, p.body, p.details, p.url FROM promotions p
      JOIN bulletins b ON b.id = p.bulletin_id
      WHERE b.status = 'published' AND EXISTS (
        SELECT 1 FROM jsonb_array_elements(p.details) AS detail WHERE detail->>'type' = 'schedule'
      ) ORDER BY b.service_date, p.position`
  );
  return result.rows.flatMap((promotion) => promotion.details.flatMap((detail) => {
    if (detail.type !== 'schedule' || !detail.schedule) return [];
    return [{ ...detail.schedule, title: detail.title, content: detail.body || promotion.body,
      url: promotion.url || '', sourceBulletinId: promotion.bulletin_id, sourceTitle: promotion.title }];
  }));
}

export async function getSiteInfo(db: Queryable) {
  const result = await db.query<{ church_name: string; worship_time: string; gathering_time: string; introduction: string; vision: string; address: string; map_url: string; recurring_info: unknown; church_events: unknown }>(
    'SELECT church_name, worship_time, gathering_time, introduction, vision, address, map_url, recurring_info, church_events FROM site_info WHERE id = 1'
  );
  const row = result.rows[0];
  if (!row) throw new Error('site_info row is missing');
  return { churchName: row.church_name, worshipTime: row.worship_time, gatheringTime: row.gathering_time,
    introduction: row.introduction, vision: row.vision, address: row.address, mapUrl: row.map_url, recurringInfo: row.recurring_info, churchEvents: row.church_events };
}

export async function replaceBulletin(client: PoolClient, id: string, data: BulletinInput) {
  await client.query(
    `UPDATE bulletins SET service_date = $2, theme = $3, cover_media_id = $4,
      sermon_title = $5, scripture = $6, preacher = $7, updated_at = now() WHERE id = $1`,
    [id, data.serviceDate, data.theme, data.coverMediaId, data.sermonTitle, data.scripture, data.preacher]
  );
  await client.query('DELETE FROM worship_items WHERE bulletin_id = $1', [id]);
  await client.query('DELETE FROM promotions WHERE bulletin_id = $1', [id]);
  await client.query('DELETE FROM community_news WHERE bulletin_id = $1', [id]);
  if (data.worshipItems.length) await client.query(
    `INSERT INTO worship_items (bulletin_id, position, label, content, assignee)
     SELECT $1, ordinality - 1, label, content, assignee
     FROM jsonb_to_recordset($2::jsonb) WITH ORDINALITY AS x(label text, content text, assignee text, ordinality bigint)`,
    [id, JSON.stringify(data.worshipItems)]
  );
  if (data.communityNews.length) await client.query(
    `INSERT INTO community_news (bulletin_id, position, category, content, details)
     SELECT $1, ordinality - 1, category, content, details
     FROM jsonb_to_recordset($2::jsonb) WITH ORDINALITY AS x(category text, content text, details jsonb, ordinality bigint)`,
    [id, JSON.stringify(data.communityNews.map(({ category, content, people, wedding, weddings }) => ({ category, content, details: { people, wedding, weddings } })))]
  );
  if (data.promotions.length) await client.query(
    `INSERT INTO promotions (bulletin_id, position, title, body, details, url)
     SELECT $1, ordinality - 1, title, body, details, NULLIF(url, '')
     FROM jsonb_to_recordset($2::jsonb) WITH ORDINALITY AS x(title text, body text, details jsonb, url text, ordinality bigint)`,
    [id, JSON.stringify(data.promotions)]
  );
}
