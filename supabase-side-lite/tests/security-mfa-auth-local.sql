begin;
insert into auth.users(id,email,email_confirmed_at,created_at,updated_at) values('b3000000-0000-4000-8000-000000000001','rls-mfa-isolated@example.invalid',now(),now(),now());
insert into auth.sessions(id,user_id,aal) values('b3000000-0000-4000-8000-000000000002','b3000000-0000-4000-8000-000000000001','aal1');
insert into auth.mfa_factors(id,user_id,factor_type,status,created_at,updated_at) values('b3000000-0000-4000-8000-000000000003','b3000000-0000-4000-8000-000000000001','totp','verified',now(),now());
do $$ begin
 if side_lite_private.api_mfa_ready('b3000000-0000-4000-8000-000000000001','b3000000-0000-4000-8000-000000000002','aal1') then raise exception 'MFA AAL1 accepted'; end if;
 if side_lite_private.api_mfa_ready('b3000000-0000-4000-8000-000000000001','b3000000-0000-4000-8000-000000000002','aal2') then raise exception 'AAL2 token with AAL1 session accepted'; end if;
 if has_function_privilege('authenticated','side_lite_private.api_mfa_ready(uuid,uuid,text)','EXECUTE') then raise exception 'browser role can call privileged function'; end if;
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub','b3000000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claims','{"sub":"b3000000-0000-4000-8000-000000000001","session_id":"b3000000-0000-4000-8000-000000000002","aal":"aal1"}',true);
do $$ begin if exists(select 1 from public.lite_profiles where id='b3000000-0000-4000-8000-000000000001') then raise exception 'RLS allowed AAL1 read'; end if; end $$;
reset role;
update auth.sessions set aal='aal2' where id='b3000000-0000-4000-8000-000000000002';
do $$ begin
 if side_lite_private.api_mfa_ready('b3000000-0000-4000-8000-000000000001','b3000000-0000-4000-8000-000000000002','aal1') then raise exception 'stale AAL1 token accepted'; end if;
 if not side_lite_private.api_mfa_ready('b3000000-0000-4000-8000-000000000001','b3000000-0000-4000-8000-000000000002','aal2') then raise exception 'AAL2 rejected'; end if;
end $$;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"b3000000-0000-4000-8000-000000000001","session_id":"b3000000-0000-4000-8000-000000000002","aal":"aal2"}',true);
do $$ begin if not exists(select 1 from public.lite_profiles where id='b3000000-0000-4000-8000-000000000001') then raise exception 'RLS rejected AAL2'; end if; end $$;
rollback;
