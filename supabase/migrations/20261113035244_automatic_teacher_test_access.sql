-- TEST ENVIRONMENT ONLY: address text is not proof of mailbox ownership.
-- Preserve all existing users, grants (including revocations), games and policies.
drop trigger if exists require_attributed_teacher_grant on side_lite_private.lite_teacher_grants;

create or replace function side_lite_private.lite_auto_grant_upch_teacher()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.is_anonymous is false and new.email_confirmed_at is not null
     and lower(coalesce(new.email, '')) ~ '^[^@[:space:]]+@upch[.]pe$' then
    insert into side_lite_private.lite_teacher_grants(user_id, approved_email)
    values (new.id, lower(new.email))
    on conflict (user_id) do nothing;
  end if;
  return new;
end $$;
revoke all on function side_lite_private.lite_auto_grant_upch_teacher() from public, anon, authenticated, service_role;
drop trigger if exists lite_auto_grant_upch_teacher on auth.users;
create trigger lite_auto_grant_upch_teacher
  after insert or update of email_confirmed_at on auth.users
  for each row execute function side_lite_private.lite_auto_grant_upch_teacher();
