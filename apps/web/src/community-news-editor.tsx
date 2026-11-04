import { Plus, Trash2 } from 'lucide-react';
import type { CommunityNews, CommunityPerson, CommunityWedding } from './lib';

const emptyPerson = (): CommunityPerson => ({ name: '', peer: '' });
const emptyWedding = (): CommunityWedding => ({ groom: emptyPerson(), bride: emptyPerson(), dateTime: '', location: '' });
export function createCommunityNews(category: CommunityNews['category'] = '새가족'): CommunityNews {
  if (category === '새가족' || category === '등반') return { category, content: '', people: [emptyPerson()] };
  if (category === '결혼') return { category, content: '', weddings: [emptyWedding()] };
  return { category, content: '' };
}

function PersonFields({ person, prefix = '', onChange }: { person: CommunityPerson; prefix?: string; onChange: (person: CommunityPerson) => void }) {
  return <div className="field-grid">
    <label className="field">{prefix}이름<input value={person.name} maxLength={80} onChange={(e) => onChange({ ...person, name: e.target.value })} placeholder="이름" /></label>
    <label className="field">{prefix}또래<input value={person.peer} maxLength={40} onChange={(e) => onChange({ ...person, peer: e.target.value })} placeholder="예: 95또래" /></label>
  </div>;
}

export function CommunityNewsEditor({ value, onChange }: { value: CommunityNews[]; onChange: (news: CommunityNews[]) => void }) {
  const update = (index: number, news: CommunityNews) => onChange(value.map((item, i) => i === index ? news : item));
  return <section className="editor-card"><div className="editor-card-head"><span className="editor-card-number">04</span><div><h2>교우 소식</h2><p>새가족·등반 명단과 결혼·군입대 소식을 등록해 주세요.</p></div></div>
    {value.map((news, index) => {
      const weddings = news.weddings ?? (news.wedding ? [news.wedding] : undefined);
      const legacy = !news.people && !weddings && news.category !== '군입대';
      const updateWeddings = (weddings: CommunityWedding[]) => {
        const { wedding: _legacyWedding, ...rest } = news;
        update(index, { ...rest, weddings });
      };
      return <div className="promo-editor" key={index}>
        <div className="promo-editor-head"><strong>소식 {index + 1}</strong><button type="button" className="icon-button" aria-label={`소식 ${index + 1} 삭제`} onClick={() => onChange(value.filter((_, i) => i !== index))}><Trash2 size={17} /></button></div>
        <label className="field">구분<select value={news.category} onChange={(e) => {
          const category = e.target.value as CommunityNews['category'];
          // Keep the entered roster when switching between the two member categories.
          update(index, news.people && (category === '새가족' || category === '등반') ? { ...news, category } : createCommunityNews(category));
        }}><option>새가족</option><option>등반</option><option>결혼</option><option>군입대</option></select></label>
        {legacy || news.category === '군입대' ? <>
          <label className="field">내용<textarea rows={3} maxLength={300} value={news.content} onChange={(e) => update(index, { ...news, content: e.target.value })} placeholder="이름 또는 소식" /></label>
          {legacy && <button type="button" className="add-button" onClick={() => update(index, createCommunityNews(news.category))}><Plus size={16} /> 항목별로 새로 입력</button>}
        </> : news.category === '새가족' || news.category === '등반' ? <>
          {(news.people || []).map((person, personIndex) => <div className="community-person-editor" key={personIndex}>
            <div className="promo-editor-head"><strong>{news.category} {personIndex + 1}</strong><button type="button" className="icon-button" aria-label={`${news.category} ${personIndex + 1} 삭제`} disabled={news.people!.length <= 1} onClick={() => update(index, { ...news, people: news.people!.filter((_, i) => i !== personIndex) })}><Trash2 size={16} /></button></div>
            <PersonFields person={person} onChange={(person) => update(index, { ...news, people: news.people!.map((item, i) => i === personIndex ? person : item) })} />
          </div>)}
          <button type="button" className="add-button" disabled={(news.people?.length || 0) >= 100} onClick={() => update(index, { ...news, people: [...(news.people || []), emptyPerson()] })}><Plus size={16} /> {news.category} 추가</button>
        </> : weddings ? <>
          {weddings.map((wedding, weddingIndex) => {
            const changeWedding = (change: Partial<CommunityWedding>) => updateWeddings(weddings.map((item, i) => i === weddingIndex ? { ...item, ...change } : item));
            return <div className="community-wedding-editor" role="group" aria-label={`커플 ${weddingIndex + 1}`} key={weddingIndex}>
              <div className="promo-editor-head"><strong>커플 {weddingIndex + 1}</strong><button type="button" className="icon-button" aria-label={`커플 ${weddingIndex + 1} 삭제`} disabled={weddings.length <= 1} onClick={() => updateWeddings(weddings.filter((_, i) => i !== weddingIndex))}><Trash2 size={16} /></button></div>
              <PersonFields prefix="신랑 " person={wedding.groom} onChange={(groom) => changeWedding({ groom })} />
              <PersonFields prefix="신부 " person={wedding.bride} onChange={(bride) => changeWedding({ bride })} />
              <label className="field">일시<input value={wedding.dateTime} maxLength={120} onChange={(e) => changeWedding({ dateTime: e.target.value })} placeholder="예: 2026년 11월 14일 (토) 오후 2시" /></label>
              <label className="field">장소<input value={wedding.location} maxLength={200} onChange={(e) => changeWedding({ location: e.target.value })} placeholder="예식장 이름과 홀" /></label>
            </div>;
          })}
          <button type="button" className="add-button" disabled={weddings.length >= 30} onClick={() => updateWeddings([...weddings, emptyWedding()])}><Plus size={16} /> 커플 추가</button>
        </> : null}
      </div>;
    })}
    <button type="button" className="add-button" disabled={value.length >= 30} onClick={() => onChange([...value, createCommunityNews()])}><Plus size={16} /> 교우 소식 추가</button>
  </section>;
}
