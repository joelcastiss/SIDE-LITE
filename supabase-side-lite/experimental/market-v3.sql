-- Experimental v3 demand allocation; not used by the official closer.
create or replace function pg_temp.side_market_demand(p_base integer, p_shares float8[], p_companies jsonb, p_factor float8 default 1)
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
    select factor into strict market_factor from pg_temp.side_marketing_factors where side_marketing_factors.amount=v_amount;
    price_factor:=greatest(.1::float8,least(2::float8,100::float8/(item->'decision'->>'price')::float8));
    for seg in 1..3 loop
      w:=(case quality when 'basic' then (array[1,.35,.12]::float8[])[seg] when 'standard' then (array[.35,1,.35]::float8[])[seg] else (array[.12,.35,1]::float8[])[seg] end)*price_factor*market_factor;
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
