-- SIDE-LITE: local preparation only. Review and test before any remote use.
-- The application server must authenticate every write and use transactions.
-- This migration deliberately does not expose write RPCs, configure Cron,
-- create teachers, or migrate credentials/data from a different provider.

create schema if not exists side_lite_private;
revoke all on schema side_lite_private from public, anon, authenticated;
grant usage on schema side_lite_private to authenticated, service_role;

create table public.lite_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(btrim(display_name)) between 2 and 80),
  created_at timestamptz not null default now()
);

-- Only administrators with direct database access can manage these approvals.
-- The email is bound to the verified identity; a changed address loses access.
create table side_lite_private.lite_teacher_grants (
  user_id uuid primary key references auth.users(id) on delete cascade,
  approved_email text not null check (approved_email = lower(btrim(approved_email)) and approved_email ~ '^[^@[:space:]]+@upch[.]pe$'),
  granted_at timestamptz not null default now(),
  granted_by uuid references auth.users(id) on delete set null,
  revoked_at timestamptz,
  -- PostgreSQL requires UPDATE privilege on a column for SELECT FOR SHARE.
  -- This invariant-only column permits locking without changing authorization.
  lock_guard boolean not null default true check (lock_guard)
);
revoke all on side_lite_private.lite_teacher_grants from public, anon, authenticated;

create table public.lite_stores (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text not null
);
create table public.lite_events (
  id text primary key,
  category text not null,
  label text not null,
  effect jsonb not null
);
-- Static copy of js/engine.js EVENTS. Keep changes reviewed against that source.
insert into public.lite_events(id,category,label,effect) values
 ('demand_fair','demand','Feria local','{"id":"demand_fair","type":"demand","label":"Feria local","demand":1.15}'),
 ('demand_rain','demand','Semana lluviosa','{"id":"demand_rain","type":"demand","label":"Semana lluviosa","demand":0.88}'),
 ('demand_holiday','demand','Temporada festiva','{"id":"demand_holiday","type":"demand","label":"Temporada festiva","demand":1.20}'),
 ('demand_slow','demand','Consumo moderado','{"id":"demand_slow","type":"demand","label":"Consumo moderado","demand":0.90}'),
 ('cost_discount','cost','Descuento del proveedor','{"id":"cost_discount","type":"cost","label":"Descuento del proveedor","purchase":0.90}'),
 ('cost_freight','cost','Flete más caro','{"id":"cost_freight","type":"cost","label":"Flete más caro","purchase":1.10}'),
 ('cost_offer','cost','Oferta de temporada','{"id":"cost_offer","type":"cost","label":"Oferta de temporada","purchase":0.95}'),
 ('cost_shortage','cost','Escasez de producto','{"id":"cost_shortage","type":"cost","label":"Escasez de producto","purchase":1.15}'),
 ('opportunity_social','opportunity','Difusión comunitaria','{"id":"opportunity_social","type":"opportunity","label":"Difusión comunitaria","demand":1.10}'),
 ('opportunity_market','opportunity','Mercado temporal','{"id":"opportunity_market","type":"opportunity","label":"Mercado temporal","demand":1.12}'),
 ('opportunity_alliance','opportunity','Alianza comercial','{"id":"opportunity_alliance","type":"opportunity","label":"Alianza comercial","demand":1.08}'),
 ('opportunity_visit','opportunity','Visita de compradores','{"id":"opportunity_visit","type":"opportunity","label":"Visita de compradores","demand":1.06}');
create table public.lite_games (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.lite_profiles(id),
  name text not null check (char_length(btrim(name)) between 2 and 80),
  code text not null unique check (code ~ '^[A-F0-9]{8}$'),
  cycle_count integer not null check (cycle_count in (3, 6)),
  duration_seconds integer not null default 120 check (duration_seconds = 120),
  capital_min integer not null check (capital_min between 10000 and 1000000 and capital_min % 10000 = 0),
  capital_max integer not null check (capital_max between capital_min and 1000000 and capital_max % 10000 = 0),
  costs jsonb not null check (jsonb_typeof(costs) = 'object'),
  enabled_events jsonb not null default '[]'::jsonb check (jsonb_typeof(enabled_events) = 'array'),
  created_at timestamptz not null default now()
);
create table public.lite_products (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.lite_games(id) on delete cascade,
  quality text not null check (quality in ('basic','standard','premium')),
  unit_cost integer not null check (unit_cost > 0),
  unique (game_id, quality)
);
create table public.lite_companies (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.lite_games(id) on delete cascade,
  student_id uuid not null references public.lite_profiles(id),
  name text not null check (char_length(btrim(name)) between 1 and 80),
  store_id uuid not null references public.lite_stores(id),
  initial_capital integer not null check (initial_capital between 10000 and 1000000 and initial_capital % 10000 = 0),
  cash integer not null check (cash >= 0),
  inventory jsonb not null default '[]'::jsonb check (jsonb_typeof(inventory) = 'array'),
  unique (game_id, student_id), unique (game_id, id)
);
create table public.lite_cycles (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.lite_games(id) on delete cascade,
  number integer not null check (number between 1 and 6),
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null,
  status text not null default 'open' check (status in ('open','closed')),
  paused_at timestamptz,
  close_requested_at timestamptz,
  event_id text references public.lite_events(id),
  unique (game_id, number), unique (game_id, id),
  check (ends_at > starts_at),
  check (status <> 'closed' or paused_at is null)
);
create unique index lite_one_open_cycle on public.lite_cycles(game_id) where status = 'open';
create index lite_due_cycles on public.lite_cycles(ends_at, id) where status = 'open' and paused_at is null;
-- Initial deadline comes only from the server clock. Pauses must update ends_at
-- under the same row lock in the trusted game operations, still to be built.
create function side_lite_private.initialize_cycle() returns trigger
language plpgsql set search_path = '' as $$
declare max_cycles integer;
begin
  select g.cycle_count into max_cycles from public.lite_games g where g.id = new.game_id for update;
  if max_cycles is null or new.number > max_cycles then
    raise exception 'Invalid cycle number' using errcode = '23514';
  end if;
  new.starts_at := clock_timestamp();
  new.ends_at := new.starts_at + interval '120 seconds';
  return new;
end $$;
revoke all on function side_lite_private.initialize_cycle() from public, anon, authenticated;
create trigger lite_cycle_initialize before insert on public.lite_cycles
for each row execute function side_lite_private.initialize_cycle();
create table side_lite_private.lite_cycle_secrets (
  cycle_id uuid primary key references public.lite_cycles(id) on delete cascade,
  seed uuid not null default gen_random_uuid()
);
revoke all on side_lite_private.lite_cycle_secrets from public, anon, authenticated;
create table public.lite_decisions (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null,
  cycle_id uuid not null,
  company_id uuid not null,
  quality text not null check (quality in ('basic','standard','premium')),
  quantity integer not null check (quantity between 0 and 100000),
  price integer not null check (price between 1 and 100000),
  marketing_amount integer not null check (marketing_amount = 0 or marketing_amount between 200 and 10000),
  confirmed boolean not null default false,
  updated_at timestamptz not null default now(),
  unique (cycle_id, company_id),
  foreign key (game_id, cycle_id) references public.lite_cycles(game_id, id) on delete cascade,
  foreign key (game_id, company_id) references public.lite_companies(game_id, id) on delete cascade
);
create table public.lite_results (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null,
  cycle_id uuid not null,
  company_id uuid not null,
  result jsonb not null check (jsonb_typeof(result) = 'object'),
  created_at timestamptz not null default now(),
  unique (cycle_id, company_id),
  foreign key (game_id, cycle_id) references public.lite_cycles(game_id, id),
  foreign key (game_id, company_id) references public.lite_companies(game_id, id)
);
create index lite_companies_student_game on public.lite_companies(student_id, game_id);
create index lite_games_teacher on public.lite_games(teacher_id);
create index lite_results_company on public.lite_results(company_id);

insert into public.lite_stores(name,description) values
 ('Galería Central','Tienda urbana'),('Paseo del Sol','Tienda comercial'),
 ('Plaza del Parque','Tienda de barrio'),('Mercado Azul','Tienda de mercado');

-- Helper functions only answer ownership/membership for the CURRENT identity.
-- Their unexposed schema and fixed search_path limit the definer surface.
create function side_lite_private.is_approved_teacher(p_game uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists (
    select 1 from public.lite_games g
    join side_lite_private.lite_teacher_grants t on t.user_id = g.teacher_id
    join auth.users u on u.id = t.user_id
    where g.id = p_game and g.teacher_id = auth.uid() and t.revoked_at is null
      and u.email_confirmed_at is not null and lower(u.email) = t.approved_email
  )
$$;
create function side_lite_private.is_game_student(p_game uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists (
    select 1 from public.lite_companies c where c.game_id = p_game and c.student_id = auth.uid()
  )
$$;
create function side_lite_private.owns_company(p_company uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists (
    select 1 from public.lite_companies c where c.id = p_company and c.student_id = auth.uid()
  )
$$;
revoke all on function side_lite_private.is_approved_teacher(uuid) from public, anon, authenticated;
revoke all on function side_lite_private.is_game_student(uuid) from public, anon, authenticated;
revoke all on function side_lite_private.owns_company(uuid) from public, anon, authenticated;
grant execute on function side_lite_private.is_approved_teacher(uuid), side_lite_private.is_game_student(uuid), side_lite_private.owns_company(uuid) to authenticated;

alter table public.lite_profiles enable row level security;
alter table public.lite_stores enable row level security;
alter table public.lite_events enable row level security;
alter table public.lite_games enable row level security;
alter table public.lite_products enable row level security;
alter table public.lite_companies enable row level security;
alter table public.lite_cycles enable row level security;
alter table public.lite_decisions enable row level security;
alter table public.lite_results enable row level security;
alter table side_lite_private.lite_teacher_grants enable row level security;
alter table side_lite_private.lite_cycle_secrets enable row level security;

revoke all on public.lite_profiles, public.lite_stores, public.lite_events, public.lite_games,
 public.lite_products, public.lite_companies, public.lite_cycles, public.lite_decisions, public.lite_results
 from public, anon, authenticated;
grant select on public.lite_profiles, public.lite_stores, public.lite_events, public.lite_games,
 public.lite_products, public.lite_companies, public.lite_cycles, public.lite_decisions, public.lite_results to authenticated;
grant insert (id, display_name), update (display_name) on public.lite_profiles to authenticated;
-- The service role is trusted server infrastructure, never a browser credential.
grant all on public.lite_profiles, public.lite_stores, public.lite_events, public.lite_games,
 public.lite_products, public.lite_companies, public.lite_cycles, public.lite_decisions, public.lite_results to service_role;
-- Runtime may verify an approval but must never create, change or revoke one.
-- Revoke first in case project default privileges granted service_role more.
revoke all on side_lite_private.lite_teacher_grants from service_role;
grant select on side_lite_private.lite_teacher_grants to service_role;
grant update (lock_guard) on side_lite_private.lite_teacher_grants to service_role;
grant all on side_lite_private.lite_cycle_secrets to service_role;

create policy profile_self_read on public.lite_profiles for select to authenticated using (id = (select auth.uid()));
create policy profile_self_insert on public.lite_profiles for insert to authenticated with check (id = (select auth.uid()));
create policy profile_self_update on public.lite_profiles for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy stores_read on public.lite_stores for select to authenticated using (true);
create policy events_read on public.lite_events for select to authenticated using (true);
create policy games_member_read on public.lite_games for select to authenticated using (side_lite_private.is_approved_teacher(id) or side_lite_private.is_game_student(id));
create policy products_member_read on public.lite_products for select to authenticated using (side_lite_private.is_approved_teacher(game_id) or side_lite_private.is_game_student(game_id));
create policy companies_private_read on public.lite_companies for select to authenticated using (student_id = (select auth.uid()) or side_lite_private.is_approved_teacher(game_id));
create policy cycles_member_read on public.lite_cycles for select to authenticated using (side_lite_private.is_approved_teacher(game_id) or side_lite_private.is_game_student(game_id));
create policy decisions_private_read on public.lite_decisions for select to authenticated using (side_lite_private.owns_company(company_id) or side_lite_private.is_approved_teacher(game_id));
create policy results_private_read on public.lite_results for select to authenticated using (side_lite_private.owns_company(company_id) or side_lite_private.is_approved_teacher(game_id));
