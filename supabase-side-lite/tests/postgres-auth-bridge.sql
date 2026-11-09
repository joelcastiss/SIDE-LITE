-- Real Postgres privileges with emulated Auth; all fixtures roll back.
begin;
insert into auth.users(id,email,email_confirmed_at) values
 ('10000000-0000-0000-0000-000000000001','teacher@upch.pe',now()),
 ('10000000-0000-0000-0000-000000000002','student@example.test',now()),
 ('10000000-0000-0000-0000-000000000003','pending@example.test',null);
insert into auth.sessions(id,user_id) select id,id from auth.users where id::text like '10000000-%';
insert into side_lite_private.lite_teacher_grants(user_id,approved_email)
 values ('10000000-0000-0000-0000-000000000001','teacher@upch.pe');
delete from public.lite_profiles where id='10000000-0000-0000-0000-000000000002';
do $$ begin
 if has_schema_privilege('side_lite_api','auth','USAGE') then raise exception 'API can access Auth schema directly'; end if;
 if has_function_privilege('anon','side_lite_private.api_identity(uuid,uuid)','EXECUTE')
   or has_function_privilege('authenticated','side_lite_private.api_create_profile(uuid,uuid,text)','EXECUTE')
   or has_function_privilege('authenticated','side_lite_private.api_lock_teacher(uuid,uuid)','EXECUTE') then
   raise exception 'Browser may call server identity functions'; end if;
end $$;
set local role side_lite_api;
do $$ declare rec record; begin
 select * into rec from side_lite_private.api_identity('10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001');
 if not rec.session_active or not rec.teacher_authorized or not rec.email_verified then raise exception 'valid teacher rejected'; end if;
 if not side_lite_private.api_lock_teacher('10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001') then raise exception 'teacher lock failed'; end if;
 if side_lite_private.api_lock_teacher('10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000002') then raise exception 'foreign session accepted'; end if;
 if side_lite_private.api_lock_teacher('10000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000002') then raise exception 'student promoted'; end if;
 if exists(select 1 from side_lite_private.api_create_profile('10000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','Student')) then raise exception 'foreign session created profile'; end if;
 if exists(select 1 from side_lite_private.api_create_profile('10000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000003','Pending')) then raise exception 'unverified email created profile'; end if;
 if not exists(select 1 from side_lite_private.api_create_profile('10000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000002','Student')) then raise exception 'valid profile creation failed'; end if;
 if exists(select 1 from side_lite_private.api_create_profile('10000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000002','Changed')) then raise exception 'existing profile overwritten'; end if;
end $$;
reset role;
update auth.sessions set not_after=now()-interval '1 second' where id='10000000-0000-0000-0000-000000000001';
set local role side_lite_api;
do $$ declare rec record; begin
 select * into rec from side_lite_private.api_identity('10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001');
 if rec.session_active or side_lite_private.api_lock_teacher('10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001') then raise exception 'expired session accepted'; end if;
end $$;
reset role;
update auth.sessions set not_after=null where id='10000000-0000-0000-0000-000000000001';
update auth.users set banned_until=now()+interval '1 hour' where id='10000000-0000-0000-0000-000000000001';
set local role side_lite_api;
do $$ declare rec record; begin
 select * into rec from side_lite_private.api_identity('10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001');
 if not rec.banned or side_lite_private.api_lock_teacher('10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001') then raise exception 'banned teacher accepted'; end if;
end $$;
reset role;
update auth.users set banned_until=null,email='changed@upch.pe' where id='10000000-0000-0000-0000-000000000001';
set local role side_lite_api;
do $$ begin
 if side_lite_private.api_lock_teacher('10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001') then raise exception 'changed teacher email accepted'; end if;
end $$;
reset role;
update auth.users set email='teacher@upch.pe' where id='10000000-0000-0000-0000-000000000001';
update side_lite_private.lite_teacher_grants set revoked_at=now() where user_id='10000000-0000-0000-0000-000000000001';
set local role side_lite_api;
do $$ begin
 if side_lite_private.api_lock_teacher('10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001') then raise exception 'revoked teacher accepted'; end if;
end $$;
rollback;
