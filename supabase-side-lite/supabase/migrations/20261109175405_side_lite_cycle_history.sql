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
