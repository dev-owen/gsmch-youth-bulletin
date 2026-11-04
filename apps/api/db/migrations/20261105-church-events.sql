-- 공통 교회 일정 데이터. 기존 교회 정보는 그대로 보존합니다.
ALTER TABLE site_info ADD COLUMN IF NOT EXISTS church_events jsonb NOT NULL DEFAULT '[]'::jsonb;
