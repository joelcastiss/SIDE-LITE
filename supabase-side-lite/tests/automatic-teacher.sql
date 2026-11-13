-- Only run against the disposable history replay database.
begin;
insert into auth.users(id,email,email_confirmed_at,is_anonymous) values
 ('79000000-0000-4000-8000-000000000001','automatic@upch.pe',now(),false),
 ('79000000-0000-4000-8000-000000000002','delayed@upch.pe',null,false);
insert into auth.sessions(id,user_id) values
 ('79000000-0000-4000-8000-000000000011','79000000-0000-4000-8000-000000000001');
do $$ begin
 if not (select teacher_authorized from side_lite_private.api_identity('79000000-0000-4000-8000-000000000001','79000000-0000-4000-8000-000000000011')) then raise exception 'automatic teacher denied'; end if;
 if exists(select 1 from side_lite_private.lite_teacher_grants where user_id='79000000-0000-4000-8000-000000000002') then raise exception 'unconfirmed grant'; end if;
 begin insert into auth.users(id,email,is_anonymous) values ('79000000-0000-4000-8000-000000000003','bad@upch.pe.evil.test',false); raise exception 'spoof accepted'; exception when check_violation then null; end;
 begin insert into auth.users(id,email,is_anonymous) values ('79000000-0000-4000-8000-000000000004','bad@example.com',false); raise exception 'external accepted'; exception when check_violation then null; end;
end $$;
update auth.users set email_confirmed_at=now() where id='79000000-0000-4000-8000-000000000002';
update auth.users set email_confirmed_at=now() where id='79000000-0000-4000-8000-000000000002';
do $$ begin
 if (select count(*) from side_lite_private.lite_teacher_grants where user_id='79000000-0000-4000-8000-000000000002') <> 1 then raise exception 'grant missing or duplicated'; end if;
end $$;
update side_lite_private.lite_teacher_grants set revoked_at=now() where user_id='79000000-0000-4000-8000-000000000002';
update auth.users set email_confirmed_at=now() where id='79000000-0000-4000-8000-000000000002';
do $$ begin
 if exists(select 1 from side_lite_private.lite_teacher_grants where user_id='79000000-0000-4000-8000-000000000002' and revoked_at is null) then raise exception 'revocation lost'; end if;
end $$;
rollback;
