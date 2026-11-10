-- Rotate the recovery capability atomically with the ownership transfer.
-- Old capabilities cannot be used again after a successful transfer.
drop function side_lite_private.api_recover_guest(uuid,uuid,text,bytea);
create function side_lite_private.api_recover_guest(p_user uuid,p_session uuid,p_code text,p_hash bytea,p_new_hash bytea)
returns table(id uuid,game_id uuid,name text) language plpgsql security definer set search_path='' as $$
declare target uuid;
begin
  if p_hash is null or p_new_hash is null or octet_length(p_hash)<>32 or octet_length(p_new_hash)<>32 or p_hash=p_new_hash then return; end if;
  if not side_lite_private.lock_active_identity(p_user,p_session) then return; end if;
  if not exists(select 1 from auth.users u where u.id=p_user and u.is_anonymous is true) then return; end if;
  select co.id into target from public.lite_companies co join public.lite_games g on g.id=co.game_id
    join side_lite_private.lite_guest_recovery r on r.company_id=co.id
    join auth.users owner on owner.id=co.student_id and owner.is_anonymous is true
    where g.code=p_code and r.secret_hash=p_hash for update of co,r;
  if target is null then return; end if;
  update side_lite_private.lite_guest_recovery set secret_hash=p_new_hash where company_id=target;
  return query update public.lite_companies co set student_id=p_user where co.id=target returning co.id,co.game_id,co.name;
end $$;
revoke all on function side_lite_private.api_recover_guest(uuid,uuid,text,bytea,bytea) from public,anon,authenticated,service_role;
grant execute on function side_lite_private.api_recover_guest(uuid,uuid,text,bytea,bytea) to side_lite_api;
