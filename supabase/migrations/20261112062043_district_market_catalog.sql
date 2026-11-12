-- Additive market data. Existing games remain on their original economic rules.
create table public.lite_districts (
  id text primary key,
  name text not null unique,
  base_demand integer not null check (base_demand > 0),
  economic_share numeric(5,4) not null check (economic_share > 0 and economic_share < 1),
  standard_share numeric(5,4) not null check (standard_share > 0 and standard_share < 1),
  premium_share numeric(5,4) not null check (premium_share > 0 and premium_share < 1),
  check (economic_share + standard_share + premium_share = 1)
);

-- Illustrative classroom parameters, not demographic statistics.
insert into public.lite_districts values
 ('comas','Comas',900,.55,.35,.10),
 ('independencia','Independencia',900,.50,.38,.12),
 ('los-olivos','Los Olivos',900,.45,.40,.15),
 ('smp','San Martín de Porres',900,.52,.36,.12),
 ('sjl','San Juan de Lurigancho',900,.53,.35,.12),
 ('miraflores','Miraflores',900,.20,.40,.40),
 ('san-isidro','San Isidro',900,.15,.35,.50),
 ('surco','Santiago de Surco',900,.25,.40,.35),
 ('la-molina','La Molina',900,.22,.40,.38),
 ('centro-lima','Cercado de Lima (Centro de Lima)',900,.45,.40,.15);

-- Configuration is opt-in, so an old game's interpretation never changes.
create table public.lite_game_markets (
  game_id uuid primary key references public.lite_games(id) on delete cascade,
  assignment_mode text not null check (assignment_mode in ('manual','random')),
  rule_version text not null default 'legacy-v2' check (rule_version = 'legacy-v2')
);
create table public.lite_game_districts (
  game_id uuid not null references public.lite_game_markets(game_id) on delete cascade,
  district_id text not null references public.lite_districts(id),
  base_demand integer not null check (base_demand > 0),
  economic_share numeric(5,4) not null check (economic_share > 0 and economic_share < 1),
  standard_share numeric(5,4) not null check (standard_share > 0 and standard_share < 1),
  premium_share numeric(5,4) not null check (premium_share > 0 and premium_share < 1),
  primary key (game_id,district_id),
  check (economic_share + standard_share + premium_share = 1)
);
create table public.lite_company_markets (
  game_id uuid not null,
  company_id uuid primary key,
  district_id text not null,
  assignment_mode text not null check (assignment_mode in ('manual','random')),
  foreign key (game_id,company_id) references public.lite_companies(game_id,id) on delete cascade,
  foreign key (game_id,district_id) references public.lite_game_districts(game_id,district_id)
);

alter table public.lite_districts enable row level security;
alter table public.lite_game_markets enable row level security;
alter table public.lite_game_districts enable row level security;
alter table public.lite_company_markets enable row level security;
revoke all on public.lite_districts, public.lite_game_markets, public.lite_game_districts, public.lite_company_markets from public, anon, authenticated;
grant select on public.lite_districts, public.lite_game_markets, public.lite_game_districts, public.lite_company_markets to authenticated;
create policy districts_read on public.lite_districts for select to authenticated using (side_lite_private.has_active_identity());
create policy game_markets_read on public.lite_game_markets for select to authenticated using (side_lite_private.is_approved_teacher(game_id) or side_lite_private.is_game_student(game_id));
create policy game_districts_read on public.lite_game_districts for select to authenticated using (side_lite_private.is_approved_teacher(game_id) or side_lite_private.is_game_student(game_id));
create policy company_markets_read on public.lite_company_markets for select to authenticated using (side_lite_private.is_approved_teacher(game_id) or exists (select 1 from public.lite_companies c where c.id=lite_company_markets.company_id and c.game_id=lite_company_markets.game_id and c.student_id=(select auth.uid()) and side_lite_private.has_active_identity()));
grant select, insert, update on public.lite_game_markets, public.lite_game_districts, public.lite_company_markets to side_lite_api;
grant select on public.lite_districts to side_lite_api, side_lite_closer;
grant select on public.lite_game_markets, public.lite_game_districts, public.lite_company_markets to side_lite_closer;

-- Match the MFA boundary of the existing exposed game tables.
do $$ declare t text; begin
  foreach t in array array['lite_districts','lite_game_markets','lite_game_districts','lite_company_markets'] loop
    execute format('create policy require_mfa on public.%I as restrictive for all to authenticated using (side_lite_private.mfa_allowed()) with check (side_lite_private.mfa_allowed())',t);
  end loop;
end $$;
