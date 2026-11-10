-- Requested policy: the @upch.pe address itself grants teacher access.
-- Email confirmation is disabled, so this does not prove mailbox ownership.
create function side_lite_private.grant_institutional_teacher() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.is_anonymous is false and lower(btrim(coalesce(new.email, ''))) ~ '^[^@[:space:]]+@upch[.]pe$' then
    insert into side_lite_private.lite_teacher_grants (user_id, approved_email)
    values (new.id, lower(btrim(new.email))) on conflict (user_id) do nothing;
  end if;
  return new;
end $$;
revoke all on function side_lite_private.grant_institutional_teacher() from public, anon, authenticated, service_role;
create trigger lite_grant_institutional_teacher after insert on auth.users
for each row execute function side_lite_private.grant_institutional_teacher();

insert into side_lite_private.lite_teacher_grants(user_id, approved_email)
select u.id, lower(btrim(u.email)) from auth.users u
where u.is_anonymous is false and lower(btrim(coalesce(u.email,''))) ~ '^[^@[:space:]]+@upch[.]pe$'
on conflict (user_id) do nothing;
