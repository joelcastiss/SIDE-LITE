-- Approval is an explicit act by a distinct administrator. Existing
-- unattributed approvals were revoked by 20261110063546. Do not reactivate
-- them during migration. A deleted administrator cannot silently erase the
-- attribution of an active grant: revoke first, then remove the account.
alter table side_lite_private.lite_teacher_grants
  add constraint lite_active_grant_attributed
  check (revoked_at is not null or (granted_by is not null and granted_by <> user_id));
