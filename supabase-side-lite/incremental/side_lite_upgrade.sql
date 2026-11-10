begin;
-- Incremental SIDE-LITE upgrade, based on read-only remote catalog.
-- Execute transactionally as an explicitly approved administrator.
create table if not exists side_lite_private.integration_revisions (revision text primary key, applied_at timestamptz not null default now());
revoke all on side_lite_private.integration_revisions from public,anon,authenticated,service_role;
do $side_upgrade$
begin
 if exists(select 1 from side_lite_private.integration_revisions where revision = 'side-lite-incremental-20261110-v1') then return; end if;
 if to_regclass('public.lite_games') is null or to_regclass('public.lite_companies') is null or to_regclass('side_lite_private.lite_teacher_grants') is null or to_regprocedure('side_lite_private.initialize_cycle()') is null then raise exception 'La estructura base SIDE-LITE no coincide; no se aplicó nada'; end if;
 if not (exists(select 1 from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_auth_limits' and a.attname='attempts' and not a.attisdropped and format_type(a.atttypid,a.atttypmod)='integer' and a.attnotnull=true)) then raise exception 'Columna incompatible: public.lite_auth_limits.attempts'; end if;
 if not (exists(select 1 from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_auth_limits' and a.attname='expires_at' and not a.attisdropped and format_type(a.atttypid,a.atttypmod)='timestamp with time zone' and a.attnotnull=true)) then raise exception 'Columna incompatible: public.lite_auth_limits.expires_at'; end if;
 if not (exists(select 1 from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_auth_limits' and a.attname='key_hash' and not a.attisdropped and format_type(a.atttypid,a.atttypmod)='text' and a.attnotnull=true)) then raise exception 'Columna incompatible: public.lite_auth_limits.key_hash'; end if;
 if not (exists(select 1 from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_companies' and a.attname='cash' and not a.attisdropped and format_type(a.atttypid,a.atttypmod)='integer' and a.attnotnull=true)) then raise exception 'Columna incompatible: public.lite_companies.cash'; end if;
 if not (exists(select 1 from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_companies' and a.attname='game_id' and not a.attisdropped and format_type(a.atttypid,a.atttypmod)='uuid' and a.attnotnull=true)) then raise exception 'Columna incompatible: public.lite_companies.game_id'; end if;
 if not (exists(select 1 from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_companies' and a.attname='id' and not a.attisdropped and format_type(a.atttypid,a.atttypmod)='uuid' and a.attnotnull=true)) then raise exception 'Columna incompatible: public.lite_companies.id'; end if;
 if not (exists(select 1 from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_companies' and a.attname='initial_capital' and not a.attisdropped and format_type(a.atttypid,a.atttypmod)='integer' and a.attnotnull=true)) then raise exception 'Columna incompatible: public.lite_companies.initial_capital'; end if;
 if not (exists(select 1 from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_companies' and a.attname='inventory' and not a.attisdropped and format_type(a.atttypid,a.atttypmod)='jsonb' and a.attnotnull=true)) then raise exception 'Columna incompatible: public.lite_companies.inventory'; end if;
 if not (exists(select 1 from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_companies' and a.attname='name' and not a.attisdropped and format_type(a.atttypid,a.atttypmod)='text' and a.attnotnull=true)) then raise exception 'Columna incompatible: public.lite_companies.name'; end if;
 if not (exists(select 1 from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_companies' and a.attname='store_id' and not a.attisdropped and format_type(a.atttypid,a.atttypmod)='uuid' and a.attnotnull=true)) then raise exception 'Columna incompatible: public.lite_companies.store_id'; end if;
 if not (exists(select 1 from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_companies' and a.attname='student_id' and not a.attisdropped and format_type(a.atttypid,a.atttypmod)='uuid' and a.attnotnull=true)) then raise exception 'Columna incompatible: public.lite_companies.student_id'; end if;
 if not (exists(select 1 from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_cycles' and a.attname='close_requested_at' and not a.attisdropped and format_type(a.atttypid,a.atttypmod)='timestamp with time zone' and a.attnotnull=false)) then raise exception 'Columna incompatible: public.lite_cycles.close_requested_at'; end if;
 if not (exists(select 1 from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_cycles' and a.attname='ends_at' and not a.attisdropped and format_type(a.atttypid,a.atttypmod)='timestamp with time zone' and a.attnotnull=true)) then raise exception 'Columna incompatible: public.lite_cycles.ends_at'; end if;
 if not (exists(select 1 from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_cycles' and a.attname='event_id' and not a.attisdropped and format_type(a.atttypid,a.atttypmod)='text' and a.attnotnull=false)) then raise exception 'Columna incompatible: public.lite_cycles.event_id'; end if;
 if not (exists(select 1 from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_cycles' and a.attname='game_id' and not a.attisdropped and format_type(a.atttypid,a.atttypmod)='uuid' and a.attnotnull=true)) then raise exception 'Columna incompatible: public.lite_cycles.game_id'; end if;
 if not (exists(select 1 from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_cycles' and a.attname='id' and not a.attisdropped and format_type(a.atttypid,a.atttypmod)='uuid' and a.attnotnull=true)) then raise exception 'Columna incompatible: public.lite_cycles.id'; end if;
 if not (exists(select 1 from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_cycles' and a.attname='number' and not a.attisdropped and format_type(a.atttypid,a.atttypmod)='integer' and a.attnotnull=true)) then raise exception 'Columna incompatible: public.lite_cycles.number'; end if;
 if not (exists(select 1 from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_cycles' and a.attname='paused_at' and not a.attisdropped and format_type(a.atttypid,a.atttypmod)='timestamp with time zone' and a.attnotnull=false)) then raise exception 'Columna incompatible: public.lite_cycles.paused_at'; end if;
 if not (exists(select 1 from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_cycles' and a.attname='starts_at' and not a.attisdropped and format_type(a.atttypid,a.atttypmod)='timestamp with time zone' and a.attnotnull=true)) then raise exception 'Columna incompatible: public.lite_cycles.starts_at'; end if;
 if not (exists(select 1 from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_cycles' and a.attname='status' and not a.attisdropped and format_type(a.atttypid,a.atttypmod)='text' and a.attnotnull=true)) then raise exception 'Columna incompatible: public.lite_cycles.status'; end if;
 if not (exists(select 1 from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_decisions' and a.attname='company_id' and not a.attisdropped and format_type(a.atttypid,a.atttypmod)='uuid' and a.attnotnull=true)) then raise exception 'Columna incompatible: public.lite_decisions.company_id'; end if;
 if not (exists(select 1 from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_decisions' and a.attname='confirmed' and not a.attisdropped and format_type(a.atttypid,a.atttypmod)='boolean' and a.attnotnull=true)) then raise exception 'Columna incompatible: public.lite_decisions.confirmed'; end if;
 if not (exists(select 1 from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_decisions' and a.attname='cycle_id' and not a.attisdropped and format_type(a.atttypid,a.atttypmod)='uuid' and a.attnotnull=true)) then raise exception 'Columna incompatible: public.lite_decisions.cycle_id'; end if;
 if not (exists(select 1 from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_decisions' and a.attname='game_id' and not a.attisdropped and format_type(a.atttypid,a.atttypmod)='uuid' and a.attnotnull=true)) then raise exception 'Columna incompatible: public.lite_decisions.game_id'; end if;
 if not (exists(select 1 from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_decisions' and a.attname='id' and not a.attisdropped and format_type(a.atttypid,a.atttypmod)='uuid' and a.attnotnull=true)) then raise exception 'Columna incompatible: public.lite_decisions.id'; end if;
 if not (exists(select 1 from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_decisions' and a.attname='marketing_amount' and not a.attisdropped and format_type(a.atttypid,a.atttypmod)='integer' and a.attnotnull=true)) then raise exception 'Columna incompatible: public.lite_decisions.marketing_amount'; end if;
 if not (exists(select 1 from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_decisions' and a.attname='price' and not a.attisdropped and format_type(a.atttypid,a.atttypmod)='integer' and a.attnotnull=true)) then raise exception 'Columna incompatible: public.lite_decisions.price'; end if;
 if not (exists(select 1 from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_decisions' and a.attname='quality' and not a.attisdropped and format_type(a.atttypid,a.atttypmod)='text' and a.attnotnull=true)) then raise exception 'Columna incompatible: public.lite_decisions.quality'; end if;
 if not (exists(select 1 from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_decisions' and a.attname='quantity' and not a.attisdropped and format_type(a.atttypid,a.atttypmod)='integer' and a.attnotnull=true)) then raise exception 'Columna incompatible: public.lite_decisions.quantity'; end if;
 if not (exists(select 1 from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_decisions' and a.attname='updated_at' and not a.attisdropped and format_type(a.atttypid,a.atttypmod)='timestamp with time zone' and a.attnotnull=true)) then raise exception 'Columna incompatible: public.lite_decisions.updated_at'; end if;
 if not (exists(select 1 from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_events' and a.attname='category' and not a.attisdropped and format_type(a.atttypid,a.atttypmod)='text' and a.attnotnull=true)) then raise exception 'Columna incompatible: public.lite_events.category'; end if;
 if not (exists(select 1 from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_events' and a.attname='effect' and not a.attisdropped and format_type(a.atttypid,a.atttypmod)='jsonb' and a.attnotnull=true)) then raise exception 'Columna incompatible: public.lite_events.effect'; end if;
 if not (exists(select 1 from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_events' and a.attname='id' and not a.attisdropped and format_type(a.atttypid,a.atttypmod)='text' and a.attnotnull=true)) then raise exception 'Columna incompatible: public.lite_events.id'; end if;
 if not (exists(select 1 from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_events' and a.attname='label' and not a.attisdropped and format_type(a.atttypid,a.atttypmod)='text' and a.attnotnull=true)) then raise exception 'Columna incompatible: public.lite_events.label'; end if;
 if not (exists(select 1 from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_games' and a.attname='capital_max' and not a.attisdropped and format_type(a.atttypid,a.atttypmod)='integer' and a.attnotnull=true)) then raise exception 'Columna incompatible: public.lite_games.capital_max'; end if;
 if not (exists(select 1 from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_games' and a.attname='capital_min' and not a.attisdropped and format_type(a.atttypid,a.atttypmod)='integer' and a.attnotnull=true)) then raise exception 'Columna incompatible: public.lite_games.capital_min'; end if;
 if not (exists(select 1 from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_games' and a.attname='code' and not a.attisdropped and format_type(a.atttypid,a.atttypmod)='text' and a.attnotnull=true)) then raise exception 'Columna incompatible: public.lite_games.code'; end if;
 if not (exists(select 1 from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_games' and a.attname='costs' and not a.attisdropped and format_type(a.atttypid,a.atttypmod)='jsonb' and a.attnotnull=true)) then raise exception 'Columna incompatible: public.lite_games.costs'; end if;
 if not (exists(select 1 from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_games' and a.attname='created_at' and not a.attisdropped and format_type(a.atttypid,a.atttypmod)='timestamp with time zone' and a.attnotnull=true)) then raise exception 'Columna incompatible: public.lite_games.created_at'; end if;
 if not (exists(select 1 from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_games' and a.attname='cycle_count' and not a.attisdropped and format_type(a.atttypid,a.atttypmod)='integer' and a.attnotnull=true)) then raise exception 'Columna incompatible: public.lite_games.cycle_count'; end if;
 if not (exists(select 1 from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_games' and a.attname='duration_seconds' and not a.attisdropped and format_type(a.atttypid,a.atttypmod)='integer' and a.attnotnull=true)) then raise exception 'Columna incompatible: public.lite_games.duration_seconds'; end if;
 if not (exists(select 1 from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_games' and a.attname='enabled_events' and not a.attisdropped and format_type(a.atttypid,a.atttypmod)='jsonb' and a.attnotnull=true)) then raise exception 'Columna incompatible: public.lite_games.enabled_events'; end if;
 if not (exists(select 1 from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_games' and a.attname='id' and not a.attisdropped and format_type(a.atttypid,a.atttypmod)='uuid' and a.attnotnull=true)) then raise exception 'Columna incompatible: public.lite_games.id'; end if;
 if not (exists(select 1 from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_games' and a.attname='name' and not a.attisdropped and format_type(a.atttypid,a.atttypmod)='text' and a.attnotnull=true)) then raise exception 'Columna incompatible: public.lite_games.name'; end if;
 if not (exists(select 1 from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_games' and a.attname='teacher_id' and not a.attisdropped and format_type(a.atttypid,a.atttypmod)='uuid' and a.attnotnull=true)) then raise exception 'Columna incompatible: public.lite_games.teacher_id'; end if;
 if not (exists(select 1 from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_products' and a.attname='game_id' and not a.attisdropped and format_type(a.atttypid,a.atttypmod)='uuid' and a.attnotnull=true)) then raise exception 'Columna incompatible: public.lite_products.game_id'; end if;
 if not (exists(select 1 from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_products' and a.attname='id' and not a.attisdropped and format_type(a.atttypid,a.atttypmod)='uuid' and a.attnotnull=true)) then raise exception 'Columna incompatible: public.lite_products.id'; end if;
 if not (exists(select 1 from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_products' and a.attname='quality' and not a.attisdropped and format_type(a.atttypid,a.atttypmod)='text' and a.attnotnull=true)) then raise exception 'Columna incompatible: public.lite_products.quality'; end if;
 if not (exists(select 1 from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_products' and a.attname='unit_cost' and not a.attisdropped and format_type(a.atttypid,a.atttypmod)='integer' and a.attnotnull=true)) then raise exception 'Columna incompatible: public.lite_products.unit_cost'; end if;
 if not (exists(select 1 from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_profiles' and a.attname='created_at' and not a.attisdropped and format_type(a.atttypid,a.atttypmod)='timestamp with time zone' and a.attnotnull=true)) then raise exception 'Columna incompatible: public.lite_profiles.created_at'; end if;
 if not (exists(select 1 from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_profiles' and a.attname='display_name' and not a.attisdropped and format_type(a.atttypid,a.atttypmod)='text' and a.attnotnull=true)) then raise exception 'Columna incompatible: public.lite_profiles.display_name'; end if;
 if not (exists(select 1 from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_profiles' and a.attname='id' and not a.attisdropped and format_type(a.atttypid,a.atttypmod)='uuid' and a.attnotnull=true)) then raise exception 'Columna incompatible: public.lite_profiles.id'; end if;
 if not (exists(select 1 from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_results' and a.attname='company_id' and not a.attisdropped and format_type(a.atttypid,a.atttypmod)='uuid' and a.attnotnull=true)) then raise exception 'Columna incompatible: public.lite_results.company_id'; end if;
 if not (exists(select 1 from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_results' and a.attname='created_at' and not a.attisdropped and format_type(a.atttypid,a.atttypmod)='timestamp with time zone' and a.attnotnull=true)) then raise exception 'Columna incompatible: public.lite_results.created_at'; end if;
 if not (exists(select 1 from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_results' and a.attname='cycle_id' and not a.attisdropped and format_type(a.atttypid,a.atttypmod)='uuid' and a.attnotnull=true)) then raise exception 'Columna incompatible: public.lite_results.cycle_id'; end if;
 if not (exists(select 1 from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_results' and a.attname='game_id' and not a.attisdropped and format_type(a.atttypid,a.atttypmod)='uuid' and a.attnotnull=true)) then raise exception 'Columna incompatible: public.lite_results.game_id'; end if;
 if not (exists(select 1 from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_results' and a.attname='id' and not a.attisdropped and format_type(a.atttypid,a.atttypmod)='uuid' and a.attnotnull=true)) then raise exception 'Columna incompatible: public.lite_results.id'; end if;
 if not (exists(select 1 from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_results' and a.attname='result' and not a.attisdropped and format_type(a.atttypid,a.atttypmod)='jsonb' and a.attnotnull=true)) then raise exception 'Columna incompatible: public.lite_results.result'; end if;
 if not (exists(select 1 from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_sessions' and a.attname='expires_at' and not a.attisdropped and format_type(a.atttypid,a.atttypmod)='timestamp with time zone' and a.attnotnull=true)) then raise exception 'Columna incompatible: public.lite_sessions.expires_at'; end if;
 if not (exists(select 1 from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_sessions' and a.attname='id_hash' and not a.attisdropped and format_type(a.atttypid,a.atttypmod)='text' and a.attnotnull=true)) then raise exception 'Columna incompatible: public.lite_sessions.id_hash'; end if;
 if not (exists(select 1 from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_sessions' and a.attname='user_id' and not a.attisdropped and format_type(a.atttypid,a.atttypmod)='uuid' and a.attnotnull=true)) then raise exception 'Columna incompatible: public.lite_sessions.user_id'; end if;
 if not (exists(select 1 from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_stores' and a.attname='description' and not a.attisdropped and format_type(a.atttypid,a.atttypmod)='text' and a.attnotnull=true)) then raise exception 'Columna incompatible: public.lite_stores.description'; end if;
 if not (exists(select 1 from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_stores' and a.attname='id' and not a.attisdropped and format_type(a.atttypid,a.atttypmod)='uuid' and a.attnotnull=true)) then raise exception 'Columna incompatible: public.lite_stores.id'; end if;
 if not (exists(select 1 from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_stores' and a.attname='name' and not a.attisdropped and format_type(a.atttypid,a.atttypmod)='text' and a.attnotnull=true)) then raise exception 'Columna incompatible: public.lite_stores.name'; end if;
 if not (exists(select 1 from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_teacher_grades' and a.attname='company_id' and not a.attisdropped and format_type(a.atttypid,a.atttypmod)='uuid' and a.attnotnull=true)) then raise exception 'Columna incompatible: public.lite_teacher_grades.company_id'; end if;
 if not (exists(select 1 from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_teacher_grades' and a.attname='game_id' and not a.attisdropped and format_type(a.atttypid,a.atttypmod)='uuid' and a.attnotnull=true)) then raise exception 'Columna incompatible: public.lite_teacher_grades.game_id'; end if;
 if not (exists(select 1 from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_teacher_grades' and a.attname='grade' and not a.attisdropped and format_type(a.atttypid,a.atttypmod)='numeric(4,2)' and a.attnotnull=true)) then raise exception 'Columna incompatible: public.lite_teacher_grades.grade'; end if;
 if not (exists(select 1 from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_teacher_grades' and a.attname='updated_at' and not a.attisdropped and format_type(a.atttypid,a.atttypmod)='timestamp with time zone' and a.attnotnull=true)) then raise exception 'Columna incompatible: public.lite_teacher_grades.updated_at'; end if;
 if not (exists(select 1 from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_teacher_podium' and a.attname='created_at' and not a.attisdropped and format_type(a.atttypid,a.atttypmod)='timestamp with time zone' and a.attnotnull=true)) then raise exception 'Columna incompatible: public.lite_teacher_podium.created_at'; end if;
 if not (exists(select 1 from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_teacher_podium' and a.attname='game_id' and not a.attisdropped and format_type(a.atttypid,a.atttypmod)='uuid' and a.attnotnull=true)) then raise exception 'Columna incompatible: public.lite_teacher_podium.game_id'; end if;
 if not (exists(select 1 from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_teacher_podium' and a.attname='published_snapshot' and not a.attisdropped and format_type(a.atttypid,a.atttypmod)='jsonb' and a.attnotnull=true)) then raise exception 'Columna incompatible: public.lite_teacher_podium.published_snapshot'; end if;
 if not (exists(select 1 from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_teacher_podium' and a.attname='reason' and not a.attisdropped and format_type(a.atttypid,a.atttypmod)='text' and a.attnotnull=true)) then raise exception 'Columna incompatible: public.lite_teacher_podium.reason'; end if;
 if not (exists(select 1 from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_teacher_podium' and a.attname='scheduled_at' and not a.attisdropped and format_type(a.atttypid,a.atttypmod)='timestamp with time zone' and a.attnotnull=true)) then raise exception 'Columna incompatible: public.lite_teacher_podium.scheduled_at'; end if;
 if not (exists(select 1 from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='side_lite_private' and c.relname='lite_cycle_secrets' and a.attname='cycle_id' and not a.attisdropped and format_type(a.atttypid,a.atttypmod)='uuid' and a.attnotnull=true)) then raise exception 'Columna incompatible: side_lite_private.lite_cycle_secrets.cycle_id'; end if;
 if not (exists(select 1 from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='side_lite_private' and c.relname='lite_cycle_secrets' and a.attname='seed' and not a.attisdropped and format_type(a.atttypid,a.atttypmod)='uuid' and a.attnotnull=true)) then raise exception 'Columna incompatible: side_lite_private.lite_cycle_secrets.seed'; end if;
 if not (exists(select 1 from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='side_lite_private' and c.relname='lite_teacher_grants' and a.attname='approved_email' and not a.attisdropped and format_type(a.atttypid,a.atttypmod)='text' and a.attnotnull=true)) then raise exception 'Columna incompatible: side_lite_private.lite_teacher_grants.approved_email'; end if;
 if not (exists(select 1 from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='side_lite_private' and c.relname='lite_teacher_grants' and a.attname='granted_at' and not a.attisdropped and format_type(a.atttypid,a.atttypmod)='timestamp with time zone' and a.attnotnull=true)) then raise exception 'Columna incompatible: side_lite_private.lite_teacher_grants.granted_at'; end if;
 if not (exists(select 1 from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='side_lite_private' and c.relname='lite_teacher_grants' and a.attname='granted_by' and not a.attisdropped and format_type(a.atttypid,a.atttypmod)='uuid' and a.attnotnull=false)) then raise exception 'Columna incompatible: side_lite_private.lite_teacher_grants.granted_by'; end if;
 if not (exists(select 1 from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='side_lite_private' and c.relname='lite_teacher_grants' and a.attname='lock_guard' and not a.attisdropped and format_type(a.atttypid,a.atttypmod)='boolean' and a.attnotnull=true)) then raise exception 'Columna incompatible: side_lite_private.lite_teacher_grants.lock_guard'; end if;
 if not (exists(select 1 from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='side_lite_private' and c.relname='lite_teacher_grants' and a.attname='revoked_at' and not a.attisdropped and format_type(a.atttypid,a.atttypmod)='timestamp with time zone' and a.attnotnull=false)) then raise exception 'Columna incompatible: side_lite_private.lite_teacher_grants.revoked_at'; end if;
 if not (exists(select 1 from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='side_lite_private' and c.relname='lite_teacher_grants' and a.attname='user_id' and not a.attisdropped and format_type(a.atttypid,a.atttypmod)='uuid' and a.attnotnull=true)) then raise exception 'Columna incompatible: side_lite_private.lite_teacher_grants.user_id'; end if;
 if not (exists(select 1 from pg_constraint x join pg_class c on c.oid=x.conrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_auth_limits' and x.conname='lite_auth_limits_attempts_check' and pg_get_constraintdef(x.oid)='CHECK ((attempts > 0))')) then raise exception 'Restricción incompatible: lite_auth_limits.lite_auth_limits_attempts_check'; end if;
 if not (exists(select 1 from pg_constraint x join pg_class c on c.oid=x.conrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_auth_limits' and x.conname='lite_auth_limits_key_hash_check' and pg_get_constraintdef(x.oid)='CHECK ((length(key_hash) = 64))')) then raise exception 'Restricción incompatible: lite_auth_limits.lite_auth_limits_key_hash_check'; end if;
 if not (exists(select 1 from pg_constraint x join pg_class c on c.oid=x.conrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_auth_limits' and x.conname='lite_auth_limits_pkey' and pg_get_constraintdef(x.oid)='PRIMARY KEY (key_hash)')) then raise exception 'Restricción incompatible: lite_auth_limits.lite_auth_limits_pkey'; end if;
 if not (exists(select 1 from pg_constraint x join pg_class c on c.oid=x.conrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_companies' and x.conname='lite_companies_cash_check' and pg_get_constraintdef(x.oid)='CHECK ((cash >= 0))')) then raise exception 'Restricción incompatible: lite_companies.lite_companies_cash_check'; end if;
 if not (exists(select 1 from pg_constraint x join pg_class c on c.oid=x.conrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_companies' and x.conname='lite_companies_game_id_fkey' and pg_get_constraintdef(x.oid)='FOREIGN KEY (game_id) REFERENCES lite_games(id) ON DELETE CASCADE')) then raise exception 'Restricción incompatible: lite_companies.lite_companies_game_id_fkey'; end if;
 if not (exists(select 1 from pg_constraint x join pg_class c on c.oid=x.conrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_companies' and x.conname='lite_companies_game_id_id_key' and pg_get_constraintdef(x.oid)='UNIQUE (game_id, id)')) then raise exception 'Restricción incompatible: lite_companies.lite_companies_game_id_id_key'; end if;
 if not (exists(select 1 from pg_constraint x join pg_class c on c.oid=x.conrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_companies' and x.conname='lite_companies_game_id_student_id_key' and pg_get_constraintdef(x.oid)='UNIQUE (game_id, student_id)')) then raise exception 'Restricción incompatible: lite_companies.lite_companies_game_id_student_id_key'; end if;
 if not (exists(select 1 from pg_constraint x join pg_class c on c.oid=x.conrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_companies' and x.conname='lite_companies_initial_capital_check' and pg_get_constraintdef(x.oid)='CHECK ((((initial_capital >= 10000) AND (initial_capital <= 1000000)) AND ((initial_capital % 10000) = 0)))')) then raise exception 'Restricción incompatible: lite_companies.lite_companies_initial_capital_check'; end if;
 if not (exists(select 1 from pg_constraint x join pg_class c on c.oid=x.conrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_companies' and x.conname='lite_companies_inventory_check' and pg_get_constraintdef(x.oid)='CHECK ((jsonb_typeof(inventory) = ''array''::text))')) then raise exception 'Restricción incompatible: lite_companies.lite_companies_inventory_check'; end if;
 if not (exists(select 1 from pg_constraint x join pg_class c on c.oid=x.conrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_companies' and x.conname='lite_companies_name_check' and pg_get_constraintdef(x.oid)='CHECK (((char_length(btrim(name)) >= 1) AND (char_length(btrim(name)) <= 80)))')) then raise exception 'Restricción incompatible: lite_companies.lite_companies_name_check'; end if;
 if not (exists(select 1 from pg_constraint x join pg_class c on c.oid=x.conrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_companies' and x.conname='lite_companies_pkey' and pg_get_constraintdef(x.oid)='PRIMARY KEY (id)')) then raise exception 'Restricción incompatible: lite_companies.lite_companies_pkey'; end if;
 if not (exists(select 1 from pg_constraint x join pg_class c on c.oid=x.conrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_companies' and x.conname='lite_companies_store_id_fkey' and pg_get_constraintdef(x.oid)='FOREIGN KEY (store_id) REFERENCES lite_stores(id)')) then raise exception 'Restricción incompatible: lite_companies.lite_companies_store_id_fkey'; end if;
 if not (exists(select 1 from pg_constraint x join pg_class c on c.oid=x.conrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_companies' and x.conname='lite_companies_student_id_fkey' and pg_get_constraintdef(x.oid)='FOREIGN KEY (student_id) REFERENCES lite_profiles(id)')) then raise exception 'Restricción incompatible: lite_companies.lite_companies_student_id_fkey'; end if;
 if not (exists(select 1 from pg_constraint x join pg_class c on c.oid=x.conrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_cycles' and x.conname='lite_cycles_check' and pg_get_constraintdef(x.oid)='CHECK ((ends_at > starts_at))')) then raise exception 'Restricción incompatible: lite_cycles.lite_cycles_check'; end if;
 if not (exists(select 1 from pg_constraint x join pg_class c on c.oid=x.conrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_cycles' and x.conname='lite_cycles_check1' and pg_get_constraintdef(x.oid)='CHECK (((status <> ''closed''::text) OR (paused_at IS NULL)))')) then raise exception 'Restricción incompatible: lite_cycles.lite_cycles_check1'; end if;
 if not (exists(select 1 from pg_constraint x join pg_class c on c.oid=x.conrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_cycles' and x.conname='lite_cycles_event_id_fkey' and pg_get_constraintdef(x.oid)='FOREIGN KEY (event_id) REFERENCES lite_events(id)')) then raise exception 'Restricción incompatible: lite_cycles.lite_cycles_event_id_fkey'; end if;
 if not (exists(select 1 from pg_constraint x join pg_class c on c.oid=x.conrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_cycles' and x.conname='lite_cycles_game_id_fkey' and pg_get_constraintdef(x.oid)='FOREIGN KEY (game_id) REFERENCES lite_games(id) ON DELETE CASCADE')) then raise exception 'Restricción incompatible: lite_cycles.lite_cycles_game_id_fkey'; end if;
 if not (exists(select 1 from pg_constraint x join pg_class c on c.oid=x.conrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_cycles' and x.conname='lite_cycles_game_id_id_key' and pg_get_constraintdef(x.oid)='UNIQUE (game_id, id)')) then raise exception 'Restricción incompatible: lite_cycles.lite_cycles_game_id_id_key'; end if;
 if not (exists(select 1 from pg_constraint x join pg_class c on c.oid=x.conrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_cycles' and x.conname='lite_cycles_game_id_number_key' and pg_get_constraintdef(x.oid)='UNIQUE (game_id, number)')) then raise exception 'Restricción incompatible: lite_cycles.lite_cycles_game_id_number_key'; end if;
 if not (exists(select 1 from pg_constraint x join pg_class c on c.oid=x.conrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_cycles' and x.conname='lite_cycles_number_check' and pg_get_constraintdef(x.oid)='CHECK (((number >= 1) AND (number <= 6)))')) then raise exception 'Restricción incompatible: lite_cycles.lite_cycles_number_check'; end if;
 if not (exists(select 1 from pg_constraint x join pg_class c on c.oid=x.conrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_cycles' and x.conname='lite_cycles_pkey' and pg_get_constraintdef(x.oid)='PRIMARY KEY (id)')) then raise exception 'Restricción incompatible: lite_cycles.lite_cycles_pkey'; end if;
 if not (exists(select 1 from pg_constraint x join pg_class c on c.oid=x.conrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_cycles' and x.conname='lite_cycles_status_check' and pg_get_constraintdef(x.oid)='CHECK ((status = ANY (ARRAY[''open''::text, ''closed''::text])))')) then raise exception 'Restricción incompatible: lite_cycles.lite_cycles_status_check'; end if;
 if not (exists(select 1 from pg_constraint x join pg_class c on c.oid=x.conrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_decisions' and x.conname='lite_decisions_cycle_id_company_id_key' and pg_get_constraintdef(x.oid)='UNIQUE (cycle_id, company_id)')) then raise exception 'Restricción incompatible: lite_decisions.lite_decisions_cycle_id_company_id_key'; end if;
 if not (exists(select 1 from pg_constraint x join pg_class c on c.oid=x.conrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_decisions' and x.conname='lite_decisions_game_id_company_id_fkey' and pg_get_constraintdef(x.oid)='FOREIGN KEY (game_id, company_id) REFERENCES lite_companies(game_id, id) ON DELETE CASCADE')) then raise exception 'Restricción incompatible: lite_decisions.lite_decisions_game_id_company_id_fkey'; end if;
 if not (exists(select 1 from pg_constraint x join pg_class c on c.oid=x.conrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_decisions' and x.conname='lite_decisions_game_id_cycle_id_fkey' and pg_get_constraintdef(x.oid)='FOREIGN KEY (game_id, cycle_id) REFERENCES lite_cycles(game_id, id) ON DELETE CASCADE')) then raise exception 'Restricción incompatible: lite_decisions.lite_decisions_game_id_cycle_id_fkey'; end if;
 if not (exists(select 1 from pg_constraint x join pg_class c on c.oid=x.conrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_decisions' and x.conname='lite_decisions_marketing_amount_check' and pg_get_constraintdef(x.oid)='CHECK (((marketing_amount = 0) OR ((marketing_amount >= 200) AND (marketing_amount <= 10000))))')) then raise exception 'Restricción incompatible: lite_decisions.lite_decisions_marketing_amount_check'; end if;
 if not (exists(select 1 from pg_constraint x join pg_class c on c.oid=x.conrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_decisions' and x.conname='lite_decisions_pkey' and pg_get_constraintdef(x.oid)='PRIMARY KEY (id)')) then raise exception 'Restricción incompatible: lite_decisions.lite_decisions_pkey'; end if;
 if not (exists(select 1 from pg_constraint x join pg_class c on c.oid=x.conrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_decisions' and x.conname='lite_decisions_price_check' and pg_get_constraintdef(x.oid)='CHECK (((price >= 1) AND (price <= 100000)))')) then raise exception 'Restricción incompatible: lite_decisions.lite_decisions_price_check'; end if;
 if not (exists(select 1 from pg_constraint x join pg_class c on c.oid=x.conrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_decisions' and x.conname='lite_decisions_quality_check' and pg_get_constraintdef(x.oid)='CHECK ((quality = ANY (ARRAY[''basic''::text, ''standard''::text, ''premium''::text])))')) then raise exception 'Restricción incompatible: lite_decisions.lite_decisions_quality_check'; end if;
 if not (exists(select 1 from pg_constraint x join pg_class c on c.oid=x.conrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_decisions' and x.conname='lite_decisions_quantity_check' and pg_get_constraintdef(x.oid)='CHECK (((quantity >= 0) AND (quantity <= 100000)))')) then raise exception 'Restricción incompatible: lite_decisions.lite_decisions_quantity_check'; end if;
 if not (exists(select 1 from pg_constraint x join pg_class c on c.oid=x.conrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_events' and x.conname='lite_events_pkey' and pg_get_constraintdef(x.oid)='PRIMARY KEY (id)')) then raise exception 'Restricción incompatible: lite_events.lite_events_pkey'; end if;
 if not (exists(select 1 from pg_constraint x join pg_class c on c.oid=x.conrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_games' and x.conname='lite_games_capital_min_check' and pg_get_constraintdef(x.oid)='CHECK ((((capital_min >= 10000) AND (capital_min <= 1000000)) AND ((capital_min % 10000) = 0)))')) then raise exception 'Restricción incompatible: lite_games.lite_games_capital_min_check'; end if;
 if not (exists(select 1 from pg_constraint x join pg_class c on c.oid=x.conrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_games' and x.conname='lite_games_check' and pg_get_constraintdef(x.oid)='CHECK ((((capital_max >= capital_min) AND (capital_max <= 1000000)) AND ((capital_max % 10000) = 0)))')) then raise exception 'Restricción incompatible: lite_games.lite_games_check'; end if;
 if not (exists(select 1 from pg_constraint x join pg_class c on c.oid=x.conrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_games' and x.conname='lite_games_code_check' and pg_get_constraintdef(x.oid)='CHECK ((code ~ ''^[A-F0-9]{8}$''::text))')) then raise exception 'Restricción incompatible: lite_games.lite_games_code_check'; end if;
 if not (exists(select 1 from pg_constraint x join pg_class c on c.oid=x.conrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_games' and x.conname='lite_games_code_key' and pg_get_constraintdef(x.oid)='UNIQUE (code)')) then raise exception 'Restricción incompatible: lite_games.lite_games_code_key'; end if;
 if not (exists(select 1 from pg_constraint x join pg_class c on c.oid=x.conrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_games' and x.conname='lite_games_costs_check' and pg_get_constraintdef(x.oid)='CHECK ((jsonb_typeof(costs) = ''object''::text))')) then raise exception 'Restricción incompatible: lite_games.lite_games_costs_check'; end if;
 if not (exists(select 1 from pg_constraint x join pg_class c on c.oid=x.conrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_games' and x.conname='lite_games_cycle_count_check' and pg_get_constraintdef(x.oid)='CHECK ((cycle_count = ANY (ARRAY[3, 6])))')) then raise exception 'Restricción incompatible: lite_games.lite_games_cycle_count_check'; end if;
 if not (exists(select 1 from pg_constraint x join pg_class c on c.oid=x.conrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_games' and x.conname='lite_games_duration_seconds_check' and pg_get_constraintdef(x.oid)='CHECK ((duration_seconds = 120))')) then raise exception 'Restricción incompatible: lite_games.lite_games_duration_seconds_check'; end if;
 if not (exists(select 1 from pg_constraint x join pg_class c on c.oid=x.conrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_games' and x.conname='lite_games_enabled_events_check' and pg_get_constraintdef(x.oid)='CHECK ((jsonb_typeof(enabled_events) = ''array''::text))')) then raise exception 'Restricción incompatible: lite_games.lite_games_enabled_events_check'; end if;
 if not (exists(select 1 from pg_constraint x join pg_class c on c.oid=x.conrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_games' and x.conname='lite_games_name_check' and pg_get_constraintdef(x.oid)='CHECK (((char_length(btrim(name)) >= 2) AND (char_length(btrim(name)) <= 80)))')) then raise exception 'Restricción incompatible: lite_games.lite_games_name_check'; end if;
 if not (exists(select 1 from pg_constraint x join pg_class c on c.oid=x.conrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_games' and x.conname='lite_games_pkey' and pg_get_constraintdef(x.oid)='PRIMARY KEY (id)')) then raise exception 'Restricción incompatible: lite_games.lite_games_pkey'; end if;
 if not (exists(select 1 from pg_constraint x join pg_class c on c.oid=x.conrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_games' and x.conname='lite_games_teacher_id_fkey' and pg_get_constraintdef(x.oid)='FOREIGN KEY (teacher_id) REFERENCES lite_profiles(id)')) then raise exception 'Restricción incompatible: lite_games.lite_games_teacher_id_fkey'; end if;
 if not (exists(select 1 from pg_constraint x join pg_class c on c.oid=x.conrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_products' and x.conname='lite_products_game_id_fkey' and pg_get_constraintdef(x.oid)='FOREIGN KEY (game_id) REFERENCES lite_games(id) ON DELETE CASCADE')) then raise exception 'Restricción incompatible: lite_products.lite_products_game_id_fkey'; end if;
 if not (exists(select 1 from pg_constraint x join pg_class c on c.oid=x.conrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_products' and x.conname='lite_products_game_id_quality_key' and pg_get_constraintdef(x.oid)='UNIQUE (game_id, quality)')) then raise exception 'Restricción incompatible: lite_products.lite_products_game_id_quality_key'; end if;
 if not (exists(select 1 from pg_constraint x join pg_class c on c.oid=x.conrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_products' and x.conname='lite_products_pkey' and pg_get_constraintdef(x.oid)='PRIMARY KEY (id)')) then raise exception 'Restricción incompatible: lite_products.lite_products_pkey'; end if;
 if not (exists(select 1 from pg_constraint x join pg_class c on c.oid=x.conrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_products' and x.conname='lite_products_quality_check' and pg_get_constraintdef(x.oid)='CHECK ((quality = ANY (ARRAY[''basic''::text, ''standard''::text, ''premium''::text])))')) then raise exception 'Restricción incompatible: lite_products.lite_products_quality_check'; end if;
 if not (exists(select 1 from pg_constraint x join pg_class c on c.oid=x.conrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_products' and x.conname='lite_products_unit_cost_check' and pg_get_constraintdef(x.oid)='CHECK ((unit_cost > 0))')) then raise exception 'Restricción incompatible: lite_products.lite_products_unit_cost_check'; end if;
 if not (exists(select 1 from pg_constraint x join pg_class c on c.oid=x.conrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_profiles' and x.conname='lite_profiles_display_name_check' and pg_get_constraintdef(x.oid)='CHECK (((char_length(btrim(display_name)) >= 2) AND (char_length(btrim(display_name)) <= 80)))')) then raise exception 'Restricción incompatible: lite_profiles.lite_profiles_display_name_check'; end if;
 if not (exists(select 1 from pg_constraint x join pg_class c on c.oid=x.conrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_profiles' and x.conname='lite_profiles_id_fkey' and pg_get_constraintdef(x.oid)='FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE')) then raise exception 'Restricción incompatible: lite_profiles.lite_profiles_id_fkey'; end if;
 if not (exists(select 1 from pg_constraint x join pg_class c on c.oid=x.conrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_profiles' and x.conname='lite_profiles_pkey' and pg_get_constraintdef(x.oid)='PRIMARY KEY (id)')) then raise exception 'Restricción incompatible: lite_profiles.lite_profiles_pkey'; end if;
 if not (exists(select 1 from pg_constraint x join pg_class c on c.oid=x.conrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_results' and x.conname='lite_results_cycle_id_company_id_key' and pg_get_constraintdef(x.oid)='UNIQUE (cycle_id, company_id)')) then raise exception 'Restricción incompatible: lite_results.lite_results_cycle_id_company_id_key'; end if;
 if not (exists(select 1 from pg_constraint x join pg_class c on c.oid=x.conrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_results' and x.conname='lite_results_game_id_company_id_fkey' and pg_get_constraintdef(x.oid)='FOREIGN KEY (game_id, company_id) REFERENCES lite_companies(game_id, id)')) then raise exception 'Restricción incompatible: lite_results.lite_results_game_id_company_id_fkey'; end if;
 if not (exists(select 1 from pg_constraint x join pg_class c on c.oid=x.conrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_results' and x.conname='lite_results_game_id_cycle_id_fkey' and pg_get_constraintdef(x.oid)='FOREIGN KEY (game_id, cycle_id) REFERENCES lite_cycles(game_id, id)')) then raise exception 'Restricción incompatible: lite_results.lite_results_game_id_cycle_id_fkey'; end if;
 if not (exists(select 1 from pg_constraint x join pg_class c on c.oid=x.conrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_results' and x.conname='lite_results_pkey' and pg_get_constraintdef(x.oid)='PRIMARY KEY (id)')) then raise exception 'Restricción incompatible: lite_results.lite_results_pkey'; end if;
 if not (exists(select 1 from pg_constraint x join pg_class c on c.oid=x.conrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_results' and x.conname='lite_results_result_check' and pg_get_constraintdef(x.oid)='CHECK ((jsonb_typeof(result) = ''object''::text))')) then raise exception 'Restricción incompatible: lite_results.lite_results_result_check'; end if;
 if not (exists(select 1 from pg_constraint x join pg_class c on c.oid=x.conrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_sessions' and x.conname='lite_sessions_pkey' and pg_get_constraintdef(x.oid)='PRIMARY KEY (id_hash)')) then raise exception 'Restricción incompatible: lite_sessions.lite_sessions_pkey'; end if;
 if not (exists(select 1 from pg_constraint x join pg_class c on c.oid=x.conrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_sessions' and x.conname='lite_sessions_user_id_fkey' and pg_get_constraintdef(x.oid)='FOREIGN KEY (user_id) REFERENCES lite_profiles(id) ON DELETE CASCADE')) then raise exception 'Restricción incompatible: lite_sessions.lite_sessions_user_id_fkey'; end if;
 if not (exists(select 1 from pg_constraint x join pg_class c on c.oid=x.conrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_stores' and x.conname='lite_stores_name_key' and pg_get_constraintdef(x.oid)='UNIQUE (name)')) then raise exception 'Restricción incompatible: lite_stores.lite_stores_name_key'; end if;
 if not (exists(select 1 from pg_constraint x join pg_class c on c.oid=x.conrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_stores' and x.conname='lite_stores_pkey' and pg_get_constraintdef(x.oid)='PRIMARY KEY (id)')) then raise exception 'Restricción incompatible: lite_stores.lite_stores_pkey'; end if;
 if not (exists(select 1 from pg_constraint x join pg_class c on c.oid=x.conrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_teacher_grades' and x.conname='lite_teacher_grades_company_id_fkey' and pg_get_constraintdef(x.oid)='FOREIGN KEY (company_id) REFERENCES lite_companies(id) ON DELETE CASCADE')) then raise exception 'Restricción incompatible: lite_teacher_grades.lite_teacher_grades_company_id_fkey'; end if;
 if not (exists(select 1 from pg_constraint x join pg_class c on c.oid=x.conrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_teacher_grades' and x.conname='lite_teacher_grades_game_id_fkey' and pg_get_constraintdef(x.oid)='FOREIGN KEY (game_id) REFERENCES lite_games(id) ON DELETE CASCADE')) then raise exception 'Restricción incompatible: lite_teacher_grades.lite_teacher_grades_game_id_fkey'; end if;
 if not (exists(select 1 from pg_constraint x join pg_class c on c.oid=x.conrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_teacher_grades' and x.conname='lite_teacher_grades_grade_check' and pg_get_constraintdef(x.oid)='CHECK (((grade >= (0)::numeric) AND (grade <= (20)::numeric)))')) then raise exception 'Restricción incompatible: lite_teacher_grades.lite_teacher_grades_grade_check'; end if;
 if not (exists(select 1 from pg_constraint x join pg_class c on c.oid=x.conrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_teacher_grades' and x.conname='lite_teacher_grades_pkey' and pg_get_constraintdef(x.oid)='PRIMARY KEY (game_id, company_id)')) then raise exception 'Restricción incompatible: lite_teacher_grades.lite_teacher_grades_pkey'; end if;
 if not (exists(select 1 from pg_constraint x join pg_class c on c.oid=x.conrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_teacher_podium' and x.conname='lite_teacher_podium_game_id_fkey' and pg_get_constraintdef(x.oid)='FOREIGN KEY (game_id) REFERENCES lite_games(id) ON DELETE CASCADE')) then raise exception 'Restricción incompatible: lite_teacher_podium.lite_teacher_podium_game_id_fkey'; end if;
 if not (exists(select 1 from pg_constraint x join pg_class c on c.oid=x.conrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_teacher_podium' and x.conname='lite_teacher_podium_pkey' and pg_get_constraintdef(x.oid)='PRIMARY KEY (game_id)')) then raise exception 'Restricción incompatible: lite_teacher_podium.lite_teacher_podium_pkey'; end if;
 if not (exists(select 1 from pg_constraint x join pg_class c on c.oid=x.conrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_teacher_podium' and x.conname='lite_teacher_podium_reason_check' and pg_get_constraintdef(x.oid)='CHECK ((length(reason) <= 1000))')) then raise exception 'Restricción incompatible: lite_teacher_podium.lite_teacher_podium_reason_check'; end if;
 if not (exists(select 1 from pg_constraint x join pg_class c on c.oid=x.conrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='side_lite_private' and c.relname='lite_cycle_secrets' and x.conname='lite_cycle_secrets_cycle_id_fkey' and pg_get_constraintdef(x.oid)='FOREIGN KEY (cycle_id) REFERENCES lite_cycles(id) ON DELETE CASCADE')) then raise exception 'Restricción incompatible: lite_cycle_secrets.lite_cycle_secrets_cycle_id_fkey'; end if;
 if not (exists(select 1 from pg_constraint x join pg_class c on c.oid=x.conrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='side_lite_private' and c.relname='lite_cycle_secrets' and x.conname='lite_cycle_secrets_pkey' and pg_get_constraintdef(x.oid)='PRIMARY KEY (cycle_id)')) then raise exception 'Restricción incompatible: lite_cycle_secrets.lite_cycle_secrets_pkey'; end if;
 if not (exists(select 1 from pg_constraint x join pg_class c on c.oid=x.conrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='side_lite_private' and c.relname='lite_teacher_grants' and x.conname='lite_teacher_grants_approved_email_check' and pg_get_constraintdef(x.oid)='CHECK (((approved_email = lower(btrim(approved_email))) AND (approved_email ~ ''^[^@[:space:]]+@upch[.]pe$''::text)))')) then raise exception 'Restricción incompatible: lite_teacher_grants.lite_teacher_grants_approved_email_check'; end if;
 if not (exists(select 1 from pg_constraint x join pg_class c on c.oid=x.conrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='side_lite_private' and c.relname='lite_teacher_grants' and x.conname='lite_teacher_grants_granted_by_fkey' and pg_get_constraintdef(x.oid)='FOREIGN KEY (granted_by) REFERENCES auth.users(id) ON DELETE SET NULL')) then raise exception 'Restricción incompatible: lite_teacher_grants.lite_teacher_grants_granted_by_fkey'; end if;
 if not (exists(select 1 from pg_constraint x join pg_class c on c.oid=x.conrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='side_lite_private' and c.relname='lite_teacher_grants' and x.conname='lite_teacher_grants_lock_guard_check' and pg_get_constraintdef(x.oid)='CHECK (lock_guard)')) then raise exception 'Restricción incompatible: lite_teacher_grants.lite_teacher_grants_lock_guard_check'; end if;
 if not (exists(select 1 from pg_constraint x join pg_class c on c.oid=x.conrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='side_lite_private' and c.relname='lite_teacher_grants' and x.conname='lite_teacher_grants_pkey' and pg_get_constraintdef(x.oid)='PRIMARY KEY (user_id)')) then raise exception 'Restricción incompatible: lite_teacher_grants.lite_teacher_grants_pkey'; end if;
 if not (exists(select 1 from pg_constraint x join pg_class c on c.oid=x.conrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='side_lite_private' and c.relname='lite_teacher_grants' and x.conname='lite_teacher_grants_user_id_fkey' and pg_get_constraintdef(x.oid)='FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE')) then raise exception 'Restricción incompatible: lite_teacher_grants.lite_teacher_grants_user_id_fkey'; end if;
 if not (exists(select 1 from pg_index x join pg_class c on c.oid=x.indrelid join pg_namespace n on n.oid=c.relnamespace join pg_class i on i.oid=x.indexrelid where n.nspname='public' and c.relname='lite_auth_limits' and i.relname='lite_auth_limits_expiry_idx' and pg_get_indexdef(i.oid)='CREATE INDEX lite_auth_limits_expiry_idx ON public.lite_auth_limits USING btree (expires_at)')) then raise exception 'Índice incompatible: lite_auth_limits_expiry_idx'; end if;
 if not (exists(select 1 from pg_index x join pg_class c on c.oid=x.indrelid join pg_namespace n on n.oid=c.relnamespace join pg_class i on i.oid=x.indexrelid where n.nspname='public' and c.relname='lite_auth_limits' and i.relname='lite_auth_limits_pkey' and pg_get_indexdef(i.oid)='CREATE UNIQUE INDEX lite_auth_limits_pkey ON public.lite_auth_limits USING btree (key_hash)')) then raise exception 'Índice incompatible: lite_auth_limits_pkey'; end if;
 if not (exists(select 1 from pg_index x join pg_class c on c.oid=x.indrelid join pg_namespace n on n.oid=c.relnamespace join pg_class i on i.oid=x.indexrelid where n.nspname='public' and c.relname='lite_companies' and i.relname='lite_companies_game_id_id_key' and pg_get_indexdef(i.oid)='CREATE UNIQUE INDEX lite_companies_game_id_id_key ON public.lite_companies USING btree (game_id, id)')) then raise exception 'Índice incompatible: lite_companies_game_id_id_key'; end if;
 if not (exists(select 1 from pg_index x join pg_class c on c.oid=x.indrelid join pg_namespace n on n.oid=c.relnamespace join pg_class i on i.oid=x.indexrelid where n.nspname='public' and c.relname='lite_companies' and i.relname='lite_companies_game_id_student_id_key' and pg_get_indexdef(i.oid)='CREATE UNIQUE INDEX lite_companies_game_id_student_id_key ON public.lite_companies USING btree (game_id, student_id)')) then raise exception 'Índice incompatible: lite_companies_game_id_student_id_key'; end if;
 if not (exists(select 1 from pg_index x join pg_class c on c.oid=x.indrelid join pg_namespace n on n.oid=c.relnamespace join pg_class i on i.oid=x.indexrelid where n.nspname='public' and c.relname='lite_companies' and i.relname='lite_companies_pkey' and pg_get_indexdef(i.oid)='CREATE UNIQUE INDEX lite_companies_pkey ON public.lite_companies USING btree (id)')) then raise exception 'Índice incompatible: lite_companies_pkey'; end if;
 if not (exists(select 1 from pg_index x join pg_class c on c.oid=x.indrelid join pg_namespace n on n.oid=c.relnamespace join pg_class i on i.oid=x.indexrelid where n.nspname='public' and c.relname='lite_companies' and i.relname='lite_companies_student_game' and pg_get_indexdef(i.oid)='CREATE INDEX lite_companies_student_game ON public.lite_companies USING btree (student_id, game_id)')) then raise exception 'Índice incompatible: lite_companies_student_game'; end if;
 if not (exists(select 1 from pg_index x join pg_class c on c.oid=x.indrelid join pg_namespace n on n.oid=c.relnamespace join pg_class i on i.oid=x.indexrelid where n.nspname='public' and c.relname='lite_companies' and i.relname='lite_company_game_idx' and pg_get_indexdef(i.oid)='CREATE INDEX lite_company_game_idx ON public.lite_companies USING btree (game_id)')) then raise exception 'Índice incompatible: lite_company_game_idx'; end if;
 if not (exists(select 1 from pg_index x join pg_class c on c.oid=x.indrelid join pg_namespace n on n.oid=c.relnamespace join pg_class i on i.oid=x.indexrelid where n.nspname='public' and c.relname='lite_cycles' and i.relname='lite_cycles_due_idx' and pg_get_indexdef(i.oid)='CREATE INDEX lite_cycles_due_idx ON public.lite_cycles USING btree (ends_at) WHERE (status = ''open''::text)')) then raise exception 'Índice incompatible: lite_cycles_due_idx'; end if;
 if not (exists(select 1 from pg_index x join pg_class c on c.oid=x.indrelid join pg_namespace n on n.oid=c.relnamespace join pg_class i on i.oid=x.indexrelid where n.nspname='public' and c.relname='lite_cycles' and i.relname='lite_cycles_game_id_id_key' and pg_get_indexdef(i.oid)='CREATE UNIQUE INDEX lite_cycles_game_id_id_key ON public.lite_cycles USING btree (game_id, id)')) then raise exception 'Índice incompatible: lite_cycles_game_id_id_key'; end if;
 if not (exists(select 1 from pg_index x join pg_class c on c.oid=x.indrelid join pg_namespace n on n.oid=c.relnamespace join pg_class i on i.oid=x.indexrelid where n.nspname='public' and c.relname='lite_cycles' and i.relname='lite_cycles_game_id_number_key' and pg_get_indexdef(i.oid)='CREATE UNIQUE INDEX lite_cycles_game_id_number_key ON public.lite_cycles USING btree (game_id, number)')) then raise exception 'Índice incompatible: lite_cycles_game_id_number_key'; end if;
 if not (exists(select 1 from pg_index x join pg_class c on c.oid=x.indrelid join pg_namespace n on n.oid=c.relnamespace join pg_class i on i.oid=x.indexrelid where n.nspname='public' and c.relname='lite_cycles' and i.relname='lite_cycles_pkey' and pg_get_indexdef(i.oid)='CREATE UNIQUE INDEX lite_cycles_pkey ON public.lite_cycles USING btree (id)')) then raise exception 'Índice incompatible: lite_cycles_pkey'; end if;
 if not (exists(select 1 from pg_index x join pg_class c on c.oid=x.indrelid join pg_namespace n on n.oid=c.relnamespace join pg_class i on i.oid=x.indexrelid where n.nspname='public' and c.relname='lite_cycles' and i.relname='lite_due_cycles' and pg_get_indexdef(i.oid)='CREATE INDEX lite_due_cycles ON public.lite_cycles USING btree (ends_at, id) WHERE ((status = ''open''::text) AND (paused_at IS NULL))')) then raise exception 'Índice incompatible: lite_due_cycles'; end if;
 if not (exists(select 1 from pg_index x join pg_class c on c.oid=x.indrelid join pg_namespace n on n.oid=c.relnamespace join pg_class i on i.oid=x.indexrelid where n.nspname='public' and c.relname='lite_cycles' and i.relname='lite_one_open_cycle' and pg_get_indexdef(i.oid)='CREATE UNIQUE INDEX lite_one_open_cycle ON public.lite_cycles USING btree (game_id) WHERE (status = ''open''::text)')) then raise exception 'Índice incompatible: lite_one_open_cycle'; end if;
 if not (exists(select 1 from pg_index x join pg_class c on c.oid=x.indrelid join pg_namespace n on n.oid=c.relnamespace join pg_class i on i.oid=x.indexrelid where n.nspname='public' and c.relname='lite_decisions' and i.relname='lite_decisions_cycle_id_company_id_key' and pg_get_indexdef(i.oid)='CREATE UNIQUE INDEX lite_decisions_cycle_id_company_id_key ON public.lite_decisions USING btree (cycle_id, company_id)')) then raise exception 'Índice incompatible: lite_decisions_cycle_id_company_id_key'; end if;
 if not (exists(select 1 from pg_index x join pg_class c on c.oid=x.indrelid join pg_namespace n on n.oid=c.relnamespace join pg_class i on i.oid=x.indexrelid where n.nspname='public' and c.relname='lite_decisions' and i.relname='lite_decisions_pkey' and pg_get_indexdef(i.oid)='CREATE UNIQUE INDEX lite_decisions_pkey ON public.lite_decisions USING btree (id)')) then raise exception 'Índice incompatible: lite_decisions_pkey'; end if;
 if not (exists(select 1 from pg_index x join pg_class c on c.oid=x.indrelid join pg_namespace n on n.oid=c.relnamespace join pg_class i on i.oid=x.indexrelid where n.nspname='public' and c.relname='lite_events' and i.relname='lite_events_pkey' and pg_get_indexdef(i.oid)='CREATE UNIQUE INDEX lite_events_pkey ON public.lite_events USING btree (id)')) then raise exception 'Índice incompatible: lite_events_pkey'; end if;
 if not (exists(select 1 from pg_index x join pg_class c on c.oid=x.indrelid join pg_namespace n on n.oid=c.relnamespace join pg_class i on i.oid=x.indexrelid where n.nspname='public' and c.relname='lite_games' and i.relname='lite_games_code_key' and pg_get_indexdef(i.oid)='CREATE UNIQUE INDEX lite_games_code_key ON public.lite_games USING btree (code)')) then raise exception 'Índice incompatible: lite_games_code_key'; end if;
 if not (exists(select 1 from pg_index x join pg_class c on c.oid=x.indrelid join pg_namespace n on n.oid=c.relnamespace join pg_class i on i.oid=x.indexrelid where n.nspname='public' and c.relname='lite_games' and i.relname='lite_games_pkey' and pg_get_indexdef(i.oid)='CREATE UNIQUE INDEX lite_games_pkey ON public.lite_games USING btree (id)')) then raise exception 'Índice incompatible: lite_games_pkey'; end if;
 if not (exists(select 1 from pg_index x join pg_class c on c.oid=x.indrelid join pg_namespace n on n.oid=c.relnamespace join pg_class i on i.oid=x.indexrelid where n.nspname='public' and c.relname='lite_games' and i.relname='lite_games_teacher' and pg_get_indexdef(i.oid)='CREATE INDEX lite_games_teacher ON public.lite_games USING btree (teacher_id)')) then raise exception 'Índice incompatible: lite_games_teacher'; end if;
 if not (exists(select 1 from pg_index x join pg_class c on c.oid=x.indrelid join pg_namespace n on n.oid=c.relnamespace join pg_class i on i.oid=x.indexrelid where n.nspname='public' and c.relname='lite_products' and i.relname='lite_products_game_id_quality_key' and pg_get_indexdef(i.oid)='CREATE UNIQUE INDEX lite_products_game_id_quality_key ON public.lite_products USING btree (game_id, quality)')) then raise exception 'Índice incompatible: lite_products_game_id_quality_key'; end if;
 if not (exists(select 1 from pg_index x join pg_class c on c.oid=x.indrelid join pg_namespace n on n.oid=c.relnamespace join pg_class i on i.oid=x.indexrelid where n.nspname='public' and c.relname='lite_products' and i.relname='lite_products_pkey' and pg_get_indexdef(i.oid)='CREATE UNIQUE INDEX lite_products_pkey ON public.lite_products USING btree (id)')) then raise exception 'Índice incompatible: lite_products_pkey'; end if;
 if not (exists(select 1 from pg_index x join pg_class c on c.oid=x.indrelid join pg_namespace n on n.oid=c.relnamespace join pg_class i on i.oid=x.indexrelid where n.nspname='public' and c.relname='lite_profiles' and i.relname='lite_profiles_pkey' and pg_get_indexdef(i.oid)='CREATE UNIQUE INDEX lite_profiles_pkey ON public.lite_profiles USING btree (id)')) then raise exception 'Índice incompatible: lite_profiles_pkey'; end if;
 if not (exists(select 1 from pg_index x join pg_class c on c.oid=x.indrelid join pg_namespace n on n.oid=c.relnamespace join pg_class i on i.oid=x.indexrelid where n.nspname='public' and c.relname='lite_results' and i.relname='lite_results_company' and pg_get_indexdef(i.oid)='CREATE INDEX lite_results_company ON public.lite_results USING btree (company_id)')) then raise exception 'Índice incompatible: lite_results_company'; end if;
 if not (exists(select 1 from pg_index x join pg_class c on c.oid=x.indrelid join pg_namespace n on n.oid=c.relnamespace join pg_class i on i.oid=x.indexrelid where n.nspname='public' and c.relname='lite_results' and i.relname='lite_results_company_idx' and pg_get_indexdef(i.oid)='CREATE INDEX lite_results_company_idx ON public.lite_results USING btree (company_id)')) then raise exception 'Índice incompatible: lite_results_company_idx'; end if;
 if not (exists(select 1 from pg_index x join pg_class c on c.oid=x.indrelid join pg_namespace n on n.oid=c.relnamespace join pg_class i on i.oid=x.indexrelid where n.nspname='public' and c.relname='lite_results' and i.relname='lite_results_cycle_id_company_id_key' and pg_get_indexdef(i.oid)='CREATE UNIQUE INDEX lite_results_cycle_id_company_id_key ON public.lite_results USING btree (cycle_id, company_id)')) then raise exception 'Índice incompatible: lite_results_cycle_id_company_id_key'; end if;
 if not (exists(select 1 from pg_index x join pg_class c on c.oid=x.indrelid join pg_namespace n on n.oid=c.relnamespace join pg_class i on i.oid=x.indexrelid where n.nspname='public' and c.relname='lite_results' and i.relname='lite_results_pkey' and pg_get_indexdef(i.oid)='CREATE UNIQUE INDEX lite_results_pkey ON public.lite_results USING btree (id)')) then raise exception 'Índice incompatible: lite_results_pkey'; end if;
 if not (exists(select 1 from pg_index x join pg_class c on c.oid=x.indrelid join pg_namespace n on n.oid=c.relnamespace join pg_class i on i.oid=x.indexrelid where n.nspname='public' and c.relname='lite_sessions' and i.relname='lite_sessions_pkey' and pg_get_indexdef(i.oid)='CREATE UNIQUE INDEX lite_sessions_pkey ON public.lite_sessions USING btree (id_hash)')) then raise exception 'Índice incompatible: lite_sessions_pkey'; end if;
 if not (exists(select 1 from pg_index x join pg_class c on c.oid=x.indrelid join pg_namespace n on n.oid=c.relnamespace join pg_class i on i.oid=x.indexrelid where n.nspname='public' and c.relname='lite_stores' and i.relname='lite_stores_name_key' and pg_get_indexdef(i.oid)='CREATE UNIQUE INDEX lite_stores_name_key ON public.lite_stores USING btree (name)')) then raise exception 'Índice incompatible: lite_stores_name_key'; end if;
 if not (exists(select 1 from pg_index x join pg_class c on c.oid=x.indrelid join pg_namespace n on n.oid=c.relnamespace join pg_class i on i.oid=x.indexrelid where n.nspname='public' and c.relname='lite_stores' and i.relname='lite_stores_pkey' and pg_get_indexdef(i.oid)='CREATE UNIQUE INDEX lite_stores_pkey ON public.lite_stores USING btree (id)')) then raise exception 'Índice incompatible: lite_stores_pkey'; end if;
 if not (exists(select 1 from pg_index x join pg_class c on c.oid=x.indrelid join pg_namespace n on n.oid=c.relnamespace join pg_class i on i.oid=x.indexrelid where n.nspname='public' and c.relname='lite_teacher_grades' and i.relname='lite_teacher_grades_pkey' and pg_get_indexdef(i.oid)='CREATE UNIQUE INDEX lite_teacher_grades_pkey ON public.lite_teacher_grades USING btree (game_id, company_id)')) then raise exception 'Índice incompatible: lite_teacher_grades_pkey'; end if;
 if not (exists(select 1 from pg_index x join pg_class c on c.oid=x.indrelid join pg_namespace n on n.oid=c.relnamespace join pg_class i on i.oid=x.indexrelid where n.nspname='public' and c.relname='lite_teacher_podium' and i.relname='lite_teacher_podium_pkey' and pg_get_indexdef(i.oid)='CREATE UNIQUE INDEX lite_teacher_podium_pkey ON public.lite_teacher_podium USING btree (game_id)')) then raise exception 'Índice incompatible: lite_teacher_podium_pkey'; end if;
 if not (exists(select 1 from pg_index x join pg_class c on c.oid=x.indrelid join pg_namespace n on n.oid=c.relnamespace join pg_class i on i.oid=x.indexrelid where n.nspname='side_lite_private' and c.relname='lite_cycle_secrets' and i.relname='lite_cycle_secrets_pkey' and pg_get_indexdef(i.oid)='CREATE UNIQUE INDEX lite_cycle_secrets_pkey ON side_lite_private.lite_cycle_secrets USING btree (cycle_id)')) then raise exception 'Índice incompatible: lite_cycle_secrets_pkey'; end if;
 if not (exists(select 1 from pg_index x join pg_class c on c.oid=x.indrelid join pg_namespace n on n.oid=c.relnamespace join pg_class i on i.oid=x.indexrelid where n.nspname='side_lite_private' and c.relname='lite_teacher_grants' and i.relname='lite_teacher_grants_pkey' and pg_get_indexdef(i.oid)='CREATE UNIQUE INDEX lite_teacher_grants_pkey ON side_lite_private.lite_teacher_grants USING btree (user_id)')) then raise exception 'Índice incompatible: lite_teacher_grants_pkey'; end if;
 if not (exists(select 1 from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='auth' and c.relname='users' and t.tgname='lite_create_student_profile' and pg_get_triggerdef(t.oid)='CREATE TRIGGER lite_create_student_profile AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION side_lite_private.create_student_profile()')) then raise exception 'Trigger incompatible: lite_create_student_profile'; end if;
 if not (exists(select 1 from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_cycles' and t.tgname='lite_cycle_initialize' and pg_get_triggerdef(t.oid)='CREATE TRIGGER lite_cycle_initialize BEFORE INSERT ON public.lite_cycles FOR EACH ROW EXECUTE FUNCTION side_lite_private.initialize_cycle()')) then raise exception 'Trigger incompatible: lite_cycle_initialize'; end if;
 if not (exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='side_lite_private' and p.proname='create_student_profile' and pg_get_function_identity_arguments(p.oid)='' and md5(pg_get_functiondef(p.oid))='65a12ab1c73dc883b4b00582c2157428')) then raise exception 'Función incompatible: create_student_profile'; end if;
 if not (exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='side_lite_private' and p.proname='initialize_cycle' and pg_get_function_identity_arguments(p.oid)='' and md5(pg_get_functiondef(p.oid))='213b4ced3bcc7565a265c0e97b3cae33')) then raise exception 'Función incompatible: initialize_cycle'; end if;
 if not (exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='side_lite_private' and p.proname='is_approved_teacher' and pg_get_function_identity_arguments(p.oid)='p_game uuid' and md5(pg_get_functiondef(p.oid))='1e3b87d9a63706aa2df2fb805aed1165')) then raise exception 'Función incompatible: is_approved_teacher'; end if;
 if not (exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='side_lite_private' and p.proname='is_game_student' and pg_get_function_identity_arguments(p.oid)='p_game uuid' and md5(pg_get_functiondef(p.oid))='c1f3da54c722e5567322a2a2d10f5e27')) then raise exception 'Función incompatible: is_game_student'; end if;
 if not (exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='side_lite_private' and p.proname='owns_company' and pg_get_function_identity_arguments(p.oid)='p_company uuid' and md5(pg_get_functiondef(p.oid))='3b8f1c74dde2132276d526ab1c4932eb')) then raise exception 'Función incompatible: owns_company'; end if;
 if not (exists(select 1 from pg_policies where schemaname='public' and tablename='lite_companies' and policyname='companies_private_read' and permissive='PERMISSIVE' and cmd='SELECT' and roles::text='{authenticated}' and coalesce(qual,'')='((student_id = ( SELECT auth.uid() AS uid)) OR side_lite_private.is_approved_teacher(game_id))' and coalesce(with_check,'')='')) then raise exception 'Política incompatible: lite_companies.companies_private_read'; end if;
 if not (exists(select 1 from pg_policies where schemaname='public' and tablename='lite_cycles' and policyname='cycles_member_read' and permissive='PERMISSIVE' and cmd='SELECT' and roles::text='{authenticated}' and coalesce(qual,'')='(side_lite_private.is_approved_teacher(game_id) OR side_lite_private.is_game_student(game_id))' and coalesce(with_check,'')='')) then raise exception 'Política incompatible: lite_cycles.cycles_member_read'; end if;
 if not (exists(select 1 from pg_policies where schemaname='public' and tablename='lite_decisions' and policyname='decisions_private_read' and permissive='PERMISSIVE' and cmd='SELECT' and roles::text='{authenticated}' and coalesce(qual,'')='(side_lite_private.owns_company(company_id) OR side_lite_private.is_approved_teacher(game_id))' and coalesce(with_check,'')='')) then raise exception 'Política incompatible: lite_decisions.decisions_private_read'; end if;
 if not (exists(select 1 from pg_policies where schemaname='public' and tablename='lite_events' and policyname='events_read' and permissive='PERMISSIVE' and cmd='SELECT' and roles::text='{authenticated}' and coalesce(qual,'')='true' and coalesce(with_check,'')='')) then raise exception 'Política incompatible: lite_events.events_read'; end if;
 if not (exists(select 1 from pg_policies where schemaname='public' and tablename='lite_games' and policyname='games_member_read' and permissive='PERMISSIVE' and cmd='SELECT' and roles::text='{authenticated}' and coalesce(qual,'')='(side_lite_private.is_approved_teacher(id) OR side_lite_private.is_game_student(id))' and coalesce(with_check,'')='')) then raise exception 'Política incompatible: lite_games.games_member_read'; end if;
 if not (exists(select 1 from pg_policies where schemaname='public' and tablename='lite_products' and policyname='products_member_read' and permissive='PERMISSIVE' and cmd='SELECT' and roles::text='{authenticated}' and coalesce(qual,'')='(side_lite_private.is_approved_teacher(game_id) OR side_lite_private.is_game_student(game_id))' and coalesce(with_check,'')='')) then raise exception 'Política incompatible: lite_products.products_member_read'; end if;
 if not (exists(select 1 from pg_policies where schemaname='public' and tablename='lite_profiles' and policyname='profile_self_insert' and permissive='PERMISSIVE' and cmd='INSERT' and roles::text='{authenticated}' and coalesce(qual,'')='' and coalesce(with_check,'')='(id = ( SELECT auth.uid() AS uid))')) then raise exception 'Política incompatible: lite_profiles.profile_self_insert'; end if;
 if not (exists(select 1 from pg_policies where schemaname='public' and tablename='lite_profiles' and policyname='profile_self_read' and permissive='PERMISSIVE' and cmd='SELECT' and roles::text='{authenticated}' and coalesce(qual,'')='(id = ( SELECT auth.uid() AS uid))' and coalesce(with_check,'')='')) then raise exception 'Política incompatible: lite_profiles.profile_self_read'; end if;
 if not (exists(select 1 from pg_policies where schemaname='public' and tablename='lite_profiles' and policyname='profile_self_update' and permissive='PERMISSIVE' and cmd='UPDATE' and roles::text='{authenticated}' and coalesce(qual,'')='(id = ( SELECT auth.uid() AS uid))' and coalesce(with_check,'')='(id = ( SELECT auth.uid() AS uid))')) then raise exception 'Política incompatible: lite_profiles.profile_self_update'; end if;
 if not (exists(select 1 from pg_policies where schemaname='public' and tablename='lite_results' and policyname='results_private_read' and permissive='PERMISSIVE' and cmd='SELECT' and roles::text='{authenticated}' and coalesce(qual,'')='(side_lite_private.owns_company(company_id) OR side_lite_private.is_approved_teacher(game_id))' and coalesce(with_check,'')='')) then raise exception 'Política incompatible: lite_results.results_private_read'; end if;
 if not (exists(select 1 from pg_policies where schemaname='public' and tablename='lite_stores' and policyname='stores_read' and permissive='PERMISSIVE' and cmd='SELECT' and roles::text='{authenticated}' and coalesce(qual,'')='true' and coalesce(with_check,'')='')) then raise exception 'Política incompatible: lite_stores.stores_read'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_auth_limits' and has_table_privilege('anon',c.oid,'DELETE')=false)) then raise exception 'Privilegio incompatible: public.lite_auth_limits anon DELETE'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_auth_limits' and has_table_privilege('anon',c.oid,'INSERT')=false)) then raise exception 'Privilegio incompatible: public.lite_auth_limits anon INSERT'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_auth_limits' and has_table_privilege('anon',c.oid,'REFERENCES')=false)) then raise exception 'Privilegio incompatible: public.lite_auth_limits anon REFERENCES'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_auth_limits' and has_table_privilege('anon',c.oid,'SELECT')=false)) then raise exception 'Privilegio incompatible: public.lite_auth_limits anon SELECT'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_auth_limits' and has_table_privilege('anon',c.oid,'TRIGGER')=false)) then raise exception 'Privilegio incompatible: public.lite_auth_limits anon TRIGGER'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_auth_limits' and has_table_privilege('anon',c.oid,'TRUNCATE')=false)) then raise exception 'Privilegio incompatible: public.lite_auth_limits anon TRUNCATE'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_auth_limits' and has_table_privilege('anon',c.oid,'UPDATE')=false)) then raise exception 'Privilegio incompatible: public.lite_auth_limits anon UPDATE'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_auth_limits' and has_table_privilege('authenticated',c.oid,'DELETE')=false)) then raise exception 'Privilegio incompatible: public.lite_auth_limits authenticated DELETE'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_auth_limits' and has_table_privilege('authenticated',c.oid,'INSERT')=false)) then raise exception 'Privilegio incompatible: public.lite_auth_limits authenticated INSERT'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_auth_limits' and has_table_privilege('authenticated',c.oid,'REFERENCES')=false)) then raise exception 'Privilegio incompatible: public.lite_auth_limits authenticated REFERENCES'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_auth_limits' and has_table_privilege('authenticated',c.oid,'SELECT')=false)) then raise exception 'Privilegio incompatible: public.lite_auth_limits authenticated SELECT'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_auth_limits' and has_table_privilege('authenticated',c.oid,'TRIGGER')=false)) then raise exception 'Privilegio incompatible: public.lite_auth_limits authenticated TRIGGER'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_auth_limits' and has_table_privilege('authenticated',c.oid,'TRUNCATE')=false)) then raise exception 'Privilegio incompatible: public.lite_auth_limits authenticated TRUNCATE'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_auth_limits' and has_table_privilege('authenticated',c.oid,'UPDATE')=false)) then raise exception 'Privilegio incompatible: public.lite_auth_limits authenticated UPDATE'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_auth_limits' and has_table_privilege('service_role',c.oid,'DELETE')=true)) then raise exception 'Privilegio incompatible: public.lite_auth_limits service_role DELETE'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_auth_limits' and has_table_privilege('service_role',c.oid,'INSERT')=true)) then raise exception 'Privilegio incompatible: public.lite_auth_limits service_role INSERT'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_auth_limits' and has_table_privilege('service_role',c.oid,'REFERENCES')=true)) then raise exception 'Privilegio incompatible: public.lite_auth_limits service_role REFERENCES'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_auth_limits' and has_table_privilege('service_role',c.oid,'SELECT')=true)) then raise exception 'Privilegio incompatible: public.lite_auth_limits service_role SELECT'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_auth_limits' and has_table_privilege('service_role',c.oid,'TRIGGER')=true)) then raise exception 'Privilegio incompatible: public.lite_auth_limits service_role TRIGGER'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_auth_limits' and has_table_privilege('service_role',c.oid,'TRUNCATE')=true)) then raise exception 'Privilegio incompatible: public.lite_auth_limits service_role TRUNCATE'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_auth_limits' and has_table_privilege('service_role',c.oid,'UPDATE')=true)) then raise exception 'Privilegio incompatible: public.lite_auth_limits service_role UPDATE'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_companies' and has_table_privilege('anon',c.oid,'DELETE')=false)) then raise exception 'Privilegio incompatible: public.lite_companies anon DELETE'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_companies' and has_table_privilege('anon',c.oid,'INSERT')=false)) then raise exception 'Privilegio incompatible: public.lite_companies anon INSERT'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_companies' and has_table_privilege('anon',c.oid,'REFERENCES')=false)) then raise exception 'Privilegio incompatible: public.lite_companies anon REFERENCES'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_companies' and has_table_privilege('anon',c.oid,'SELECT')=false)) then raise exception 'Privilegio incompatible: public.lite_companies anon SELECT'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_companies' and has_table_privilege('anon',c.oid,'TRIGGER')=false)) then raise exception 'Privilegio incompatible: public.lite_companies anon TRIGGER'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_companies' and has_table_privilege('anon',c.oid,'TRUNCATE')=false)) then raise exception 'Privilegio incompatible: public.lite_companies anon TRUNCATE'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_companies' and has_table_privilege('anon',c.oid,'UPDATE')=false)) then raise exception 'Privilegio incompatible: public.lite_companies anon UPDATE'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_companies' and has_table_privilege('authenticated',c.oid,'DELETE')=false)) then raise exception 'Privilegio incompatible: public.lite_companies authenticated DELETE'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_companies' and has_table_privilege('authenticated',c.oid,'INSERT')=false)) then raise exception 'Privilegio incompatible: public.lite_companies authenticated INSERT'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_companies' and has_table_privilege('authenticated',c.oid,'REFERENCES')=false)) then raise exception 'Privilegio incompatible: public.lite_companies authenticated REFERENCES'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_companies' and has_table_privilege('authenticated',c.oid,'SELECT')=true)) then raise exception 'Privilegio incompatible: public.lite_companies authenticated SELECT'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_companies' and has_table_privilege('authenticated',c.oid,'TRIGGER')=false)) then raise exception 'Privilegio incompatible: public.lite_companies authenticated TRIGGER'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_companies' and has_table_privilege('authenticated',c.oid,'TRUNCATE')=false)) then raise exception 'Privilegio incompatible: public.lite_companies authenticated TRUNCATE'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_companies' and has_table_privilege('authenticated',c.oid,'UPDATE')=false)) then raise exception 'Privilegio incompatible: public.lite_companies authenticated UPDATE'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_companies' and has_table_privilege('service_role',c.oid,'DELETE')=true)) then raise exception 'Privilegio incompatible: public.lite_companies service_role DELETE'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_companies' and has_table_privilege('service_role',c.oid,'INSERT')=true)) then raise exception 'Privilegio incompatible: public.lite_companies service_role INSERT'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_companies' and has_table_privilege('service_role',c.oid,'REFERENCES')=true)) then raise exception 'Privilegio incompatible: public.lite_companies service_role REFERENCES'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_companies' and has_table_privilege('service_role',c.oid,'SELECT')=true)) then raise exception 'Privilegio incompatible: public.lite_companies service_role SELECT'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_companies' and has_table_privilege('service_role',c.oid,'TRIGGER')=true)) then raise exception 'Privilegio incompatible: public.lite_companies service_role TRIGGER'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_companies' and has_table_privilege('service_role',c.oid,'TRUNCATE')=true)) then raise exception 'Privilegio incompatible: public.lite_companies service_role TRUNCATE'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_companies' and has_table_privilege('service_role',c.oid,'UPDATE')=true)) then raise exception 'Privilegio incompatible: public.lite_companies service_role UPDATE'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_cycles' and has_table_privilege('anon',c.oid,'DELETE')=false)) then raise exception 'Privilegio incompatible: public.lite_cycles anon DELETE'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_cycles' and has_table_privilege('anon',c.oid,'INSERT')=false)) then raise exception 'Privilegio incompatible: public.lite_cycles anon INSERT'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_cycles' and has_table_privilege('anon',c.oid,'REFERENCES')=false)) then raise exception 'Privilegio incompatible: public.lite_cycles anon REFERENCES'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_cycles' and has_table_privilege('anon',c.oid,'SELECT')=false)) then raise exception 'Privilegio incompatible: public.lite_cycles anon SELECT'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_cycles' and has_table_privilege('anon',c.oid,'TRIGGER')=false)) then raise exception 'Privilegio incompatible: public.lite_cycles anon TRIGGER'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_cycles' and has_table_privilege('anon',c.oid,'TRUNCATE')=false)) then raise exception 'Privilegio incompatible: public.lite_cycles anon TRUNCATE'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_cycles' and has_table_privilege('anon',c.oid,'UPDATE')=false)) then raise exception 'Privilegio incompatible: public.lite_cycles anon UPDATE'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_cycles' and has_table_privilege('authenticated',c.oid,'DELETE')=false)) then raise exception 'Privilegio incompatible: public.lite_cycles authenticated DELETE'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_cycles' and has_table_privilege('authenticated',c.oid,'INSERT')=false)) then raise exception 'Privilegio incompatible: public.lite_cycles authenticated INSERT'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_cycles' and has_table_privilege('authenticated',c.oid,'REFERENCES')=false)) then raise exception 'Privilegio incompatible: public.lite_cycles authenticated REFERENCES'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_cycles' and has_table_privilege('authenticated',c.oid,'SELECT')=true)) then raise exception 'Privilegio incompatible: public.lite_cycles authenticated SELECT'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_cycles' and has_table_privilege('authenticated',c.oid,'TRIGGER')=false)) then raise exception 'Privilegio incompatible: public.lite_cycles authenticated TRIGGER'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_cycles' and has_table_privilege('authenticated',c.oid,'TRUNCATE')=false)) then raise exception 'Privilegio incompatible: public.lite_cycles authenticated TRUNCATE'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_cycles' and has_table_privilege('authenticated',c.oid,'UPDATE')=false)) then raise exception 'Privilegio incompatible: public.lite_cycles authenticated UPDATE'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_cycles' and has_table_privilege('service_role',c.oid,'DELETE')=true)) then raise exception 'Privilegio incompatible: public.lite_cycles service_role DELETE'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_cycles' and has_table_privilege('service_role',c.oid,'INSERT')=true)) then raise exception 'Privilegio incompatible: public.lite_cycles service_role INSERT'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_cycles' and has_table_privilege('service_role',c.oid,'REFERENCES')=true)) then raise exception 'Privilegio incompatible: public.lite_cycles service_role REFERENCES'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_cycles' and has_table_privilege('service_role',c.oid,'SELECT')=true)) then raise exception 'Privilegio incompatible: public.lite_cycles service_role SELECT'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_cycles' and has_table_privilege('service_role',c.oid,'TRIGGER')=true)) then raise exception 'Privilegio incompatible: public.lite_cycles service_role TRIGGER'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_cycles' and has_table_privilege('service_role',c.oid,'TRUNCATE')=true)) then raise exception 'Privilegio incompatible: public.lite_cycles service_role TRUNCATE'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_cycles' and has_table_privilege('service_role',c.oid,'UPDATE')=true)) then raise exception 'Privilegio incompatible: public.lite_cycles service_role UPDATE'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_decisions' and has_table_privilege('anon',c.oid,'DELETE')=false)) then raise exception 'Privilegio incompatible: public.lite_decisions anon DELETE'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_decisions' and has_table_privilege('anon',c.oid,'INSERT')=false)) then raise exception 'Privilegio incompatible: public.lite_decisions anon INSERT'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_decisions' and has_table_privilege('anon',c.oid,'REFERENCES')=false)) then raise exception 'Privilegio incompatible: public.lite_decisions anon REFERENCES'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_decisions' and has_table_privilege('anon',c.oid,'SELECT')=false)) then raise exception 'Privilegio incompatible: public.lite_decisions anon SELECT'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_decisions' and has_table_privilege('anon',c.oid,'TRIGGER')=false)) then raise exception 'Privilegio incompatible: public.lite_decisions anon TRIGGER'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_decisions' and has_table_privilege('anon',c.oid,'TRUNCATE')=false)) then raise exception 'Privilegio incompatible: public.lite_decisions anon TRUNCATE'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_decisions' and has_table_privilege('anon',c.oid,'UPDATE')=false)) then raise exception 'Privilegio incompatible: public.lite_decisions anon UPDATE'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_decisions' and has_table_privilege('authenticated',c.oid,'DELETE')=false)) then raise exception 'Privilegio incompatible: public.lite_decisions authenticated DELETE'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_decisions' and has_table_privilege('authenticated',c.oid,'INSERT')=false)) then raise exception 'Privilegio incompatible: public.lite_decisions authenticated INSERT'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_decisions' and has_table_privilege('authenticated',c.oid,'REFERENCES')=false)) then raise exception 'Privilegio incompatible: public.lite_decisions authenticated REFERENCES'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_decisions' and has_table_privilege('authenticated',c.oid,'SELECT')=true)) then raise exception 'Privilegio incompatible: public.lite_decisions authenticated SELECT'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_decisions' and has_table_privilege('authenticated',c.oid,'TRIGGER')=false)) then raise exception 'Privilegio incompatible: public.lite_decisions authenticated TRIGGER'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_decisions' and has_table_privilege('authenticated',c.oid,'TRUNCATE')=false)) then raise exception 'Privilegio incompatible: public.lite_decisions authenticated TRUNCATE'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_decisions' and has_table_privilege('authenticated',c.oid,'UPDATE')=false)) then raise exception 'Privilegio incompatible: public.lite_decisions authenticated UPDATE'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_decisions' and has_table_privilege('service_role',c.oid,'DELETE')=true)) then raise exception 'Privilegio incompatible: public.lite_decisions service_role DELETE'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_decisions' and has_table_privilege('service_role',c.oid,'INSERT')=true)) then raise exception 'Privilegio incompatible: public.lite_decisions service_role INSERT'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_decisions' and has_table_privilege('service_role',c.oid,'REFERENCES')=true)) then raise exception 'Privilegio incompatible: public.lite_decisions service_role REFERENCES'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_decisions' and has_table_privilege('service_role',c.oid,'SELECT')=true)) then raise exception 'Privilegio incompatible: public.lite_decisions service_role SELECT'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_decisions' and has_table_privilege('service_role',c.oid,'TRIGGER')=true)) then raise exception 'Privilegio incompatible: public.lite_decisions service_role TRIGGER'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_decisions' and has_table_privilege('service_role',c.oid,'TRUNCATE')=true)) then raise exception 'Privilegio incompatible: public.lite_decisions service_role TRUNCATE'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_decisions' and has_table_privilege('service_role',c.oid,'UPDATE')=true)) then raise exception 'Privilegio incompatible: public.lite_decisions service_role UPDATE'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_events' and has_table_privilege('anon',c.oid,'DELETE')=false)) then raise exception 'Privilegio incompatible: public.lite_events anon DELETE'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_events' and has_table_privilege('anon',c.oid,'INSERT')=false)) then raise exception 'Privilegio incompatible: public.lite_events anon INSERT'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_events' and has_table_privilege('anon',c.oid,'REFERENCES')=false)) then raise exception 'Privilegio incompatible: public.lite_events anon REFERENCES'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_events' and has_table_privilege('anon',c.oid,'SELECT')=false)) then raise exception 'Privilegio incompatible: public.lite_events anon SELECT'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_events' and has_table_privilege('anon',c.oid,'TRIGGER')=false)) then raise exception 'Privilegio incompatible: public.lite_events anon TRIGGER'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_events' and has_table_privilege('anon',c.oid,'TRUNCATE')=false)) then raise exception 'Privilegio incompatible: public.lite_events anon TRUNCATE'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_events' and has_table_privilege('anon',c.oid,'UPDATE')=false)) then raise exception 'Privilegio incompatible: public.lite_events anon UPDATE'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_events' and has_table_privilege('authenticated',c.oid,'DELETE')=false)) then raise exception 'Privilegio incompatible: public.lite_events authenticated DELETE'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_events' and has_table_privilege('authenticated',c.oid,'INSERT')=false)) then raise exception 'Privilegio incompatible: public.lite_events authenticated INSERT'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_events' and has_table_privilege('authenticated',c.oid,'REFERENCES')=false)) then raise exception 'Privilegio incompatible: public.lite_events authenticated REFERENCES'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_events' and has_table_privilege('authenticated',c.oid,'SELECT')=true)) then raise exception 'Privilegio incompatible: public.lite_events authenticated SELECT'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_events' and has_table_privilege('authenticated',c.oid,'TRIGGER')=false)) then raise exception 'Privilegio incompatible: public.lite_events authenticated TRIGGER'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_events' and has_table_privilege('authenticated',c.oid,'TRUNCATE')=false)) then raise exception 'Privilegio incompatible: public.lite_events authenticated TRUNCATE'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_events' and has_table_privilege('authenticated',c.oid,'UPDATE')=false)) then raise exception 'Privilegio incompatible: public.lite_events authenticated UPDATE'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_events' and has_table_privilege('service_role',c.oid,'DELETE')=true)) then raise exception 'Privilegio incompatible: public.lite_events service_role DELETE'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_events' and has_table_privilege('service_role',c.oid,'INSERT')=true)) then raise exception 'Privilegio incompatible: public.lite_events service_role INSERT'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_events' and has_table_privilege('service_role',c.oid,'REFERENCES')=true)) then raise exception 'Privilegio incompatible: public.lite_events service_role REFERENCES'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_events' and has_table_privilege('service_role',c.oid,'SELECT')=true)) then raise exception 'Privilegio incompatible: public.lite_events service_role SELECT'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_events' and has_table_privilege('service_role',c.oid,'TRIGGER')=true)) then raise exception 'Privilegio incompatible: public.lite_events service_role TRIGGER'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_events' and has_table_privilege('service_role',c.oid,'TRUNCATE')=true)) then raise exception 'Privilegio incompatible: public.lite_events service_role TRUNCATE'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_events' and has_table_privilege('service_role',c.oid,'UPDATE')=true)) then raise exception 'Privilegio incompatible: public.lite_events service_role UPDATE'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_games' and has_table_privilege('anon',c.oid,'DELETE')=false)) then raise exception 'Privilegio incompatible: public.lite_games anon DELETE'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_games' and has_table_privilege('anon',c.oid,'INSERT')=false)) then raise exception 'Privilegio incompatible: public.lite_games anon INSERT'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_games' and has_table_privilege('anon',c.oid,'REFERENCES')=false)) then raise exception 'Privilegio incompatible: public.lite_games anon REFERENCES'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_games' and has_table_privilege('anon',c.oid,'SELECT')=false)) then raise exception 'Privilegio incompatible: public.lite_games anon SELECT'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_games' and has_table_privilege('anon',c.oid,'TRIGGER')=false)) then raise exception 'Privilegio incompatible: public.lite_games anon TRIGGER'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_games' and has_table_privilege('anon',c.oid,'TRUNCATE')=false)) then raise exception 'Privilegio incompatible: public.lite_games anon TRUNCATE'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_games' and has_table_privilege('anon',c.oid,'UPDATE')=false)) then raise exception 'Privilegio incompatible: public.lite_games anon UPDATE'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_games' and has_table_privilege('authenticated',c.oid,'DELETE')=false)) then raise exception 'Privilegio incompatible: public.lite_games authenticated DELETE'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_games' and has_table_privilege('authenticated',c.oid,'INSERT')=false)) then raise exception 'Privilegio incompatible: public.lite_games authenticated INSERT'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_games' and has_table_privilege('authenticated',c.oid,'REFERENCES')=false)) then raise exception 'Privilegio incompatible: public.lite_games authenticated REFERENCES'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_games' and has_table_privilege('authenticated',c.oid,'SELECT')=true)) then raise exception 'Privilegio incompatible: public.lite_games authenticated SELECT'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_games' and has_table_privilege('authenticated',c.oid,'TRIGGER')=false)) then raise exception 'Privilegio incompatible: public.lite_games authenticated TRIGGER'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_games' and has_table_privilege('authenticated',c.oid,'TRUNCATE')=false)) then raise exception 'Privilegio incompatible: public.lite_games authenticated TRUNCATE'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_games' and has_table_privilege('authenticated',c.oid,'UPDATE')=false)) then raise exception 'Privilegio incompatible: public.lite_games authenticated UPDATE'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_games' and has_table_privilege('service_role',c.oid,'DELETE')=true)) then raise exception 'Privilegio incompatible: public.lite_games service_role DELETE'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_games' and has_table_privilege('service_role',c.oid,'INSERT')=true)) then raise exception 'Privilegio incompatible: public.lite_games service_role INSERT'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_games' and has_table_privilege('service_role',c.oid,'REFERENCES')=true)) then raise exception 'Privilegio incompatible: public.lite_games service_role REFERENCES'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_games' and has_table_privilege('service_role',c.oid,'SELECT')=true)) then raise exception 'Privilegio incompatible: public.lite_games service_role SELECT'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_games' and has_table_privilege('service_role',c.oid,'TRIGGER')=true)) then raise exception 'Privilegio incompatible: public.lite_games service_role TRIGGER'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_games' and has_table_privilege('service_role',c.oid,'TRUNCATE')=true)) then raise exception 'Privilegio incompatible: public.lite_games service_role TRUNCATE'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_games' and has_table_privilege('service_role',c.oid,'UPDATE')=true)) then raise exception 'Privilegio incompatible: public.lite_games service_role UPDATE'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_products' and has_table_privilege('anon',c.oid,'DELETE')=false)) then raise exception 'Privilegio incompatible: public.lite_products anon DELETE'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_products' and has_table_privilege('anon',c.oid,'INSERT')=false)) then raise exception 'Privilegio incompatible: public.lite_products anon INSERT'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_products' and has_table_privilege('anon',c.oid,'REFERENCES')=false)) then raise exception 'Privilegio incompatible: public.lite_products anon REFERENCES'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_products' and has_table_privilege('anon',c.oid,'SELECT')=false)) then raise exception 'Privilegio incompatible: public.lite_products anon SELECT'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_products' and has_table_privilege('anon',c.oid,'TRIGGER')=false)) then raise exception 'Privilegio incompatible: public.lite_products anon TRIGGER'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_products' and has_table_privilege('anon',c.oid,'TRUNCATE')=false)) then raise exception 'Privilegio incompatible: public.lite_products anon TRUNCATE'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_products' and has_table_privilege('anon',c.oid,'UPDATE')=false)) then raise exception 'Privilegio incompatible: public.lite_products anon UPDATE'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_products' and has_table_privilege('authenticated',c.oid,'DELETE')=false)) then raise exception 'Privilegio incompatible: public.lite_products authenticated DELETE'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_products' and has_table_privilege('authenticated',c.oid,'INSERT')=false)) then raise exception 'Privilegio incompatible: public.lite_products authenticated INSERT'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_products' and has_table_privilege('authenticated',c.oid,'REFERENCES')=false)) then raise exception 'Privilegio incompatible: public.lite_products authenticated REFERENCES'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_products' and has_table_privilege('authenticated',c.oid,'SELECT')=true)) then raise exception 'Privilegio incompatible: public.lite_products authenticated SELECT'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_products' and has_table_privilege('authenticated',c.oid,'TRIGGER')=false)) then raise exception 'Privilegio incompatible: public.lite_products authenticated TRIGGER'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_products' and has_table_privilege('authenticated',c.oid,'TRUNCATE')=false)) then raise exception 'Privilegio incompatible: public.lite_products authenticated TRUNCATE'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_products' and has_table_privilege('authenticated',c.oid,'UPDATE')=false)) then raise exception 'Privilegio incompatible: public.lite_products authenticated UPDATE'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_products' and has_table_privilege('service_role',c.oid,'DELETE')=true)) then raise exception 'Privilegio incompatible: public.lite_products service_role DELETE'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_products' and has_table_privilege('service_role',c.oid,'INSERT')=true)) then raise exception 'Privilegio incompatible: public.lite_products service_role INSERT'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_products' and has_table_privilege('service_role',c.oid,'REFERENCES')=true)) then raise exception 'Privilegio incompatible: public.lite_products service_role REFERENCES'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_products' and has_table_privilege('service_role',c.oid,'SELECT')=true)) then raise exception 'Privilegio incompatible: public.lite_products service_role SELECT'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_products' and has_table_privilege('service_role',c.oid,'TRIGGER')=true)) then raise exception 'Privilegio incompatible: public.lite_products service_role TRIGGER'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_products' and has_table_privilege('service_role',c.oid,'TRUNCATE')=true)) then raise exception 'Privilegio incompatible: public.lite_products service_role TRUNCATE'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_products' and has_table_privilege('service_role',c.oid,'UPDATE')=true)) then raise exception 'Privilegio incompatible: public.lite_products service_role UPDATE'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_profiles' and has_table_privilege('anon',c.oid,'DELETE')=false)) then raise exception 'Privilegio incompatible: public.lite_profiles anon DELETE'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_profiles' and has_table_privilege('anon',c.oid,'INSERT')=false)) then raise exception 'Privilegio incompatible: public.lite_profiles anon INSERT'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_profiles' and has_table_privilege('anon',c.oid,'REFERENCES')=false)) then raise exception 'Privilegio incompatible: public.lite_profiles anon REFERENCES'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_profiles' and has_table_privilege('anon',c.oid,'SELECT')=false)) then raise exception 'Privilegio incompatible: public.lite_profiles anon SELECT'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_profiles' and has_table_privilege('anon',c.oid,'TRIGGER')=false)) then raise exception 'Privilegio incompatible: public.lite_profiles anon TRIGGER'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_profiles' and has_table_privilege('anon',c.oid,'TRUNCATE')=false)) then raise exception 'Privilegio incompatible: public.lite_profiles anon TRUNCATE'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_profiles' and has_table_privilege('anon',c.oid,'UPDATE')=false)) then raise exception 'Privilegio incompatible: public.lite_profiles anon UPDATE'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_profiles' and has_table_privilege('authenticated',c.oid,'DELETE')=false)) then raise exception 'Privilegio incompatible: public.lite_profiles authenticated DELETE'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_profiles' and has_table_privilege('authenticated',c.oid,'INSERT')=false)) then raise exception 'Privilegio incompatible: public.lite_profiles authenticated INSERT'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_profiles' and has_table_privilege('authenticated',c.oid,'REFERENCES')=false)) then raise exception 'Privilegio incompatible: public.lite_profiles authenticated REFERENCES'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_profiles' and has_table_privilege('authenticated',c.oid,'SELECT')=true)) then raise exception 'Privilegio incompatible: public.lite_profiles authenticated SELECT'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_profiles' and has_table_privilege('authenticated',c.oid,'TRIGGER')=false)) then raise exception 'Privilegio incompatible: public.lite_profiles authenticated TRIGGER'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_profiles' and has_table_privilege('authenticated',c.oid,'TRUNCATE')=false)) then raise exception 'Privilegio incompatible: public.lite_profiles authenticated TRUNCATE'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_profiles' and has_table_privilege('authenticated',c.oid,'UPDATE')=false)) then raise exception 'Privilegio incompatible: public.lite_profiles authenticated UPDATE'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_profiles' and has_table_privilege('service_role',c.oid,'DELETE')=true)) then raise exception 'Privilegio incompatible: public.lite_profiles service_role DELETE'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_profiles' and has_table_privilege('service_role',c.oid,'INSERT')=true)) then raise exception 'Privilegio incompatible: public.lite_profiles service_role INSERT'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_profiles' and has_table_privilege('service_role',c.oid,'REFERENCES')=true)) then raise exception 'Privilegio incompatible: public.lite_profiles service_role REFERENCES'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_profiles' and has_table_privilege('service_role',c.oid,'SELECT')=true)) then raise exception 'Privilegio incompatible: public.lite_profiles service_role SELECT'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_profiles' and has_table_privilege('service_role',c.oid,'TRIGGER')=true)) then raise exception 'Privilegio incompatible: public.lite_profiles service_role TRIGGER'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_profiles' and has_table_privilege('service_role',c.oid,'TRUNCATE')=true)) then raise exception 'Privilegio incompatible: public.lite_profiles service_role TRUNCATE'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_profiles' and has_table_privilege('service_role',c.oid,'UPDATE')=true)) then raise exception 'Privilegio incompatible: public.lite_profiles service_role UPDATE'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_results' and has_table_privilege('anon',c.oid,'DELETE')=false)) then raise exception 'Privilegio incompatible: public.lite_results anon DELETE'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_results' and has_table_privilege('anon',c.oid,'INSERT')=false)) then raise exception 'Privilegio incompatible: public.lite_results anon INSERT'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_results' and has_table_privilege('anon',c.oid,'REFERENCES')=false)) then raise exception 'Privilegio incompatible: public.lite_results anon REFERENCES'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_results' and has_table_privilege('anon',c.oid,'SELECT')=false)) then raise exception 'Privilegio incompatible: public.lite_results anon SELECT'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_results' and has_table_privilege('anon',c.oid,'TRIGGER')=false)) then raise exception 'Privilegio incompatible: public.lite_results anon TRIGGER'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_results' and has_table_privilege('anon',c.oid,'TRUNCATE')=false)) then raise exception 'Privilegio incompatible: public.lite_results anon TRUNCATE'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_results' and has_table_privilege('anon',c.oid,'UPDATE')=false)) then raise exception 'Privilegio incompatible: public.lite_results anon UPDATE'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_results' and has_table_privilege('authenticated',c.oid,'DELETE')=false)) then raise exception 'Privilegio incompatible: public.lite_results authenticated DELETE'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_results' and has_table_privilege('authenticated',c.oid,'INSERT')=false)) then raise exception 'Privilegio incompatible: public.lite_results authenticated INSERT'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_results' and has_table_privilege('authenticated',c.oid,'REFERENCES')=false)) then raise exception 'Privilegio incompatible: public.lite_results authenticated REFERENCES'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_results' and has_table_privilege('authenticated',c.oid,'SELECT')=true)) then raise exception 'Privilegio incompatible: public.lite_results authenticated SELECT'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_results' and has_table_privilege('authenticated',c.oid,'TRIGGER')=false)) then raise exception 'Privilegio incompatible: public.lite_results authenticated TRIGGER'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_results' and has_table_privilege('authenticated',c.oid,'TRUNCATE')=false)) then raise exception 'Privilegio incompatible: public.lite_results authenticated TRUNCATE'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_results' and has_table_privilege('authenticated',c.oid,'UPDATE')=false)) then raise exception 'Privilegio incompatible: public.lite_results authenticated UPDATE'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_results' and has_table_privilege('service_role',c.oid,'DELETE')=true)) then raise exception 'Privilegio incompatible: public.lite_results service_role DELETE'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_results' and has_table_privilege('service_role',c.oid,'INSERT')=true)) then raise exception 'Privilegio incompatible: public.lite_results service_role INSERT'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_results' and has_table_privilege('service_role',c.oid,'REFERENCES')=true)) then raise exception 'Privilegio incompatible: public.lite_results service_role REFERENCES'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_results' and has_table_privilege('service_role',c.oid,'SELECT')=true)) then raise exception 'Privilegio incompatible: public.lite_results service_role SELECT'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_results' and has_table_privilege('service_role',c.oid,'TRIGGER')=true)) then raise exception 'Privilegio incompatible: public.lite_results service_role TRIGGER'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_results' and has_table_privilege('service_role',c.oid,'TRUNCATE')=true)) then raise exception 'Privilegio incompatible: public.lite_results service_role TRUNCATE'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_results' and has_table_privilege('service_role',c.oid,'UPDATE')=true)) then raise exception 'Privilegio incompatible: public.lite_results service_role UPDATE'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_sessions' and has_table_privilege('anon',c.oid,'DELETE')=false)) then raise exception 'Privilegio incompatible: public.lite_sessions anon DELETE'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_sessions' and has_table_privilege('anon',c.oid,'INSERT')=false)) then raise exception 'Privilegio incompatible: public.lite_sessions anon INSERT'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_sessions' and has_table_privilege('anon',c.oid,'REFERENCES')=false)) then raise exception 'Privilegio incompatible: public.lite_sessions anon REFERENCES'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_sessions' and has_table_privilege('anon',c.oid,'SELECT')=false)) then raise exception 'Privilegio incompatible: public.lite_sessions anon SELECT'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_sessions' and has_table_privilege('anon',c.oid,'TRIGGER')=false)) then raise exception 'Privilegio incompatible: public.lite_sessions anon TRIGGER'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_sessions' and has_table_privilege('anon',c.oid,'TRUNCATE')=false)) then raise exception 'Privilegio incompatible: public.lite_sessions anon TRUNCATE'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_sessions' and has_table_privilege('anon',c.oid,'UPDATE')=false)) then raise exception 'Privilegio incompatible: public.lite_sessions anon UPDATE'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_sessions' and has_table_privilege('authenticated',c.oid,'DELETE')=false)) then raise exception 'Privilegio incompatible: public.lite_sessions authenticated DELETE'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_sessions' and has_table_privilege('authenticated',c.oid,'INSERT')=false)) then raise exception 'Privilegio incompatible: public.lite_sessions authenticated INSERT'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_sessions' and has_table_privilege('authenticated',c.oid,'REFERENCES')=false)) then raise exception 'Privilegio incompatible: public.lite_sessions authenticated REFERENCES'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_sessions' and has_table_privilege('authenticated',c.oid,'SELECT')=false)) then raise exception 'Privilegio incompatible: public.lite_sessions authenticated SELECT'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_sessions' and has_table_privilege('authenticated',c.oid,'TRIGGER')=false)) then raise exception 'Privilegio incompatible: public.lite_sessions authenticated TRIGGER'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_sessions' and has_table_privilege('authenticated',c.oid,'TRUNCATE')=false)) then raise exception 'Privilegio incompatible: public.lite_sessions authenticated TRUNCATE'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_sessions' and has_table_privilege('authenticated',c.oid,'UPDATE')=false)) then raise exception 'Privilegio incompatible: public.lite_sessions authenticated UPDATE'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_sessions' and has_table_privilege('service_role',c.oid,'DELETE')=true)) then raise exception 'Privilegio incompatible: public.lite_sessions service_role DELETE'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_sessions' and has_table_privilege('service_role',c.oid,'INSERT')=true)) then raise exception 'Privilegio incompatible: public.lite_sessions service_role INSERT'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_sessions' and has_table_privilege('service_role',c.oid,'REFERENCES')=true)) then raise exception 'Privilegio incompatible: public.lite_sessions service_role REFERENCES'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_sessions' and has_table_privilege('service_role',c.oid,'SELECT')=true)) then raise exception 'Privilegio incompatible: public.lite_sessions service_role SELECT'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_sessions' and has_table_privilege('service_role',c.oid,'TRIGGER')=true)) then raise exception 'Privilegio incompatible: public.lite_sessions service_role TRIGGER'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_sessions' and has_table_privilege('service_role',c.oid,'TRUNCATE')=true)) then raise exception 'Privilegio incompatible: public.lite_sessions service_role TRUNCATE'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_sessions' and has_table_privilege('service_role',c.oid,'UPDATE')=true)) then raise exception 'Privilegio incompatible: public.lite_sessions service_role UPDATE'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_stores' and has_table_privilege('anon',c.oid,'DELETE')=false)) then raise exception 'Privilegio incompatible: public.lite_stores anon DELETE'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_stores' and has_table_privilege('anon',c.oid,'INSERT')=false)) then raise exception 'Privilegio incompatible: public.lite_stores anon INSERT'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_stores' and has_table_privilege('anon',c.oid,'REFERENCES')=false)) then raise exception 'Privilegio incompatible: public.lite_stores anon REFERENCES'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_stores' and has_table_privilege('anon',c.oid,'SELECT')=false)) then raise exception 'Privilegio incompatible: public.lite_stores anon SELECT'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_stores' and has_table_privilege('anon',c.oid,'TRIGGER')=false)) then raise exception 'Privilegio incompatible: public.lite_stores anon TRIGGER'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_stores' and has_table_privilege('anon',c.oid,'TRUNCATE')=false)) then raise exception 'Privilegio incompatible: public.lite_stores anon TRUNCATE'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_stores' and has_table_privilege('anon',c.oid,'UPDATE')=false)) then raise exception 'Privilegio incompatible: public.lite_stores anon UPDATE'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_stores' and has_table_privilege('authenticated',c.oid,'DELETE')=false)) then raise exception 'Privilegio incompatible: public.lite_stores authenticated DELETE'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_stores' and has_table_privilege('authenticated',c.oid,'INSERT')=false)) then raise exception 'Privilegio incompatible: public.lite_stores authenticated INSERT'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_stores' and has_table_privilege('authenticated',c.oid,'REFERENCES')=false)) then raise exception 'Privilegio incompatible: public.lite_stores authenticated REFERENCES'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_stores' and has_table_privilege('authenticated',c.oid,'SELECT')=true)) then raise exception 'Privilegio incompatible: public.lite_stores authenticated SELECT'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_stores' and has_table_privilege('authenticated',c.oid,'TRIGGER')=false)) then raise exception 'Privilegio incompatible: public.lite_stores authenticated TRIGGER'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_stores' and has_table_privilege('authenticated',c.oid,'TRUNCATE')=false)) then raise exception 'Privilegio incompatible: public.lite_stores authenticated TRUNCATE'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_stores' and has_table_privilege('authenticated',c.oid,'UPDATE')=false)) then raise exception 'Privilegio incompatible: public.lite_stores authenticated UPDATE'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_stores' and has_table_privilege('service_role',c.oid,'DELETE')=true)) then raise exception 'Privilegio incompatible: public.lite_stores service_role DELETE'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_stores' and has_table_privilege('service_role',c.oid,'INSERT')=true)) then raise exception 'Privilegio incompatible: public.lite_stores service_role INSERT'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_stores' and has_table_privilege('service_role',c.oid,'REFERENCES')=true)) then raise exception 'Privilegio incompatible: public.lite_stores service_role REFERENCES'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_stores' and has_table_privilege('service_role',c.oid,'SELECT')=true)) then raise exception 'Privilegio incompatible: public.lite_stores service_role SELECT'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_stores' and has_table_privilege('service_role',c.oid,'TRIGGER')=true)) then raise exception 'Privilegio incompatible: public.lite_stores service_role TRIGGER'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_stores' and has_table_privilege('service_role',c.oid,'TRUNCATE')=true)) then raise exception 'Privilegio incompatible: public.lite_stores service_role TRUNCATE'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_stores' and has_table_privilege('service_role',c.oid,'UPDATE')=true)) then raise exception 'Privilegio incompatible: public.lite_stores service_role UPDATE'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_teacher_grades' and has_table_privilege('anon',c.oid,'DELETE')=false)) then raise exception 'Privilegio incompatible: public.lite_teacher_grades anon DELETE'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_teacher_grades' and has_table_privilege('anon',c.oid,'INSERT')=false)) then raise exception 'Privilegio incompatible: public.lite_teacher_grades anon INSERT'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_teacher_grades' and has_table_privilege('anon',c.oid,'REFERENCES')=false)) then raise exception 'Privilegio incompatible: public.lite_teacher_grades anon REFERENCES'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_teacher_grades' and has_table_privilege('anon',c.oid,'SELECT')=false)) then raise exception 'Privilegio incompatible: public.lite_teacher_grades anon SELECT'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_teacher_grades' and has_table_privilege('anon',c.oid,'TRIGGER')=false)) then raise exception 'Privilegio incompatible: public.lite_teacher_grades anon TRIGGER'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_teacher_grades' and has_table_privilege('anon',c.oid,'TRUNCATE')=false)) then raise exception 'Privilegio incompatible: public.lite_teacher_grades anon TRUNCATE'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_teacher_grades' and has_table_privilege('anon',c.oid,'UPDATE')=false)) then raise exception 'Privilegio incompatible: public.lite_teacher_grades anon UPDATE'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_teacher_grades' and has_table_privilege('authenticated',c.oid,'DELETE')=false)) then raise exception 'Privilegio incompatible: public.lite_teacher_grades authenticated DELETE'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_teacher_grades' and has_table_privilege('authenticated',c.oid,'INSERT')=false)) then raise exception 'Privilegio incompatible: public.lite_teacher_grades authenticated INSERT'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_teacher_grades' and has_table_privilege('authenticated',c.oid,'REFERENCES')=false)) then raise exception 'Privilegio incompatible: public.lite_teacher_grades authenticated REFERENCES'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_teacher_grades' and has_table_privilege('authenticated',c.oid,'SELECT')=false)) then raise exception 'Privilegio incompatible: public.lite_teacher_grades authenticated SELECT'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_teacher_grades' and has_table_privilege('authenticated',c.oid,'TRIGGER')=false)) then raise exception 'Privilegio incompatible: public.lite_teacher_grades authenticated TRIGGER'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_teacher_grades' and has_table_privilege('authenticated',c.oid,'TRUNCATE')=false)) then raise exception 'Privilegio incompatible: public.lite_teacher_grades authenticated TRUNCATE'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_teacher_grades' and has_table_privilege('authenticated',c.oid,'UPDATE')=false)) then raise exception 'Privilegio incompatible: public.lite_teacher_grades authenticated UPDATE'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_teacher_grades' and has_table_privilege('service_role',c.oid,'DELETE')=true)) then raise exception 'Privilegio incompatible: public.lite_teacher_grades service_role DELETE'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_teacher_grades' and has_table_privilege('service_role',c.oid,'INSERT')=true)) then raise exception 'Privilegio incompatible: public.lite_teacher_grades service_role INSERT'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_teacher_grades' and has_table_privilege('service_role',c.oid,'REFERENCES')=true)) then raise exception 'Privilegio incompatible: public.lite_teacher_grades service_role REFERENCES'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_teacher_grades' and has_table_privilege('service_role',c.oid,'SELECT')=true)) then raise exception 'Privilegio incompatible: public.lite_teacher_grades service_role SELECT'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_teacher_grades' and has_table_privilege('service_role',c.oid,'TRIGGER')=true)) then raise exception 'Privilegio incompatible: public.lite_teacher_grades service_role TRIGGER'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_teacher_grades' and has_table_privilege('service_role',c.oid,'TRUNCATE')=true)) then raise exception 'Privilegio incompatible: public.lite_teacher_grades service_role TRUNCATE'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_teacher_grades' and has_table_privilege('service_role',c.oid,'UPDATE')=true)) then raise exception 'Privilegio incompatible: public.lite_teacher_grades service_role UPDATE'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_teacher_podium' and has_table_privilege('anon',c.oid,'DELETE')=false)) then raise exception 'Privilegio incompatible: public.lite_teacher_podium anon DELETE'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_teacher_podium' and has_table_privilege('anon',c.oid,'INSERT')=false)) then raise exception 'Privilegio incompatible: public.lite_teacher_podium anon INSERT'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_teacher_podium' and has_table_privilege('anon',c.oid,'REFERENCES')=false)) then raise exception 'Privilegio incompatible: public.lite_teacher_podium anon REFERENCES'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_teacher_podium' and has_table_privilege('anon',c.oid,'SELECT')=false)) then raise exception 'Privilegio incompatible: public.lite_teacher_podium anon SELECT'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_teacher_podium' and has_table_privilege('anon',c.oid,'TRIGGER')=false)) then raise exception 'Privilegio incompatible: public.lite_teacher_podium anon TRIGGER'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_teacher_podium' and has_table_privilege('anon',c.oid,'TRUNCATE')=false)) then raise exception 'Privilegio incompatible: public.lite_teacher_podium anon TRUNCATE'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_teacher_podium' and has_table_privilege('anon',c.oid,'UPDATE')=false)) then raise exception 'Privilegio incompatible: public.lite_teacher_podium anon UPDATE'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_teacher_podium' and has_table_privilege('authenticated',c.oid,'DELETE')=false)) then raise exception 'Privilegio incompatible: public.lite_teacher_podium authenticated DELETE'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_teacher_podium' and has_table_privilege('authenticated',c.oid,'INSERT')=false)) then raise exception 'Privilegio incompatible: public.lite_teacher_podium authenticated INSERT'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_teacher_podium' and has_table_privilege('authenticated',c.oid,'REFERENCES')=false)) then raise exception 'Privilegio incompatible: public.lite_teacher_podium authenticated REFERENCES'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_teacher_podium' and has_table_privilege('authenticated',c.oid,'SELECT')=false)) then raise exception 'Privilegio incompatible: public.lite_teacher_podium authenticated SELECT'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_teacher_podium' and has_table_privilege('authenticated',c.oid,'TRIGGER')=false)) then raise exception 'Privilegio incompatible: public.lite_teacher_podium authenticated TRIGGER'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_teacher_podium' and has_table_privilege('authenticated',c.oid,'TRUNCATE')=false)) then raise exception 'Privilegio incompatible: public.lite_teacher_podium authenticated TRUNCATE'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_teacher_podium' and has_table_privilege('authenticated',c.oid,'UPDATE')=false)) then raise exception 'Privilegio incompatible: public.lite_teacher_podium authenticated UPDATE'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_teacher_podium' and has_table_privilege('service_role',c.oid,'DELETE')=true)) then raise exception 'Privilegio incompatible: public.lite_teacher_podium service_role DELETE'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_teacher_podium' and has_table_privilege('service_role',c.oid,'INSERT')=true)) then raise exception 'Privilegio incompatible: public.lite_teacher_podium service_role INSERT'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_teacher_podium' and has_table_privilege('service_role',c.oid,'REFERENCES')=true)) then raise exception 'Privilegio incompatible: public.lite_teacher_podium service_role REFERENCES'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_teacher_podium' and has_table_privilege('service_role',c.oid,'SELECT')=true)) then raise exception 'Privilegio incompatible: public.lite_teacher_podium service_role SELECT'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_teacher_podium' and has_table_privilege('service_role',c.oid,'TRIGGER')=true)) then raise exception 'Privilegio incompatible: public.lite_teacher_podium service_role TRIGGER'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_teacher_podium' and has_table_privilege('service_role',c.oid,'TRUNCATE')=true)) then raise exception 'Privilegio incompatible: public.lite_teacher_podium service_role TRUNCATE'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='lite_teacher_podium' and has_table_privilege('service_role',c.oid,'UPDATE')=true)) then raise exception 'Privilegio incompatible: public.lite_teacher_podium service_role UPDATE'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='side_lite_private' and c.relname='lite_cycle_secrets' and has_table_privilege('anon',c.oid,'DELETE')=false)) then raise exception 'Privilegio incompatible: side_lite_private.lite_cycle_secrets anon DELETE'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='side_lite_private' and c.relname='lite_cycle_secrets' and has_table_privilege('anon',c.oid,'INSERT')=false)) then raise exception 'Privilegio incompatible: side_lite_private.lite_cycle_secrets anon INSERT'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='side_lite_private' and c.relname='lite_cycle_secrets' and has_table_privilege('anon',c.oid,'REFERENCES')=false)) then raise exception 'Privilegio incompatible: side_lite_private.lite_cycle_secrets anon REFERENCES'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='side_lite_private' and c.relname='lite_cycle_secrets' and has_table_privilege('anon',c.oid,'SELECT')=false)) then raise exception 'Privilegio incompatible: side_lite_private.lite_cycle_secrets anon SELECT'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='side_lite_private' and c.relname='lite_cycle_secrets' and has_table_privilege('anon',c.oid,'TRIGGER')=false)) then raise exception 'Privilegio incompatible: side_lite_private.lite_cycle_secrets anon TRIGGER'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='side_lite_private' and c.relname='lite_cycle_secrets' and has_table_privilege('anon',c.oid,'TRUNCATE')=false)) then raise exception 'Privilegio incompatible: side_lite_private.lite_cycle_secrets anon TRUNCATE'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='side_lite_private' and c.relname='lite_cycle_secrets' and has_table_privilege('anon',c.oid,'UPDATE')=false)) then raise exception 'Privilegio incompatible: side_lite_private.lite_cycle_secrets anon UPDATE'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='side_lite_private' and c.relname='lite_cycle_secrets' and has_table_privilege('authenticated',c.oid,'DELETE')=false)) then raise exception 'Privilegio incompatible: side_lite_private.lite_cycle_secrets authenticated DELETE'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='side_lite_private' and c.relname='lite_cycle_secrets' and has_table_privilege('authenticated',c.oid,'INSERT')=false)) then raise exception 'Privilegio incompatible: side_lite_private.lite_cycle_secrets authenticated INSERT'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='side_lite_private' and c.relname='lite_cycle_secrets' and has_table_privilege('authenticated',c.oid,'REFERENCES')=false)) then raise exception 'Privilegio incompatible: side_lite_private.lite_cycle_secrets authenticated REFERENCES'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='side_lite_private' and c.relname='lite_cycle_secrets' and has_table_privilege('authenticated',c.oid,'SELECT')=false)) then raise exception 'Privilegio incompatible: side_lite_private.lite_cycle_secrets authenticated SELECT'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='side_lite_private' and c.relname='lite_cycle_secrets' and has_table_privilege('authenticated',c.oid,'TRIGGER')=false)) then raise exception 'Privilegio incompatible: side_lite_private.lite_cycle_secrets authenticated TRIGGER'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='side_lite_private' and c.relname='lite_cycle_secrets' and has_table_privilege('authenticated',c.oid,'TRUNCATE')=false)) then raise exception 'Privilegio incompatible: side_lite_private.lite_cycle_secrets authenticated TRUNCATE'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='side_lite_private' and c.relname='lite_cycle_secrets' and has_table_privilege('authenticated',c.oid,'UPDATE')=false)) then raise exception 'Privilegio incompatible: side_lite_private.lite_cycle_secrets authenticated UPDATE'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='side_lite_private' and c.relname='lite_cycle_secrets' and has_table_privilege('service_role',c.oid,'DELETE')=true)) then raise exception 'Privilegio incompatible: side_lite_private.lite_cycle_secrets service_role DELETE'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='side_lite_private' and c.relname='lite_cycle_secrets' and has_table_privilege('service_role',c.oid,'INSERT')=true)) then raise exception 'Privilegio incompatible: side_lite_private.lite_cycle_secrets service_role INSERT'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='side_lite_private' and c.relname='lite_cycle_secrets' and has_table_privilege('service_role',c.oid,'REFERENCES')=true)) then raise exception 'Privilegio incompatible: side_lite_private.lite_cycle_secrets service_role REFERENCES'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='side_lite_private' and c.relname='lite_cycle_secrets' and has_table_privilege('service_role',c.oid,'SELECT')=true)) then raise exception 'Privilegio incompatible: side_lite_private.lite_cycle_secrets service_role SELECT'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='side_lite_private' and c.relname='lite_cycle_secrets' and has_table_privilege('service_role',c.oid,'TRIGGER')=true)) then raise exception 'Privilegio incompatible: side_lite_private.lite_cycle_secrets service_role TRIGGER'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='side_lite_private' and c.relname='lite_cycle_secrets' and has_table_privilege('service_role',c.oid,'TRUNCATE')=true)) then raise exception 'Privilegio incompatible: side_lite_private.lite_cycle_secrets service_role TRUNCATE'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='side_lite_private' and c.relname='lite_cycle_secrets' and has_table_privilege('service_role',c.oid,'UPDATE')=true)) then raise exception 'Privilegio incompatible: side_lite_private.lite_cycle_secrets service_role UPDATE'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='side_lite_private' and c.relname='lite_teacher_grants' and has_table_privilege('anon',c.oid,'DELETE')=false)) then raise exception 'Privilegio incompatible: side_lite_private.lite_teacher_grants anon DELETE'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='side_lite_private' and c.relname='lite_teacher_grants' and has_table_privilege('anon',c.oid,'INSERT')=false)) then raise exception 'Privilegio incompatible: side_lite_private.lite_teacher_grants anon INSERT'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='side_lite_private' and c.relname='lite_teacher_grants' and has_table_privilege('anon',c.oid,'REFERENCES')=false)) then raise exception 'Privilegio incompatible: side_lite_private.lite_teacher_grants anon REFERENCES'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='side_lite_private' and c.relname='lite_teacher_grants' and has_table_privilege('anon',c.oid,'SELECT')=false)) then raise exception 'Privilegio incompatible: side_lite_private.lite_teacher_grants anon SELECT'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='side_lite_private' and c.relname='lite_teacher_grants' and has_table_privilege('anon',c.oid,'TRIGGER')=false)) then raise exception 'Privilegio incompatible: side_lite_private.lite_teacher_grants anon TRIGGER'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='side_lite_private' and c.relname='lite_teacher_grants' and has_table_privilege('anon',c.oid,'TRUNCATE')=false)) then raise exception 'Privilegio incompatible: side_lite_private.lite_teacher_grants anon TRUNCATE'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='side_lite_private' and c.relname='lite_teacher_grants' and has_table_privilege('anon',c.oid,'UPDATE')=false)) then raise exception 'Privilegio incompatible: side_lite_private.lite_teacher_grants anon UPDATE'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='side_lite_private' and c.relname='lite_teacher_grants' and has_table_privilege('authenticated',c.oid,'DELETE')=false)) then raise exception 'Privilegio incompatible: side_lite_private.lite_teacher_grants authenticated DELETE'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='side_lite_private' and c.relname='lite_teacher_grants' and has_table_privilege('authenticated',c.oid,'INSERT')=false)) then raise exception 'Privilegio incompatible: side_lite_private.lite_teacher_grants authenticated INSERT'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='side_lite_private' and c.relname='lite_teacher_grants' and has_table_privilege('authenticated',c.oid,'REFERENCES')=false)) then raise exception 'Privilegio incompatible: side_lite_private.lite_teacher_grants authenticated REFERENCES'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='side_lite_private' and c.relname='lite_teacher_grants' and has_table_privilege('authenticated',c.oid,'SELECT')=false)) then raise exception 'Privilegio incompatible: side_lite_private.lite_teacher_grants authenticated SELECT'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='side_lite_private' and c.relname='lite_teacher_grants' and has_table_privilege('authenticated',c.oid,'TRIGGER')=false)) then raise exception 'Privilegio incompatible: side_lite_private.lite_teacher_grants authenticated TRIGGER'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='side_lite_private' and c.relname='lite_teacher_grants' and has_table_privilege('authenticated',c.oid,'TRUNCATE')=false)) then raise exception 'Privilegio incompatible: side_lite_private.lite_teacher_grants authenticated TRUNCATE'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='side_lite_private' and c.relname='lite_teacher_grants' and has_table_privilege('authenticated',c.oid,'UPDATE')=false)) then raise exception 'Privilegio incompatible: side_lite_private.lite_teacher_grants authenticated UPDATE'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='side_lite_private' and c.relname='lite_teacher_grants' and has_table_privilege('service_role',c.oid,'DELETE')=false)) then raise exception 'Privilegio incompatible: side_lite_private.lite_teacher_grants service_role DELETE'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='side_lite_private' and c.relname='lite_teacher_grants' and has_table_privilege('service_role',c.oid,'INSERT')=false)) then raise exception 'Privilegio incompatible: side_lite_private.lite_teacher_grants service_role INSERT'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='side_lite_private' and c.relname='lite_teacher_grants' and has_table_privilege('service_role',c.oid,'REFERENCES')=false)) then raise exception 'Privilegio incompatible: side_lite_private.lite_teacher_grants service_role REFERENCES'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='side_lite_private' and c.relname='lite_teacher_grants' and has_table_privilege('service_role',c.oid,'SELECT')=true)) then raise exception 'Privilegio incompatible: side_lite_private.lite_teacher_grants service_role SELECT'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='side_lite_private' and c.relname='lite_teacher_grants' and has_table_privilege('service_role',c.oid,'TRIGGER')=false)) then raise exception 'Privilegio incompatible: side_lite_private.lite_teacher_grants service_role TRIGGER'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='side_lite_private' and c.relname='lite_teacher_grants' and has_table_privilege('service_role',c.oid,'TRUNCATE')=false)) then raise exception 'Privilegio incompatible: side_lite_private.lite_teacher_grants service_role TRUNCATE'; end if;
 if not (exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='side_lite_private' and c.relname='lite_teacher_grants' and has_table_privilege('service_role',c.oid,'UPDATE')=false)) then raise exception 'Privilegio incompatible: side_lite_private.lite_teacher_grants service_role UPDATE'; end if;
 if exists(select 1 from pg_roles where rolname in ('side_lite_api','side_lite_closer')) then raise exception 'Existen roles SIDE-LITE; revisar antes de continuar'; end if;

-- 20261109021458_side_lite_join_rate_limit.sql
 execute $side_migration$
-- Prepared locally only; do not apply to a remote project without review.
-- One bounded counter per verified user. No caller-supplied IP or code is stored.
create table side_lite_private.lite_join_attempt_windows (
  user_id uuid primary key references auth.users(id) on delete cascade,
  window_started_at timestamptz not null,
  attempts integer not null check (attempts between 1 and 11)
);
alter table side_lite_private.lite_join_attempt_windows enable row level security;
revoke all on side_lite_private.lite_join_attempt_windows from public, anon, authenticated;
-- A privileged API role can use this table, but must never be available to the
-- browser. Prefer a dedicated restricted DB role during deployment review.
grant select, insert, update on side_lite_private.lite_join_attempt_windows to service_role;

$side_migration$;

-- 20261109021901_side_lite_early_termination.sql
 execute $side_migration$
-- Local preparation only. ended_at indicates teacher-requested early ending;
-- calculation of an active cycle remains asynchronous and may still be pending.
alter table public.lite_games add column if not exists ended_at timestamptz;

-- Retain the same 120-second server deadline while forbidding a new cycle
-- after early termination, even if a trusted API forgets its own check.
create or replace function side_lite_private.initialize_cycle() returns trigger
language plpgsql set search_path = '' as $$
declare max_cycles integer; game_ended timestamptz;
begin
  select g.cycle_count,g.ended_at into max_cycles,game_ended
    from public.lite_games g where g.id = new.game_id for update;
  if max_cycles is null or new.number > max_cycles or game_ended is not null then
    raise exception 'Invalid or terminated game' using errcode = '23514';
  end if;
  new.starts_at := clock_timestamp();
  new.ends_at := new.starts_at + interval '120 seconds';
  return new;
end $$;

$side_migration$;

-- 20261109175222_side_lite_identity_security.sql
 execute $side_migration$
-- SIDE-LITE only. Prerequisite: reviewed core already exists in this project;
-- never rerun core blindly where its migration history is absent.
-- Fail closed if core relations are missing; ordinary DDL is transactional.
-- Check the current Auth session on every direct Data API request. A signed JWT
-- alone may remain valid after sign-out, administrative ban, or email change.
create function side_lite_private.has_active_identity()
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists (
    select 1 from auth.users u join auth.sessions s on s.user_id = u.id
    where u.id = auth.uid() and u.email_confirmed_at is not null
      and (u.banned_until is null or u.banned_until <= now())
      and s.id::text = coalesce(auth.jwt()->>'session_id', '')
      and (s.not_after is null or s.not_after > now())
  )
$$;
revoke all on function side_lite_private.has_active_identity() from public, anon, authenticated, service_role;
grant execute on function side_lite_private.has_active_identity() to authenticated;

-- Minimal self-only identity for the static login UI; never trusts user metadata
-- for the role and checks the current explicit administrative grant on each call.
create function public.lite_my_identity()
returns table (id uuid, display_name text, role text)
language sql stable security definer set search_path = '' as $$
  select p.id, p.display_name,
    case when exists (
      select 1 from side_lite_private.lite_teacher_grants g
      join auth.users u on u.id = g.user_id
      where g.user_id = p.id and g.revoked_at is null
        and u.email_confirmed_at is not null and lower(u.email) = g.approved_email
    ) then 'teacher' else 'student' end
  from public.lite_profiles p
  where p.id = auth.uid() and side_lite_private.has_active_identity()
$$;
revoke all on function public.lite_my_identity() from public, anon, authenticated, service_role;
grant execute on function public.lite_my_identity() to authenticated;

-- Teacher rights require an explicit current grant and the same verified
-- institutional email. Authentication/session checks are live, not JWT metadata.
create or replace function side_lite_private.is_approved_teacher(p_game uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select side_lite_private.has_active_identity() and exists (
    select 1 from public.lite_games g
    join side_lite_private.lite_teacher_grants t on t.user_id = g.teacher_id
    join auth.users u on u.id = t.user_id
    where g.id = p_game and g.teacher_id = auth.uid() and t.revoked_at is null
      and u.email_confirmed_at is not null and lower(u.email) = t.approved_email
  )
$$;
create or replace function side_lite_private.is_game_student(p_game uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select side_lite_private.has_active_identity() and exists (
    select 1 from public.lite_companies c where c.game_id = p_game and c.student_id = auth.uid()
  )
$$;
create or replace function side_lite_private.owns_company(p_company uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select side_lite_private.has_active_identity() and exists (
    select 1 from public.lite_companies c where c.id = p_company and c.student_id = auth.uid()
  )
$$;

-- A table-level SELECT would expose the join code despite column revocation.
revoke select on public.lite_games from public, anon, authenticated;
revoke select (code) on public.lite_games from public, anon, authenticated;
grant select (id, teacher_id, name, cycle_count, duration_seconds, capital_min, capital_max, costs, enabled_events, created_at, ended_at) on public.lite_games to authenticated;

drop policy profile_self_read on public.lite_profiles;
create policy profile_self_read on public.lite_profiles for select to authenticated using (side_lite_private.has_active_identity() and id = (select auth.uid()));
drop policy profile_self_insert on public.lite_profiles;
create policy profile_self_insert on public.lite_profiles for insert to authenticated with check (side_lite_private.has_active_identity() and id = (select auth.uid()));
drop policy profile_self_update on public.lite_profiles;
create policy profile_self_update on public.lite_profiles for update to authenticated using (side_lite_private.has_active_identity() and id = (select auth.uid())) with check (side_lite_private.has_active_identity() and id = (select auth.uid()));
drop policy stores_read on public.lite_stores;
create policy stores_read on public.lite_stores for select to authenticated using (side_lite_private.has_active_identity());
drop policy events_read on public.lite_events;
create policy events_read on public.lite_events for select to authenticated using (side_lite_private.has_active_identity());
drop policy games_member_read on public.lite_games;
create policy games_member_read on public.lite_games for select to authenticated using (side_lite_private.is_approved_teacher(id) or side_lite_private.is_game_student(id));
drop policy products_member_read on public.lite_products;
create policy products_member_read on public.lite_products for select to authenticated using (side_lite_private.is_approved_teacher(game_id) or side_lite_private.is_game_student(game_id));
drop policy companies_private_read on public.lite_companies;
create policy companies_private_read on public.lite_companies for select to authenticated using ((side_lite_private.has_active_identity() and student_id = (select auth.uid())) or side_lite_private.is_approved_teacher(game_id));
drop policy cycles_member_read on public.lite_cycles;
create policy cycles_member_read on public.lite_cycles for select to authenticated using (side_lite_private.is_approved_teacher(game_id) or side_lite_private.is_game_student(game_id));
drop policy decisions_private_read on public.lite_decisions;
create policy decisions_private_read on public.lite_decisions for select to authenticated using (side_lite_private.owns_company(company_id) or side_lite_private.is_approved_teacher(game_id));
drop policy results_private_read on public.lite_results;
create policy results_private_read on public.lite_results for select to authenticated using (side_lite_private.owns_company(company_id) or side_lite_private.is_approved_teacher(game_id));

$side_migration$;

-- 20261109175405_side_lite_cycle_history.sql
 execute $side_migration$
-- Read-only projections of closed-cycle records, not a transaction ledger.
-- The security_invoker setting preserves the caller's grants and RLS on every
-- underlying table. Numeric fields are emitted only when their JSON type is a
-- number; missing or malformed historic data remains NULL, never silently zero.
create view public.lite_cycle_history with (security_invoker = true) as
select r.id as result_id, r.game_id, r.company_id, r.cycle_id, c.number as cycle_number,
       c.event_id, r.created_at,
       case when jsonb_typeof(r.result->'cashStart') = 'number' then (r.result->>'cashStart')::numeric end as cash_start,
       case when jsonb_typeof(r.result->'cashEnd') = 'number' then (r.result->>'cashEnd')::numeric end as cash_end,
       case when jsonb_typeof(r.result->'sold') = 'number' then (r.result->>'sold')::numeric end as units_sold,
       case when jsonb_typeof(r.result->'demand') = 'number' then (r.result->>'demand')::numeric end as demand,
       case when jsonb_typeof(r.result->'profit') = 'number' then (r.result->>'profit')::numeric end as profit,
       case when jsonb_typeof(r.result->'inventory') = 'array' then r.result->'inventory' end as inventory,
       r.result->>'ruleVersion' as rule_version
from public.lite_results r
join public.lite_cycles c on c.game_id = r.game_id and c.id = r.cycle_id
where c.status = 'closed';
revoke all on public.lite_cycle_history from public, anon, authenticated;
grant select on public.lite_cycle_history to authenticated;

-- Three category totals per result; negative means an outflow of cash.
-- This projection is derived from the committed result; it does not introduce
-- financial writes, recompute game outcomes, or claim individual transactions.
create view public.lite_economic_movements with (security_invoker = true) as
select r.id as result_id, r.game_id, r.company_id, r.cycle_id, c.number as cycle_number,
       movement.category,
       case when jsonb_typeof(r.result->movement.field) = 'number'
            then movement.sign * (r.result->>movement.field)::numeric end as amount,
       r.created_at
from public.lite_results r
join public.lite_cycles c on c.game_id = r.game_id and c.id = r.cycle_id
cross join (values ('purchase','purchase',-1), ('marketing','marketing',-1), ('revenue','revenue',1))
  as movement(category,field,sign)
where c.status = 'closed';
revoke all on public.lite_economic_movements from public, anon, authenticated;
grant select on public.lite_economic_movements to authenticated;

$side_migration$;

-- 20261109182006_side_lite_lock_active_identity.sql
 execute $side_migration$
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

$side_migration$;

-- 20261109182051_side_lite_server_roles.sql
 execute $side_migration$
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

$side_migration$;

-- 20261109204458_restrict_legacy_tables.sql
 execute $side_migration$
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

$side_migration$;

-- 20261109205734_restricted_auth_access.sql
 execute $side_migration$
-- The trusted API cannot assume USAGE on Supabase's auth schema. These
-- narrowly scoped definer functions expose only authorization decisions and
-- profile fields, never raw Auth rows. Their owner must have legitimate read
-- and row-lock privileges on Auth; test that precondition on the target stack.
create function side_lite_private.api_identity(p_user uuid, p_session uuid)
returns table (id uuid, display_name text, email_verified boolean, session_active boolean, banned boolean, teacher_authorized boolean)
language sql stable security definer set search_path = '' as $$
  select p.id, p.display_name, u.email_confirmed_at is not null,
    exists(select 1 from auth.sessions s where s.id=p_session and s.user_id=u.id and (s.not_after is null or s.not_after>now())),
    u.banned_until is not null and u.banned_until>now(),
    exists(select 1 from side_lite_private.lite_teacher_grants g where g.user_id=u.id and g.revoked_at is null
      and lower(u.email)=g.approved_email and u.email_confirmed_at is not null)
  from auth.users u left join public.lite_profiles p on p.id=u.id where u.id=p_user
$$;

create function side_lite_private.api_create_profile(p_user uuid, p_session uuid, p_name text)
returns table (id uuid, display_name text)
language plpgsql security definer set search_path = '' as $$
begin
  if char_length(btrim(coalesce(p_name,''))) not between 2 and 80 then return; end if;
  perform 1 from auth.users u join auth.sessions s on s.user_id=u.id and s.id=p_session
    where u.id=p_user and u.email_confirmed_at is not null
      and (u.banned_until is null or u.banned_until<=clock_timestamp())
      and (s.not_after is null or s.not_after>clock_timestamp()) for share of u,s;
  if not found then return; end if;
  return query insert into public.lite_profiles as p(id,display_name) values(p_user,btrim(p_name))
    on conflict on constraint lite_profiles_pkey do nothing returning p.id,p.display_name;
end $$;

create function side_lite_private.api_lock_teacher(p_user uuid, p_session uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if not side_lite_private.lock_active_identity(p_user,p_session) then return false; end if;
  perform 1 from side_lite_private.lite_teacher_grants g join auth.users u on u.id=g.user_id
    where g.user_id=p_user and g.revoked_at is null and u.email_confirmed_at is not null
      and lower(u.email)=g.approved_email for share of g;
  return found;
end $$;

revoke all on function side_lite_private.api_identity(uuid,uuid),
  side_lite_private.api_create_profile(uuid,uuid,text), side_lite_private.api_lock_teacher(uuid,uuid)
  from public, anon, authenticated, service_role;
grant execute on function side_lite_private.api_identity(uuid,uuid),
  side_lite_private.api_create_profile(uuid,uuid,text), side_lite_private.api_lock_teacher(uuid,uuid)
  to side_lite_api;
-- Direct Auth grants are unnecessary even where the platform permits them.
revoke select (id,email,email_confirmed_at,banned_until) on auth.users from side_lite_api;
revoke select (id,user_id,not_after) on auth.sessions from side_lite_api;
revoke usage on schema auth from side_lite_api;
-- A grant made by the schema owner may not be revocable by this migration's
-- executor. Do not silently continue with a more privileged API role.
do $$ begin
  if has_schema_privilege('side_lite_api','auth','USAGE') then
    raise exception 'side_lite_api must not have USAGE on auth; revoke it as schema owner before applying';
  end if;
end $$;

$side_migration$;

-- 20261110004101_guest_session.sql
 execute $side_migration$
-- SIDE-LITE guest identities: reviewed local preparation only.
-- Anonymous Auth must remain disabled until rate limiting/CAPTCHA and all
-- authorization tests have been verified on the target environment.
alter table public.lite_companies add column brand_name text
  check (brand_name is null or char_length(btrim(brand_name)) between 2 and 80);
-- Prevent two different identities claiming the same legal company in a game.
-- The migration deliberately fails if existing data has such collisions.
create unique index lite_company_game_name_unique on public.lite_companies(game_id, lower(btrim(name)));
create table side_lite_private.lite_guest_recovery (
  company_id uuid primary key references public.lite_companies(id) on delete cascade,
  secret_hash bytea not null unique check(octet_length(secret_hash)=32),
  created_at timestamptz not null default now()
);
alter table side_lite_private.lite_guest_recovery enable row level security;
revoke all on side_lite_private.lite_guest_recovery from public, anon, authenticated, service_role;
grant insert on side_lite_private.lite_guest_recovery to side_lite_api;
-- The server controls this transition after locking and checking the recovery
-- credential; never grant UPDATE to an authenticated browser role.
create or replace function side_lite_private.lock_active_identity(p_user uuid, p_session uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  perform 1 from auth.users u join auth.sessions s on s.user_id=u.id and s.id=p_session
    join public.lite_profiles p on p.id=u.id
    where u.id=p_user and (u.email_confirmed_at is not null or u.is_anonymous is true)
      and (u.banned_until is null or u.banned_until<=clock_timestamp())
      and (s.not_after is null or s.not_after>clock_timestamp()) for share of u,s,p;
  return found;
end $$;
-- is_anonymous is returned from Auth itself; middleware compares it with the
-- signed JWT and never trusts user metadata for identity or authorization.
drop function side_lite_private.api_identity(uuid,uuid);
create function side_lite_private.api_identity(p_user uuid, p_session uuid)
returns table (id uuid, display_name text, email_verified boolean, session_active boolean, banned boolean, teacher_authorized boolean, is_anonymous boolean)
language sql stable security definer set search_path='' as $$
  select p.id,p.display_name,u.email_confirmed_at is not null,
    exists(select 1 from auth.sessions s where s.id=p_session and s.user_id=u.id and (s.not_after is null or s.not_after>now())),
    u.banned_until is not null and u.banned_until>now(),
    exists(select 1 from side_lite_private.lite_teacher_grants g where g.user_id=u.id and g.revoked_at is null
      and lower(u.email)=g.approved_email and u.email_confirmed_at is not null and u.is_anonymous is false),
    u.is_anonymous
  from auth.users u left join public.lite_profiles p on p.id=u.id where u.id=p_user
$$;
revoke all on function side_lite_private.api_identity(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function side_lite_private.api_identity(uuid,uuid) to side_lite_api;
create or replace function side_lite_private.api_create_profile(p_user uuid,p_session uuid,p_name text)
returns table (id uuid,display_name text) language plpgsql security definer set search_path='' as $$
begin
  if char_length(btrim(coalesce(p_name,''))) not between 2 and 80 then return; end if;
  perform 1 from auth.users u join auth.sessions s on s.user_id=u.id and s.id=p_session
    where u.id=p_user and (u.email_confirmed_at is not null or u.is_anonymous is true)
      and (u.banned_until is null or u.banned_until<=clock_timestamp())
      and (s.not_after is null or s.not_after>clock_timestamp()) for share of u,s;
  if not found then return; end if;
  return query insert into public.lite_profiles as p(id,display_name) values(p_user,btrim(p_name))
    on conflict on constraint lite_profiles_pkey do nothing returning p.id,p.display_name;
end $$;
create or replace function side_lite_private.has_active_identity()
returns boolean language sql stable security definer set search_path='' as $$
  select auth.uid() is not null and exists (
    select 1 from auth.users u join auth.sessions s on s.user_id=u.id
    where u.id=auth.uid()
      and (u.email_confirmed_at is not null or (u.is_anonymous is true and coalesce((auth.jwt()->>'is_anonymous')::boolean,false)))
      and (u.banned_until is null or u.banned_until<=now())
      and s.id::text=coalesce(auth.jwt()->>'session_id','') and (s.not_after is null or s.not_after>now())
  )
$$;

-- Recovery is limited to a verified anonymous session and requires possession
-- of a high-entropy capability. The API cannot directly reassign student_id.
create function side_lite_private.api_recover_guest(p_user uuid,p_session uuid,p_code text,p_hash bytea)
returns table(id uuid,game_id uuid,name text) language plpgsql security definer set search_path='' as $$
declare target uuid;
begin
  if not side_lite_private.lock_active_identity(p_user,p_session) then return; end if;
  if not exists(select 1 from auth.users u where u.id=p_user and u.is_anonymous is true) then return; end if;
  select co.id into target from public.lite_companies co join public.lite_games g on g.id=co.game_id
    join side_lite_private.lite_guest_recovery r on r.company_id=co.id
    join auth.users owner on owner.id=co.student_id and owner.is_anonymous is true
    where g.code=p_code and r.secret_hash=p_hash for update of co;
  if target is null then return; end if;
  return query update public.lite_companies co set student_id=p_user where co.id=target returning co.id,co.game_id,co.name;
end $$;
revoke all on function side_lite_private.api_recover_guest(uuid,uuid,text,bytea) from public,anon,authenticated,service_role;
grant execute on function side_lite_private.api_recover_guest(uuid,uuid,text,bytea) to side_lite_api;

$side_migration$;

-- 20261110004117_side_lite_security_mfa.sql
 execute $side_migration$
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

$side_migration$;

-- 20261110004755_guest_recovery_rotate.sql
 execute $side_migration$
-- Rotate the recovery capability atomically with the ownership transfer.
-- Old capabilities cannot be used again after a successful transfer.
drop function side_lite_private.api_recover_guest(uuid,uuid,text,bytea);
create function side_lite_private.api_recover_guest(p_user uuid,p_session uuid,p_code text,p_hash bytea,p_new_hash bytea)
returns table(id uuid,game_id uuid,name text) language plpgsql security definer set search_path='' as $$
declare target uuid;
begin
  if p_hash is null or p_new_hash is null or octet_length(p_hash)<>32 or octet_length(p_new_hash)<>32 or p_hash=p_new_hash then return; end if;
  if not side_lite_private.lock_active_identity(p_user,p_session) then return; end if;
  if not exists(select 1 from auth.users u where u.id=p_user and u.is_anonymous is true) then return; end if;
  select co.id into target from public.lite_companies co join public.lite_games g on g.id=co.game_id
    join side_lite_private.lite_guest_recovery r on r.company_id=co.id
    join auth.users owner on owner.id=co.student_id and owner.is_anonymous is true
    where g.code=p_code and r.secret_hash=p_hash for update of co,r;
  if target is null then return; end if;
  update side_lite_private.lite_guest_recovery set secret_hash=p_new_hash where company_id=target;
  return query update public.lite_companies co set student_id=p_user where co.id=target returning co.id,co.game_id,co.name;
end $$;
revoke all on function side_lite_private.api_recover_guest(uuid,uuid,text,bytea,bytea) from public,anon,authenticated,service_role;
grant execute on function side_lite_private.api_recover_guest(uuid,uuid,text,bytea,bytea) to side_lite_api;

$side_migration$;

-- 20261110005110_side_lite_teacher_podium.sql
 execute $side_migration$
-- SIDE-LITE private podium. No browser-facing privileges or direct Data API
-- policies; only the authenticated, membership-checking API may access it.
create table side_lite_private.teacher_grades (
 game_id uuid not null,
 company_id uuid not null,
 grade numeric(4,2) not null check(grade between 0 and 20),
 updated_at timestamptz not null default now(),
 primary key(game_id,company_id),
 foreign key(game_id,company_id) references public.lite_companies(game_id,id) on delete cascade
);
create table side_lite_private.teacher_podium (
 game_id uuid primary key references public.lite_games(id) on delete cascade,
 reason text not null check(char_length(reason)<=1000),
 scheduled_at timestamptz not null,
 published_snapshot jsonb not null check(jsonb_typeof(published_snapshot)='array'),
 created_at timestamptz not null default now()
);
alter table side_lite_private.teacher_grades enable row level security;
alter table side_lite_private.teacher_podium enable row level security;
revoke all on side_lite_private.teacher_grades,side_lite_private.teacher_podium from public,anon,authenticated,service_role;
grant select,insert,update on side_lite_private.teacher_grades to side_lite_api;
grant select,insert,update,delete on side_lite_private.teacher_podium to side_lite_api;

$side_migration$;

 -- Copy historical teacher grades and publication without deleting originals.
 if to_regclass('public.lite_teacher_grades') is not null then
   insert into side_lite_private.teacher_grades(game_id,company_id,grade,updated_at)
     select game_id,company_id,grade,updated_at from public.lite_teacher_grades;
 end if;
 if to_regclass('public.lite_teacher_podium') is not null then
   insert into side_lite_private.teacher_podium(game_id,reason,scheduled_at,published_snapshot,created_at)
     select game_id,reason,scheduled_at,published_snapshot,created_at from public.lite_teacher_podium;
 end if;

-- 20261110005150_guest_join_retry.sql
 execute $side_migration$
-- Retry a join only for the same live anonymous identity AND same capability.
-- This does not expose hashes or give the API unrestricted SELECT on them.
create function side_lite_private.api_find_guest_join(p_user uuid,p_session uuid,p_game uuid,p_hash bytea)
returns table(id uuid,game_id uuid,student_id uuid,name text,brand_name text,store_id uuid,initial_capital integer,cash integer,inventory jsonb)
language plpgsql security definer set search_path='' as $$
begin
  if not side_lite_private.lock_active_identity(p_user,p_session) then return; end if;
  if not exists(select 1 from auth.users u where u.id=p_user and u.is_anonymous is true) then return; end if;
  return query select co.id,co.game_id,co.student_id,co.name,co.brand_name,co.store_id,co.initial_capital,co.cash,co.inventory
  from public.lite_companies co join side_lite_private.lite_guest_recovery r on r.company_id=co.id
  where co.student_id=p_user and co.game_id=p_game and r.secret_hash=p_hash;
end $$;
revoke all on function side_lite_private.api_find_guest_join(uuid,uuid,uuid,bytea) from public,anon,authenticated,service_role;
grant execute on function side_lite_private.api_find_guest_join(uuid,uuid,uuid,bytea) to side_lite_api;

$side_migration$;

-- 20261110024228_side_lite_join_game_limit.sql
 execute $side_migration$
-- Defense in depth: shared per-code admission budgets across anonymous identities.
-- Trusted-edge IP throttling and Auth CAPTCHA are still required independently.
create table side_lite_private.lite_admission_code_windows (
 code_hash bytea primary key check(octet_length(code_hash)=32),
 window_started_at timestamptz not null,
 attempts integer not null check(attempts between 1 and 121)
);
alter table side_lite_private.lite_admission_code_windows enable row level security;
revoke all on side_lite_private.lite_admission_code_windows from public,anon,authenticated,service_role;
grant select,insert,update on side_lite_private.lite_admission_code_windows to side_lite_api;

$side_migration$;
 insert into side_lite_private.integration_revisions(revision) values ('side-lite-incremental-20261110-v1');
end
$side_upgrade$;

commit;
