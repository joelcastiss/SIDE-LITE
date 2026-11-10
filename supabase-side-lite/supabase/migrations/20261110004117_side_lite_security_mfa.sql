-- Local preparation only. Apply after the identity and role migrations.
-- A verified factor requires BOTH an AAL2 signed token and an AAL2 live
-- Auth session. This prevents an earlier AAL1 token becoming privileged after
-- a different browser elevates the same session. Errors deny access.
create function side_lite_private.api_mfa_ready(p_user uuid, p_session uuid, p_aal text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from auth.sessions s
    where s.id=p_session and s.user_id=p_user
      and (s.not_after is null or s.not_after>now())
      and (not exists (select 1 from auth.mfa_factors f where f.user_id=p_user and f.status::text='verified')
        or (p_aal='aal2' and s.aal::text='aal2'))
  )
$$;
revoke all on function side_lite_private.api_mfa_ready(uuid,uuid,text) from public, anon, authenticated, service_role;
grant execute on function side_lite_private.api_mfa_ready(uuid,uuid,text) to side_lite_api;

-- The Data API uses its JWT directly and must enforce the same rule. This
-- no-argument wrapper derives identity and session exclusively from auth.jwt().
create function side_lite_private.mfa_allowed()
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists (
    select 1 from auth.sessions s where s.user_id=auth.uid()
      and s.id::text=coalesce(auth.jwt()->>'session_id','')
      and (s.not_after is null or s.not_after>now())
      and (not exists (select 1 from auth.mfa_factors f where f.user_id=s.user_id and f.status::text='verified')
        or (auth.jwt()->>'aal'='aal2' and s.aal::text='aal2'))
  )
$$;
revoke all on function side_lite_private.mfa_allowed() from public, anon, authenticated, service_role;
grant execute on function side_lite_private.mfa_allowed() to authenticated;

-- Restrictive policies compose with existing ownership and teacher policies;
-- they do not add any new access. No client receives BYPASSRLS.
do $$
declare t text;
begin
  foreach t in array array['lite_profiles','lite_stores','lite_events','lite_games','lite_products','lite_companies','lite_cycles','lite_decisions','lite_results'] loop
    execute format('create policy require_mfa on public.%I as restrictive for all to authenticated using (side_lite_private.mfa_allowed()) with check (side_lite_private.mfa_allowed())',t);
  end loop;
end $$;
