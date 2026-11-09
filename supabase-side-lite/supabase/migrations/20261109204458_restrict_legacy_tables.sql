-- These tables belong to the standalone local server, not the Supabase API.
-- Older installations may contain them in public: keep their data, but do not
-- expose it through the Data API. A fresh Supabase install has none of them.
-- No policy is created: browser access stays denied until a separately reviewed
-- feature requires a specific access model. This does not touch server roles.
do $$
declare
  t text;
  cols text;
begin
  foreach t in array array['lite_sessions', 'lite_auth_limits', 'lite_teacher_grades', 'lite_teacher_podium'] loop
    if to_regclass(format('public.%I', t)) is not null then
      execute format('alter table public.%I enable row level security', t);
      execute format('revoke all privileges on table public.%I from public, anon, authenticated', t);
      -- Table-level REVOKE alone does not remove independent column grants.
      select string_agg(format('%I', a.attname), ', ' order by a.attnum) into cols
        from pg_attribute a where a.attrelid = to_regclass(format('public.%I', t))
          and a.attnum > 0 and not a.attisdropped;
      if cols is not null then
        execute format('revoke select (%s), insert (%s), update (%s), references (%s) on public.%I from public, anon, authenticated', cols, cols, cols, cols, t);
      end if;
    end if;
  end loop;
end $$;
