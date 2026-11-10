-- SIDE-LITE guest identities: reviewed local preparation only.
-- Anonymous Auth must remain disabled until rate limiting/CAPTCHA and all
-- authorization tests have been verified on the target environment.
alter table public.lite_companies add column brand_name text
  check (brand_name is null or char_length(btrim(brand_name)) between 2 and 80);
-- Prevent two different identities claiming the same legal company in a game.
-- The migration deliberately fails if existing data has such collisions.
create unique index lite_company_game_name_unique on public.lite_companies(game_id, lower(btrim(name)));
create table side_lite_private.lite_guest_recovery (
  company_id uuid primary key references public.lite_companies(id) on delete cascade,
  secret_hash bytea not null unique check(octet_length(secret_hash)=32),
  created_at timestamptz not null default now()
);
alter table side_lite_private.lite_guest_recovery enable row level security;
revoke all on side_lite_private.lite_guest_recovery from public, anon, authenticated, service_role;
grant insert on side_lite_private.lite_guest_recovery to side_lite_api;
-- The server controls this transition after locking and checking the recovery
-- credential; never grant UPDATE to an authenticated browser role.
create or replace function side_lite_private.lock_active_identity(p_user uuid, p_session uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  perform 1 from auth.users u join auth.sessions s on s.user_id=u.id and s.id=p_session
    join public.lite_profiles p on p.id=u.id
    where u.id=p_user and (u.email_confirmed_at is not null or u.is_anonymous is true)
      and (u.banned_until is null or u.banned_until<=clock_timestamp())
      and (s.not_after is null or s.not_after>clock_timestamp()) for share of u,s,p;
  return found;
end $$;
-- is_anonymous is returned from Auth itself; middleware compares it with the
-- signed JWT and never trusts user metadata for identity or authorization.
drop function side_lite_private.api_identity(uuid,uuid);
create function side_lite_private.api_identity(p_user uuid, p_session uuid)
returns table (id uuid, display_name text, email_verified boolean, session_active boolean, banned boolean, teacher_authorized boolean, is_anonymous boolean)
language sql stable security definer set search_path='' as $$
  select p.id,p.display_name,u.email_confirmed_at is not null,
    exists(select 1 from auth.sessions s where s.id=p_session and s.user_id=u.id and (s.not_after is null or s.not_after>now())),
    u.banned_until is not null and u.banned_until>now(),
    exists(select 1 from side_lite_private.lite_teacher_grants g where g.user_id=u.id and g.revoked_at is null
      and lower(u.email)=g.approved_email and u.email_confirmed_at is not null and u.is_anonymous is false),
    u.is_anonymous
  from auth.users u left join public.lite_profiles p on p.id=u.id where u.id=p_user
$$;
revoke all on function side_lite_private.api_identity(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function side_lite_private.api_identity(uuid,uuid) to side_lite_api;
create or replace function side_lite_private.api_create_profile(p_user uuid,p_session uuid,p_name text)
returns table (id uuid,display_name text) language plpgsql security definer set search_path='' as $$
begin
  if char_length(btrim(coalesce(p_name,''))) not between 2 and 80 then return; end if;
  perform 1 from auth.users u join auth.sessions s on s.user_id=u.id and s.id=p_session
    where u.id=p_user and (u.email_confirmed_at is not null or u.is_anonymous is true)
      and (u.banned_until is null or u.banned_until<=clock_timestamp())
      and (s.not_after is null or s.not_after>clock_timestamp()) for share of u,s;
  if not found then return; end if;
  return query insert into public.lite_profiles as p(id,display_name) values(p_user,btrim(p_name))
    on conflict on constraint lite_profiles_pkey do nothing returning p.id,p.display_name;
end $$;
create or replace function side_lite_private.has_active_identity()
returns boolean language sql stable security definer set search_path='' as $$
  select auth.uid() is not null and exists (
    select 1 from auth.users u join auth.sessions s on s.user_id=u.id
    where u.id=auth.uid()
      and (u.email_confirmed_at is not null or (u.is_anonymous is true and coalesce((auth.jwt()->>'is_anonymous')::boolean,false)))
      and (u.banned_until is null or u.banned_until<=now())
      and s.id::text=coalesce(auth.jwt()->>'session_id','') and (s.not_after is null or s.not_after>now())
  )
$$;

-- Recovery is limited to a verified anonymous session and requires possession
-- of a high-entropy capability. The API cannot directly reassign student_id.
create function side_lite_private.api_recover_guest(p_user uuid,p_session uuid,p_code text,p_hash bytea)
returns table(id uuid,game_id uuid,name text) language plpgsql security definer set search_path='' as $$
declare target uuid;
begin
  if not side_lite_private.lock_active_identity(p_user,p_session) then return; end if;
  if not exists(select 1 from auth.users u where u.id=p_user and u.is_anonymous is true) then return; end if;
  select co.id into target from public.lite_companies co join public.lite_games g on g.id=co.game_id
    join side_lite_private.lite_guest_recovery r on r.company_id=co.id
    join auth.users owner on owner.id=co.student_id and owner.is_anonymous is true
    where g.code=p_code and r.secret_hash=p_hash for update of co;
  if target is null then return; end if;
  return query update public.lite_companies co set student_id=p_user where co.id=target returning co.id,co.game_id,co.name;
end $$;
revoke all on function side_lite_private.api_recover_guest(uuid,uuid,text,bytea) from public,anon,authenticated,service_role;
grant execute on function side_lite_private.api_recover_guest(uuid,uuid,text,bytea) to side_lite_api;
