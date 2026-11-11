-- Experimental parity candidate only. Do not deploy or use for official closes.
create or replace function pg_temp.side_engine_v2(p_cash bigint, p_stock jsonb, p_decision jsonb,
  p_costs jsonb, p_event jsonb, p_seed text, p_company text)
returns jsonb language plpgsql set search_path = '' as $$
declare
  h bigint := 2166136261; key text := p_seed || ':' || p_company; i integer;
  v double precision; quality text; quantity bigint; price bigint; marketing bigint;
  unit_cost bigint; purchase bigint; demand bigint; sold bigint; available bigint := 0;
  left_to_sell bigint; consumed bigint; cost_of_sales bigint := 0; revenue bigint; cash_end bigint;
  stock jsonb := coalesce(p_stock,'[]'::jsonb); remaining_stock jsonb := '[]'::jsonb; batch jsonb;
  quality_factor double precision; demand_factor double precision; purchase_factor double precision; p_marketing_factor double precision;
begin
  if p_seed is null or p_company is null then raise exception 'missing seed'; end if;
  if p_decision is null then
    return jsonb_build_object('cashStart',p_cash,'cashEnd',p_cash,'purchase',0,'marketing',0,
      'revenue',0,'costOfSales',0,'profit',0,'sold',0,'demand',0,'inventory',stock,'event',p_event,'ruleVersion',2);
  end if;
  for i in 1..length(key) loop
    h := ((h # ascii(substr(key,i,1))::bigint) * 16777619) % 4294967296;
  end loop;
  v := 0.95::float8 + (h % 101)::float8 / 1000::float8;
  quality := p_decision->>'quality'; quantity := (p_decision->>'quantity')::bigint;
  price := (p_decision->>'price')::bigint; marketing := (p_decision->>'marketingAmount')::bigint;
  quality_factor := case quality when 'basic' then 0.85::float8 when 'standard' then 1::float8 when 'premium' then 1.18::float8 else null end;
  if quality_factor is null or quantity < 0 or price < 1 or marketing < 0 or (marketing > 0 and marketing < 200) or marketing > 10000 then raise exception 'invalid decision'; end if;
  select factor into strict p_marketing_factor from pg_temp.side_marketing_factors where amount=marketing;
  demand_factor := coalesce((p_event->>'demand')::float8,1::float8);
  purchase_factor := coalesce((p_event->>'purchase')::float8,1::float8);
  unit_cost := floor((p_costs->>quality)::float8 * purchase_factor + 0.5)::bigint;
  purchase := quantity * unit_cost;
  if p_cash < purchase + marketing then raise exception 'insufficient cash'; end if;
  if quantity > 0 then stock := stock || jsonb_build_array(jsonb_build_object('quantity',quantity,'unitCost',unit_cost)); end if;
  demand := floor(300::float8 * greatest(0.1::float8,least(2::float8,100::float8/price::float8)) * quality_factor * p_marketing_factor * demand_factor * v)::bigint;
  for batch in select value from jsonb_array_elements(stock) loop
    available := available + (batch->>'quantity')::bigint;
  end loop;
  sold := least(demand,available); left_to_sell := sold;
  for batch in select value from jsonb_array_elements(stock) loop
    consumed := least(left_to_sell,(batch->>'quantity')::bigint);
    cost_of_sales := cost_of_sales + consumed*(batch->>'unitCost')::bigint;
    quantity := (batch->>'quantity')::bigint - consumed; left_to_sell := left_to_sell - consumed;
    if quantity > 0 then remaining_stock := remaining_stock || jsonb_build_array(jsonb_build_object('quantity',quantity,'unitCost',(batch->>'unitCost')::bigint)); end if;
  end loop;
  revenue := sold*price; cash_end := p_cash-purchase-marketing+revenue;
  return jsonb_build_object('cashStart',p_cash,'cashEnd',cash_end,'purchase',purchase,'unitCost',unit_cost,
    'marketing',marketing,'revenue',revenue,'costOfSales',cost_of_sales,'profit',revenue-cost_of_sales-marketing,
    'sold',sold,'demand',demand,'inventory',remaining_stock,'event',p_event,'ruleVersion',2);
end $$;
