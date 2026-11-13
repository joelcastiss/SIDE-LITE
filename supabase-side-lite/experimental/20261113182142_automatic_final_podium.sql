-- The final snapshot is separate from the teacher's manual publication.
create table side_lite_private.final_podium (
  game_id uuid primary key references public.lite_games(id) on delete cascade,
  cycle_id uuid not null references public.lite_cycles(id) on delete cascade,
  ranking jsonb not null check (jsonb_typeof(ranking) = 'array'),
  published_at timestamptz not null default clock_timestamp()
);
alter table side_lite_private.final_podium enable row level security;
revoke all on side_lite_private.final_podium from public, anon, authenticated, service_role;
grant select on side_lite_private.final_podium to side_lite_api;
grant select, insert on side_lite_private.final_podium to side_lite_closer;
create policy final_podium_api_read on side_lite_private.final_podium for select to side_lite_api using (true);
create policy final_podium_closer_read on side_lite_private.final_podium for select to side_lite_closer using (true);
create policy final_podium_closer_insert on side_lite_private.final_podium for insert to side_lite_closer with check (true);

-- A failed publication rolls back the entire close. The existing cron sweep
-- retries the still-open cycle, so no partial results can become visible.
create function side_lite_private.publish_final_podium() returns trigger
language plpgsql set search_path = '' as $$
declare expected integer; actual integer; snapshot jsonb;
begin
  if new.status <> 'closed' or old.status = 'closed' or not exists (
    select 1 from public.lite_games g where g.id = new.game_id and g.cycle_count = new.number
  ) then return new; end if;
  select count(*) into expected from public.lite_companies where game_id = new.game_id;
  select count(*) into actual from public.lite_results where game_id = new.game_id and cycle_id = new.id;
  if expected = 0 or actual <> expected or exists (
    select 1 from public.lite_companies c where c.game_id = new.game_id and not exists (
      select 1 from public.lite_results r where r.game_id = c.game_id and r.cycle_id = new.id and r.company_id = c.id
    )
  ) then raise exception 'Incomplete final cycle results'; end if;
  select jsonb_agg(jsonb_build_object('companyId', ranked.id, 'name', ranked.name,
    'returnPercent', ranked.return_percent, 'cash', ranked.cash) order by ranked.return_percent desc, ranked.cash desc, ranked.name)
  into snapshot from (
    select c.id, c.name, c.cash,
      100.0 * (c.cash + coalesce((select sum((b->>'quantity')::numeric * (b->>'unitCost')::numeric)
        from jsonb_array_elements(c.inventory) b), 0) - c.initial_capital) / c.initial_capital as return_percent
    from public.lite_companies c where c.game_id = new.game_id
  ) ranked;
  insert into side_lite_private.final_podium(game_id, cycle_id, ranking)
    values(new.game_id, new.id, snapshot) on conflict (game_id) do nothing;
  return new;
end $$;
revoke all on function side_lite_private.publish_final_podium() from public, anon, authenticated, service_role;
grant execute on function side_lite_private.publish_final_podium() to side_lite_closer;
create trigger side_lite_publish_final_podium after update of status on public.lite_cycles
for each row execute function side_lite_private.publish_final_podium();
