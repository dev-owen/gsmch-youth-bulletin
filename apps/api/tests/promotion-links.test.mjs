import test from 'node:test';
import assert from 'node:assert/strict';
import { bulletinInput } from '../.test-dist/validation.js';
import { getBulletin, getPromotionCalendarEvents, replaceBulletin } from '../.test-dist/db.js';

const promotion = { title: '수련회', body: '참여 신청 안내', details: [], url: 'https://example.com/register' };
const input = { serviceDate: '2026-11-08', theme: '', coverMediaId: null, coverAltText: '', sermonTitle: '', scripture: '', preacher: '', worshipItems: [], communityNews: [], promotions: [promotion] };

test('button names are optional, trimmed, and limited to 60 characters', () => {
  const parse = (change) => bulletinInput.parse({ ...input, promotions: [{ ...promotion, ...change }] }).promotions[0];
  assert.equal(parse({}).linkLabel, '');
  assert.equal(parse({ linkLabel: '  ' }).linkLabel, '');
  assert.equal(parse({ linkLabel: '  신청하기  ' }).linkLabel, '신청하기');
  assert.equal(parse({ linkLabel: '가'.repeat(60) }).linkLabel.length, 60);
  assert.equal(bulletinInput.safeParse({ ...input, promotions: [{ ...promotion, linkLabel: '가'.repeat(61) }] }).success, false);
});

test('bulk save persists custom button names and reads them back using the API field name', async () => {
  const data = bulletinInput.parse({ ...input, promotions: [{ ...promotion, linkLabel: '신청하기' }] });
  let stored;
  await replaceBulletin({ query: async (sql, parameters) => {
    if (sql.startsWith('INSERT INTO promotions')) {
      assert.match(sql, /url, link_label\)/);
      assert.match(sql, /COALESCE\(item->>'linkLabel', ''\)/);
      stored = JSON.parse(parameters[1])[0];
    }
    return { rows: [] };
  } }, 'bulletin-id', data);
  assert.equal(stored.linkLabel, '신청하기');
  const result = await getBulletin({ query: async (sql) => {
    if (sql.startsWith('SELECT b.id')) return { rows: [{ id: 'bulletin-id', service_date: input.serviceDate }] };
    if (sql.includes('FROM promotions')) {
      assert.match(sql, /link_label/);
      const { linkLabel, ...rest } = stored;
      return { rows: [{ ...rest, link_label: linkLabel }] };
    }
    return { rows: [] };
  } }, 'b.id = $1', 'bulletin-id');
  assert.equal(result.promotions[0].linkLabel, '신청하기');
  assert.equal('link_label' in result.promotions[0], false);
});

test('published calendar events retain the advertisement button name', async () => {
  const schedule = { startDate: '2026-11-15', endDate: '2026-11-15', allDay: true, startTime: '', endTime: '' };
  const events = await getPromotionCalendarEvents({ query: async (sql) => {
    assert.match(sql, /p.link_label/);
    return { rows: [{ ...promotion, bulletin_id: 'bulletin-id', link_label: '안내 보기', details: [{ type: 'schedule', title: '행사 일정', body: '', schedule }] }] };
  } });
  assert.equal(events[0].linkLabel, '안내 보기');
  assert.equal(events[0].url, promotion.url);
});
