import type { Bulletin, CalendarEvent, ChurchEvent, PromotionSchedule } from './lib';

export function promotionCalendarEvents(bulletin: Bulletin): CalendarEvent[] {
  return bulletin.promotions.flatMap((promotion) => (promotion.details || []).flatMap((detail) => {
    if (detail.type !== 'schedule' || !detail.schedule?.startDate) return [];
    return [{ ...detail.schedule, endDate: detail.schedule.endDate || detail.schedule.startDate,
      title: detail.title, content: detail.body || promotion.body, url: promotion.url, linkLabel: promotion.linkLabel || '',
      sourceBulletinId: bulletin.id, sourceTitle: promotion.title }];
  }));
}

export function collectCalendarEvents(churchEvents: ChurchEvent[], publishedEvents: CalendarEvent[], bulletin: Bulletin): CalendarEvent[] {
  const manualEvents: CalendarEvent[] = churchEvents.map((event) => ({
    startDate: event.date, endDate: event.endDate || event.date, allDay: true, startTime: '', endTime: '',
    title: event.title, content: event.content, contact: event.contact,
  }));
  const events = [...manualEvents, ...publishedEvents.filter((event) => event.sourceBulletinId !== bulletin.id), ...promotionCalendarEvents(bulletin)];
  const unique = new Map<string, CalendarEvent>();
  for (const event of events) {
    // Incomplete form entries stay out of the preview until a valid date is chosen.
    if (!event.startDate || event.endDate < event.startDate) continue;
    const key = JSON.stringify([event.title.trim(), event.sourceTitle?.trim() || '', event.startDate, event.endDate, event.allDay,
      event.allDay ? '' : event.startTime, event.allDay ? '' : event.endTime]);
    unique.set(key, event);
  }
  return [...unique.values()].sort((a, b) => a.startDate.localeCompare(b.startDate) || a.startTime.localeCompare(b.startTime) || a.title.localeCompare(b.title, 'ko'));
}

function lastOccupiedDate(event: CalendarEvent): string {
  const endDate = event.endDate || event.startDate;
  if (!event.allDay && event.endTime === '00:00' && endDate > event.startDate) {
    const previous = new Date(`${endDate}T00:00:00Z`);
    previous.setUTCDate(previous.getUTCDate() - 1);
    return previous.toISOString().slice(0, 10);
  }
  return endDate;
}

export function eventOccursOnDate(event: CalendarEvent, date: string): boolean {
  return event.startDate <= date && date <= lastOccupiedDate(event);
}

export function eventMarkerOnDate(event: CalendarEvent, date: string): 'single' | 'start' | 'end' | null {
  const endDate = event.endDate || event.startDate;
  if (event.startDate === endDate) return date === event.startDate ? 'single' : null;
  if (date === event.startDate) return 'start';
  if (date === endDate) return 'end';
  return null;
}

export function calendarEventColors(index: number) {
  const hue = (210 + index * 137.508) % 360;
  return { color: `hsl(${hue} 55% 34%)`, background: `hsl(${hue} 65% 95%)`, border: `hsl(${hue} 45% 75%)` };
}

export function eventsForMonth(events: CalendarEvent[], month: string): CalendarEvent[] {
  const [year, number] = month.split('-').map(Number);
  const lastDay = new Date(Date.UTC(year, number, 0)).getUTCDate();
  const firstDate = `${month}-01`;
  const lastDate = `${month}-${lastDay}`;
  // The ending date remains visible as a boundary, including an end at midnight.
  return events.filter((event) => event.startDate <= lastDate && (event.endDate || event.startDate) >= firstDate);
}

export function formatSchedule(schedule: PromotionSchedule, locale = 'ko-KR'): string {
  if (!schedule.startDate) return '';
  const dateFormatter = new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'numeric', day: 'numeric', weekday: 'short', timeZone: 'Asia/Seoul' });
  const allDay = locale.startsWith('en') ? 'All day' : locale.startsWith('zh') ? '全天' : '종일';
  const label = (date: string) => dateFormatter.format(new Date(`${date}T12:00:00+09:00`));
  const endDate = schedule.endDate || schedule.startDate;
  if (schedule.allDay) return `${label(schedule.startDate)}${endDate !== schedule.startDate ? ` ~ ${label(endDate)}` : ''} · ${allDay}`;
  if (endDate !== schedule.startDate) return `${label(schedule.startDate)} ${schedule.startTime} ~ ${label(endDate)} ${schedule.endTime}`;
  return `${label(schedule.startDate)} ${schedule.startTime}${schedule.endTime ? ` ~ ${schedule.endTime}` : ''}`;
}
