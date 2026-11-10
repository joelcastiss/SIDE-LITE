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
