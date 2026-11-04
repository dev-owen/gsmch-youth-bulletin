import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { bulletinInput, communityNewsInput } from '../.test-dist/validation.js';
import { getBulletin, replaceBulletin } from '../.test-dist/db.js';

const people = [{ name: '김새봄', peer: '95또래' }, { name: '이하늘', peer: '96또래' }];
const wedding = { groom: people[0], bride: people[1], dateTime: '2026년 11월 14일 (토) 오후 2시', location: '예식장 3층 그레이스홀' };

test('accepts multiple name/peer pairs and retains their order in both member categories', () => {
  for (const category of ['새가족', '등반']) {
    const news = communityNewsInput.parse({ category, people });
    assert.deepEqual(news.people, people);
    assert.equal(news.content, '김새봄 (95또래)\n이하늘 (96또래)');
    assert.deepEqual(communityNewsInput.parse(news), news);
    assert.equal(communityNewsInput.safeParse({ category, people: [] }).success, false);
    assert.equal(communityNewsInput.safeParse({ category, people: [{ name: ' ', peer: '95또래' }] }).success, false);
    assert.equal(communityNewsInput.safeParse({ category, people: [{ name: '김새봄', peer: ' ' }] }).success, false);
    assert.equal(communityNewsInput.safeParse({ category, people: Array(101).fill(people[0]) }).success, false);
  }
  // A valid roster can generate more text than the old 300-character text field.
  const largeRoster = communityNewsInput.parse({ category: '새가족', people: Array(100).fill(people[0]) });
  assert.ok(largeRoster.content.length > 300);
  assert.deepEqual(communityNewsInput.parse(largeRoster), largeRoster);
});

test('requires both spouses and every wedding field, including when legacy content is supplied', () => {
  const news = communityNewsInput.parse({ category: '결혼', wedding });
  assert.deepEqual(news.wedding, wedding);
  assert.match(news.content, /신랑 김새봄 \(95또래\) · 신부 이하늘 \(96또래\)/);
  assert.match(news.content, /일시: 2026년 11월 14일/);
  assert.match(news.content, /장소: 예식장 3층 그레이스홀/);
  for (const role of ['groom', 'bride']) {
    for (const field of ['name', 'peer']) {
      assert.equal(communityNewsInput.safeParse({ category: '결혼', content: '기존 내용', wedding: { ...wedding, [role]: { ...wedding[role], [field]: ' ' } } }).success, false);
    }
  }
  for (const field of ['dateTime', 'location']) {
    assert.equal(communityNewsInput.safeParse({ category: '결혼', wedding: { ...wedding, [field]: ' ' } }).success, false);
  }
});

test('preserves legacy text and military news but rejects structured fields in the wrong category', () => {
  for (const category of ['새가족', '등반', '결혼', '군입대']) {
    const legacy = { category, content: '기존 소식' };
    assert.deepEqual(communityNewsInput.parse(legacy), legacy);
    assert.equal(communityNewsInput.safeParse({ category, content: ' ' }).success, false);
    assert.equal(communityNewsInput.safeParse({ category, content: '가'.repeat(301) }).success, false);
  }
  for (const category of ['결혼', '군입대']) assert.equal(communityNewsInput.safeParse({ category, people }).success, false);
  for (const category of ['새가족', '등반', '군입대']) assert.equal(communityNewsInput.safeParse({ category, wedding }).success, false);
});

test('writes and reloads structured and legacy news without losing individual fields', async () => {
  const input = bulletinInput.parse({
    serviceDate: '2026-11-15', theme: '', coverMediaId: null, coverAltText: '', sermonTitle: '', scripture: '', preacher: '', worshipItems: [], promotions: [],
    communityNews: [{ category: '새가족', people }, { category: '등반', people: [...people].reverse() }, { category: '결혼', wedding }, { category: '군입대', content: '김청년 입대' }, { category: '새가족', content: '기존 새가족 소식' }],
  });
  const stored = [];
  await replaceBulletin({ query: async (sql, values) => {
    if (sql.startsWith('INSERT INTO community_news')) {
      assert.match(sql, /details/);
      stored.push({ category: values[2], content: values[3], details: JSON.parse(values[4]) });
    }
    return { rows: [] };
  } }, 'bulletin-id', input);
  assert.equal(stored.length, 5);
  const result = await getBulletin({ query: async (sql) => {
    if (sql.includes('FROM bulletins b')) return { rows: [{ id: 'bulletin-id', service_date: input.serviceDate }] };
    if (sql.includes('FROM community_news')) { assert.match(sql, /details/); return { rows: stored }; }
    return { rows: [] };
  } }, 'b.id = $1', 'bulletin-id');
  assert.deepEqual(result.communityNews, input.communityNews);
});

const source = await readFile(new URL('../../web/src/community-news-content.tsx', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React } });
// Transpile the actual public renderer for a standalone server-rendering check.
const { CommunityNewsContent } = await import(`data:text/javascript;base64,${Buffer.from(`import React from ${JSON.stringify(import.meta.resolve('react'))};\n${outputText}`).toString('base64')}`);

test('renders every member, wedding detail and legacy text in public news cards', () => {
  const markup = (news) => renderToStaticMarkup(React.createElement(CommunityNewsContent, { news }));
  const members = markup({ category: '새가족', people });
  assert.equal((members.match(/<li>/g) || []).length, 2);
  assert.match(members, /김새봄/);
  assert.match(members, /96또래/);
  const marriage = markup({ category: '결혼', wedding });
  for (const text of ['신랑', '신부', '김새봄', '이하늘', '95또래', '96또래', '일시', wedding.dateTime, '장소', wedding.location]) assert.ok(marriage.includes(text));
  assert.match(markup({ category: '결혼', content: '기존 예식 안내' }), /기존 예식 안내/);
});
