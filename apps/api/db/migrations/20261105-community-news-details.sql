-- Preserve existing free-text news while adding member lists and wedding fields.
ALTER TABLE community_news ADD COLUMN IF NOT EXISTS details jsonb NOT NULL DEFAULT '{}'::jsonb;
