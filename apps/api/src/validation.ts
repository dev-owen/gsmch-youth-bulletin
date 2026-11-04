import { z } from 'zod';

const bounded = (max: number) => z.string().trim().max(max);
const required = (max: number) => bounded(max).min(1);
export const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}, '올바른 날짜를 입력해 주세요.');
export const urlSchema = z.string().trim().max(2000).refine((value) => {
  if (!value) return true;
  try { return ['https:', 'http:'].includes(new URL(value).protocol); } catch { return false; }
}, 'http 또는 https 주소를 입력해 주세요.');

const optionalTime = z.string().refine((value) => !value || /^([01]\d|2[0-3]):[0-5]\d$/.test(value), '올바른 시각을 입력해 주세요.').default('');
export const promotionScheduleInput = z.object({
  startDate: dateSchema,
  endDate: dateSchema.or(z.literal('')).default(''),
  allDay: z.boolean().default(true),
  startTime: optionalTime,
  endTime: optionalTime,
}).superRefine((schedule, context) => {
  const endDate = schedule.endDate || schedule.startDate;
  if (endDate < schedule.startDate) context.addIssue({ code: 'custom', path: ['endDate'], message: '종료 날짜는 시작 날짜 이후로 설정해 주세요.' });
  if (schedule.allDay) return;
  if (!schedule.startTime) context.addIssue({ code: 'custom', path: ['startTime'], message: '시작 시각을 입력해 주세요.' });
  if (endDate > schedule.startDate && !schedule.endTime) context.addIssue({ code: 'custom', path: ['endTime'], message: '여러 날에 걸친 일정의 종료 시각을 입력해 주세요.' });
  if (schedule.endTime && endDate === schedule.startDate && schedule.endTime <= schedule.startTime) {
    context.addIssue({ code: 'custom', path: ['endTime'], message: '종료 시각은 시작 시각 이후로 설정해 주세요.' });
  }
}).transform((schedule) => ({ ...schedule, endDate: schedule.endDate || schedule.startDate,
  startTime: schedule.allDay ? '' : schedule.startTime, endTime: schedule.allDay ? '' : schedule.endTime }));

const promotionDetailInput = z.object({
  type: z.enum(['text', 'schedule']).optional(),
  title: required(120),
  body: bounded(1000).default(''),
  schedule: promotionScheduleInput.optional(),
}).superRefine((detail, context) => {
  if (detail.type === 'schedule') {
    if (!detail.schedule) context.addIssue({ code: 'custom', path: ['schedule'], message: '일정의 시작 날짜를 입력해 주세요.' });
  } else if (!detail.body) context.addIssue({ code: 'custom', path: ['body'], message: '세부 내용을 입력해 주세요.' });
});

const communityPerson = z.object({ name: required(80), peer: required(40) });
const communityWedding = z.object({
  groom: communityPerson, bride: communityPerson,
  dateTime: required(120), location: required(200),
});
export const communityNewsInput = z.object({
  category: z.enum(['새가족', '등반', '결혼', '군입대']),
  content: bounded(20000).default(''),
  people: z.array(communityPerson).min(1).max(100).optional(),
  wedding: communityWedding.optional(),
  weddings: z.array(communityWedding).min(1).max(30).optional(),
}).superRefine((news, context) => {
  if (news.people !== undefined && news.category !== '새가족' && news.category !== '등반') {
    context.addIssue({ code: 'custom', path: ['people'], message: '명단은 새가족·등반 소식에만 입력할 수 있습니다.' });
  }
  if (news.wedding !== undefined && news.category !== '결혼') {
    context.addIssue({ code: 'custom', path: ['wedding'], message: '예식 정보는 결혼 소식에만 입력할 수 있습니다.' });
  }
  if (news.weddings !== undefined && news.category !== '결혼') {
    context.addIssue({ code: 'custom', path: ['weddings'], message: '예식 정보는 결혼 소식에만 입력할 수 있습니다.' });
  }
  if (news.wedding !== undefined && news.weddings !== undefined) {
    context.addIssue({ code: 'custom', path: ['weddings'], message: '단일 커플 정보와 여러 커플 정보를 동시에 입력할 수 없습니다.' });
  }
  if (news.people === undefined && news.wedding === undefined && news.weddings === undefined && (!news.content || news.content.length > 300)) {
    context.addIssue({ code: 'custom', path: ['content'], message: '소식 내용을 1~300자로 입력해 주세요.' });
  }
}).transform((news) => {
  const person = ({ name, peer }: z.infer<typeof communityPerson>) => `${name} (${peer})`;
  if (news.people) return { ...news, content: news.people.map(person).join('\n') };
  const weddings = news.weddings ?? (news.wedding ? [news.wedding] : undefined);
  if (weddings) {
    const content = weddings.map(({ groom, bride, dateTime, location }) =>
      `신랑 ${person(groom)} · 신부 ${person(bride)}\n일시: ${dateTime}\n장소: ${location}`
    ).join('\n\n');
    return { ...news, content };
  }
  return news;
});

export const bulletinInput = z.object({
  serviceDate: dateSchema,
  theme: bounded(160),
  coverMediaId: z.uuid().nullable(),
  coverAltText: bounded(200),
  sermonTitle: bounded(200),
  scripture: bounded(200),
  preacher: bounded(100),
  worshipItems: z.array(z.object({ label: required(120), content: bounded(300).default(''), assignee: bounded(100) })).max(30),
  communityNews: z.array(communityNewsInput).max(30).default([]),
  promotions: z.array(z.object({ title: required(120), body: required(1000), details: z.array(promotionDetailInput).max(20).default([]), url: urlSchema, linkLabel: bounded(60).default('') })).max(10),
});

const directoryGroups = z.array(z.object({ title: required(120), entries: z.array(required(500)).max(100) })).max(20);
export const recurringInfoInput = z.object({
  offering: z.object({
    bank: required(100), accountNumber: required(100), accountHolder: required(100),
    envelope: bounded(2000), transfer: bounded(2000), example: bounded(200), mainChurch: bounded(2000),
  }),
  meetings: z.array(z.object({ title: required(120), schedule: bounded(500), location: bounded(500), description: bounded(2000), contact: bounded(300) })).max(10),
  newcomer: z.object({ welcome: bounded(1000), guidance: bounded(2000) }),
  visionReference: bounded(200),
  visionPoints: z.array(z.object({ title: required(120), body: bounded(1000), reference: bounded(200) })).max(10),
  missionGroups: directoryGroups,
  missionNote: bounded(500),
  staffGroups: directoryGroups,
});

export const siteInfoInput = z.object({
  churchName: required(120),
  worshipTime: bounded(500),
  gatheringTime: bounded(500),
  introduction: bounded(2000),
  vision: bounded(2000),
  address: bounded(500),
  mapUrl: urlSchema,
  recurringInfo: recurringInfoInput.optional(),
  churchEvents: z.array(z.object({ title: required(120), date: dateSchema, content: bounded(1000).default(''), contact: bounded(200).default('') })).max(100).optional(),
});

export type BulletinInput = z.infer<typeof bulletinInput>;
