import type { WorshipItem } from './lib';

export function WorshipItemContent({ item }: { item: WorshipItem }) {
  if (item.type === 'sermon') return <small className="worship-content worship-sermon-content"><span>설교 주제: {item.content.sermonTitle}</span><br /><span>말씀 구절: {item.content.scripture}</span></small>;
  return item.content ? <small className="worship-content">{item.content}</small> : null;
}
