-- Isolated PostgreSQL fixture. Never run against a shared database.
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create role side_lite_api nologin bypassrls;
create schema auth;
create schema side_lite_private;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
create table auth.sessions(id uuid primary key,user_id uuid not null,not_after timestamptz,aal text);
create table auth.mfa_factors(id uuid primary key,user_id uuid not null,status text not null);
grant usage on schema auth,side_lite_private to authenticated,side_lite_api;
grant execute on function auth.uid(),auth.jwt() to authenticated;
do $$ declare t text; begin
 foreach t in array array['lite_profiles','lite_stores','lite_events','lite_games','lite_products','lite_companies','lite_cycles','lite_decisions','lite_results'] loop
  execute format('create table public.%I (id integer primary key)',t);
  execute format('alter table public.%I enable row level security',t);
  execute format('grant select,insert,update,delete on public.%I to authenticated',t);
  execute format('create policy test_base on public.%I to authenticated using (true) with check (true)',t);
  execute format('insert into public.%I values (1)',t);
 end loop;
 foreach t in array array['lite_sessions','lite_auth_limits','lite_teacher_grades','lite_teacher_podium'] loop
  execute format('create table public.%I (id integer primary key)',t);
  execute format('grant all on public.%I to anon,authenticated',t);
  execute format('grant select (id),update (id) on public.%I to authenticated',t);
  execute format('insert into public.%I values (1)',t);
 end loop;
end $$;
