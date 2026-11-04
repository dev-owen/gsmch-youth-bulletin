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

export const bulletinInput = z.object({
  serviceDate: dateSchema,
  theme: bounded(160),
  coverMediaId: z.uuid().nullable(),
  coverAltText: bounded(200),
  sermonTitle: bounded(200),
  scripture: bounded(200),
  preacher: bounded(100),
  worshipItems: z.array(z.object({ label: required(120), content: bounded(300).default(''), assignee: bounded(100) })).max(30),
  communityNews: z.array(z.object({ category: z.enum(['새가족', '등반', '결혼', '군입대']), content: required(300) })).max(30).default([]),
  promotions: z.array(z.object({ title: required(120), body: required(1000), details: z.array(z.object({ title: required(120), body: required(1000) })).max(20).default([]), url: urlSchema })).max(10),
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
});

export type BulletinInput = z.infer<typeof bulletinInput>;
