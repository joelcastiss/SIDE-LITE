-- SIDE-LITE only. Prerequisite: reviewed core already exists in this project;
-- never rerun core blindly where its migration history is absent.
-- Fail closed if core relations are missing; ordinary DDL is transactional.
-- Check the current Auth session on every direct Data API request. A signed JWT
-- alone may remain valid after sign-out, administrative ban, or email change.
create function side_lite_private.has_active_identity()
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists (
    select 1 from auth.users u join auth.sessions s on s.user_id = u.id
    where u.id = auth.uid() and u.email_confirmed_at is not null
      and (u.banned_until is null or u.banned_until <= now())
      and s.id::text = coalesce(auth.jwt()->>'session_id', '')
      and (s.not_after is null or s.not_after > now())
  )
$$;
revoke all on function side_lite_private.has_active_identity() from public, anon, authenticated, service_role;
grant execute on function side_lite_private.has_active_identity() to authenticated;

-- Minimal self-only identity for the static login UI; never trusts user metadata
-- for the role and checks the current explicit administrative grant on each call.
create function public.lite_my_identity()
returns table (id uuid, display_name text, role text)
language sql stable security definer set search_path = '' as $$
  select p.id, p.display_name,
    case when exists (
      select 1 from side_lite_private.lite_teacher_grants g
      join auth.users u on u.id = g.user_id
      where g.user_id = p.id and g.revoked_at is null
        and u.email_confirmed_at is not null and lower(u.email) = g.approved_email
    ) then 'teacher' else 'student' end
  from public.lite_profiles p
  where p.id = auth.uid() and side_lite_private.has_active_identity()
$$;
revoke all on function public.lite_my_identity() from public, anon, authenticated, service_role;
grant execute on function public.lite_my_identity() to authenticated;

-- Teacher rights require an explicit current grant and the same verified
-- institutional email. Authentication/session checks are live, not JWT metadata.
create or replace function side_lite_private.is_approved_teacher(p_game uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select side_lite_private.has_active_identity() and exists (
    select 1 from public.lite_games g
    join side_lite_private.lite_teacher_grants t on t.user_id = g.teacher_id
    join auth.users u on u.id = t.user_id
    where g.id = p_game and g.teacher_id = auth.uid() and t.revoked_at is null
      and u.email_confirmed_at is not null and lower(u.email) = t.approved_email
  )
$$;
create or replace function side_lite_private.is_game_student(p_game uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select side_lite_private.has_active_identity() and exists (
    select 1 from public.lite_companies c where c.game_id = p_game and c.student_id = auth.uid()
  )
$$;
create or replace function side_lite_private.owns_company(p_company uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select side_lite_private.has_active_identity() and exists (
    select 1 from public.lite_companies c where c.id = p_company and c.student_id = auth.uid()
  )
$$;

-- A table-level SELECT would expose the join code despite column revocation.
revoke select on public.lite_games from public, anon, authenticated;
revoke select (code) on public.lite_games from public, anon, authenticated;
grant select (id, teacher_id, name, cycle_count, duration_seconds, capital_min, capital_max, costs, enabled_events, created_at, ended_at) on public.lite_games to authenticated;

drop policy profile_self_read on public.lite_profiles;
create policy profile_self_read on public.lite_profiles for select to authenticated using (side_lite_private.has_active_identity() and id = (select auth.uid()));
drop policy profile_self_insert on public.lite_profiles;
create policy profile_self_insert on public.lite_profiles for insert to authenticated with check (side_lite_private.has_active_identity() and id = (select auth.uid()));
drop policy profile_self_update on public.lite_profiles;
create policy profile_self_update on public.lite_profiles for update to authenticated using (side_lite_private.has_active_identity() and id = (select auth.uid())) with check (side_lite_private.has_active_identity() and id = (select auth.uid()));
drop policy stores_read on public.lite_stores;
create policy stores_read on public.lite_stores for select to authenticated using (side_lite_private.has_active_identity());
drop policy events_read on public.lite_events;
create policy events_read on public.lite_events for select to authenticated using (side_lite_private.has_active_identity());
drop policy games_member_read on public.lite_games;
create policy games_member_read on public.lite_games for select to authenticated using (side_lite_private.is_approved_teacher(id) or side_lite_private.is_game_student(id));
drop policy products_member_read on public.lite_products;
create policy products_member_read on public.lite_products for select to authenticated using (side_lite_private.is_approved_teacher(game_id) or side_lite_private.is_game_student(game_id));
drop policy companies_private_read on public.lite_companies;
create policy companies_private_read on public.lite_companies for select to authenticated using ((side_lite_private.has_active_identity() and student_id = (select auth.uid())) or side_lite_private.is_approved_teacher(game_id));
drop policy cycles_member_read on public.lite_cycles;
create policy cycles_member_read on public.lite_cycles for select to authenticated using (side_lite_private.is_approved_teacher(game_id) or side_lite_private.is_game_student(game_id));
drop policy decisions_private_read on public.lite_decisions;
create policy decisions_private_read on public.lite_decisions for select to authenticated using (side_lite_private.owns_company(company_id) or side_lite_private.is_approved_teacher(game_id));
drop policy results_private_read on public.lite_results;
create policy results_private_read on public.lite_results for select to authenticated using (side_lite_private.owns_company(company_id) or side_lite_private.is_approved_teacher(game_id));
