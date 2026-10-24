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
  worshipItems: z.array(z.object({ label: required(120), assignee: bounded(100) })).max(30),
  promotions: z.array(z.object({ title: required(120), body: required(500), url: urlSchema })).max(3),
});

export const siteInfoInput = z.object({
  churchName: required(120),
  worshipTime: bounded(500),
  gatheringTime: bounded(500),
  introduction: bounded(2000),
  vision: bounded(2000),
  address: bounded(500),
  mapUrl: urlSchema,
});

export type BulletinInput = z.infer<typeof bulletinInput>;
