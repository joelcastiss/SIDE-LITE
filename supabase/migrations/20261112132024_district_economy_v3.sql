-- Versioned district economy; existing games retain legacy-v2.
-- Experimental v3 demand allocation; not used by the official closer.
create or replace function side_lite_private.side_market_demand_v3(p_base integer, p_shares float8[], p_companies jsonb, p_factor float8, p_event jsonb)
returns jsonb language plpgsql set search_path = '' as $$
declare
  total integer := floor(p_base*p_factor); pools integer[]; raw float8[]; remaining integer;
  weights float8[] := array[1,1,1]::float8[]; item jsonb; ids text[] := array[]::text[];
  all_weights float8[] := array[]::float8[]; w float8; price_factor float8; market_factor float8;
  quality text; v_amount integer; idx integer := 0; seg integer; i integer; answer jsonb := '{}'::jsonb; allocation integer;
begin
  if p_base<0 or p_factor<0 or array_length(p_shares,1)<>3 or abs(p_shares[1]+p_shares[2]+p_shares[3]-1)>1e-9 or
    p_shares[1]<=0 or p_shares[2]<=0 or p_shares[3]<=0 then raise exception 'invalid market'; end if;
  raw:=array[p_shares[1]*total,p_shares[2]*total,p_shares[3]*total];
  pools:=array[floor(raw[1])::int,floor(raw[2])::int,floor(raw[3])::int];
  remaining:=total-pools[1]-pools[2]-pools[3];
  for i in select x from generate_series(1,3) x order by raw[x]-pools[x] desc,x loop
    if remaining>0 then pools[i]:=pools[i]+1; remaining:=remaining-1; end if;
  end loop;
  for item in select value from jsonb_array_elements(p_companies) loop
    if item->>'id' is null or item->>'id'='' or item->>'id'=any(ids) then raise exception 'invalid company'; end if;
    ids:=array_append(ids,item->>'id');
    if item->'decision' is null or item->'decision'='null'::jsonb then all_weights:=all_weights || array[0,0,0]::float8[]; continue; end if;
    quality:=item->'decision'->>'quality'; v_amount:=(item->'decision'->>'marketingAmount')::integer;
    if quality not in ('basic','standard','premium') or (item->'decision'->>'price')::integer<1 then raise exception 'invalid decision'; end if;
    select factor into strict market_factor from side_lite_private.side_marketing_factors where side_marketing_factors.amount=v_amount;
    price_factor:=power(greatest(.1::float8,least(2::float8,100::float8/(item->'decision'->>'price')::float8)),coalesce((p_event->>'priceSensitivity')::float8,1));
    market_factor:=1+(market_factor-1)*coalesce((p_event->>'marketingStrength')::float8,1);
    for seg in 1..3 loop
      w:=(case quality when 'basic' then (array[1,.35,.12]::float8[])[seg] when 'standard' then (array[.35,1,.35]::float8[])[seg] else (array[.12,.35,1]::float8[])[seg] end)*price_factor*market_factor*coalesce((p_event->'quality'->>quality)::float8,1);
      weights[seg]:=weights[seg]+w; all_weights:=array_append(all_weights,w);
    end loop;
  end loop;
  for i in 1..coalesce(array_length(ids,1),0) loop
    allocation:=0;
    for seg in 1..3 loop if weights[seg]>0 then allocation:=allocation+floor(pools[seg]*all_weights[(i-1)*3+seg]/weights[seg]+1e-9::float8)::integer; end if; end loop;
    answer:=answer||jsonb_build_object(ids[i],allocation);
  end loop;
  return answer;
end $$;

create or replace function side_lite_private.side_engine_v3(p_cash bigint, p_stock jsonb, p_decision jsonb,
  p_costs jsonb, p_event jsonb, p_seed text, p_company text, p_demand bigint, p_district text)
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
      'revenue',0,'costOfSales',0,'profit',0,'sold',0,'demand',0,'inventory',stock,'event',p_event,'ruleVersion',3,'companyId',p_company,'districtId',p_district);
  end if;
  for i in 1..length(key) loop
    h := ((h # ascii(substr(key,i,1))::bigint) * 16777619) % 4294967296;
  end loop;
  v := 0.95::float8 + (h % 101)::float8 / 1000::float8;
  quality := p_decision->>'quality'; quantity := (p_decision->>'quantity')::bigint;
  price := (p_decision->>'price')::bigint; marketing := (p_decision->>'marketingAmount')::bigint;
  quality_factor := case quality when 'basic' then 0.85::float8 when 'standard' then 1::float8 when 'premium' then 1.18::float8 else null end;
  if quality_factor is null or quantity < 0 or price < 1 or marketing < 0 or (marketing > 0 and marketing < 200) or marketing > 10000 then raise exception 'invalid decision'; end if;
  select factor into strict p_marketing_factor from side_lite_private.side_marketing_factors where amount=marketing;
  demand_factor := coalesce((p_event->>'demand')::float8,1::float8);
  purchase_factor := coalesce((p_event->>'purchase')::float8,1::float8);
  unit_cost := floor((p_costs->>quality)::float8 * purchase_factor + 0.5)::bigint;
  purchase := quantity * unit_cost;
  if p_cash < purchase + marketing then raise exception 'insufficient cash'; end if;
  if quantity > 0 then stock := stock || jsonb_build_array(jsonb_build_object('quantity',quantity,'unitCost',unit_cost)); end if;
  demand := p_demand;
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
    'sold',sold,'demand',demand,'inventory',remaining_stock,'event',p_event,'ruleVersion',3,'companyId',p_company,'districtId',p_district);
end $$;


-- Existing rows stay on v2. New games must explicitly select district-v3.
alter table public.lite_game_markets drop constraint lite_game_markets_rule_version_check;
alter table public.lite_game_markets add constraint lite_game_markets_rule_version_check check(rule_version in ('legacy-v2','district-v3'));
create or replace function side_lite_private.side_close_one(p_game uuid default null)
returns uuid language plpgsql set search_path = '' as $$
declare cy record; co record; d record; g record; market record; ev jsonb; answer jsonb; entrants jsonb; allocation jsonb; decision jsonb;
begin
 select c.id,c.game_id,c.event_id,s.seed into cy from public.lite_cycles c
 left join side_lite_private.lite_cycle_secrets s on s.cycle_id=c.id
 where c.status='open' and c.paused_at is null and c.ends_at<=clock_timestamp() and (p_game is null or c.game_id=p_game)
 order by c.ends_at,c.id for update of c skip locked limit 1;
 if not found then return null; end if;
 if cy.seed is null then raise exception 'missing cycle secret'; end if;
 select id,costs into strict g from public.lite_games where id=cy.game_id;
 if cy.event_id is not null then select effect into strict ev from public.lite_events where id=cy.event_id; end if;
 -- All decisions and inventory are settled atomically from the same cycle.
 perform id from public.lite_companies where game_id=g.id order by id for update;
 for co in select id,cash,inventory from public.lite_companies where game_id=g.id order by id loop
  select quality,quantity,price,marketing_amount into d from public.lite_decisions where game_id=g.id and cycle_id=cy.id and company_id=co.id and confirmed;
  decision:=case when found then jsonb_build_object('quality',d.quality,'quantity',d.quantity,'price',d.price,'marketingAmount',d.marketing_amount) else null end;
  select gm.rule_version,cm.district_id,gd.base_demand,gd.economic_share,gd.standard_share,gd.premium_share into market
   from public.lite_game_markets gm left join public.lite_company_markets cm on cm.game_id=gm.game_id and cm.company_id=co.id
   left join public.lite_game_districts gd on gd.game_id=cm.game_id and gd.district_id=cm.district_id where gm.game_id=g.id;
  if market.rule_version='district-v3' then
   if market.district_id is null then raise exception 'missing district'; end if;
   select jsonb_agg(jsonb_build_object('id',c.id::text,'decision',case when dc.confirmed then jsonb_build_object('quality',dc.quality,'quantity',dc.quantity,'price',dc.price,'marketingAmount',dc.marketing_amount) else null end) order by c.id)
   into entrants from public.lite_companies c join public.lite_company_markets cm on cm.company_id=c.id and cm.game_id=c.game_id
   left join public.lite_decisions dc on dc.company_id=c.id and dc.cycle_id=cy.id and dc.game_id=g.id
   where c.game_id=g.id and cm.district_id=market.district_id;
   allocation:=side_lite_private.side_market_demand_v3(market.base_demand,array[market.economic_share::float8,market.standard_share::float8,market.premium_share::float8],entrants,coalesce((ev->>'demand')::float8,1),ev);
   answer:=side_lite_private.side_engine_v3(co.cash,co.inventory,decision,g.costs,ev,cy.seed::text,co.id::text,(allocation->>co.id::text)::bigint,market.district_id);
  else
   answer:=side_lite_private.side_engine_v2(co.cash,co.inventory,decision,g.costs,ev,cy.seed::text,co.id::text);
  end if;
  insert into public.lite_results(game_id,cycle_id,company_id,result) values(g.id,cy.id,co.id,answer);
  update public.lite_companies set cash=(answer->>'cashEnd')::integer,inventory=answer->'inventory' where id=co.id and game_id=g.id;
 end loop;
 update public.lite_cycles set status='closed' where id=cy.id and status='open';
 return cy.id;
end $$;
revoke all on function side_lite_private.side_market_demand_v3(integer,float8[],jsonb,float8,jsonb) from public,anon,authenticated,service_role;
revoke all on function side_lite_private.side_engine_v3(bigint,jsonb,jsonb,jsonb,jsonb,text,text,bigint,text) from public,anon,authenticated,service_role;
grant execute on function side_lite_private.side_market_demand_v3(integer,float8[],jsonb,float8,jsonb) to side_lite_closer;
grant execute on function side_lite_private.side_engine_v3(bigint,jsonb,jsonb,jsonb,jsonb,text,text,bigint,text) to side_lite_closer;
grant select on public.lite_game_markets,public.lite_company_markets,public.lite_game_districts to side_lite_closer;

insert into public.lite_events(id,category,label,effect) values
('trend_luxury','preferences','Tendencia de lujo','{"id":"trend_luxury","type":"preferences","label":"Tendencia de lujo","description":"Crece el interés por productos prémium.","quality":{"premium":1.4}}'::jsonb),
('trend_economy','preferences','Moda económica','{"id":"trend_economy","type":"preferences","label":"Moda económica","description":"Aumenta el interés por productos básicos.","quality":{"basic":1.4}}'::jsonb),
('prefer_quality','preferences','Preferencia por calidad','{"id":"prefer_quality","type":"preferences","label":"Preferencia por calidad","description":"Los compradores valoran más la calidad.","quality":{"standard":1.15,"premium":1.3}}'::jsonb),
('price_sensitive','preferences','Compradores sensibles al precio','{"id":"price_sensitive","type":"preferences","label":"Compradores sensibles al precio","description":"Los compradores comparan más los precios.","priceSensitivity":1.5}'::jsonb),
('viral_campaign','marketing','Campaña viral','{"id":"viral_campaign","type":"marketing","label":"Campaña viral","description":"La publicidad llega a más personas.","marketingStrength":1.7}'::jsonb),
('ad_saturation','marketing','Saturación publicitaria','{"id":"ad_saturation","type":"marketing","label":"Saturación publicitaria","description":"La publicidad pierde eficacia.","marketingStrength":0.5}'::jsonb),
('recommendations','marketing','Recomendaciones positivas','{"id":"recommendations","type":"marketing","label":"Recomendaciones positivas","description":"Las recomendaciones refuerzan la calidad.","quality":{"standard":1.12,"premium":1.2}}'::jsonb),
('ad_distrust','marketing','Desconfianza publicitaria','{"id":"ad_distrust","type":"marketing","label":"Desconfianza publicitaria","description":"Los anuncios convencen menos.","marketingStrength":0.3}'::jsonb),
('purchasing_power_up','economy','Aumento del poder adquisitivo','{"id":"purchasing_power_up","type":"economy","label":"Aumento del poder adquisitivo","description":"Más compradores consideran adquirir bolsos.","demand":1.15,"quality":{"premium":1.12}}'::jsonb),
('purchasing_power_down','economy','Reducción del poder adquisitivo','{"id":"purchasing_power_down","type":"economy","label":"Reducción del poder adquisitivo","description":"Menos compradores disponen de presupuesto.","demand":0.88,"quality":{"basic":1.12}}'::jsonb),
('price_competition','economy','Competencia de precios','{"id":"price_competition","type":"economy","label":"Competencia de precios","description":"Los precios bajos atraen más compradores.","priceSensitivity":1.6}'::jsonb),
('impulse_buying','economy','Compras impulsivas','{"id":"impulse_buying","type":"economy","label":"Compras impulsivas","description":"La publicidad impulsa más compras.","demand":1.1,"marketingStrength":1.4}'::jsonb),
('tourism','markets','Afluencia turística','{"id":"tourism","type":"markets","label":"Afluencia turística","description":"Más visitantes llegan al mercado.","demand":1.15}'::jsonb),
('entrepreneur_fair','markets','Feria de emprendimientos','{"id":"entrepreneur_fair","type":"markets","label":"Feria de emprendimientos","description":"Una feria atrae clientes a las empresas.","demand":1.18,"marketingStrength":1.2}'::jsonb),
('roadworks','markets','Obras y restricciones viales','{"id":"roadworks","type":"markets","label":"Obras y restricciones viales","description":"Las obras reducen la afluencia.","demand":0.85}'::jsonb),
('shopping_center','markets','Apertura de centro comercial','{"id":"shopping_center","type":"markets","label":"Apertura de centro comercial","description":"Nuevos comercios compiten por los compradores.","demand":0.9,"quality":{"premium":1.12}}'::jsonb),
('supplier_clearance','supply','Liquidación de proveedores','{"id":"supplier_clearance","type":"supply","label":"Liquidación de proveedores","description":"El costo de compra baja.","purchase":0.85}'::jsonb),
('raw_material_increase','supply','Aumento de materias primas','{"id":"raw_material_increase","type":"supply","label":"Aumento de materias primas","description":"El costo de compra sube.","purchase":1.18}'::jsonb);
