-- Experimental only: temporary functions, no deployment or grants.
create or replace function pg_temp.side_close_one(p_game uuid default null)
returns uuid language plpgsql set search_path = '' as $$
declare cy record; co record; d record; g record; ev jsonb; answer jsonb;
begin
  select c.id,c.game_id,c.event_id,s.seed into cy
    from public.lite_cycles c left join side_lite_private.lite_cycle_secrets s on s.cycle_id=c.id
    where c.status='open' and c.paused_at is null and c.ends_at<=clock_timestamp()
      and (p_game is null or c.game_id=p_game)
    order by c.ends_at,c.id for update of c skip locked limit 1;
  if not found then return null; end if;
  if cy.seed is null then raise exception 'missing cycle secret'; end if;
  select id,costs into strict g from public.lite_games where id=cy.game_id;
  if cy.event_id is not null then select effect into strict ev from public.lite_events where id=cy.event_id; end if;
  for co in select id,cash,inventory from public.lite_companies where game_id=g.id order by id for update loop
    select quality,quantity,price,marketing_amount into d from public.lite_decisions
      where game_id=g.id and cycle_id=cy.id and company_id=co.id and confirmed;
    answer := pg_temp.side_engine_v2(co.cash,co.inventory,
      case when found then jsonb_build_object('quality',d.quality,'quantity',d.quantity,'price',d.price,'marketingAmount',d.marketing_amount) else null end,
      g.costs,ev,cy.seed::text,co.id::text);
    insert into public.lite_results(game_id,cycle_id,company_id,result) values(g.id,cy.id,co.id,answer);
    update public.lite_companies set cash=(answer->>'cashEnd')::integer,inventory=answer->'inventory' where id=co.id and game_id=g.id;
  end loop;
  update public.lite_cycles set status='closed' where id=cy.id and status='open';
  return cy.id;
end $$;
