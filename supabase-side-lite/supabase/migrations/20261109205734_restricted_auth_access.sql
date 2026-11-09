-- The trusted API cannot assume USAGE on Supabase's auth schema. These
-- narrowly scoped definer functions expose only authorization decisions and
-- profile fields, never raw Auth rows. Their owner must have legitimate read
-- and row-lock privileges on Auth; test that precondition on the target stack.
create function side_lite_private.api_identity(p_user uuid, p_session uuid)
returns table (id uuid, display_name text, email_verified boolean, session_active boolean, banned boolean, teacher_authorized boolean)
language sql stable security definer set search_path = '' as $$
  select p.id, p.display_name, u.email_confirmed_at is not null,
    exists(select 1 from auth.sessions s where s.id=p_session and s.user_id=u.id and (s.not_after is null or s.not_after>now())),
    u.banned_until is not null and u.banned_until>now(),
    exists(select 1 from side_lite_private.lite_teacher_grants g where g.user_id=u.id and g.revoked_at is null
      and lower(u.email)=g.approved_email and u.email_confirmed_at is not null)
  from auth.users u left join public.lite_profiles p on p.id=u.id where u.id=p_user
$$;

create function side_lite_private.api_create_profile(p_user uuid, p_session uuid, p_name text)
returns table (id uuid, display_name text)
language plpgsql security definer set search_path = '' as $$
begin
  if char_length(btrim(coalesce(p_name,''))) not between 2 and 80 then return; end if;
  perform 1 from auth.users u join auth.sessions s on s.user_id=u.id and s.id=p_session
    where u.id=p_user and u.email_confirmed_at is not null
      and (u.banned_until is null or u.banned_until<=clock_timestamp())
      and (s.not_after is null or s.not_after>clock_timestamp()) for share of u,s;
  if not found then return; end if;
  return query insert into public.lite_profiles as p(id,display_name) values(p_user,btrim(p_name))
    on conflict on constraint lite_profiles_pkey do nothing returning p.id,p.display_name;
end $$;

create function side_lite_private.api_lock_teacher(p_user uuid, p_session uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if not side_lite_private.lock_active_identity(p_user,p_session) then return false; end if;
  perform 1 from side_lite_private.lite_teacher_grants g join auth.users u on u.id=g.user_id
    where g.user_id=p_user and g.revoked_at is null and u.email_confirmed_at is not null
      and lower(u.email)=g.approved_email for share of g;
  return found;
end $$;

revoke all on function side_lite_private.api_identity(uuid,uuid),
  side_lite_private.api_create_profile(uuid,uuid,text), side_lite_private.api_lock_teacher(uuid,uuid)
  from public, anon, authenticated, service_role;
grant execute on function side_lite_private.api_identity(uuid,uuid),
  side_lite_private.api_create_profile(uuid,uuid,text), side_lite_private.api_lock_teacher(uuid,uuid)
  to side_lite_api;
-- Direct Auth grants are unnecessary even where the platform permits them.
revoke select (id,email,email_confirmed_at,banned_until) on auth.users from side_lite_api;
revoke select (id,user_id,not_after) on auth.sessions from side_lite_api;
revoke usage on schema auth from side_lite_api;
-- A grant made by the schema owner may not be revocable by this migration's
-- executor. Do not silently continue with a more privileged API role.
do $$ begin
  if has_schema_privilege('side_lite_api','auth','USAGE') then
    raise exception 'side_lite_api must not have USAGE on auth; revoke it as schema owner before applying';
  end if;
end $$;
