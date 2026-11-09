-- Prepared locally; review the function owner and API role before deployment.
-- Row locks persist to the end of the caller's transaction. Keeping these
-- locks inside a definer function avoids UPDATE rights on Supabase Auth tables.
create function side_lite_private.lock_active_identity(p_user uuid, p_session uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  perform 1 from auth.users u
    join auth.sessions s on s.user_id = u.id and s.id = p_session
    join public.lite_profiles p on p.id = u.id
    where u.id = p_user and u.email_confirmed_at is not null
      and (u.banned_until is null or u.banned_until <= clock_timestamp())
      and (s.not_after is null or s.not_after > clock_timestamp())
    for share of u, s, p;
  return found;
end $$;
revoke all on function side_lite_private.lock_active_identity(uuid, uuid)
  from public, anon, authenticated, service_role;
-- Deployment must explicitly grant EXECUTE to the dedicated server-only API
-- role after its permissions and connection pool have been reviewed.
