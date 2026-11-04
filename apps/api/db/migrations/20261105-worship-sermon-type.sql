BEGIN;

ALTER TABLE worship_items ADD COLUMN IF NOT EXISTS type text;
ALTER TABLE worship_items ADD COLUMN IF NOT EXISTS sermon jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Convert existing sermon rows using the bulletin's message; retain other text content.
UPDATE worship_items AS item
SET type = 'sermon',
    sermon = jsonb_build_object('sermonTitle', bulletin.sermon_title, 'scripture', bulletin.scripture),
    assignee = COALESCE(NULLIF(btrim(item.assignee), ''), bulletin.preacher)
FROM bulletins AS bulletin
WHERE item.bulletin_id = bulletin.id AND item.type IS NULL AND btrim(item.label) = '설교';
UPDATE worship_items SET type = 'text' WHERE type IS NULL;

ALTER TABLE worship_items ALTER COLUMN type SET DEFAULT 'text';
ALTER TABLE worship_items ALTER COLUMN type SET NOT NULL;
ALTER TABLE worship_items DROP CONSTRAINT IF EXISTS worship_items_type_check;
ALTER TABLE worship_items ADD CONSTRAINT worship_items_type_check CHECK (type IN ('text', 'sermon'));
ALTER TABLE worship_items DROP CONSTRAINT IF EXISTS worship_items_sermon_check;
ALTER TABLE worship_items ADD CONSTRAINT worship_items_sermon_check CHECK (
  type <> 'sermon' OR (jsonb_typeof(sermon) = 'object' AND sermon ?& ARRAY['sermonTitle', 'scripture']
    AND jsonb_typeof(sermon->'sermonTitle') = 'string' AND jsonb_typeof(sermon->'scripture') = 'string')
);

COMMIT;
