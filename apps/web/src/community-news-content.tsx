import type { CommunityNews, CommunityPerson } from './lib';

function Person({ person }: { person: CommunityPerson }) {
  return <>{person.name} <span className="community-peer">({person.peer})</span></>;
}

export function CommunityNewsContent({ news }: { news: CommunityNews }) {
  if ((news.category === '새가족' || news.category === '등반') && news.people?.length) {
    return <ul className="community-people">{news.people.map((person, index) => <li key={index}><Person person={person} /></li>)}</ul>;
  }
  const weddings = news.weddings ?? (news.wedding ? [news.wedding] : []);
  if (news.category === '결혼' && weddings.length) {
    return <div className="community-weddings" role="region" aria-label="결혼 소식, 좌우로 밀어 전체 정보 보기" tabIndex={0}>{weddings.map(({ groom, bride, dateTime, location }, index) => <dl className="community-wedding" aria-label={`커플 ${index + 1} 결혼 정보`} key={index}>
      <div><dt>신랑</dt><dd><Person person={groom} /></dd></div>
      <div><dt>신부</dt><dd><Person person={bride} /></dd></div>
      <div><dt>일시</dt><dd>{dateTime}</dd></div>
      <div><dt>장소</dt><dd>{location}</dd></div>
    </dl>)}</div>;
  }
  return <p className="community-legacy">{news.content}</p>;
}
