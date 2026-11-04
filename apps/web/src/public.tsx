import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, ArrowUpRight, BookOpen, CalendarDays, ChevronRight, MapPin, Megaphone, Sparkles, WifiOff } from 'lucide-react';
import { api, coverUrl, formatDate, readLatest, saveLatest, shortDate, type Bulletin, type CalendarEvent, type PublicData } from './lib';
import { ChurchGuide } from './church-guide';
import { BulletinQr } from './bulletin-qr';
import { collectCalendarEvents, eventOccursOnDate, eventsForMonth, formatSchedule } from './calendar';
import './promotion-schedule.css';
import { CommunityNewsContent } from './community-news-content';
import { ReadingSettings } from './reading-settings';

const CHURCH = '선한목자 젊은이교회';

function Brand({ home = false }: { home?: boolean }) {
  return <header className="site-header"><div className="site-header-inner">
    <Link to="/" className="brand" aria-label="선한목자 젊은이교회 주보 홈"><span className="brand-symbol">✦</span><span><strong>선한목자 젊은이교회</strong><small>YOUTH CHURCH BULLETIN</small></span></Link>
    <div className="header-actions"><Link className="header-link" to={home ? '/archive' : '/'}>{home ? '지난 주보' : '이번 주 주보'} <ArrowUpRight size={15} /></Link><ReadingSettings /></div>
  </div></header>;
}

function Status({ children }: { children: React.ReactNode }) { return <div className="status-panel" role="status">{children}</div>; }

function Cover({ bulletin, offline }: { bulletin: Bulletin; offline?: boolean }) {
  const image = coverUrl(bulletin);
  return <section className={`cover ${image ? 'cover-image' : 'cover-text'}`}>
    {image && <img className="cover-photo" src={image} alt={bulletin.cover?.altText || ''} />}
    <div className="cover-content">
      <div className="cover-top"><span className="eyebrow"><Sparkles size={13} /> SUNDAY WORSHIP</span><div className="cover-actions">{offline && <span className="offline-badge"><WifiOff size={13} /> 오프라인 저장본</span>}{bulletin.status === 'published' && <BulletinQr key={bulletin.serviceDate} serviceDate={bulletin.serviceDate} />}</div></div>
      <div className="cover-main"><span className="cover-date">{formatDate(bulletin.serviceDate)}</span><span className="cover-line" /><h1>{bulletin.theme || '주일 예배'}</h1><p>함께 예배하는 기쁨, 오늘 이 자리에서</p></div>
      <div className="cover-bottom"><span>{CHURCH}</span><span>WEEKLY BULLETIN · {bulletin.serviceDate}</span></div>
    </div>
  </section>;
}

function SectionHeading({ number, kicker, title, icon }: { number: string; kicker: string; title: string; icon?: React.ReactNode }) {
  return <div className="section-heading"><div><span className="section-kicker">{number} / {kicker}</span><h2>{title}</h2></div>{icon && <span className="section-icon">{icon}</span>}</div>;
}

function ReadingTools({ hasNews, hasAnnouncements }: { hasNews: boolean; hasAnnouncements: boolean }) {
  const links = [['worship', '예배 순서'], ['message', '오늘의 말씀'], ...(hasNews ? [['news', '교우 소식']] : []), ...(hasAnnouncements ? [['announcements', '광고']] : []), ['calendar', '교회 일정'], ['about', '교회 안내']];
  return <>
    <div className="reading-progress" aria-hidden="true"><span /></div>
    <nav className="reading-nav" aria-label="주보 바로가기">{links.map(([id, label]) => <a key={id} href={`#${id}`}>{label}</a>)}</nav>
  </>;
}

export function BulletinContent({ data, offline = false, preview = false }: { data: PublicData; offline?: boolean; preview?: boolean }) {
  const { bulletin, siteInfo } = data;
  useEffect(() => {
    const elements = document.querySelectorAll('.content-section, .archive-cta');
    const observer = new IntersectionObserver((entries) => entries.forEach((entry) => {
      if (entry.isIntersecting) { entry.target.classList.add('is-visible'); observer.unobserve(entry.target); }
    }), { threshold: 0, rootMargin: '0px 0px -35px 0px' });
    elements.forEach((element) => observer.observe(element));
    const update = () => {
      const scrollable = document.documentElement.scrollHeight - window.innerHeight;
      document.documentElement.style.setProperty('--reading-progress', `${scrollable > 0 ? window.scrollY / scrollable * 100 : 0}%`);
    };
    update(); window.addEventListener('scroll', update, { passive: true }); window.addEventListener('resize', update);
    return () => { observer.disconnect(); window.removeEventListener('scroll', update); window.removeEventListener('resize', update); };
  }, [bulletin]);
  if (!bulletin) return <div className="empty-bulletin"><span className="empty-symbol">✦</span><span className="eyebrow dark">WELCOME TO OUR CHURCH</span><h1>{siteInfo.churchName || CHURCH}</h1><p>새 주보를 준비하고 있습니다.<br />곧 이곳에서 예배 소식을 만나보실 수 있습니다.</p></div>;
  return <>
    <Cover bulletin={bulletin} offline={offline} />
    <ReadingTools hasNews={Boolean(bulletin.communityNews?.length)} hasAnnouncements={bulletin.promotions.length > 0} />
    <div className="bulletin-body">
      <div className="bulletin-overview">
        <section id="worship" className="content-section worship-section"><SectionHeading number="01" kicker="ORDER OF WORSHIP" title="예배 순서" icon={<CalendarDays size={23} />} />
          <div className="worship-list">{bulletin.worshipItems.map((item, index) => <div className="worship-row" key={`${index}-${item.label}`}><span className="worship-index">{String(index + 1).padStart(2, '0')}</span><span className="worship-label">{item.label}{item.content && <small className="worship-content">{item.content}</small>}</span><span className="worship-assignee">{item.assignee}</span></div>)}</div>
        </section>
        <section id="message" className="content-section message-section"><SectionHeading number="02" kicker="THE MESSAGE" title="오늘의 말씀" icon={<BookOpen size={23} />} />
          <div className="sermon-card"><span className="sermon-mark">“</span><p className="sermon-scripture">{bulletin.scripture}</p><h3>{bulletin.sermonTitle}</h3><div className="sermon-preacher"><span className="small-rule" />{bulletin.preacher}</div></div>
        </section>
        {bulletin.communityNews?.length > 0 && <section id="news" className="content-section community-section"><SectionHeading number="03" kicker="COMMUNITY NEWS" title="교우 소식" icon={<Sparkles size={23} />} /><div className="community-news-grid" aria-label="교우 소식">{bulletin.communityNews.map((news, index) => <article className="promotion-card" key={`${index}-${news.category}`}><span className="promotion-number">{news.category}</span><div><CommunityNewsContent news={news} /></div></article>)}</div></section>}
      </div>
      <div className="bulletin-updates">
        {bulletin.promotions.length > 0 && <section id="announcements" className="content-section"><SectionHeading number="04" kicker="ANNOUNCEMENTS" title="광고" icon={<Megaphone size={23} />} />
          <div className="promotion-list">{bulletin.promotions.map((card, index) => <details className="promotion-card announcement-card" key={`${index}-${card.title}`} open={index === 0}><summary><span className="promotion-number">{String(index + 1).padStart(2, '0')}</span><span><strong>{card.title}</strong><small>눌러서 자세히 보기</small></span><ChevronRight className="announcement-chevron" size={19} /></summary><div className="announcement-body">{card.body && <p>{card.body}</p>}{card.details?.map((detail, detailIndex) => <div className="promotion-detail" key={detailIndex}><strong>{detail.title}</strong>{detail.type === 'schedule' && detail.schedule && <p className="promotion-schedule"><CalendarDays size={15} /><span>{formatSchedule(detail.schedule)}</span></p>}{detail.body && <p>{detail.body}</p>}</div>)}{card.url && <a href={card.url} target="_blank" rel="noreferrer" className="text-link">자세히 보기 <ArrowUpRight size={16} /></a>}</div></details>)}</div>
        </section>}
        <ChurchCalendar key={bulletin.id} events={collectCalendarEvents(siteInfo.churchEvents || [], data.calendarEvents || [], bulletin)} initialDate={bulletin.serviceDate} />
      </div>
      <section id="about" className="content-section info-section"><SectionHeading number="06" kicker="LIFE TOGETHER" title="매주 함께하는 안내" icon={<MapPin size={23} />} /><ChurchGuide siteInfo={siteInfo} /></section>
      {!preview && <Link to="/archive" className="archive-cta"><span><small>PREVIOUS BULLETINS</small><strong>지난 주보 보기</strong></span><span className="round-arrow"><ArrowRight size={20} /></span></Link>}
    </div>
  </>;
}

function ChurchCalendar({ events, initialDate }: { events: CalendarEvent[]; initialDate: string }) {
  const [month, setMonth] = useState(() => { const [year, number] = initialDate.split('-').map(Number); return new Date(Date.UTC(year, number - 1, 1)); });
  const year = month.getUTCFullYear();
  const number = month.getUTCMonth() + 1;
  const firstWeekday = month.getUTCDay();
  const days = new Date(Date.UTC(year, number, 0)).getUTCDate();
  const monthKey = `${year}-${String(number).padStart(2, '0')}`;
  const monthEvents = eventsForMonth(events, monthKey);
  return <section id="calendar" className="content-section church-calendar"><SectionHeading number="05" kicker="CHURCH CALENDAR" title="교회 주요 일정" icon={<CalendarDays size={23} />} />
    <div className="calendar-month"><button className="calendar-nav" aria-label="이전 달" onClick={() => setMonth(new Date(Date.UTC(year, number - 2, 1)))}><ArrowLeft size={18} /></button><strong>{year}년 {number}월</strong><button className="calendar-nav" aria-label="다음 달" onClick={() => setMonth(new Date(Date.UTC(year, number, 1)))}><ArrowRight size={18} /></button></div>
    <div className="calendar-grid" role="grid" aria-label={`${year}년 ${number}월 일정`}>
      {['일', '월', '화', '수', '목', '금', '토'].map((day) => <span role="columnheader" className="calendar-weekday" key={day}>{day}</span>)}
      {Array.from({ length: firstWeekday }, (_, i) => <span className="calendar-empty" role="gridcell" key={`empty-${i}`} />)}
      {Array.from({ length: days }, (_, i) => { const day = i + 1; const date = `${monthKey}-${String(day).padStart(2, '0')}`; const dayEvents = monthEvents.filter((event) => eventOccursOnDate(event, date)); const hasEvent = dayEvents.length > 0; return <span role="gridcell" aria-label={`${day}일${hasEvent ? `, ${dayEvents.map((event) => event.title).join(', ')}` : ''}`} className={`calendar-day${hasEvent ? ' has-event' : ''}`} key={date}>{day}{hasEvent && <i />}</span>; })}
    </div>
    <div className="calendar-events" aria-live="polite"><h3>{number}월 일정</h3>{monthEvents.length ? monthEvents.map((event, i) => {
      const visibleDate = event.startDate < `${monthKey}-01` ? `${monthKey}-01` : event.startDate;
      return <article className="calendar-event" key={`${event.startDate}-${event.title}-${i}`}><time dateTime={visibleDate}><strong>{Number(visibleDate.slice(8))}</strong><span>{new Date(`${visibleDate}T12:00:00+09:00`).toLocaleDateString('ko-KR', { weekday: 'short', timeZone: 'Asia/Seoul' })}</span></time><div>{event.sourceTitle && event.sourceTitle !== event.title && <small className="calendar-source">{event.sourceTitle}</small>}<h4>{event.title}</h4><p className="calendar-event-schedule">{formatSchedule(event)}</p>{event.content && <p>{event.content}</p>}{event.contact && <a href={`tel:${event.contact.replace(/[^+\d]/g, '')}`}>문의 {event.contact}</a>}{event.url && <a href={event.url} target="_blank" rel="noreferrer" className="text-link">자세히 보기 <ArrowUpRight size={14} /></a>}</div></article>;
    }) : <p className="calendar-empty-note">이번 달 등록된 일정이 없습니다.</p>}</div>
  </section>;
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
