import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
import { siteInfoInput } from '../.test-dist/validation.js';
import { getSiteInfo } from '../.test-dist/db.js';

// 실제 프런트엔드 기본값을 API 스키마와 함께 검증해 두 형식의 불일치를 감지합니다.
const source = await readFile(new URL('../../web/src/church-info.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } });
const { normalizeSiteInfo, defaultRecurringInfo } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
const legacyInfo = { churchName: '선한목자 젊은이교회', worshipTime: '', gatheringTime: '', introduction: '', vision: '', address: '', mapUrl: '' };

test('photo-based recurring defaults are accepted and retained by the API', () => {
  const input = siteInfoInput.parse(normalizeSiteInfo(legacyInfo));
  assert.deepEqual(input.recurringInfo, defaultRecurringInfo);
  assert.equal(input.recurringInfo.meetings.length, 3);
  assert.equal(input.recurringInfo.offering.accountNumber, '3560-09-008436-8');
  assert.equal(input.recurringInfo.missionGroups.length, 6);
  assert.equal(input.recurringInfo.staffGroups.length, 4);
});

test('legacy and cached site information receive defaults while retaining saved overrides', () => {
  assert.equal(siteInfoInput.parse(legacyInfo).recurringInfo, undefined);
  assert.deepEqual(normalizeSiteInfo({ ...legacyInfo, recurringInfo: {} }).recurringInfo, defaultRecurringInfo);
  const saved = { ...legacyInfo, vision: '저장한 비전', recurringInfo: { ...defaultRecurringInfo, meetings: [{ title: '주일중보기도모임', schedule: '오후 1시', location: '변경된 장소', description: '', contact: '' }] } };
  const normalized = normalizeSiteInfo(saved);
  assert.equal(normalized.vision, '저장한 비전');
  assert.equal(normalized.recurringInfo.meetings[0].location, '변경된 장소');
  assert.equal(normalized.recurringInfo.meetings.length, 1);
  assert.deepEqual(siteInfoInput.parse(normalized).recurringInfo, saved.recurringInfo);
});

test('recurring information rejects incomplete account data and oversized or blank directory entries', () => {
  const input = normalizeSiteInfo(legacyInfo);
  const withRecurring = (change) => ({ ...input, recurringInfo: { ...input.recurringInfo, ...change } });
  assert.equal(siteInfoInput.safeParse(withRecurring({ offering: { ...defaultRecurringInfo.offering, accountNumber: ' ' } })).success, false);
  assert.equal(siteInfoInput.safeParse(withRecurring({ missionGroups: [{ title: '선교사', entries: [' '] }] })).success, false);
  assert.equal(siteInfoInput.safeParse(withRecurring({ staffGroups: [{ title: '섬기는 분들', entries: ['가'.repeat(501)] }] })).success, false);
  assert.equal(siteInfoInput.safeParse(withRecurring({ meetings: Array(11).fill(defaultRecurringInfo.meetings[0]) })).success, false);
});

test('site information reads recurring data without changing the stored content', async () => {
  const stored = { ...defaultRecurringInfo, missionNote: '변경한 선교 안내' };
  const siteInfo = await getSiteInfo({ query: async (sql) => {
    assert.match(sql, /recurring_info/);
    return { rows: [{ church_name: legacyInfo.churchName, worship_time: '', gathering_time: '', introduction: '', vision: '', address: '', map_url: '', recurring_info: stored }] };
  } });
  assert.deepEqual(siteInfo.recurringInfo, stored);
  assert.equal(normalizeSiteInfo(siteInfo).recurringInfo.missionNote, '변경한 선교 안내');
});
