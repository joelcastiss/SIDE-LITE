-- Proposal only: review and validate in an isolated environment before migration.
-- Existing active grants stay active and are recorded for institutional review.
drop trigger if exists lite_auto_grant_upch_teacher on auth.users;
create table if not exists side_lite_private.teacher_grants_pending_review (
  user_id uuid primary key references auth.users(id) on delete cascade,
  recorded_at timestamptz not null default clock_timestamp(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id)
);
alter table side_lite_private.teacher_grants_pending_review enable row level security;
revoke all on side_lite_private.teacher_grants_pending_review from public, anon, authenticated, service_role;
insert into side_lite_private.teacher_grants_pending_review(user_id)
select user_id from side_lite_private.lite_teacher_grants
where revoked_at is null and granted_by is null
on conflict (user_id) do nothing;

-- Protect future grants and reactivations without affecting existing grants or
-- their lock_guard updates. Attribution is recorded only after independent review.
create or replace function side_lite_private.require_attributed_teacher_grant()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.revoked_at is null and (new.granted_by is null or new.granted_by = new.user_id)
    and (tg_op = 'INSERT' or old.revoked_at is not null
      or new.granted_by is distinct from old.granted_by) then
    raise exception 'Teacher authorization requires independent attribution' using errcode = '23514';
  end if;
  return new;
end $$;
revoke all on function side_lite_private.require_attributed_teacher_grant() from public, anon, authenticated, service_role;
create trigger require_attributed_teacher_grant
  before insert or update on side_lite_private.lite_teacher_grants
  for each row execute function side_lite_private.require_attributed_teacher_grant();
