import type { BulletinInput, WorshipItem } from './lib';

type SermonFields = Pick<BulletinInput, 'sermonTitle' | 'scripture' | 'preacher'>;
type LegacyWorshipItem = { type?: undefined; label: string; content?: string; assignee: string };

export function normalizeWorshipItems(items: (WorshipItem | LegacyWorshipItem)[], sermon: SermonFields): WorshipItem[] {
  return items.map((item) => {
    if (item.type === 'sermon') return item;
    if (!item.type && item.label.trim() === '설교') return { type: 'sermon', label: item.label,
      content: { sermonTitle: sermon.sermonTitle, scripture: sermon.scripture }, assignee: item.assignee || sermon.preacher };
    return { ...item, type: 'text', content: item.content || '' };
  });
}

export function syncSermonFields(input: BulletinInput): BulletinInput {
  const sermon = input.worshipItems.find((item) => item.type === 'sermon');
  return sermon ? { ...input, sermonTitle: sermon.content.sermonTitle, scripture: sermon.content.scripture, preacher: sermon.assignee } : input;
}
