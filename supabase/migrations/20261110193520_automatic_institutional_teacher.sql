-- An unverified institutional address grants teacher access by design.
-- Keep identity/session and game ownership checks unchanged.
alter table side_lite_private.lite_teacher_grants
  drop constraint if exists lite_active_grant_attributed;
alter table side_lite_private.lite_teacher_grants
  add constraint lite_active_grant_attributed
  check (revoked_at is not null or granted_by is null or granted_by <> user_id);

create or replace function side_lite_private.lite_auto_grant_upch_teacher()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.is_anonymous is false and new.email_confirmed_at is not null
    and lower(btrim(coalesce(new.email, ''))) ~ '^[^@[:space:]]+@upch[.]pe$' then
    insert into side_lite_private.lite_teacher_grants
      (user_id, approved_email, granted_at, revoked_at)
    values (new.id, lower(btrim(new.email)), clock_timestamp(), null)
    on conflict (user_id) do nothing;
  end if;
  return new;
end $$;
revoke all on function side_lite_private.lite_auto_grant_upch_teacher()
  from public, anon, authenticated, service_role;

drop trigger if exists lite_auto_grant_upch_teacher on auth.users;
create trigger lite_auto_grant_upch_teacher
  after insert or update of email, email_confirmed_at on auth.users
  for each row execute function side_lite_private.lite_auto_grant_upch_teacher();

-- Apply the same rule to eligible accounts without changing existing grants,
-- including explicitly revoked grants. No account or game data is removed.
insert into side_lite_private.lite_teacher_grants
  (user_id, approved_email, granted_at, revoked_at)
select u.id, lower(btrim(u.email)), clock_timestamp(), null
from auth.users u
where u.is_anonymous is false and u.email_confirmed_at is not null
  and lower(btrim(coalesce(u.email, ''))) ~ '^[^@[:space:]]+@upch[.]pe$'
on conflict (user_id) do nothing;
