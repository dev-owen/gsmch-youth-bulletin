-- 공통 교회 안내. 기존 교회 정보와 주보 데이터는 그대로 보존합니다.
ALTER TABLE site_info ADD COLUMN IF NOT EXISTS recurring_info jsonb NOT NULL DEFAULT '{}'::jsonb;
