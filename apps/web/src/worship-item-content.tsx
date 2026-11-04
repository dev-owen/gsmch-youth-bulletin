import type { WorshipItem } from './lib';

export function WorshipItemContent({ item }: { item: WorshipItem }) {
  if (item.type === 'sermon') return <small className="worship-content worship-sermon-content"><strong className="worship-sermon-title">{item.content.sermonTitle}</strong><span className="worship-sermon-scripture">{item.content.scripture}</span></small>;
  return item.content ? <small className="worship-content">{item.content}</small> : null;
}
