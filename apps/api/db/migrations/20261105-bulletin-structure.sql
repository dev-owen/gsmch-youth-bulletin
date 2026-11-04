BEGIN;

ALTER TABLE worship_items ADD COLUMN IF NOT EXISTS content text NOT NULL DEFAULT '';
ALTER TABLE promotions ADD COLUMN IF NOT EXISTS details jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE promotions DROP CONSTRAINT IF EXISTS promotions_position_check;
ALTER TABLE promotions ADD CONSTRAINT promotions_position_check CHECK (position BETWEEN 0 AND 9);

CREATE TABLE IF NOT EXISTS community_news (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bulletin_id uuid NOT NULL REFERENCES bulletins(id) ON DELETE CASCADE,
  position integer NOT NULL CHECK (position >= 0),
  category text NOT NULL CHECK (category IN ('새가족', '등반', '결혼', '군입대')),
  content text NOT NULL,
  UNIQUE (bulletin_id, position)
);

COMMIT;
