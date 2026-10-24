import type { Pool } from 'pg';

export type Bindings = {
  HYPERDRIVE?: { connectionString: string };
  MEDIA: R2Bucket;
  DATABASE_URL?: string;
  WEB_ORIGIN: string;
  PUBLIC_MEDIA_BASE_URL: string;
  BETTER_AUTH_URL: string;
  BETTER_AUTH_SECRET: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
};

export type AppEnv = { Bindings: Bindings; Variables: { pool: Pool; adminUserId: string } };

export type BulletinRow = {
  id: string;
  service_date: string;
  theme: string;
  cover_media_id: string | null;
  cover_object_key: string | null;
  cover_alt_text: string | null;
  sermon_title: string;
  scripture: string;
  preacher: string;
  status: 'draft' | 'published';
  published_at: string | null;
};
