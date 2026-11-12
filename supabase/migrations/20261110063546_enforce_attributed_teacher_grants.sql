UPDATE side_lite_private.lite_teacher_grants SET revoked_at = clock_timestamp() WHERE revoked_at IS NULL AND granted_by IS NULL;
