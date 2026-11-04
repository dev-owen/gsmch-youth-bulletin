import { CalendarDays, Plus, Trash2 } from 'lucide-react';
import type { Promotion, PromotionDetail, PromotionSchedule } from './lib';

export function PromotionEditor({ value, serviceDate, onChange }: { value: Promotion[]; serviceDate: string; onChange: (value: Promotion[]) => void }) {
  const newSchedule = (): PromotionSchedule => ({ startDate: serviceDate, endDate: serviceDate, allDay: true, startTime: '', endTime: '' });
  function update(index: number, change: Partial<Promotion>) {
    onChange(value.map((promotion, i) => i === index ? { ...promotion, ...change } : promotion));
  }
  function updateDetail(index: number, detailIndex: number, change: Partial<PromotionDetail>) {
    update(index, { details: value[index].details.map((detail, i) => i === detailIndex ? { ...detail, ...change } : detail) });
  }
  function updateSchedule(index: number, detailIndex: number, change: Partial<PromotionSchedule>) {
    const schedule = value[index].details[detailIndex].schedule || newSchedule();
    updateDetail(index, detailIndex, { schedule: { ...schedule, ...change } });
  }
  return <section className="editor-card promotion-editor-card"><div className="editor-card-head"><span className="editor-card-number">05</span><div><h2>광고</h2><p>세부 내용을 일정으로 설정하면 주보 캘린더에 자동으로 표시됩니다.</p></div></div>
    {value.map((promotion, index) => <div className="promo-editor" key={index}>
      <div className="promo-editor-head"><strong>광고 {index + 1}</strong><button className="icon-button" aria-label="광고 삭제" onClick={() => onChange(value.filter((_, i) => i !== index))}><Trash2 size={17} /></button></div>
      <label className="field">제목<input value={promotion.title} maxLength={120} onChange={(e) => update(index, { title: e.target.value })} placeholder="광고 제목" /></label>
      <label className="field">설명<textarea value={promotion.body} maxLength={1000} onChange={(e) => update(index, { body: e.target.value })} rows={3} placeholder="광고 설명" /></label>
      <div className="promotion-details"><strong>세부 내용</strong>
        {promotion.details.map((detail, detailIndex) => <div className="promo-detail" key={detailIndex}>
          <label className="field">내용 타입<select value={detail.type || 'text'} onChange={(e) => updateDetail(index, detailIndex, {
            type: e.target.value as 'text' | 'schedule',
            schedule: e.target.value === 'schedule' ? detail.schedule || newSchedule() : undefined,
          })}><option value="text">일반</option><option value="schedule">일정</option></select></label>
          <label className="field">제목<input value={detail.title} maxLength={120} onChange={(e) => updateDetail(index, detailIndex, { title: e.target.value })} placeholder={detail.type === 'schedule' ? '예: 수련회, 신청 기간' : '세부 제목'} /></label>
          {detail.type === 'schedule' && <ScheduleFields value={detail.schedule || newSchedule()} onChange={(change) => updateSchedule(index, detailIndex, change)} />}
          <label className="field">{detail.type === 'schedule' ? '안내 내용 (선택)' : '본문'}<textarea rows={2} value={detail.body} maxLength={1000} onChange={(e) => updateDetail(index, detailIndex, { body: e.target.value })} placeholder={detail.type === 'schedule' ? '장소나 안내 내용을 적어 주세요' : '세부 내용'} /></label>
          <button className="text-button" onClick={() => update(index, { details: promotion.details.filter((_, i) => i !== detailIndex) })}>세부 내용 삭제</button>
        </div>)}
        <div className="promotion-add-actions">
          <button className="add-button" disabled={promotion.details.length >= 20} onClick={() => update(index, { details: [...promotion.details, { type: 'text', title: '', body: '' }] })}><Plus size={16} /> 세부 내용 추가</button>
          <button className="add-button" disabled={promotion.details.length >= 20} onClick={() => update(index, { details: [...promotion.details, { type: 'schedule', title: promotion.title || '일정', body: '', schedule: newSchedule() }] })}><CalendarDays size={16} /> 일정 추가</button>
        </div>
      </div>
      <label className="field">링크 <small>선택</small><input type="url" value={promotion.url} onChange={(e) => update(index, { url: e.target.value })} placeholder="https://" /></label>
    </div>)}
    <button className="add-button" disabled={value.length >= 10} onClick={() => onChange([...value, { title: '', body: '', details: [], url: '' }])}><Plus size={16} /> 광고 추가</button>
  </section>;
}

function ScheduleFields({ value, onChange }: { value: PromotionSchedule; onChange: (change: Partial<PromotionSchedule>) => void }) {
  return <fieldset className="schedule-fields"><legend><CalendarDays size={16} /> 일정 설정</legend>
    <label className="schedule-all-day"><input type="checkbox" checked={value.allDay} onChange={(e) => onChange({ allDay: e.target.checked, ...(e.target.checked ? { startTime: '', endTime: '' } : {}) })} /> 종일</label>
    <div className="field-grid">
      <label className="field">시작 날짜<input type="date" value={value.startDate} onChange={(e) => onChange({ startDate: e.target.value, ...(value.endDate === value.startDate ? { endDate: e.target.value } : {}) })} /></label>
      <label className="field">종료 날짜 <small>선택</small><input type="date" min={value.startDate} value={value.endDate} onChange={(e) => onChange({ endDate: e.target.value })} /></label>
    </div>
    {!value.allDay && <div className="field-grid">
      <label className="field">시작 시각<input type="time" value={value.startTime} onChange={(e) => onChange({ startTime: e.target.value })} /></label>
      <label className="field">종료 시각 <small>{value.endDate > value.startDate ? '필수' : '선택'}</small><input type="time" value={value.endTime} onChange={(e) => onChange({ endTime: e.target.value })} /></label>
    </div>}
    <p className="schedule-help">시각은 한국 시간 기준입니다. 종료 날짜를 비우면 시작 날짜 하루 일정으로 표시됩니다. 발행하면 캘린더에 자동 반영됩니다.</p>
  </fieldset>;
}
