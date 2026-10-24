CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Better Auth tables are generated separately with `npx auth generate`.
CREATE TABLE IF NOT EXISTS media_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  object_key text NOT NULL UNIQUE,
  content_type text NOT NULL,
  size_bytes integer NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 5242880),
  alt_text text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS bulletins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_date date NOT NULL UNIQUE,
  theme text NOT NULL DEFAULT '',
  cover_media_id uuid REFERENCES media_assets(id),
  sermon_title text NOT NULL DEFAULT '',
  scripture text NOT NULL DEFAULT '',
  preacher text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS worship_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bulletin_id uuid NOT NULL REFERENCES bulletins(id) ON DELETE CASCADE,
  position integer NOT NULL CHECK (position >= 0),
  label text NOT NULL,
  assignee text NOT NULL DEFAULT '',
  UNIQUE (bulletin_id, position)
);

CREATE TABLE IF NOT EXISTS promotions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bulletin_id uuid NOT NULL REFERENCES bulletins(id) ON DELETE CASCADE,
  position integer NOT NULL CHECK (position BETWEEN 0 AND 2),
  title text NOT NULL,
  body text NOT NULL,
  url text,
  UNIQUE (bulletin_id, position)
);

CREATE TABLE IF NOT EXISTS site_info (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  church_name text NOT NULL DEFAULT '선한목자 젊은이교회',
  worship_time text NOT NULL DEFAULT '',
  gathering_time text NOT NULL DEFAULT '',
  introduction text NOT NULL DEFAULT '',
  vision text NOT NULL DEFAULT '',
  address text NOT NULL DEFAULT '',
  map_url text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS site_settings (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  current_bulletin_id uuid REFERENCES bulletins(id)
);

CREATE TABLE IF NOT EXISTS admin_users (
  user_id text PRIMARY KEY,
  granted_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO site_info (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
INSERT INTO site_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

CREATE INDEX IF NOT EXISTS bulletins_published_order ON bulletins (service_date DESC, id DESC) WHERE status = 'published';
