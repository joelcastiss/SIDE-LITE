-- Local preparation only. ended_at indicates teacher-requested early ending;
-- calculation of an active cycle remains asynchronous and may still be pending.
alter table public.lite_games add column ended_at timestamptz;

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
