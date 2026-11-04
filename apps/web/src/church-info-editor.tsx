import type { DirectoryGroup, RecurringInfo } from './church-info';

function Field({ label, value, onChange, rows = 2, maxLength = 2000 }: { label: string; value: string; onChange: (value: string) => void; rows?: number; maxLength?: number }) {
  return <label className="field">{label}<textarea value={value} rows={rows} maxLength={maxLength} onChange={(event) => onChange(event.target.value)} /></label>;
}

function Directories({ groups, onChange, staff = false }: { groups: DirectoryGroup[]; onChange: (groups: DirectoryGroup[]) => void; staff?: boolean }) {
  return <>{groups.map((group, index) => <Field key={index} label={group.title} value={group.entries.join('\n')} rows={Math.min(9, group.entries.length + 1)} maxLength={20000} onChange={(value) => onChange(groups.map((item, i) => i === index ? { ...item, entries: value.split('\n') } : item))} />)}<p className="editor-field-help">한 줄에 한 항목씩 입력하세요.{staff && ' 역할과 이름은 | 기호로 구분합니다. 예: 예배팀 | 문슬기 · 이은혜'}</p></>;
}

export function RecurringInfoEditor({ value, onChange }: { value: RecurringInfo; onChange: (value: RecurringInfo) => void }) {
  function update<K extends keyof RecurringInfo>(key: K, next: RecurringInfo[K]) { onChange({ ...value, [key]: next }); }
  return <>
    <section className="editor-card"><div className="editor-card-head"><div><h2>모임·새가족 안내</h2><p>매주 표시할 모임 시간, 장소와 등록 안내입니다.</p></div></div>
      <Field label="새가족 환영 문구" value={value.newcomer.welcome} maxLength={1000} onChange={(welcome) => update('newcomer', { ...value.newcomer, welcome })} />
      <Field label="새가족 등록 장소·안내" value={value.newcomer.guidance} onChange={(guidance) => update('newcomer', { ...value.newcomer, guidance })} />
      {value.meetings.map((meeting, index) => <fieldset className="recurring-fieldset" key={index}><legend>{meeting.title}</legend>
        {(['title', 'schedule', 'location', 'description', 'contact'] as const).map((key) => <Field key={key} label={{ title: '모임명', schedule: '시간', location: '장소', description: '모임 설명·상세 일정', contact: '문의' }[key]} value={meeting[key]} rows={key === 'description' ? 4 : 2} maxLength={{ title: 120, schedule: 500, location: 500, description: 2000, contact: 300 }[key]} onChange={(next) => update('meetings', value.meetings.map((item, i) => i === index ? { ...item, [key]: next } : item))} />)}
      </fieldset>)}<p className="editor-field-help">노방전도처럼 월별 일정이 있는 모임은 상세 일정을 갱신해 주세요.</p>
    </section>
    <section className="editor-card"><div className="editor-card-head"><div><h2>헌금안내</h2><p>계좌와 헌금 방법을 모든 주보에서 함께 사용합니다.</p></div></div>
      {(['bank', 'accountNumber', 'accountHolder', 'envelope', 'transfer', 'example', 'mainChurch'] as const).map((key) => <Field key={key} label={{ bank: '은행', accountNumber: '계좌번호', accountHolder: '예금주', envelope: '봉투헌금', transfer: '온라인헌금', example: '송금 입력 예시', mainChurch: '본교회 예배를 드리는 경우' }[key]} value={value.offering[key]} rows={key === 'transfer' ? 4 : 2} maxLength={['bank', 'accountNumber', 'accountHolder'].includes(key) ? 100 : key === 'example' ? 200 : 2000} onChange={(next) => update('offering', { ...value.offering, [key]: next })} />)}
    </section>
    <section className="editor-card"><div className="editor-card-head"><div><h2>비전의 세 가지 방향</h2><p>위 기본 정보의 비전 문구와 함께 표시됩니다.</p></div></div>
      <Field label="비전 성경 구절" value={value.visionReference} maxLength={200} onChange={(next) => update('visionReference', next)} />
      {value.visionPoints.map((point, index) => <fieldset className="recurring-fieldset" key={index}><legend>{point.title}</legend>{(['title', 'body', 'reference'] as const).map((key) => <Field key={key} label={{ title: '제목', body: '내용', reference: '성경 구절' }[key]} value={point[key]} maxLength={{ title: 120, body: 1000, reference: 200 }[key]} onChange={(next) => update('visionPoints', value.visionPoints.map((item, i) => i === index ? { ...item, [key]: next } : item))} />)}</fieldset>)}
    </section>
    <section className="editor-card"><div className="editor-card-head"><div><h2>섬기는 교회·선교사·선교기관</h2><p>사역별 명단을 나누어 관리합니다.</p></div></div><Directories groups={value.missionGroups} onChange={(next) => update('missionGroups', next)} /><Field label="선교 안내 주석" value={value.missionNote} maxLength={500} onChange={(next) => update('missionNote', next)} /></section>
    <section className="editor-card"><div className="editor-card-head"><div><h2>섬기는 분들</h2><p>담당 역할과 이름을 함께 입력하세요.</p></div></div><Directories groups={value.staffGroups} staff onChange={(next) => update('staffGroups', next)} /></section>
  </>;
}
