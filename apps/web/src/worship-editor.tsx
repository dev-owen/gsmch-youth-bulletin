import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import type { SermonContent, WorshipItem } from './lib';
import './worship-editor.css';

export function WorshipEditor({ value, sermon, preacher, onChange }: {
  value: WorshipItem[]; sermon: SermonContent; preacher: string; onChange: (items: WorshipItem[]) => void;
}) {
  function change(index: number, item: WorshipItem) {
    onChange(value.map((current, i) => i === index ? item : current));
  }
  function changeType(index: number, type: WorshipItem['type']) {
    const item = value[index];
    if (item.type === type) return;
    change(index, type === 'sermon'
      ? { type, label: item.label || '설교', content: { ...sermon }, assignee: item.assignee || preacher }
      : { type, label: item.label, content: '', assignee: item.assignee });
  }
  function move(from: number, to: number) {
    const items = [...value];
    const [item] = items.splice(from, 1);
    items.splice(to, 0, item);
    onChange(items);
  }
  return <section className="editor-card">
    <div className="editor-card-head"><span className="editor-card-number">02</span><div><h2>예배 순서</h2><p>설교는 설교 주제와 말씀 구절을 입력해 주세요.</p></div></div>
    <div className="editable-list">{value.map((item, index) => <div className={`worship-item-editor${item.type === 'sermon' ? ' is-sermon' : ''}`} key={index}>
      <div className="worship-item-heading"><span className="row-index">{String(index + 1).padStart(2, '0')}</span>
        <label className="field">순서 타입<select aria-label={`${index + 1}번째 순서 타입`} value={item.type} onChange={(e) => changeType(index, e.target.value as WorshipItem['type'])}><option value="text">일반</option><option value="sermon">설교</option></select></label>
        <label className="field">순서명<input aria-label={`${index + 1}번째 순서명`} value={item.label} maxLength={120} onChange={(e) => {
          const label = e.target.value;
          change(index, item.type === 'text' && label.trim() === '설교'
            ? { type: 'sermon', label, content: { ...sermon }, assignee: item.assignee || preacher }
            : { ...item, label });
        }} placeholder="순서명" /></label>
      </div>
      <div className="worship-item-content">{item.type === 'sermon'
        ? <><label className="field">설교 주제<input aria-label={`${index + 1}번째 설교 주제`} value={item.content.sermonTitle} maxLength={200} onChange={(e) => change(index, { ...item, content: { ...item.content, sermonTitle: e.target.value } })} placeholder="설교 주제" /></label><label className="field">말씀 구절<input aria-label={`${index + 1}번째 말씀 구절`} value={item.content.scripture} maxLength={200} onChange={(e) => change(index, { ...item, content: { ...item.content, scripture: e.target.value } })} placeholder="예: 요한복음 15:1–8" /></label></>
        : <label className="field">내용<input aria-label={`${index + 1}번째 내용`} value={item.content} maxLength={300} onChange={(e) => change(index, { ...item, content: e.target.value })} placeholder="내용 (선택)" /></label>}
        <label className="field">{item.type === 'sermon' ? '설교자' : '담당자'}<input aria-label={`${index + 1}번째 담당자`} value={item.assignee} maxLength={100} onChange={(e) => change(index, { ...item, assignee: e.target.value })} placeholder={item.type === 'sermon' ? '설교자 이름' : '담당자'} /></label>
      </div>
      <div className="row-actions"><button aria-label={`${index + 1}번째 순서 위로`} disabled={index === 0} onClick={() => move(index, index - 1)}><ArrowUp size={15} /></button><button aria-label={`${index + 1}번째 순서 아래로`} disabled={index === value.length - 1} onClick={() => move(index, index + 1)}><ArrowDown size={15} /></button><button aria-label={`${index + 1}번째 순서 삭제`} onClick={() => onChange(value.filter((_, i) => i !== index))}><Trash2 size={15} /></button></div>
    </div>)}</div>
    <div className="worship-add-actions"><button className="add-button" disabled={value.length >= 30} onClick={() => onChange([...value, { type: 'text', label: '', content: '', assignee: '' }])}><Plus size={16} /> 순서 추가</button><button className="add-button" disabled={value.length >= 30} onClick={() => onChange([...value, { type: 'sermon', label: '설교', content: { ...sermon }, assignee: preacher }])}><Plus size={16} /> 설교 추가</button></div>
  </section>;
}
