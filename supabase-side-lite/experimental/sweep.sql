-- Experimental only: one failed cycle is rolled back without starving others.
create or replace function pg_temp.side_sweep()
returns jsonb language plpgsql set search_path = '' as $$
declare cy record; closed_id uuid; closed_count integer := 0; failed_count integer := 0;
begin
  for cy in select id,game_id from public.lite_cycles where status='open' and paused_at is null
    and ends_at<=clock_timestamp() order by ends_at,id loop
    begin
      closed_id := pg_temp.side_close_one(cy.game_id);
      if closed_id is not null then closed_count := closed_count + 1; end if;
    exception when others then
      failed_count := failed_count + 1;
      raise warning 'SIDE-LITE cycle close failed: cycle %, SQLSTATE %', cy.id, sqlstate;
    end;
  end loop;
  return jsonb_build_object('closed',closed_count,'failed',failed_count);
end $$;
