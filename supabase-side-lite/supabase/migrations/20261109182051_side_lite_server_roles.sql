-- Local proposal only. NOLOGIN roles need separately provisioned server-only
-- credentials. Review platform support and effective role memberships first.
-- BYPASSRLS is necessary for trusted transactional SQL; narrow object grants
-- are therefore essential. Never grant these roles to browser-facing roles.
create role side_lite_api nologin noinherit bypassrls;
create role side_lite_closer nologin noinherit bypassrls;
grant usage on schema public, side_lite_private to side_lite_api, side_lite_closer;
grant usage on schema auth to side_lite_api;
grant select (id, email, email_confirmed_at, banned_until) on auth.users to side_lite_api;
grant select (id, user_id, not_after) on auth.sessions to side_lite_api;
grant execute on function side_lite_private.lock_active_identity(uuid, uuid) to side_lite_api;

grant select on public.lite_profiles, public.lite_stores, public.lite_events,
  public.lite_games, public.lite_products, public.lite_companies,
  public.lite_cycles, public.lite_decisions, public.lite_results to side_lite_api;
grant insert (id, display_name) on public.lite_profiles to side_lite_api;
grant insert on public.lite_games, public.lite_products, public.lite_companies,
  public.lite_cycles, public.lite_decisions to side_lite_api;
grant update (ended_at) on public.lite_games to side_lite_api;
-- UPDATE on a harmless column permits SELECT FOR UPDATE for affordability
-- without giving the API authority to change company cash or inventory.
grant update (name) on public.lite_companies to side_lite_api;
grant update (ends_at, paused_at, close_requested_at) on public.lite_cycles to side_lite_api;
grant update (quality, quantity, price, marketing_amount, confirmed, updated_at) on public.lite_decisions to side_lite_api;
grant select on side_lite_private.lite_teacher_grants to side_lite_api;
grant update (lock_guard) on side_lite_private.lite_teacher_grants to side_lite_api;
grant select, insert on side_lite_private.lite_cycle_secrets to side_lite_api;
grant select, insert, update on side_lite_private.lite_join_attempt_windows to side_lite_api;

grant select on public.lite_games, public.lite_companies, public.lite_cycles,
  public.lite_decisions to side_lite_closer;
grant select on side_lite_private.lite_cycle_secrets to side_lite_closer;
grant insert on public.lite_results to side_lite_closer;
grant update (cash, inventory) on public.lite_companies to side_lite_closer;
grant update (status) on public.lite_cycles to side_lite_closer;
