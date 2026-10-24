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
  assert.equal(bulletinInput.safeParse({ ...validBulletin, promotions: Array(4).fill(validBulletin.promotions[0]) }).success, false);
  assert.equal(bulletinInput.safeParse({ ...validBulletin, worshipItems: [{ label: ' ', assignee: '' }] }).success, false);
});

test('requires a church name in site information', () => {
  const siteInfo = { churchName: '선한목자 젊은이교회', worshipTime: '', gatheringTime: '', introduction: '', vision: '', address: '', mapUrl: '' };
  assert.equal(siteInfoInput.safeParse(siteInfo).success, true);
  assert.equal(siteInfoInput.safeParse({ ...siteInfo, churchName: ' ' }).success, false);
});
