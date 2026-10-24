import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, CalendarDays, Check, ChevronRight, Eye, ImagePlus, LogOut, Plus, Save, Settings2, Trash2, UploadCloud, X } from 'lucide-react';
import { api, authClient, coverUrl, json, shortDate, type Bulletin, type BulletinInput, type BulletinListItem, type SiteInfo } from './lib';
import { BulletinContent } from './public';

type AdminStatus = 'checking' | 'ready' | 'login' | 'forbidden' | 'error';
function ErrorNote({ text }: { text: string }) { return text ? <div className="form-error" role="alert">{text}</div> : null; }

export function AdminPage() {
  const [status, setStatus] = useState<AdminStatus>('checking');
  const [error, setError] = useState('');
  const location = useLocation();
  const navigate = useNavigate();
  useEffect(() => {
    let active = true;
    api<{ userId: string }>('/v1/admin/me').then(() => { if (active) setStatus('ready'); }).catch((reason) => {
      if (!active) return;
      if (reason?.status === 401) setStatus('login');
      else if (reason?.status === 403) setStatus('forbidden');
      else { setStatus('error'); setError(reason instanceof Error ? reason.message : '연결할 수 없습니다.'); }
    });
    return () => { active = false; };
  }, []);
  async function signIn() {
    setError('');
    const result = await authClient.signIn.social({ provider: 'google', callbackURL: `${window.location.origin}/admin` });
    if (result.error) setError(result.error.message || '로그인에 실패했습니다.');
  }
  async function signOut() { await authClient.signOut(); setStatus('login'); navigate('/admin'); }
  if (status !== 'ready') return <div className="admin-auth-screen"><Link to="/" className="auth-home"><ArrowLeft size={17} /> 주보로 돌아가기</Link><div className="auth-card"><span className="auth-emblem">✦</span><span className="eyebrow dark">BULLETIN STUDIO</span><h1>주보 관리</h1>
    {status === 'checking' ? <p>관리자 권한을 확인하고 있습니다.</p> : status === 'login' ? <><p>교회에서 승인한 Google 계정으로 로그인해 주세요.</p><button className="primary-button full" onClick={signIn}>Google로 로그인 <ArrowRight size={17} /></button></> : status === 'forbidden' ? <><p>로그인한 계정에 관리자 권한이 없습니다.<br />배포 관리자에게 계정 승인을 요청해 주세요.</p><button className="secondary-button full" onClick={signOut}>다른 계정으로 로그인</button></> : <p>{error}</p>}
    <ErrorNote text={error} /></div></div>;
  const path = location.pathname;
  return <div className="admin-shell"><aside className="admin-sidebar"><Link to="/admin" className="admin-brand"><span>✦</span><div><strong>주보 관리</strong><small>선한목자 젊은이교회</small></div></Link><nav aria-label="관리자 메뉴"><Link className={path === '/admin' ? 'active' : ''} to="/admin"><CalendarDays size={18} /> 주보 목록</Link><Link className={path.includes('site-info') ? 'active' : ''} to="/admin/site-info"><Settings2 size={18} /> 교회 안내</Link></nav><div className="admin-sidebar-bottom"><Link to="/"><Eye size={17} /> 공개 주보 보기</Link><button onClick={signOut}><LogOut size={17} /> 로그아웃</button></div></aside>
    <main className="admin-main"><div className="admin-topbar"><Link to="/admin" className="admin-mobile-brand">✦ <strong>주보 관리</strong></Link><span>선한목자 젊은이교회</span><Link to="/" title="공개 주보"><Eye size={19} /></Link></div><nav className="admin-mobile-nav" aria-label="관리자 메뉴"><Link className={!path.includes('site-info') ? 'active' : ''} to="/admin">주보 목록</Link><Link className={path.includes('site-info') ? 'active' : ''} to="/admin/site-info">교회 안내</Link><button onClick={signOut}>로그아웃</button></nav>
      {path.includes('site-info') ? <SiteInfoEditor /> : path.startsWith('/admin/bulletins/') ? <BulletinEditor key={path} id={path.split('/').at(-1)!} /> : <BulletinIndex />}
    </main></div>;
}

function BulletinIndex() {
  const [items, setItems] = useState<BulletinListItem[]>([]);
  const [date, setDate] = useState('');
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  useEffect(() => { api<{ items: BulletinListItem[] }>('/v1/admin/bulletins').then((r) => setItems(r.items)).catch((e) => setError(e.message)); }, []);
  async function create() {
    if (!date) { setError('예배 날짜를 선택해 주세요.'); return; }
    setBusy(true); setError('');
    try { const result = await api<{ id: string }>('/v1/admin/bulletins', json({ serviceDate: date }, 'POST')); navigate(`/admin/bulletins/${result.id}`); }
    catch (e) { setError(e instanceof Error ? e.message : '주보를 만들지 못했습니다.'); }
    finally { setBusy(false); }
  }
  return <div className="admin-page"><div className="admin-page-heading"><div><span className="eyebrow dark">WEEKLY BULLETINS</span><h1>주보 목록</h1><p>새 주보를 작성하고 발행 상태를 확인하세요.</p></div><button className="primary-button" onClick={() => setCreating(true)}><Plus size={18} /> 새 주보 만들기</button></div>
    {creating && <div className="create-panel"><div><strong>새 주보 만들기</strong><p>마지막 주보의 예배 순서 이름만 가져옵니다.</p></div><div className="create-controls"><input aria-label="예배 날짜" type="date" value={date} onChange={(e) => setDate(e.target.value)} /><button className="primary-button" disabled={busy} onClick={create}>{busy ? '만드는 중…' : '만들기'}</button><button className="icon-button" aria-label="닫기" onClick={() => setCreating(false)}><X size={20} /></button></div></div>}
    <ErrorNote text={error} />
    <div className="admin-list">{items.map((item) => <Link to={`/admin/bulletins/${item.id}`} className="admin-list-row" key={item.id}><span className="admin-date-icon"><CalendarDays size={20} /></span><span className="admin-list-content"><small>{shortDate(item.serviceDate)}</small><strong>{item.theme || '제목을 입력해 주세요'}</strong></span><span className={`status-chip ${item.status}`}>{item.status === 'published' ? '발행됨' : '초안'}</span><ChevronRight size={19} /></Link>)}
      {items.length === 0 && !error && <div className="admin-empty"><CalendarDays size={28} /><h2>아직 주보가 없습니다</h2><p>첫 주보를 만들어 예배 내용을 채워 주세요.</p></div>}</div>
  </div>;
}

function BulletinEditor({ id }: { id: string }) {
  const [bulletin, setBulletin] = useState<Bulletin | null>(null);
  const [siteInfo, setSiteInfo] = useState<SiteInfo | null>(null);
  const [form, setForm] = useState<BulletinInput | null>(null);
  const [dirty, setDirty] = useState(false);
  const [preview, setPreview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  useEffect(() => {
    Promise.all([api<{ bulletin: Bulletin }>(`/v1/admin/bulletins/${id}`), api<{ siteInfo: SiteInfo }>('/v1/admin/site-info')]).then(([b, s]) => {
      setBulletin(b.bulletin); setSiteInfo(s.siteInfo); setForm(toInput(b.bulletin));
    }).catch((e) => setError(e.message));
  }, [id]);
  function update(change: Partial<BulletinInput>) { setForm((value) => value ? { ...value, ...change } : null); setDirty(true); setNotice(''); }
  function itemChange(index: number, key: 'label' | 'assignee', value: string) {
    if (!form) return; const copy = [...form.worshipItems]; copy[index] = { ...copy[index], [key]: value }; update({ worshipItems: copy });
  }
  function promotionChange(index: number, key: 'title' | 'body' | 'url', value: string) {
    if (!form) return; const copy = [...form.promotions]; copy[index] = { ...copy[index], [key]: value }; update({ promotions: copy });
  }
  async function save() {
    if (!form) return false;
    setBusy(true); setError(''); setNotice('');
    try { const result = await api<{ bulletin: Bulletin }>(`/v1/admin/bulletins/${id}`, json(form)); setBulletin(result.bulletin); setForm(toInput(result.bulletin)); setDirty(false); setNotice('초안을 저장했습니다.'); return true; }
    catch (e) { setError(e instanceof Error ? e.message : '저장하지 못했습니다.'); return false; }
    finally { setBusy(false); }
  }
  async function publish() {
    if (dirty) { setError('변경 내용을 먼저 저장해 주세요.'); return; }
    setBusy(true); setError(''); setNotice('');
    try { const result = await api<{ bulletin: Bulletin }>(`/v1/admin/bulletins/${id}/publish`, { method: 'POST' }); setBulletin(result.bulletin); setNotice('주보를 발행했습니다. 공개 주소에서 확인할 수 있습니다.'); }
    catch (e) { setError(e instanceof Error ? e.message : '발행하지 못했습니다.'); }
    finally { setBusy(false); }
  }
  async function upload(file: File) {
    if (!form?.coverAltText.trim()) { setError('이미지 대체 텍스트를 입력해 주세요.'); return; }
    setUploading(true); setError('');
    try { const body = new FormData(); body.append('file', file); body.append('altText', form.coverAltText.trim());
      const result = await api<{ id: string; url: string }>('/v1/admin/media', { method: 'POST', body });
      update({ coverMediaId: result.id }); setBulletin((b) => b ? { ...b, cover: { objectKey: result.url.split('/').at(-1)!, altText: form.coverAltText.trim() } } : b);
    } catch (e) { setError(e instanceof Error ? e.message : '이미지를 올리지 못했습니다.'); }
    finally { setUploading(false); }
  }
  if (!form || !bulletin || !siteInfo) return <div className="admin-page"><Link to="/admin" className="back-link"><ArrowLeft size={16} /> 주보 목록</Link><div className="admin-empty">{error || '주보를 불러오는 중입니다.'}</div></div>;
  const previewBulletin: Bulletin = { ...bulletin, ...form, cover: form.coverMediaId && bulletin.cover ? { ...bulletin.cover, altText: form.coverAltText } : null };
  return <div className="admin-page"><div className="editor-heading"><Link to="/admin" className="back-link"><ArrowLeft size={16} /> 주보 목록</Link><div className="admin-page-heading"><div><span className="eyebrow dark">BULLETIN EDITOR</span><h1>{bulletin.status === 'published' ? '주보 수정' : '주보 작성'}</h1><p>내용을 저장한 뒤 모바일 미리보기에서 확인하고 발행하세요.</p></div><span className={`status-chip ${bulletin.status}`}>{bulletin.status === 'published' ? '발행됨' : '초안'}</span></div></div>
    <div className="editor-actions"><button className="secondary-button" onClick={() => setPreview(true)}><Eye size={17} /> 모바일 미리보기</button><button className="secondary-button" disabled={busy} onClick={save}><Save size={17} /> {busy ? '처리 중…' : '저장'}</button>{bulletin.status === 'draft' && <button className="primary-button" disabled={busy || dirty} onClick={publish}><Check size={17} /> 발행</button>}</div>
    <ErrorNote text={error} />{notice && <div className="form-notice" role="status">{notice}</div>}
    <div className="editor-grid"><div className="editor-column"><section className="editor-card"><div className="editor-card-head"><span className="editor-card-number">01</span><div><h2>표지</h2><p>이번 주 예배의 첫 화면입니다.</p></div></div><div className="field-grid"><label className="field">예배 날짜<input type="date" value={form.serviceDate} disabled={bulletin.status === 'published'} onChange={(e) => update({ serviceDate: e.target.value })} /></label><label className="field">이번 주 주제<input value={form.theme} maxLength={160} onChange={(e) => update({ theme: e.target.value })} placeholder="예: 함께 걷는 믿음" /></label></div>
      <div className="upload-box"><ImagePlus size={22} /><div><strong>대표 이미지</strong><p>선택 사항 · JPG, PNG, WebP · 5MB 이하 · 최대 2400px 너비</p></div></div>
      <label className="field">이미지 대체 텍스트<input value={form.coverAltText} onChange={(e) => update({ coverAltText: e.target.value })} maxLength={200} placeholder="이미지에 보이는 내용을 설명해 주세요" /></label>
      <div className="upload-actions"><label className="secondary-button upload-button"><UploadCloud size={17} /> {uploading ? '업로드 중…' : '이미지 선택'}<input type="file" accept="image/jpeg,image/png,image/webp" disabled={uploading} onChange={(e) => { const file = e.target.files?.[0]; if (file) void upload(file); e.target.value = ''; }} /></label>{form.coverMediaId && <button className="text-button" onClick={() => { update({ coverMediaId: null, coverAltText: '' }); setBulletin((b) => b ? { ...b, cover: null } : b); }}>이미지 제거</button>}</div>
      {form.coverMediaId && bulletin.cover && <img className="editor-cover-thumb" src={coverUrl(bulletin) || ''} alt={bulletin.cover.altText} />}
    </section>
    <section className="editor-card"><div className="editor-card-head"><span className="editor-card-number">02</span><div><h2>예배 순서</h2><p>순서명과 담당자를 입력해 주세요.</p></div></div><div className="editable-list">{form.worshipItems.map((item, index) => <div className="editable-row" key={index}><span className="row-index">{String(index + 1).padStart(2, '0')}</span><input aria-label={`${index + 1}번째 순서명`} value={item.label} onChange={(e) => itemChange(index, 'label', e.target.value)} placeholder="순서명" /><input aria-label={`${index + 1}번째 담당자`} value={item.assignee} onChange={(e) => itemChange(index, 'assignee', e.target.value)} placeholder="담당자" /><div className="row-actions"><button aria-label="위로" disabled={index === 0} onClick={() => update({ worshipItems: move(form.worshipItems, index, index - 1) })}><ArrowUp size={15} /></button><button aria-label="아래로" disabled={index === form.worshipItems.length - 1} onClick={() => update({ worshipItems: move(form.worshipItems, index, index + 1) })}><ArrowDown size={15} /></button><button aria-label="삭제" onClick={() => update({ worshipItems: form.worshipItems.filter((_, i) => i !== index) })}><Trash2 size={15} /></button></div></div>)}</div><button className="add-button" disabled={form.worshipItems.length >= 30} onClick={() => update({ worshipItems: [...form.worshipItems, { label: '', assignee: '' }] })}><Plus size={16} /> 순서 추가</button></section>
    <section className="editor-card"><div className="editor-card-head"><span className="editor-card-number">03</span><div><h2>설교</h2><p>오늘의 말씀을 소개합니다.</p></div></div><label className="field">설교 제목<input value={form.sermonTitle} onChange={(e) => update({ sermonTitle: e.target.value })} placeholder="설교 제목" /></label><div className="field-grid"><label className="field">성경 본문<input value={form.scripture} onChange={(e) => update({ scripture: e.target.value })} placeholder="예: 요한복음 15:1–8" /></label><label className="field">설교자<input value={form.preacher} onChange={(e) => update({ preacher: e.target.value })} placeholder="설교자 이름" /></label></div></section>
    <section className="editor-card"><div className="editor-card-head"><span className="editor-card-number">04</span><div><h2>홍보 카드</h2><p>최대 3개까지 등록할 수 있습니다.</p></div></div>{form.promotions.map((promo, index) => <div className="promo-editor" key={index}><div className="promo-editor-head"><strong>홍보 {index + 1}</strong><button className="icon-button" aria-label="홍보 삭제" onClick={() => update({ promotions: form.promotions.filter((_, i) => i !== index) })}><Trash2 size={17} /></button></div><label className="field">제목<input value={promo.title} onChange={(e) => promotionChange(index, 'title', e.target.value)} placeholder="홍보 제목" /></label><label className="field">설명<textarea value={promo.body} onChange={(e) => promotionChange(index, 'body', e.target.value)} rows={3} placeholder="짧은 안내 내용을 입력해 주세요" /></label><label className="field">링크 <small>선택</small><input type="url" value={promo.url} onChange={(e) => promotionChange(index, 'url', e.target.value)} placeholder="https://" /></label></div>)}<button className="add-button" disabled={form.promotions.length >= 3} onClick={() => update({ promotions: [...form.promotions, { title: '', body: '', url: '' }] })}><Plus size={16} /> 홍보 카드 추가</button></section>
    </div><aside className="editor-guide"><div className="guide-card"><span className="eyebrow dark">PUBLISHING GUIDE</span><h3>발행 전 확인</h3><ul><li>예배 날짜와 주제를 입력했나요?</li><li>모든 예배 순서에 담당자가 있나요?</li><li>설교 정보가 정확한가요?</li><li>홍보 링크가 있다면 열리나요?</li></ul><p>저장만 하면 공개 주보는 바뀌지 않습니다. 발행 버튼을 누르면 같은 QR 주소에 새 주보가 표시됩니다.</p></div><button className="preview-aside" onClick={() => setPreview(true)}><Eye size={20} /><span><strong>모바일 미리보기</strong><small>실제 방문자 화면으로 확인</small></span><ChevronRight size={18} /></button></aside></div>
    {preview && <div className="preview-overlay" role="dialog" aria-modal="true" aria-label="모바일 미리보기"><div className="preview-dialog"><div className="preview-toolbar"><strong>모바일 미리보기</strong><button className="icon-button" aria-label="닫기" onClick={() => setPreview(false)}><X size={21} /></button></div><div className="preview-device"><BulletinContent data={{ bulletin: previewBulletin, siteInfo }} preview /></div><div className="preview-footer"><button className="secondary-button" onClick={() => setPreview(false)}>편집으로 돌아가기</button></div></div></div>}
  </div>;
}

function toInput(b: Bulletin): BulletinInput { return { serviceDate: b.serviceDate, theme: b.theme, coverMediaId: b.coverMediaId, coverAltText: b.cover?.altText || '', sermonTitle: b.sermonTitle, scripture: b.scripture, preacher: b.preacher, worshipItems: b.worshipItems, promotions: b.promotions }; }
function move<T>(array: T[], from: number, to: number): T[] { const result = [...array]; const [item] = result.splice(from, 1); result.splice(to, 0, item); return result; }

function SiteInfoEditor() {
  const [form, setForm] = useState<SiteInfo | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  useEffect(() => { api<{ siteInfo: SiteInfo }>('/v1/admin/site-info').then((r) => setForm(r.siteInfo)).catch((e) => setError(e.message)); }, []);
  function update(key: keyof SiteInfo, value: string) { setForm((f) => f ? { ...f, [key]: value } : f); setNotice(''); }
  async function save() {
    if (!form) return;
    setBusy(true); setError(''); setNotice('');
    try { await api('/v1/admin/site-info', json(form)); setNotice('교회 안내를 저장했습니다. 공개 주보에도 반영됩니다.'); }
    catch (e) { setError(e instanceof Error ? e.message : '저장하지 못했습니다.'); }
    finally { setBusy(false); }
  }
  if (!form) return <div className="admin-page"><div className="admin-empty">{error || '교회 안내를 불러오는 중입니다.'}</div></div>;
  return <div className="admin-page"><div className="admin-page-heading"><div><span className="eyebrow dark">CHURCH INFORMATION</span><h1>교회 안내</h1><p>여기서 수정한 내용은 모든 주보에 함께 표시됩니다.</p></div><button className="primary-button" disabled={busy} onClick={save}><Save size={17} /> 저장</button></div><ErrorNote text={error} />{notice && <div className="form-notice" role="status">{notice}</div>}
    <div className="site-editor-grid"><section className="editor-card"><div className="editor-card-head"><span className="editor-card-number">✦</span><div><h2>기본 정보</h2><p>방문자에게 보이는 교회 안내입니다.</p></div></div>
      <label className="field">교회명<input value={form.churchName} onChange={(e) => update('churchName', e.target.value)} /></label>
      <label className="field">예배 시간<textarea rows={2} value={form.worshipTime} onChange={(e) => update('worshipTime', e.target.value)} placeholder="실제 예배 시간과 장소를 입력해 주세요" /></label>
      <label className="field">모임 시간<textarea rows={2} value={form.gatheringTime} onChange={(e) => update('gatheringTime', e.target.value)} placeholder="정기 모임 시간과 장소" /></label>
      <label className="field">교회 소개<textarea rows={5} value={form.introduction} onChange={(e) => update('introduction', e.target.value)} placeholder="교회를 소개해 주세요" /></label>
      <label className="field">비전<textarea rows={5} value={form.vision} onChange={(e) => update('vision', e.target.value)} placeholder="교회의 비전을 적어 주세요" /></label>
      <label className="field">주소<input value={form.address} onChange={(e) => update('address', e.target.value)} placeholder="실제 주소를 입력해 주세요" /></label>
      <label className="field">지도 링크<input type="url" value={form.mapUrl} onChange={(e) => update('mapUrl', e.target.value)} placeholder="https://" /></label>
    </section><aside className="guide-card"><span className="eyebrow dark">NOTE</span><h3>안내 내용 관리</h3><p>예배·모임 시간, 주소와 지도 링크는 실제 운영 정보를 확인한 뒤 입력해 주세요. 저장하면 이번 주와 지난 주보 모두에 최신 안내가 표시됩니다.</p><Link className="text-link" to="/">공개 화면 확인 <ArrowRight size={16} /></Link></aside></div>
  </div>;
}
