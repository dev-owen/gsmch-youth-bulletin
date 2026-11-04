import { createAuthClient } from 'better-auth/react';
import type { RecurringInfo } from './church-info';
import { createPublicDataCache, isPublicBulletinPath } from './public-cache';

export const API_BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
export const MEDIA_BASE = (import.meta.env.VITE_MEDIA_BASE_URL || `${API_BASE}/v1/media`).replace(/\/$/, '');
export const authClient = createAuthClient({ baseURL: API_BASE, fetchOptions: { credentials: 'include' } });
const publicCache = createPublicDataCache(API_BASE);
export const PUBLIC_CACHE_INVALIDATED = 'bulletin-cache-invalidated';
const INVALIDATED_KEY = `${publicCache.storageKey}:invalidated-at`;
let bypassPublicCacheUntil = 0;

export type SiteInfo = {
  churchName: string; worshipTime: string; gatheringTime: string; introduction: string;
  vision: string; address: string; mapUrl: string; recurringInfo?: Partial<RecurringInfo>; churchEvents: ChurchEvent[];
};
export type ChurchEvent = { title: string; date: string; endDate?: string; content: string; contact: string };
export type SermonContent = { sermonTitle: string; scripture: string };
export type WorshipItem = { label: string; assignee: string } & (
  { type: 'text'; content: string } | { type: 'sermon'; content: SermonContent }
);
export type CommunityPerson = { name: string; peer: string };
export type CommunityWedding = { groom: CommunityPerson; bride: CommunityPerson; dateTime: string; location: string };
export type CommunityNews = {
  category: '새가족' | '등반' | '결혼' | '군입대'; content: string;
  people?: CommunityPerson[]; wedding?: CommunityWedding; weddings?: CommunityWedding[];
};
export type PromotionSchedule = { startDate: string; endDate: string; allDay: boolean; startTime: string; endTime: string };
export type PromotionDetail = { type?: 'text' | 'schedule'; title: string; body: string; schedule?: PromotionSchedule };
export type Promotion = { title: string; body: string; details: PromotionDetail[]; url: string; linkLabel?: string };
export type CalendarEvent = PromotionSchedule & { title: string; content: string; contact?: string; url?: string; linkLabel?: string; sourceBulletinId?: string; sourceTitle?: string };
export type Bulletin = {
  id: string; serviceDate: string; theme: string; coverMediaId: string | null;
  cover: { objectKey: string; altText: string } | null;
  sermonTitle: string; scripture: string; preacher: string;
  status: 'draft' | 'published'; publishedAt: string | null;
  worshipItems: WorshipItem[]; communityNews: CommunityNews[]; promotions: Promotion[];
};
export type BulletinInput = Pick<Bulletin, 'serviceDate' | 'theme' | 'coverMediaId' | 'sermonTitle' | 'scripture' | 'preacher' | 'worshipItems' | 'communityNews' | 'promotions'> & { coverAltText: string };
export type BulletinListItem = Pick<Bulletin, 'id' | 'serviceDate' | 'theme' | 'status'>;
export type PublicData = { bulletin: Bulletin | null; siteInfo: SiteInfo; calendarEvents?: CalendarEvent[] };

export function showToast(message: string, kind: 'success' | 'error' = 'success') {
  window.dispatchEvent(new CustomEvent('app-toast', { detail: { message, kind } }));
}

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const method = (options.method || 'GET').toUpperCase();
  const isPublic = method === 'GET' && isPublicBulletinPath(path);
  const request = () => fetchApi<T>(path, options, isPublic);
  if (isPublic) return publicCache.load(path, request);
  const result = await request();
  if (path.startsWith('/v1/admin/') && !['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    publicCache.clear();
    bypassPublicCacheUntil = Date.now() + 60_000;
    try { localStorage.removeItem(STORAGE_KEY); localStorage.setItem(INVALIDATED_KEY, String(bypassPublicCacheUntil)); } catch { /* storage may be disabled */ }
    window.dispatchEvent(new Event(PUBLIC_CACHE_INVALIDATED));
  }
  return result;
}

async function fetchApi<T>(path: string, options: RequestInit, isPublic: boolean): Promise<T> {
  const headers = new Headers(options.headers);
  if (isPublic) {
    try { bypassPublicCacheUntil = Math.max(bypassPublicCacheUntil, Number(localStorage.getItem(INVALIDATED_KEY)) || 0); } catch { /* storage may be disabled */ }
    if (Date.now() < bypassPublicCacheUntil) headers.set('Cache-Control', 'no-cache');
  }
  const response = await fetch(`${API_BASE}${path}`, { credentials: 'include', cache: isPublic ? 'default' : 'no-store', ...options, headers });
  if (!response.ok) {
    const body = await response.json().catch(() => ({ code: 'REQUEST_FAILED', message: '요청을 처리하지 못했습니다.' }));
    if (isPublic && response.status >= 400 && response.status < 500) publicCache.remove(path);
    throw new ApiError(response.status, body.code, body.message);
  }
  return response.json() as Promise<T>;
}

export function readPublicApi<T>(path: string): T | null {
  const cached = publicCache.read<T>(path);
  if (cached) return cached;
  if (path === '/v1/bulletins/current') return readLatest() as T | null;
  if (/^\/v1\/bulletins\/\d{4}-\d{2}-\d{2}$/.test(path)) {
    const latest = publicCache.read<PublicData>('/v1/bulletins/current') || readLatest();
    if (latest?.bulletin?.serviceDate === path.slice(-10)) return latest as T;
  }
  return null;
}

export function onPublicCacheInvalidated(listener: () => void) {
  const sync = (event: StorageEvent) => {
    if (event.key !== INVALIDATED_KEY && event.key !== null) return;
    publicCache.reset(); listener();
  };
  window.addEventListener(PUBLIC_CACHE_INVALIDATED, listener);
  window.addEventListener('storage', sync);
  return () => { window.removeEventListener(PUBLIC_CACHE_INVALIDATED, listener); window.removeEventListener('storage', sync); };
}
export const json = (data: unknown, method = 'PUT'): RequestInit => ({ method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
export const coverUrl = (bulletin: Bulletin) => bulletin.cover ? `${MEDIA_BASE}/${bulletin.cover.objectKey}` : null;
export const formatDate = (date: string, locale = 'ko-KR') => new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long', timeZone: 'Asia/Seoul' }).format(new Date(`${date}T12:00:00+09:00`));
export const shortDate = (date: string, locale = 'ko-KR') => new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Asia/Seoul' }).format(new Date(`${date}T12:00:00+09:00`));

const STORAGE_KEY = 'gsmch-latest-bulletin-v1';
export function saveLatest(data: PublicData) {
  if (!data.bulletin) {
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* storage may be disabled */ }
    if ('serviceWorker' in navigator) navigator.serviceWorker.ready.then((registration) => registration.active?.postMessage({ type: 'CLEAR_COVER' })).catch(() => {});
    return;
  }
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch { /* storage may be disabled */ }
  const url = coverUrl(data.bulletin);
  if ('serviceWorker' in navigator) navigator.serviceWorker.ready.then((registration) => registration.active?.postMessage(url ? { type: 'CACHE_COVER', url } : { type: 'CLEAR_COVER' })).catch(() => {});
}
export function readLatest(): PublicData | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;
    const parsed = JSON.parse(stored) as PublicData;
    return parsed.bulletin?.serviceDate && parsed.siteInfo?.churchName ? parsed : null;
  } catch { return null; }
}
