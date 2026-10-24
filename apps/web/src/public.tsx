import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, ArrowUpRight, BookOpen, CalendarDays, ChevronRight, Clock3, MapPin, Megaphone, Sparkles, WifiOff } from 'lucide-react';
import { api, coverUrl, formatDate, readLatest, saveLatest, shortDate, type Bulletin, type PublicData, type SiteInfo } from './lib';

const CHURCH = '선한목자 젊은이교회';

function Brand({ home = false }: { home?: boolean }) {
  return <header className="site-header"><div className="site-header-inner">
    <Link to="/" className="brand" aria-label="선한목자 젊은이교회 주보 홈"><span className="brand-symbol">✦</span><span><strong>선한목자 젊은이교회</strong><small>YOUTH CHURCH BULLETIN</small></span></Link>
    <Link className="header-link" to={home ? '/archive' : '/'}>{home ? '지난 주보' : '이번 주 주보'} <ArrowUpRight size={15} /></Link>
  </div></header>;
}

function Status({ children }: { children: React.ReactNode }) { return <div className="status-panel" role="status">{children}</div>; }

function Cover({ bulletin, offline }: { bulletin: Bulletin; offline?: boolean }) {
  const image = coverUrl(bulletin);
  return <section className={`cover ${image ? 'cover-image' : 'cover-text'}`}>
    {image && <img className="cover-photo" src={image} alt={bulletin.cover?.altText || ''} />}
    <div className="cover-content">
      <div className="cover-top"><span className="eyebrow"><Sparkles size={13} /> SUNDAY WORSHIP</span>{offline && <span className="offline-badge"><WifiOff size={13} /> 오프라인 저장본</span>}</div>
      <div className="cover-main"><span className="cover-date">{formatDate(bulletin.serviceDate)}</span><span className="cover-line" /><h1>{bulletin.theme || '주일 예배'}</h1><p>함께 예배하는 기쁨, 오늘 이 자리에서</p></div>
      <div className="cover-bottom"><span>{CHURCH}</span><span>WEEKLY BULLETIN · {bulletin.serviceDate}</span></div>
    </div>
  </section>;
}

function SectionHeading({ number, kicker, title, icon }: { number: string; kicker: string; title: string; icon?: React.ReactNode }) {
  return <div className="section-heading"><div><span className="section-kicker">{number} / {kicker}</span><h2>{title}</h2></div>{icon && <span className="section-icon">{icon}</span>}</div>;
}

function SiteInfoCards({ info }: { info: SiteInfo }) {
  const cards = [
    { icon: <Clock3 size={20} />, label: '예배 및 모임', body: [info.worshipTime, info.gatheringTime].filter(Boolean).join('\n') },
    { icon: <BookOpen size={20} />, label: '교회 소개', body: info.introduction },
    { icon: <Sparkles size={20} />, label: '우리의 비전', body: info.vision },
    { icon: <MapPin size={20} />, label: '오시는 길', body: info.address, url: info.mapUrl },
  ];
  return <div className="info-grid">{cards.map((card) => <div className="info-card" key={card.label}>
    <div className="info-icon">{card.icon}</div><div><h3>{card.label}</h3><p>{card.body || '안내를 준비하고 있습니다.'}</p>{card.url && <a href={card.url} target="_blank" rel="noreferrer" className="text-link">지도에서 보기 <ArrowUpRight size={15} /></a>}</div>
  </div>)}</div>;
}

export function BulletinContent({ data, offline = false, preview = false }: { data: PublicData; offline?: boolean; preview?: boolean }) {
  const { bulletin, siteInfo } = data;
  if (!bulletin) return <div className="empty-bulletin"><span className="empty-symbol">✦</span><span className="eyebrow dark">WELCOME TO OUR CHURCH</span><h1>{siteInfo.churchName || CHURCH}</h1><p>새 주보를 준비하고 있습니다.<br />곧 이곳에서 예배 소식을 만나보실 수 있습니다.</p></div>;
  return <>
    <Cover bulletin={bulletin} offline={offline} />
    <div className="bulletin-body">
      <section className="content-section worship-section"><SectionHeading number="01" kicker="ORDER OF WORSHIP" title="예배 순서" icon={<CalendarDays size={23} />} />
        <div className="worship-list">{bulletin.worshipItems.map((item, index) => <div className="worship-row" key={`${index}-${item.label}`}><span className="worship-index">{String(index + 1).padStart(2, '0')}</span><span className="worship-label">{item.label}</span><span className="worship-assignee">{item.assignee}</span></div>)}</div>
      </section>
      <section className="content-section"><SectionHeading number="02" kicker="THE MESSAGE" title="오늘의 말씀" icon={<BookOpen size={23} />} />
        <div className="sermon-card"><span className="sermon-mark">“</span><p className="sermon-scripture">{bulletin.scripture}</p><h3>{bulletin.sermonTitle}</h3><div className="sermon-preacher"><span className="small-rule" />{bulletin.preacher}</div></div>
      </section>
      {bulletin.promotions.length > 0 && <section className="content-section"><SectionHeading number="03" kicker="COMMUNITY NEWS" title="함께하는 소식" icon={<Megaphone size={23} />} />
        <div className="promotion-list">{bulletin.promotions.map((card, index) => <article className="promotion-card" key={`${index}-${card.title}`}><span className="promotion-number">0{index + 1}</span><div><h3>{card.title}</h3><p>{card.body}</p>{card.url && <a href={card.url} target="_blank" rel="noreferrer" className="text-link">자세히 보기 <ArrowUpRight size={16} /></a>}</div></article>)}</div>
      </section>}
      <section className="content-section info-section"><SectionHeading number={bulletin.promotions.length ? '04' : '03'} kicker="ABOUT OUR CHURCH" title="교회 안내" icon={<MapPin size={23} />} /><SiteInfoCards info={siteInfo} /></section>
      {!preview && <Link to="/archive" className="archive-cta"><span><small>PREVIOUS BULLETINS</small><strong>지난 주보 보기</strong></span><span className="round-arrow"><ArrowRight size={20} /></span></Link>}
    </div>
  </>;
}

export function PublicPage({ invalidRoute = false }: { invalidRoute?: boolean }) {
  const { date } = useParams();
  const [data, setData] = useState<PublicData | null>(null);
  const [offline, setOffline] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (invalidRoute || (date && !/^\d{4}-\d{2}-\d{2}$/.test(date))) { setError('페이지를 찾을 수 없습니다.'); return; }
    let active = true;
    setData(null); setOffline(false); setError('');
    api<PublicData>(date ? `/v1/bulletins/${date}` : '/v1/bulletins/current').then((result) => {
      if (!active) return;
      setData(result);
      if (!date) saveLatest(result);
    }).catch((reason) => {
      if (!active) return;
      if (!date && (!(reason instanceof Error && 'status' in reason) || !navigator.onLine)) {
        const cached = readLatest();
        if (cached) { setData(cached); setOffline(true); return; }
        setError('저장된 주보가 없습니다. 인터넷 연결 후 다시 열어 주세요.'); return;
      }
      setError(reason instanceof Error ? reason.message : '주보를 불러오지 못했습니다.');
    });
    return () => { active = false; };
  }, [date, invalidRoute]);
  return <div className="public-shell"><Brand home={!date} />
    <main className="public-main">{date && <Link to="/archive" className="back-link"><ArrowLeft size={16} /> 지난 주보 목록</Link>}
      {error ? <Status><WifiOff size={24} /><p>{error}</p><Link to="/">홈으로 가기</Link></Status> : data ? <BulletinContent data={data} offline={offline} /> : <Status><span className="loading-spinner" /><p>주보를 불러오는 중입니다.</p></Status>}
    </main><Footer /></div>;
}

function Footer() { return <footer className="site-footer"><span>✦</span><p>{CHURCH}<small>함께 걷는 믿음의 여정</small></p><Link to="/admin">관리자</Link></footer>; }

export function ArchivePage() {
  const [items, setItems] = useState<{ id: string; serviceDate: string; theme: string }[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  async function load(next?: string) {
    setLoading(true); setError('');
    try {
      const result = await api<{ items: typeof items; nextCursor: string | null }>(`/v1/bulletins${next ? `?cursor=${encodeURIComponent(next)}` : ''}`);
      setItems((previous) => next ? [...previous, ...result.items] : result.items);
      setCursor(result.nextCursor);
    } catch (reason) { setError(reason instanceof Error ? reason.message : '목록을 불러오지 못했습니다.'); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);
  return <div className="public-shell"><Brand /><main className="archive-main"><Link to="/" className="back-link"><ArrowLeft size={16} /> 이번 주 주보</Link>
    <div className="archive-heading"><span className="eyebrow dark">OUR JOURNEY</span><h1>지난 주보</h1><p>함께 드린 예배의 기록을 다시 만나보세요.</p></div>
    {error && <Status><p>{error}</p><button className="simple-button" onClick={() => load(cursor || undefined)}>다시 시도</button></Status>}
    <div className="archive-list">{items.map((item) => <Link className="archive-item" key={item.id} to={`/bulletins/${item.serviceDate}`}><span className="archive-calendar"><CalendarDays size={22} /></span><span><small>{shortDate(item.serviceDate)}</small><strong>{item.theme || '주일 예배'}</strong></span><ChevronRight size={20} /></Link>)}</div>
    {!loading && !error && items.length === 0 && <Status><p>아직 발행된 주보가 없습니다.</p></Status>}
    {loading && <Status><span className="loading-spinner" /><p>불러오는 중입니다.</p></Status>}
    {!loading && cursor && <button className="load-more" onClick={() => load(cursor)}>더 보기 <ArrowRight size={16} /></button>}
  </main><Footer /></div>;
}
