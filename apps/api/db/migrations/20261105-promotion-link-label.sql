-- Existing advertisements retain the default button label when no custom name is set.
ALTER TABLE promotions ADD COLUMN IF NOT EXISTS link_label text NOT NULL DEFAULT '';
