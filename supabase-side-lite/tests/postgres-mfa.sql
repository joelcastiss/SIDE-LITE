-- Execute only against the disposable Auth-emulated test cluster.
begin;
insert into auth.users(id,email,email_confirmed_at) values('b3000000-0000-4000-8000-000000000001','rls-mfa@example.invalid',now());
insert into auth.sessions(id,user_id,aal) values('b3000000-0000-4000-8000-000000000002','b3000000-0000-4000-8000-000000000001','aal1');
insert into auth.mfa_factors(id,user_id,status) values('b3000000-0000-4000-8000-000000000003','b3000000-0000-4000-8000-000000000001','verified');
do $$ begin
 if side_lite_private.api_mfa_ready('b3000000-0000-4000-8000-000000000001','b3000000-0000-4000-8000-000000000002','aal1') then raise exception 'AAL1 accepted'; end if;
 if side_lite_private.api_mfa_ready('b3000000-0000-4000-8000-000000000001','b3000000-0000-4000-8000-000000000002','aal2') then raise exception 'AAL2 token without AAL2 session accepted'; end if;
 if has_function_privilege('authenticated','side_lite_private.api_mfa_ready(uuid,uuid,text)','EXECUTE') then raise exception 'browser can call server function'; end if;
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub','b3000000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claims','{"session_id":"b3000000-0000-4000-8000-000000000002","aal":"aal1"}',true);
do $$ begin if exists(select 1 from public.lite_profiles where id='b3000000-0000-4000-8000-000000000001') then raise exception 'RLS accepted AAL1'; end if; end $$;
reset role;
update auth.sessions set aal='aal2' where id='b3000000-0000-4000-8000-000000000002';
do $$ begin
 if side_lite_private.api_mfa_ready('b3000000-0000-4000-8000-000000000001','b3000000-0000-4000-8000-000000000002','aal1') then raise exception 'stale AAL1 accepted'; end if;
 if not side_lite_private.api_mfa_ready('b3000000-0000-4000-8000-000000000001','b3000000-0000-4000-8000-000000000002','aal2') then raise exception 'AAL2 rejected'; end if;
end $$;
set local role authenticated;
select set_config('request.jwt.claims','{"session_id":"b3000000-0000-4000-8000-000000000002","aal":"aal2"}',true);
do $$ begin if not exists(select 1 from public.lite_profiles where id='b3000000-0000-4000-8000-000000000001') then raise exception 'RLS rejected AAL2'; end if; end $$;
rollback;
