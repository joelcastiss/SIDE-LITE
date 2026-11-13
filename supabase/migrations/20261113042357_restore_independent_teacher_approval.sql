-- Preserve all existing grants, including those created by the test-only rule.
drop trigger if exists lite_auto_grant_upch_teacher on auth.users;

insert into side_lite_private.teacher_grants_pending_review(user_id)
select user_id from side_lite_private.lite_teacher_grants
where revoked_at is null and granted_by is null
on conflict (user_id) do nothing;

-- This trigger function was installed by 20261113025642. Recreate only the
-- guard, without changing current grants or reactivating revoked ones.
drop trigger if exists require_attributed_teacher_grant on side_lite_private.lite_teacher_grants;
create trigger require_attributed_teacher_grant
  before insert or update on side_lite_private.lite_teacher_grants
  for each row execute function side_lite_private.require_attributed_teacher_grant();
