-- Disposable test database only. Model the inherited grants on old tables.
create table public.lite_sessions (id_hash text primary key);
create table public.lite_auth_limits (key_hash text primary key);
create table public.lite_teacher_grades (id integer primary key);
create table public.lite_teacher_podium (id integer primary key);
grant all on public.lite_sessions, public.lite_auth_limits,
  public.lite_teacher_grades, public.lite_teacher_podium to anon, authenticated;
grant select (id_hash), update (id_hash) on public.lite_sessions to authenticated;
insert into public.lite_sessions values ('fixture');
