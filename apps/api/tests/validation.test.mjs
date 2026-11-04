import test from 'node:test';
import assert from 'node:assert/strict';
import { bulletinInput, dateSchema, siteInfoInput, urlSchema } from '../.test-dist/validation.js';

const validBulletin = {
  serviceDate: '2026-10-25',
  theme: '감사',
  coverMediaId: null,
  coverAltText: '',
  sermonTitle: '함께 걷기',
  scripture: '요한복음 1:1',
  preacher: '홍길동',
  worshipItems: [{ label: '찬양', assignee: '청년부' }],
  promotions: [{ title: '수련회', body: '참여 신청 안내', url: 'https://example.com' }],
};

test('accepts a real calendar date and rejects impossible dates', () => {
  assert.equal(dateSchema.safeParse('2024-02-29').success, true);
  assert.equal(dateSchema.safeParse('2026-02-29').success, false);
  assert.equal(dateSchema.safeParse('2026-13-01').success, false);
});

test('allows blank optional links but only accepts HTTP(S) URLs', () => {
  assert.equal(urlSchema.safeParse('').success, true);
  assert.equal(urlSchema.safeParse('https://example.com').success, true);
  assert.equal(urlSchema.safeParse('javascript:alert(1)').success, false);
  assert.equal(urlSchema.safeParse('not a URL').success, false);
});

test('validates bulletin content and enforces promotion limits', () => {
  assert.equal(bulletinInput.safeParse(validBulletin).success, true);
  assert.equal(bulletinInput.safeParse({ ...validBulletin, serviceDate: '2026-02-29' }).success, false);
  assert.equal(bulletinInput.safeParse({ ...validBulletin, promotions: Array(11).fill(validBulletin.promotions[0]) }).success, false);
  assert.equal(bulletinInput.safeParse({ ...validBulletin, worshipItems: [{ label: ' ', assignee: '' }] }).success, false);
});

test('accepts optional worship content and retains all four community news categories', () => {
  const input = bulletinInput.parse({
    ...validBulletin,
    worshipItems: [{ label: '찬양', content: '주님만 사랑하리', assignee: '찬양팀' }],
    communityNews: ['새가족', '등반', '결혼', '군입대'].map((category) => ({ category, content: `${category} 소식` })),
  });
  assert.equal(input.worshipItems[0].content, '주님만 사랑하리');
  assert.deepEqual(input.communityNews.map((news) => news.category), ['새가족', '등반', '결혼', '군입대']);
  assert.equal(bulletinInput.parse(validBulletin).worshipItems[0].content, '');
  assert.deepEqual(bulletinInput.parse(validBulletin).communityNews, []);
  assert.equal(bulletinInput.safeParse({ ...validBulletin, communityNews: [{ category: '기타', content: '소식' }] }).success, false);
  assert.equal(bulletinInput.safeParse({ ...validBulletin, communityNews: [{ category: '새가족', content: ' ' }] }).success, false);
});

test('retains multiple announcement details and rejects incomplete detail entries', () => {
  const promotion = { title: '수련회', body: '참여 신청 안내', details: [{ title: '일시', body: '토요일 오전 10시' }, { title: '장소', body: '본당' }], url: '' };
  const input = bulletinInput.parse({ ...validBulletin, promotions: [promotion] });
  assert.deepEqual(input.promotions[0], promotion);
  assert.deepEqual(bulletinInput.parse(validBulletin).promotions[0].details, []);
  assert.equal(bulletinInput.safeParse({ ...validBulletin, promotions: [{ ...promotion, details: [{ title: ' ', body: '내용' }] }] }).success, false);
  assert.equal(bulletinInput.safeParse({ ...validBulletin, promotions: [{ ...promotion, details: [{ title: '제목', body: ' ' }] }] }).success, false);
  assert.equal(bulletinInput.safeParse({ ...validBulletin, promotions: [{ ...promotion, url: 'javascript:alert(1)' }] }).success, false);
});

test('requires a church name in site information', () => {
  const siteInfo = { churchName: '선한목자 젊은이교회', worshipTime: '', gatheringTime: '', introduction: '', vision: '', address: '', mapUrl: '' };
  assert.equal(siteInfoInput.safeParse(siteInfo).success, true);
  assert.equal(siteInfoInput.safeParse({ ...siteInfo, churchName: ' ' }).success, false);
});
