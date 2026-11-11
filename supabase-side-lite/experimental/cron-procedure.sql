-- Invoker procedure, called as a top-level CALL by pg_cron. Each game commits
-- independently so locks and successful closes do not wait for the whole sweep.
create or replace procedure pg_temp.side_cron_sweep()
language plpgsql as $$
declare cy record;
begin
  for cy in select id,game_id from public.lite_cycles where status='open' and paused_at is null
    and ends_at<=pg_catalog.clock_timestamp() order by ends_at,id loop
    begin
      perform pg_temp.side_close_one(cy.game_id);
    exception when others then
      raise warning 'SIDE-LITE cycle close failed: cycle %, SQLSTATE %', cy.id, sqlstate;
    end;
    commit;
  end loop;
end $$;
