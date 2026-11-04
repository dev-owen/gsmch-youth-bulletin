import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
import { siteInfoInput } from '../.test-dist/validation.js';

const source = await readFile(new URL('../../web/src/calendar.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } });
const { calendarEventColors, collectCalendarEvents, eventMarkerOnDate, eventsForMonth } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
const event = { title: '겨울 수련회', content: '', startDate: '2026-11-28', endDate: '2026-12-02', allDay: true, startTime: '', endTime: '' };

test('multi-day calendar markers show only the real start and end dates', () => {
  assert.equal(eventMarkerOnDate(event, '2026-11-28'), 'start');
  assert.equal(eventMarkerOnDate(event, '2026-12-02'), 'end');
  for (const date of ['2026-11-27', '2026-11-29', '2026-11-30', '2026-12-01', '2026-12-03']) {
    assert.equal(eventMarkerOnDate(event, date), null, date);
  }
  assert.equal(eventMarkerOnDate({ ...event, endDate: event.startDate }, event.startDate), 'single');
  assert.equal(eventMarkerOnDate({ ...event, endDate: '' }, event.startDate), 'single');
});

test('ongoing months keep the full period in the list without inventing calendar endpoints', () => {
  const longEvent = { ...event, startDate: '2026-10-20', endDate: '2027-01-05' };
  assert.deepEqual(eventsForMonth([longEvent], '2026-11'), [longEvent]);
  for (let day = 1; day <= 30; day++) assert.equal(eventMarkerOnDate(longEvent, `2026-11-${String(day).padStart(2, '0')}`), null);
  const midnight = { ...event, endDate: '2026-12-01', allDay: false, startTime: '18:00', endTime: '00:00' };
  assert.deepEqual(eventsForMonth([midnight], '2026-12'), [midnight]);
  assert.equal(eventMarkerOnDate(midnight, '2026-12-01'), 'end');
});

test('manual calendar periods are saved, validated, and collected alongside legacy single dates', () => {
  const siteInfo = { churchName: '교회', worshipTime: '', gatheringTime: '', introduction: '', vision: '', address: '', mapUrl: '' };
  const manual = { title: '수련회', date: '2026-11-28', endDate: '2026-12-02', content: '', contact: '' };
  const parsed = siteInfoInput.parse({ ...siteInfo, churchEvents: [manual] });
  const bulletin = { id: 'current', promotions: [] };
  assert.equal(collectCalendarEvents(parsed.churchEvents, [], bulletin)[0].endDate, manual.endDate);
  assert.equal(siteInfoInput.safeParse({ ...siteInfo, churchEvents: [{ ...manual, endDate: '2026-11-27' }] }).success, false);
  assert.equal(siteInfoInput.safeParse({ ...siteInfo, churchEvents: [{ ...manual, endDate: '2026-02-30' }] }).success, false);
  const { endDate, ...legacy } = manual;
  assert.equal(collectCalendarEvents([legacy], [], bulletin)[0].endDate, manual.date);
});

test('each schedule uses a distinct color that stays the same when navigating months', () => {
  const colors = Array.from({ length: 20 }, (_, index) => calendarEventColors(index));
  assert.equal(new Set(colors.map(({ color }) => color)).size, colors.length);
  assert.deepEqual(calendarEventColors(7), colors[7]);
});
