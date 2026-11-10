-- Revoke the grants backfilled by the retired automatic grant migration.
UPDATE side_lite_private.lite_teacher_grants
SET revoked_at = clock_timestamp()
WHERE revoked_at IS NULL AND granted_by IS NULL
  AND granted_at = timestamptz '2026-11-10 05:51:30.635672+00';
