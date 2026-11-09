-- Proves table and column grants are revoked and the existing data is retained.
do $$
declare t text; role_name text; privilege_name text;
begin
  foreach t in array array['lite_sessions', 'lite_auth_limits', 'lite_teacher_grades', 'lite_teacher_podium'] loop
    if not (select relrowsecurity from pg_class where oid = to_regclass(format('public.%I', t))) then
      raise exception 'RLS missing on %', t;
    end if;
    foreach role_name in array array['anon', 'authenticated'] loop
      foreach privilege_name in array array['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER'] loop
        if has_table_privilege(role_name, format('public.%I', t), privilege_name) then
          raise exception '% has % on %', role_name, privilege_name, t;
        end if;
      end loop;
      if has_any_column_privilege(role_name, format('public.%I', t), 'SELECT, INSERT, UPDATE, REFERENCES') then
        raise exception '% has a column privilege on %', role_name, t;
      end if;
    end loop;
  end loop;
  if not exists (select 1 from public.lite_sessions where id_hash = 'fixture') then
    raise exception 'Existing data was lost';
  end if;
end $$;
