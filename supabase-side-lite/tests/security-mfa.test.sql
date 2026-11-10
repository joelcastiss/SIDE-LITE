-- Run after 20261109204458 and 20261110004117 in disposable fixture only.
do $$ declare t text; r text; p text; begin
 foreach t in array array['lite_sessions','lite_auth_limits','lite_teacher_grades','lite_teacher_podium'] loop
  if not (select relrowsecurity from pg_class where oid=to_regclass(format('public.%I',t))) then raise exception 'RLS missing: %',t; end if;
  foreach r in array array['anon','authenticated'] loop
   foreach p in array array['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'] loop
    if has_table_privilege(r,format('public.%I',t),p) then raise exception 'Unexpected % for % on %',p,r,t; end if;
   end loop;
   if has_any_column_privilege(r,format('public.%I',t),'SELECT,INSERT,UPDATE,REFERENCES') then raise exception 'Column grant for % on %',r,t; end if;
  end loop;
 end loop;
 if not exists(select 1 from public.lite_sessions where id=1) then raise exception 'Legacy row lost'; end if;
 if has_function_privilege('authenticated','side_lite_private.api_mfa_ready(uuid,uuid,text)','EXECUTE') or has_function_privilege('anon','side_lite_private.mfa_allowed()','EXECUTE') then raise exception 'Unexpected function grant'; end if;
end $$;
insert into auth.sessions(id,user_id,aal) values('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','aal1');
insert into auth.mfa_factors(id,user_id,status) values('30000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','verified');
do $$ begin
 if side_lite_private.api_mfa_ready('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','aal1') then raise exception 'AAL1 accepted'; end if;
 if side_lite_private.api_mfa_ready('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','aal2') then raise exception 'AAL2 token with AAL1 session accepted'; end if;
end $$;
set role authenticated;
select set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000001',false);
select set_config('request.jwt.claims','{"session_id":"10000000-0000-0000-0000-000000000001","aal":"aal1"}',false);
do $$ begin
 if exists(select 1 from public.lite_games) then raise exception 'RLS leaked AAL1'; end if;
 begin insert into public.lite_games values(2); raise exception 'RLS allowed AAL1 insert'; exception when insufficient_privilege then null; end;
end $$;
reset role;
update auth.sessions set aal='aal2' where id='10000000-0000-0000-0000-000000000001';
do $$ begin
 if side_lite_private.api_mfa_ready('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','aal1') then raise exception 'Old AAL1 token accepted'; end if;
 if not side_lite_private.api_mfa_ready('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','aal2') then raise exception 'AAL2 rejected'; end if;
end $$;
set role authenticated;
select set_config('request.jwt.claims','{"session_id":"10000000-0000-0000-0000-000000000001","aal":"aal2"}',false);
do $$ begin if not exists(select 1 from public.lite_games where id=1) then raise exception 'RLS rejected AAL2'; end if; end $$;
-- An AAL1 token remains insufficient even after the live session is elevated.
select set_config('request.jwt.claims','{"session_id":"10000000-0000-0000-0000-000000000001","aal":"aal1"}',false);
do $$ begin if exists(select 1 from public.lite_games) then raise exception 'RLS leaked stale AAL1'; end if; end $$;
reset role;
update auth.mfa_factors set status='unverified';
update auth.sessions set aal='aal1';
do $$ begin if not side_lite_private.api_mfa_ready('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','aal1') then raise exception 'Password only account rejected'; end if; end $$;
