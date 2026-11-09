-- Disposable PostgreSQL only, run after the complete migration chain.
do $$
begin
  if has_table_privilege('side_lite_api', 'auth.users', 'UPDATE')
    or has_any_column_privilege('side_lite_api', 'auth.users', 'UPDATE')
    or has_any_column_privilege('side_lite_api', 'auth.sessions', 'UPDATE') then
    raise exception 'API must not update Auth identities or sessions';
  end if;
  if has_column_privilege('side_lite_api', 'public.lite_companies', 'cash', 'UPDATE')
    or has_column_privilege('side_lite_api', 'public.lite_companies', 'inventory', 'UPDATE')
    or has_table_privilege('side_lite_api', 'public.lite_results', 'INSERT')
    or has_column_privilege('side_lite_api', 'side_lite_private.lite_teacher_grants', 'revoked_at', 'UPDATE') then
    raise exception 'API has excessive economic or teacher privileges';
  end if;
  if not has_function_privilege('side_lite_api', 'side_lite_private.lock_active_identity(uuid,uuid)', 'EXECUTE')
    or has_function_privilege('authenticated', 'side_lite_private.lock_active_identity(uuid,uuid)', 'EXECUTE')
    or has_function_privilege('anon', 'side_lite_private.lock_active_identity(uuid,uuid)', 'EXECUTE') then
    raise exception 'identity lock permissions are invalid';
  end if;
  if has_table_privilege('side_lite_closer', 'public.lite_games', 'INSERT')
    or has_table_privilege('side_lite_closer', 'side_lite_private.lite_teacher_grants', 'SELECT')
    or not has_column_privilege('side_lite_closer', 'public.lite_companies', 'cash', 'UPDATE') then
    raise exception 'closer permissions are invalid';
  end if;
end $$;
