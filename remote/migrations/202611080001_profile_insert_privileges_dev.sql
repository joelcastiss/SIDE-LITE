-- Isolated SIDE-LITE development only; apply after prior grants before deploying
-- the matching API change. Verify the role is NOINHERIT and has no additional
-- INSERT privileges via memberships, table ownership, or superuser status.
ALTER TABLE lite.lite_profiles ALTER COLUMN role SET DEFAULT 'student';
REVOKE INSERT ON lite.lite_profiles FROM PUBLIC, lite_dev_api;
GRANT INSERT (id, display_name) ON lite.lite_profiles TO lite_dev_api;
