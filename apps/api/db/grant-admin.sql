-- Run after the selected Google account has signed in once.
-- psql -v admin_email='person@example.com' -f db/grant-admin.sql
INSERT INTO admin_users (user_id)
SELECT id FROM "user" WHERE email = :'admin_email'
ON CONFLICT (user_id) DO NOTHING;
