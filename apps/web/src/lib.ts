import { createAuthClient } from 'better-auth/react';

export const API_BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
export const MEDIA_BASE = (import.meta.env.VITE_MEDIA_BASE_URL || `${API_BASE}/v1/media`).replace(/\/$/, '');
export const authClient = createAuthClient({ baseURL: API_BASE, fetchOptions: { credentials: 'include' } });

export type SiteInfo = {
  churchName: string; worshipTime: string; gatheringTime: string; introduction: string;
  vision: string; address: string; mapUrl: string;
};
export type WorshipItem = { label: string; assignee: string };
export type Promotion = { title: string; body: string; url: string };
export type Bulletin = {
  id: string; serviceDate: string; theme: string; coverMediaId: string | null;
  cover: { objectKey: string; altText: string } | null;
  sermonTitle: string; scripture: string; preacher: string;
  status: 'draft' | 'published'; publishedAt: string | null;
  worshipItems: WorshipItem[]; promotions: Promotion[];
};
export type BulletinInput = Pick<Bulletin, 'serviceDate' | 'theme' | 'coverMediaId' | 'sermonTitle' | 'scripture' | 'preacher' | 'worshipItems' | 'promotions'> & { coverAltText: string };
export type BulletinListItem = Pick<Bulletin, 'id' | 'serviceDate' | 'theme' | 'status'>;
export type PublicData = { bulletin: Bulletin | null; siteInfo: SiteInfo };

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, { credentials: 'include', cache: 'no-store', ...options });
  if (!response.ok) {
    const body = await response.json().catch(() => ({ code: 'REQUEST_FAILED', message: '요청을 처리하지 못했습니다.' }));
    throw new ApiError(response.status, body.code, body.message);
  }
  return response.json() as Promise<T>;
}
export const json = (data: unknown, method = 'PUT'): RequestInit => ({ method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
export const coverUrl = (bulletin: Bulletin) => bulletin.cover ? `${MEDIA_BASE}/${bulletin.cover.objectKey}` : null;
export const formatDate = (date: string) => new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long', timeZone: 'Asia/Seoul' }).format(new Date(`${date}T12:00:00+09:00`));
export const shortDate = (date: string) => new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Asia/Seoul' }).format(new Date(`${date}T12:00:00+09:00`));

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
