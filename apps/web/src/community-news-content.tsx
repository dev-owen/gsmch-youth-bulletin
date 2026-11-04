import type { CommunityNews, CommunityPerson } from './lib';

function Person({ person }: { person: CommunityPerson }) {
  return <>{person.name} <span className="community-peer">({person.peer})</span></>;
}

export function CommunityNewsContent({ news }: { news: CommunityNews }) {
  if ((news.category === '새가족' || news.category === '등반') && news.people?.length) {
    return <ul className="community-people">{news.people.map((person, index) => <li key={index}><Person person={person} /></li>)}</ul>;
  }
  if (news.category === '결혼' && news.wedding) {
    const { groom, bride, dateTime, location } = news.wedding;
    return <dl className="community-wedding">
      <div><dt>신랑</dt><dd><Person person={groom} /></dd></div>
      <div><dt>신부</dt><dd><Person person={bride} /></dd></div>
      <div><dt>일시</dt><dd>{dateTime}</dd></div>
      <div><dt>장소</dt><dd>{location}</dd></div>
    </dl>;
  }
  return <p className="community-legacy">{news.content}</p>;
}
