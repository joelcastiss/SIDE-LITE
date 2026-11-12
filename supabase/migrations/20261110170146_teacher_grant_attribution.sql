alter table side_lite_private.lite_teacher_grants add constraint lite_active_grant_attributed check (revoked_at is not null or (granted_by is not null and granted_by <> user_id));
