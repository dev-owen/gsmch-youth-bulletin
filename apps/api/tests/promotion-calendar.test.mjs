import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
import { bulletinInput, promotionScheduleInput } from '../.test-dist/validation.js';
import { getBulletin, getPromotionCalendarEvents, replaceBulletin } from '../.test-dist/db.js';

const source = await readFile(new URL('../../web/src/calendar.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } });
const { collectCalendarEvents, eventOccursOnDate, eventsForMonth, formatSchedule, promotionCalendarEvents } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);

const schedule = { startDate: '2026-11-28', endDate: '2026-12-02', allDay: false, startTime: '18:00', endTime: '12:00' };
const detail = { type: 'schedule', title: '겨울 수련회', body: '수양관에서 함께합니다.', schedule };
const promotion = { title: '수련회 안내', body: '함께 신청해 주세요.', details: [detail], url: 'https://example.com' };
const input = {
  serviceDate: '2026-11-22', theme: '감사', coverMediaId: null, coverAltText: '', sermonTitle: '함께 걷기', scripture: '요한복음 1:1', preacher: '목사',
  worshipItems: [], communityNews: [], promotions: [promotion],
};
const bulletin = { ...input, id: 'current', status: 'draft', cover: null, publishedAt: null };

test('advertisements can mix legacy text, all-day dates, timed events, and date ranges', () => {
  const details = [
    { title: '장소', body: '본당' }, detail,
    { type: 'schedule', title: '신청 마감', schedule: { startDate: '2026-11-20' } },
    { type: 'schedule', title: '설명회', body: '', schedule: { startDate: '2026-11-15', allDay: false, startTime: '13:00' } },
  ];
  const result = bulletinInput.parse({ ...input, promotions: [{ ...promotion, details }] });
  assert.deepEqual(result.promotions[0].details[0], details[0]);
  assert.deepEqual(result.promotions[0].details[1], detail);
  assert.deepEqual(result.promotions[0].details[2].schedule, { startDate: '2026-11-20', endDate: '2026-11-20', allDay: true, startTime: '', endTime: '' });
  assert.equal(result.promotions[0].details[3].schedule.endTime, '');
});

test('schedule validation rejects missing dates, impossible dates, and reversed ranges', () => {
  const invalid = [
    { ...schedule, startDate: '' }, { ...schedule, startDate: '2026-02-29' },
    { ...schedule, endDate: '2026-11-27' }, { ...schedule, endDate: '2026-11-31' },
  ];
  for (const value of invalid) assert.equal(promotionScheduleInput.safeParse(value).success, false, JSON.stringify(value));
  assert.equal(bulletinInput.safeParse({ ...input, promotions: [{ ...promotion, details: [{ type: 'schedule', title: '일정' }] }] }).success, false);
});

test('timed schedules require valid times and a positive duration when an end is specified', () => {
  const invalid = [
    { ...schedule, startTime: '' }, { ...schedule, startTime: '24:00' }, { ...schedule, endTime: '12:60' },
    { ...schedule, endTime: '' }, { ...schedule, endDate: schedule.startDate, endTime: '17:59' },
    { ...schedule, endDate: schedule.startDate, endTime: '18:00' },
  ];
  for (const value of invalid) assert.equal(promotionScheduleInput.safeParse(value).success, false, JSON.stringify(value));
  assert.equal(promotionScheduleInput.safeParse({ ...schedule, endDate: schedule.startDate, endTime: '18:01' }).success, true);
  assert.equal(promotionScheduleInput.safeParse({ ...schedule, endDate: '2026-11-29', endTime: '00:00' }).success, true);
});

test('all-day schedules clear hidden times, while an omitted end date means one day', () => {
  const result = promotionScheduleInput.parse({ ...schedule, endDate: '', allDay: true });
  assert.deepEqual(result, { ...schedule, allDay: true, endDate: schedule.startDate, startTime: '', endTime: '' });
});

test('schedule details survive the existing JSON storage and bulletin read path', async () => {
  const writes = [];
  await replaceBulletin({ query: async (sql, parameters) => { writes.push({ sql, parameters }); return { rows: [] }; } }, 'current', bulletinInput.parse(input));
  const inserted = writes.find(({ sql }) => sql.startsWith('INSERT INTO promotions'));
  const storedDetails = JSON.parse(inserted.parameters[4]);
  assert.deepEqual(storedDetails, [detail]);
  const result = await getBulletin({ query: async (sql) => {
    if (sql.startsWith('SELECT b.id')) return { rows: [{ id: 'current', service_date: input.serviceDate, status: 'published' }] };
    if (sql.includes('FROM promotions')) return { rows: [{ ...promotion, details: storedDetails }] };
    return { rows: [] };
  } }, 'b.id = $1', 'current');
  assert.deepEqual(result.promotions[0].details, [detail]);
});

test('calendar queries select published advertisements and match frontend extraction', async () => {
  let rows = [{ ...promotion, bulletin_id: bulletin.id, details: [{ title: '장소', body: '수양관' }, detail] }];
  const db = { query: async (sql) => {
    assert.match(sql, /JOIN bulletins b ON b.id = p.bulletin_id/);
    assert.match(sql, /b.status = 'published'/);
    assert.match(sql, /detail->>'type' = 'schedule'/);
    return { rows };
  } };
  assert.deepEqual(await getPromotionCalendarEvents(db), promotionCalendarEvents(bulletin));
  rows = [];
  assert.deepEqual(await getPromotionCalendarEvents(db), []);
});

test('periods mark every occupied date and appear in both months without repeating the list item', () => {
  const [event] = promotionCalendarEvents(bulletin);
  for (const date of ['2026-11-28', '2026-11-29', '2026-11-30', '2026-12-01', '2026-12-02']) assert.equal(eventOccursOnDate(event, date), true);
  assert.equal(eventOccursOnDate(event, '2026-11-27'), false);
  assert.equal(eventOccursOnDate(event, '2026-12-03'), false);
  assert.equal(eventsForMonth([event], '2026-11').length, 1);
  assert.equal(eventsForMonth([event], '2026-12').length, 1);
  assert.equal(eventsForMonth([event], '2027-01').length, 0);
});

test('calendar ranges handle leap days, year boundaries, and midnight ending at the next month', () => {
  const [event] = promotionCalendarEvents(bulletin);
  const leap = { ...event, startDate: '2028-02-29', endDate: '2028-03-01', allDay: true };
  assert.equal(eventsForMonth([leap], '2028-02').length, 1);
  const yearEnd = { ...leap, startDate: '2026-12-31', endDate: '2027-01-01' };
  assert.equal(eventsForMonth([yearEnd], '2027-01').length, 1);
  const midnight = { ...event, endDate: '2026-12-01', endTime: '00:00' };
  assert.equal(eventOccursOnDate(midnight, '2026-11-30'), true);
  assert.equal(eventOccursOnDate(midnight, '2026-12-01'), false);
  assert.equal(eventsForMonth([midnight], '2026-12').length, 0);
});

test('calendar keeps prior published schedules and manual church events alongside the current draft', () => {
  const old = { ...promotionCalendarEvents(bulletin)[0], sourceBulletinId: 'previous', title: '이전 광고 일정' };
  const manual = { title: '공동 기도회', date: '2026-11-01', content: '본당', contact: '010-1234-5678' };
  const events = collectCalendarEvents([manual], [old], bulletin);
  assert.equal(events.length, 3);
  assert.equal(events[0].contact, manual.contact);
  assert.ok(events.some((event) => event.title === old.title));
});

test('preview replaces or removes the edited bulletin schedules and collapses repeated advertisements', () => {
  const [original] = promotionCalendarEvents(bulletin);
  const edited = { ...bulletin, promotions: [{ ...promotion, details: [{ ...detail, schedule: { ...schedule, startDate: '2026-11-29' } }] }] };
  const preview = collectCalendarEvents([], [original], edited);
  assert.equal(preview.length, 1);
  assert.equal(preview[0].startDate, '2026-11-29');
  assert.deepEqual(collectCalendarEvents([], [original], { ...bulletin, promotions: [] }), []);
  assert.equal(collectCalendarEvents([], [{ ...original, sourceBulletinId: 'previous' }], bulletin).length, 1);
  assert.deepEqual(collectCalendarEvents([], [], { ...bulletin, promotions: [{ ...promotion, details: [{ ...detail, schedule: { ...schedule, startDate: '' } }] }] }), []);
});

test('schedule labels show a single time, same-day duration, multi-day range, and all-day status', () => {
  assert.match(formatSchedule({ ...schedule, allDay: true }), /2026.*11.*28.*~.*2026.*12.*2.*종일/);
  assert.match(formatSchedule(schedule), /18:00 ~ .*12:00/);
  assert.match(formatSchedule({ ...schedule, endDate: schedule.startDate, endTime: '20:00' }), /18:00 ~ 20:00$/);
  assert.match(formatSchedule({ ...schedule, endDate: '', endTime: '' }), /18:00$/);
});
