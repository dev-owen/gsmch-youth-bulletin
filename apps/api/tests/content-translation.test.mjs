import test from 'node:test';
import assert from 'node:assert/strict';
import { Hono } from 'hono';
import { createContentTranslator, automaticContentTranslation, splitTranslationText, TRANSLATION_MODEL } from '../.test-dist/content-translation.js';
import { defaultRecurringInfo } from '../.test-dist/church-info.js';

function fixture(handler) {
  const stored = new Map();
  const calls = [];
  let writes = 0;
  let active = 0;
  let peak = 0;
  const env = {
    MEDIA: {
      async get(key) { return stored.has(key) ? { json: async () => JSON.parse(stored.get(key)) } : null; },
      async put(key, value) { writes++; stored.set(key, value); },
    },
    AI: { async run(model, input) {
      assert.equal(model, TRANSLATION_MODEL);
      const texts=JSON.parse(input.messages.at(-1).content);
      const language=input.messages[0].content.includes('into English.')?'en':'zh';
      assert(texts.every(text=>text.length<=600));
      assert.equal(input.response_format.type,'json_object');
      calls.push(...texts.map(text=>({text,target_lang:language})));
      active++;peak=Math.max(peak,active);
      try {
        const translations=await Promise.all(texts.map(async text=>{
          const result=handler?await handler({text,target_lang:language}):{translated_text:`${language}:${text}`};
          return result.translated_text;
        }));
        return {response:{translations}};
      } finally { active--; }
    } },
  };
  return { env, calls, stored, get writes() { return writes; }, get peak() { return peak; } };
}

const source = {
  bulletin: { id:'bulletin-id', serviceDate:'2026-11-08', theme:'함께 예배하는 교회', status:'published', preacher:'김목사',
    cover:{ objectKey:'cover-file.webp', altText:'예배하는 공동체' },
    worshipItems:[{ type:'sermon', label:'설교', assignee:'김목사', content:{ sermonTitle:'오늘의 설교 제목', scripture:'요한복음 1:1' } }, { type:'text', label:'찬양', assignee:'다 함께', content:'찬송가를 부릅니다.' }],
    communityNews:[{ category:'새가족', people:[{ name:'김새봄', peer:'95또래' }] }, { category:'결혼', weddings:[{ groom:{ name:'김청년', peer:'95또래' }, bride:{ name:'이사랑', peer:'96또래' }, dateTime:'토요일 오후 2시', location:'예식장' }] }],
    promotions:[{ title:'함께하는 수련회', body:'신청은 https://example.com/apply 또는 hello@example.com 에서 받습니다. 문의 010-1234-5678\n둘째 줄 안내입니다.', url:'https://example.com/apply', linkLabel:'신청하기', details:[{ title:'수련회 일정', body:'함께 기도합니다.', type:'schedule', schedule:{ startDate:'2026-11-13', endDate:'2026-11-15', allDay:true, startTime:'', endTime:'' } }] }],
  },
  siteInfo:{ churchName:'선한목자 젊은이교회', worshipTime:'주일 오후 3시', gatheringTime:'주일 모임', introduction:'한국어 교회 소개', vision:'한국어 비전', address:'성남시 교회', mapUrl:'https://example.com/map', churchEvents:[{ title:'주일 기도회', date:'2026-11-08', content:'함께 기도하는 시간', contact:'010-0000-0000' }] },
  calendarEvents:[{ title:'함께하는 수련회', sourceTitle:'광고 제목', content:'달력의 안내 내용', startDate:'2026-11-13', endDate:'2026-11-15', allDay:true, startTime:'', endTime:'', url:'https://example.com/apply', contact:'010-1234-5678', linkLabel:'신청하기' }],
};

async function finish(localize, data, language, env) {
  let result;
  for (let i=0;i<100;i++) {
    result = await localize(data, language, env);
    if (result._translation.status !== 'pending') return result;
  }
  assert.fail('Translation never completed');
}

test('translates public text fields and recurring defaults while preserving semantic fields, names, accounts and links', async () => {
  const f = fixture(); const original = structuredClone(source);
  const defaults = structuredClone(defaultRecurringInfo);
  const result = await finish(createContentTranslator({ batchSize:20 }), source, 'en', f.env);
  assert.equal(result._translation.status, 'complete');
  assert.match(result._translation.sourceHash, /^[a-f0-9]{64}$/);
  assert.equal(result.bulletin.theme, 'en:'+source.bulletin.theme);
  assert.equal(result.bulletin.worshipItems[0].content.sermonTitle, 'en:오늘의 설교 제목');
  assert.equal(result.bulletin.worshipItems[0].type, 'sermon');
  assert.equal(result.bulletin.worshipItems[0].assignee, '김목사');
  assert.equal(result.bulletin.worshipItems[1].assignee, 'All together');
  assert.equal(result.bulletin.communityNews[0].category, '새가족');
  assert.deepEqual(result.bulletin.communityNews[0].people, source.bulletin.communityNews[0].people);
  assert.equal(result.bulletin.communityNews[1].weddings[0].location, 'en:예식장');
  assert.equal(result.bulletin.serviceDate, '2026-11-08');
  assert.equal(result.bulletin.status, 'published');
  assert.equal(result.bulletin.preacher, '김목사');
  assert.equal(result.bulletin.cover.objectKey, 'cover-file.webp');
  assert.equal(result.bulletin.promotions[0].details[0].type, 'schedule');
  assert.deepEqual(result.bulletin.promotions[0].details[0].schedule, source.bulletin.promotions[0].details[0].schedule);
  assert.equal(result.bulletin.promotions[0].url, 'https://example.com/apply');
  assert.equal(result.siteInfo.mapUrl, 'https://example.com/map');
  assert.equal(result.siteInfo.recurringInfo.offering.accountNumber, defaultRecurringInfo.offering.accountNumber);
  assert.equal(result.siteInfo.recurringInfo.offering.accountHolder, defaultRecurringInfo.offering.accountHolder);
  assert.equal(result.siteInfo.recurringInfo.offering.example, defaultRecurringInfo.offering.example);
  assert.match(result.siteInfo.recurringInfo.offering.transfer, /^en:/);
  assert.match(result.siteInfo.recurringInfo.staffGroups[0].entries[0], /^en:담임목사 \| 김다위$/);
  assert.deepEqual(result.siteInfo.recurringInfo.missionGroups[0].entries, defaultRecurringInfo.missionGroups[0].entries);
  const body = result.bulletin.promotions[0].body;
  for (const protectedText of ['https://example.com/apply','hello@example.com','010-1234-5678','\n']) assert(body.includes(protectedText));
  assert.equal(result.calendarEvents[0].content, 'en:달력의 안내 내용');
  assert.equal(result.calendarEvents[0].contact, '010-1234-5678');
  assert.deepEqual(source, original, 'Korean source was mutated');
  assert.deepEqual(defaultRecurringInfo, defaults, 'Shared Korean defaults were mutated');
});

test('bounds calls per request, makes progress, deduplicates strings, and reuses durable translations after a restart', async () => {
  const f = fixture(async input => { await new Promise(resolve=>setTimeout(resolve,1)); return { translated_text: 'en:'+input.text }; });
  const localize = createContentTranslator({ batchSize:2 });
  const data={ items:[{ theme:'첫 번째 제목' },{ theme:'두 번째 제목' },{ theme:'세 번째 제목' },{ theme:'첫 번째 제목' }] };
  const first=await localize(data,'en',f.env);
  assert.equal(first._translation.status,'pending'); assert.equal(first._translation.remaining,1);
  assert.equal(f.calls.length,2); assert.equal(f.peak,1);
  const final=await finish(localize,data,'en',f.env);
  assert.equal(final._translation.status,'complete'); assert.equal(f.calls.length,3);
  assert.equal(final.items[0].theme,final.items[3].theme);
  const restarted=await createContentTranslator()(data,'en',f.env);
  assert.equal(restarted._translation.status,'complete'); assert.equal(f.calls.length,3);
  const changed=await localize({ ...data, items:[...data.items,{theme:'수정된 제목'}] },'en',f.env);
  assert.equal(changed._translation.status,'complete'); assert.equal(f.calls.length,4);
  assert.equal(changed.items.at(-1).theme,'en:수정된 제목');
  const chinese=await finish(localize,data,'zh',f.env);
  assert.equal(chinese._translation.language,'zh'); assert.equal(f.calls.length,7);
});

test('splits long Korean content without truncation and keeps whitespace and protected content intact', async () => {
  const text='함께 예배하며 기도합니다. '.repeat(60)+'\n문의 010-1234-5678 / https://example.com/신청';
  const parts=splitTranslationText(text);
  assert.equal(parts.map(part=>part.original).join(''),text);
  assert(parts.filter(part=>part.source).every(part=>part.source.length<=600));
  const f=fixture(); const result=await finish(createContentTranslator(),{body:text},'en',f.env);
  assert.equal(result._translation.status,'complete');
  assert(result.body.includes('\n문의') || result.body.includes('\nen:문의'));
  assert(result.body.includes('010-1234-5678')); assert(result.body.includes('https://example.com/신청'));
  assert.equal(result.body.replaceAll('en:',''),text);
  assert(f.calls.every(({text})=>!text.includes('010-1234-5678')&&!text.includes('https://')));
});

test('missing binding, provider failure, invalid output and timeout preserve the Korean content and permit a later retry', async () => {
  for (const handler of [async()=>{ throw new Error('quota'); }, async()=>({translated_text:''}), async()=>new Promise(()=>{})]) {
    const f=fixture(handler); const localize=createContentTranslator({timeoutMs:5});
    const result=await localize({theme:'안전한 한국어 원문'},'en',f.env);
    assert.equal(result.theme,'안전한 한국어 원문'); assert.equal(result._translation.status,'unavailable'); assert.equal(f.writes,0);
  }
  const f=fixture(); const localize=createContentTranslator();
  const unavailable=await localize({theme:'다시 시도하는 원문'},'en',{MEDIA:f.env.MEDIA});
  assert.equal(unavailable._translation.status,'unavailable');
  const retried=await localize({theme:'다시 시도하는 원문'},'en',f.env);
  assert.equal(retried._translation.status,'complete'); assert.equal(f.calls.length,1);
});

test('uses church terminology for newcomer gatherings instead of literal new-family translations', async () => {
  const english=fixture(async()=>({translated_text:'We have a new family gathering after worship.'}));
  const chinese=fixture(async()=>({translated_text:'敬拜后有新的家庭聚会。'}));
  const data={title:'새가족 모임',assignee:'다 함께'};
  const en=await createContentTranslator()(data,'en',english.env);
  const zh=await createContentTranslator()(data,'zh',chinese.env);
  assert.equal(en.title,'We have a newcomer gathering after worship.');
  assert.equal(zh.title,'敬拜后有新朋友聚会。');
  assert.equal(en.assignee,'All together'); assert.equal(zh.assignee,'全体会众');
});

test('rejects missing or reordered-length JSON results and does not cache translations that lose verse numbers', async () => {
  for (const output of [{response:{translations:[]}}, {response:{translations:['one','extra']}}, {choices:[{message:{content:'not JSON'}}]}]) {
    const f=fixture();f.env.AI.run=async()=>output;
    const result=await createContentTranslator()({theme:'검증할 원문'},'en',f.env);
    assert.equal(result._translation.status,'unavailable');assert.equal(result.theme,'검증할 원문');assert.equal(f.writes,0);
  }
  const f=fixture(async()=>({translated_text:'John'}));
  const result=await createContentTranslator()({scripture:'요한복음 1:1'},'en',f.env);
  assert.equal(result._translation.status,'unavailable');assert.equal(result.scripture,'요한복음 1:1');assert.equal(f.writes,0);
});

test('translates only successful published GET responses and keeps raw source caching separate from translations', async () => {
  const f=fixture(); const app=new Hono(); let reads=0; let raw;
  app.use('/v1/*',automaticContentTranslation());
  app.use('/v1/bulletins/current',async(c,next)=>{
    if(raw) { c.res=Response.json(raw); return; }
    await next(); raw=await c.res.clone().json();
  });
  app.get('/v1/bulletins/current',c=>{reads++;return c.json({bulletin:{theme:'캐시되는 한국어'}});});
  app.get('/v1/admin/bulletins',c=>c.json({theme:'비공개 초안'}));
  app.get('/v1/bulletins/:date',c=>c.json({message:'주보 없음'},404));
  for(const path of ['/v1/bulletins/current','/v1/bulletins/current?lang=ko','/v1/admin/bulletins?lang=en','/v1/bulletins/2026-11-01?lang=en']) await app.request(path,{},f.env);
  assert.equal(f.calls.length,0);
  const invalid=await app.request('/v1/bulletins/current?lang=fr',{},f.env); assert.equal(invalid.status,400);
  const translated=await app.request('/v1/bulletins/current?lang=en',{},f.env);
  assert.equal((await translated.json()).bulletin.theme,'en:캐시되는 한국어');
  assert.equal(translated.headers.get('Cache-Control'),'no-store');
  assert.equal(raw.bulletin.theme,'캐시되는 한국어'); assert.equal(reads,1);
  const korean=await app.request('/v1/bulletins/current',{},f.env);
  assert.deepEqual(await korean.json(),raw);
});
