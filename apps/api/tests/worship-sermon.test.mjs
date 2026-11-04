import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { bulletinInput, worshipItemInput, worshipItemsComplete } from '../.test-dist/validation.js';
import { getBulletin, replaceBulletin, toWorshipItem } from '../.test-dist/db.js';

const sermon = { type: 'sermon', label: '설교', content: { sermonTitle: '함께 걷는 믿음', scripture: '요한복음 15:1–8' }, assignee: '김목사' };
const text = { type: 'text', label: '찬양', content: '주님만 사랑하리', assignee: '찬양팀' };
const input = { serviceDate: '2026-11-08', theme: '감사', coverMediaId: null, coverAltText: '', sermonTitle: '이전 제목', scripture: '이전 본문', preacher: '이전 설교자', worshipItems: [text, sermon], communityNews: [], promotions: [] };

test('sermon content has two fixed string fields and cannot fall back to free text', () => {
  assert.deepEqual(worshipItemInput.parse(sermon), sermon);
  for (const content of ['', {}, { sermonTitle: '제목' }, { scripture: '본문' }, { sermonTitle: 123, scripture: '본문' }]) {
    assert.equal(bulletinInput.safeParse({ ...input, worshipItems: [{ ...sermon, content }] }).success, false);
  }
  for (const field of ['sermonTitle', 'scripture']) {
    assert.equal(worshipItemInput.safeParse({ ...sermon, content: { ...sermon.content, [field]: '가'.repeat(201) } }).success, false);
    assert.equal(worshipItemInput.parse({ ...sermon, content: { ...sermon.content, [field]: '  내용  ' } }).content[field], '내용');
  }
  assert.equal(worshipItemInput.safeParse({ ...text, content: sermon.content }).success, false);
  assert.equal(bulletinInput.safeParse({ ...input, worshipItems: [{ ...text, type: 'unknown' }] }).success, false);
});

test('drafts retain both empty sermon fields, while publication requires every sermon to be complete', () => {
  const blank = { ...sermon, content: { sermonTitle: '', scripture: '' }, assignee: '' };
  assert.deepEqual(bulletinInput.parse({ ...input, worshipItems: [blank] }).worshipItems, [blank]);
  assert.equal(worshipItemsComplete([text, sermon]), true);
  assert.equal(worshipItemsComplete([]), false);
  assert.equal(worshipItemsComplete([text, blank]), false);
  for (const field of ['sermonTitle', 'scripture']) {
    assert.equal(worshipItemsComplete([sermon, { ...sermon, content: { ...sermon.content, [field]: ' ' } }]), false);
  }
  assert.equal(worshipItemsComplete([{ ...sermon, assignee: ' ' }]), false);
});

test('the first sermon supplies the message card and existing untyped rows remain editable', () => {
  const parsed = bulletinInput.parse(input);
  assert.equal(parsed.sermonTitle, sermon.content.sermonTitle);
  assert.equal(parsed.scripture, sermon.content.scripture);
  assert.equal(parsed.preacher, sermon.assignee);
  assert.deepEqual(bulletinInput.parse(parsed), parsed);
  const legacy = bulletinInput.parse({ ...input, worshipItems: [{ label: '찬양', content: '기존 찬양', assignee: '찬양팀' }, { label: '설교', assignee: '김목사' }] });
  assert.deepEqual(legacy.worshipItems[0], { ...text, content: '기존 찬양' });
  assert.deepEqual(legacy.worshipItems[1].content, { sermonTitle: input.sermonTitle, scripture: input.scripture });
});

test('structured sermon content and ordinary text survive saving and reloading', async () => {
  const data = bulletinInput.parse(input);
  let stored;
  let bulletin;
  await replaceBulletin({ query: async (sql, values) => {
    if (sql.startsWith('UPDATE bulletins')) bulletin = { id: 'bulletin-id', service_date: values[1], sermon_title: values[4], scripture: values[5], preacher: values[6] };
    if (sql.startsWith('INSERT INTO worship_items')) {
      assert.match(sql, /type, label, content, sermon, assignee/);
      stored = JSON.parse(values[1]);
    }
    return { rows: [] };
  } }, 'bulletin-id', data);
  assert.equal(stored[0].content, text.content);
  assert.deepEqual(stored[1].sermon, sermon.content);
  const result = await getBulletin({ query: async (sql) => {
    if (sql.startsWith('SELECT b.id')) return { rows: [bulletin] };
    if (sql.includes('FROM worship_items')) return { rows: stored };
    return { rows: [] };
  } }, 'b.id = $1', 'bulletin-id');
  assert.deepEqual(result.worshipItems, data.worshipItems);
  assert.equal(result.sermonTitle, sermon.content.sermonTitle);
  assert.equal(result.scripture, sermon.content.scripture);
  assert.equal(result.preacher, sermon.assignee);
  assert.equal(worshipItemsComplete([toWorshipItem({ ...stored[1], sermon: {} })]), false);
});

async function loadWebModule(name) {
  const source = await readFile(new URL(`../../web/src/${name}`, import.meta.url), 'utf8');
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React } });
  const code = outputText.replace(/import '\.\/[^']+\.css';/g, '').replace(/from 'lucide-react'/g, `from ${JSON.stringify(import.meta.resolve('lucide-react'))}`);
  return import(`data:text/javascript;base64,${Buffer.from(`import React from ${JSON.stringify(import.meta.resolve('react'))};\n${code}`).toString('base64')}`);
}
const { WorshipItemContent } = await loadWebModule('worship-item-content.tsx');
const { WorshipEditor } = await loadWebModule('worship-editor.tsx');
const { normalizeWorshipItems, syncSermonFields } = await loadWebModule('worship.ts');

test('public sermon rows always show both fixed labels and safely render their values', () => {
  const render = (item) => renderToStaticMarkup(React.createElement(WorshipItemContent, { item }));
  for (const value of ['설교 주제:', sermon.content.sermonTitle, '말씀 구절:', sermon.content.scripture]) assert.ok(render(sermon).includes(value));
  assert.ok(render({ ...sermon, content: { sermonTitle: '', scripture: '' } }).includes('말씀 구절:'));
  assert.match(render({ ...sermon, content: { sermonTitle: '<script>', scripture: '본문' } }), /&lt;script&gt;/);
  assert.ok(render(text).includes(text.content));
  assert.equal(render({ ...text, content: '' }), '');
});

test('legacy normalization and editor updates keep the message card synchronized', () => {
  const normalized = normalizeWorshipItems([{ label: '찬양', assignee: '' }, { label: '설교', assignee: '' }], input);
  assert.deepEqual(normalized[0], { type: 'text', label: '찬양', content: '', assignee: '' });
  assert.deepEqual(normalized[1], { type: 'sermon', label: '설교', content: { sermonTitle: input.sermonTitle, scripture: input.scripture }, assignee: input.preacher });
  for (const field of ['sermonTitle', 'scripture']) {
    const updated = { ...sermon, content: { ...sermon.content, [field]: '바뀐 내용' } };
    assert.equal(syncSermonFields({ ...input, worshipItems: [text, updated] })[field], '바뀐 내용');
  }
  assert.equal(syncSermonFields({ ...input, worshipItems: [{ ...sermon, assignee: '다른 설교자' }] }).preacher, '다른 설교자');
  assert.equal(syncSermonFields({ ...input, worshipItems: [text] }).sermonTitle, input.sermonTitle);
});

function elements(tree) {
  if (Array.isArray(tree)) return tree.flatMap(elements);
  if (!React.isValidElement(tree)) return [];
  return [tree, ...elements(tree.props.children)];
}

test('editor type changes and sermon field edits retain the two fixed inputs', () => {
  let value = [{ ...text, label: '' }];
  const tree = () => WorshipEditor({ value, sermon: sermon.content, preacher: sermon.assignee, onChange: (next) => { value = next; } });
  const find = (label) => elements(tree()).find((element) => element.props['aria-label'] === label);
  find('1번째 순서 타입').props.onChange({ target: { value: 'sermon' } });
  assert.deepEqual(value[0], { ...sermon, assignee: text.assignee });
  assert.equal(find('1번째 내용'), undefined);
  find('1번째 설교 주제').props.onChange({ target: { value: '새 주제' } });
  find('1번째 말씀 구절').props.onChange({ target: { value: '시편 23:1' } });
  assert.deepEqual(value[0].content, { sermonTitle: '새 주제', scripture: '시편 23:1' });
  const markup = renderToStaticMarkup(tree());
  assert.ok(markup.includes('설교 주제'));
  assert.ok(markup.includes('말씀 구절'));
  find('1번째 순서 타입').props.onChange({ target: { value: 'text' } });
  assert.equal(value[0].type, 'text');
  assert.ok(find('1번째 내용'));
  assert.equal(find('1번째 설교 주제'), undefined);
});
