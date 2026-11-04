import { useState } from 'react';
import { ArrowUpRight, Check, ChevronDown, Church, Clock3, Copy, HeartHandshake, MapPin, Users } from 'lucide-react';
import { normalizeSiteInfo, type DirectoryGroup, type RecurringInfo } from './church-info';
import type { SiteInfo } from './lib';
import { CompactDisclosure, SwipeCards } from './compact-disclosure';
import './church-guide.css';
import { useLanguage } from './language';

function Directory({ group, staff = false }: { group: DirectoryGroup; staff?: boolean }) {
  const { t } = useLanguage();
  return <details className="directory-card">
    <summary><span>{group.title}</span><span className="directory-meta">{group.entries.length} {t(staff ? '항목' : '곳·명')}<ChevronDown size={17} aria-hidden="true" /></span></summary>
    {staff ? <dl className="staff-list">{group.entries.map((entry, index) => {
      const [role, ...names] = entry.split('|');
      return <div key={index}><dt>{names.length ? role.trim() : t('섬김')}</dt><dd>{names.length ? names.join('|').trim() : role}</dd></div>;
    })}</dl> : <ul className="mission-list">{group.entries.map((entry, index) => <li key={index}>{entry}</li>)}</ul>}
  </details>;
}

function OfferingCard({ offering }: { offering: RecurringInfo['offering'] }) {
  const { t } = useLanguage();
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'manual'>('idle');
  async function copyAccount() {
    try { await navigator.clipboard.writeText(offering.accountNumber); setCopyState('copied'); }
    catch { setCopyState('manual'); }
  }
  return <div className="offering-card">
    <div className="offering-account"><div><span className="guide-label">{t('온라인 헌금 계좌')} · {offering.bank}</span><strong className="account-number">{offering.accountNumber}</strong><p>{t('예금주')} {offering.accountHolder}</p></div><button type="button" className="copy-account" aria-label={t('헌금 계좌번호 복사')} onClick={copyAccount}>{copyState === 'copied' ? <Check size={16} /> : <Copy size={16} />}<span className="copy-account-label">{t('계좌 복사')}</span></button></div>
    <p className="copy-feedback" role="status">{copyState === 'copied' ? t('계좌번호를 복사했습니다.') : copyState === 'manual' ? t('계좌번호를 길게 눌러 복사해 주세요.') : ''}</p>
    <CompactDisclosure title={t('헌금 방법')} preview={t('봉투·온라인 헌금 작성 안내')} icon={<HeartHandshake size={20} />}>
    <div className="offering-instructions"><div><h4>{t('봉투헌금')}</h4><p>{offering.envelope}</p></div><div><h4>{t('온라인헌금')}</h4><p>{offering.transfer}</p><span className="transfer-example">{t('입력 예시')} · {offering.example}</span></div></div>
    <details className="guide-detail"><summary>{t('본교회 예배를 드리는 경우')}<ChevronDown size={16} aria-hidden="true" /></summary><p>{offering.mainChurch}</p></details>
    </CompactDisclosure>
  </div>;
}

export function ChurchGuide({ siteInfo }: { siteInfo: SiteInfo }) {
  const { t } = useLanguage();
  const info = normalizeSiteInfo(siteInfo);
  const recurring = info.recurringInfo;
  return <div className="church-guide">
    <nav className="guide-nav" aria-label={t('고정 교회 안내 바로가기')}><a href="#church-meetings">{t('모임·새가족')}</a><a href="#church-offering">{t('헌금')}</a><a href="#church-vision">{t('비전')}</a><a href="#church-mission">{t('선교')}</a><a href="#church-staff">{t('섬기는 분들')}</a></nav>
    <section id="church-meetings" className="guide-section" aria-labelledby="meetings-title">
      <div className="guide-section-heading"><Users size={20} aria-hidden="true" /><h3 id="meetings-title">{t('함께하는 모임')}</h3></div>
      <CompactDisclosure title={t('모임·새가족')} preview={t('{count}개 모임 · 새가족 등록 안내', { count: recurring.meetings.length })} icon={<Users size={20} />}>
      <div className="newcomer-card"><span className="newcomer-symbol" aria-hidden="true"><HeartHandshake size={25} /></span><div><span className="guide-label">{t('처음 오셨나요?')}</span><h4>{t('새가족 등록 안내')}</h4><p>{recurring.newcomer.welcome}</p><p className="newcomer-location"><MapPin size={16} aria-hidden="true" />{recurring.newcomer.guidance}</p></div></div>
      <SwipeCards label={t('모임')}>{recurring.meetings.map((meeting, index) => <article className="meeting-card" key={index}>
        <span className="guide-label">{String(index + 1).padStart(2, '0')} / GATHER TOGETHER</span><h4>{meeting.title}</h4>
        <p className="meeting-schedule"><Clock3 size={16} aria-hidden="true" />{meeting.schedule}</p><p className="meeting-location"><MapPin size={16} aria-hidden="true" />{meeting.location}</p>
        {(meeting.description || meeting.contact) && <details className="guide-detail"><summary>{t('모임 안내')}<ChevronDown size={16} aria-hidden="true" /></summary><p>{meeting.description}</p>{meeting.contact && <p className="meeting-contact">{t('문의')} · {meeting.contact}</p>}</details>}
      </article>)}</SwipeCards>
      </CompactDisclosure>
    </section>
    <section id="church-offering" className="guide-section" aria-labelledby="offering-title"><div className="guide-section-heading"><HeartHandshake size={20} aria-hidden="true" /><h3 id="offering-title">{t('헌금안내')}</h3></div><OfferingCard offering={recurring.offering} /></section>
    <section id="church-vision" className="guide-section" aria-labelledby="vision-title"><div className="guide-section-heading"><Church size={20} aria-hidden="true" /><h3 id="vision-title">{t('젊은이교회 비전')}</h3></div>
      <CompactDisclosure title={t('젊은이교회 비전')} preview={info.vision} icon={<Church size={20} />}>
      <div className="vision-card"><p className="vision-introduction">{info.introduction}</p><p className="vision-statement">{info.vision}</p><span className="vision-reference">{recurring.visionReference}</span><div className="vision-points">{recurring.visionPoints.map((point, index) => <div key={index}><h4>{point.title}</h4><p>{point.body}</p><small>{point.reference}</small></div>)}</div></div>
      </CompactDisclosure>
    </section>
    <section id="church-mission" className="guide-section" aria-labelledby="mission-title"><div className="guide-section-heading"><HeartHandshake size={20} aria-hidden="true" /><h3 id="mission-title">{t('젊은이교회가 섬기는 교회 · 선교사 · 선교기관')}</h3></div><CompactDisclosure title={t('선교 동역자')} preview={t('{groups}개 분야 · {count}곳·명과 함께합니다', { groups: recurring.missionGroups.length, count: recurring.missionGroups.reduce((total, group) => total + group.entries.length, 0) })} icon={<HeartHandshake size={20} />}><p className="guide-description">{t('기도와 섬김으로 함께하는 동역자들입니다. 항목을 눌러 전체 명단을 확인하세요.')}</p><div className="directory-grid">{recurring.missionGroups.map((group, index) => <Directory group={group} key={index} />)}</div><p className="directory-note">{recurring.missionNote}</p></CompactDisclosure></section>
    <section id="church-staff" className="guide-section" aria-labelledby="staff-title"><div className="guide-section-heading"><Users size={20} aria-hidden="true" /><h3 id="staff-title">{t('섬기는 분들')}</h3></div><CompactDisclosure title={t('섬기는 분들')} preview={t('{count}개 분야 · 목회자·교역자·사역팀 안내', { count: recurring.staffGroups.length })} icon={<Users size={20} />}><div className="directory-grid staff-directory">{recurring.staffGroups.map((group, index) => <Directory group={group} staff key={index} />)}</div></CompactDisclosure></section>
    {(info.worshipTime || info.gatheringTime || info.address) && <CompactDisclosure title={t('예배 시간·오시는 길')} preview={info.worshipTime || info.address} icon={<MapPin size={20} />}><div className="church-visit">{(info.worshipTime || info.gatheringTime) && <div><h4>{t('예배 및 모임 안내')}</h4><p>{[info.worshipTime, info.gatheringTime].filter(Boolean).join('\n')}</p></div>}{info.address && <div><h4>{t('오시는 길')}</h4><p>{info.address}</p>{info.mapUrl && <a href={info.mapUrl} target="_blank" rel="noreferrer" className="text-link">{t('지도에서 보기')}<ArrowUpRight size={15} /></a>}</div>}</div></CompactDisclosure>}
  </div>;
}
