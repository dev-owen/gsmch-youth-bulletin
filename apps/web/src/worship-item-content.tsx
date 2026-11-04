import type { WorshipItem } from './lib';
import type { Translate } from './translations';

export function WorshipItemContent({ item, t = (key) => key }: { item: WorshipItem; t?: Translate }) {
  if (item.type === 'sermon') return <small className="worship-content worship-sermon-content"><span>{t('설교 주제')}: {item.content.sermonTitle}</span><br /><span>{t('말씀 구절')}: {item.content.scripture}</span></small>;
  return item.content ? <small className="worship-content">{item.content}</small> : null;
}
