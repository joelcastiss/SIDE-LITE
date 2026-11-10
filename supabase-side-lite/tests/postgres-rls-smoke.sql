-- Auth is emulated; this does not establish Supabase Auth/Realtime behavior.
begin;
insert into auth.users(id,email,email_confirmed_at) values
 ('00000000-0000-0000-0000-000000000001','a@example.test', now()),
 ('00000000-0000-0000-0000-000000000002','b@example.test', now()),
 ('00000000-0000-0000-0000-000000000003','teacher@upch.pe', now()),
 ('00000000-0000-0000-0000-000000000004','other@example.test', now()),
 ('00000000-0000-0000-0000-000000000005','peer@example.test', now());
insert into auth.sessions(id,user_id) select id,id from auth.users where id in (
 '00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002',
 '00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000004',
 '00000000-0000-0000-0000-000000000005');
-- Profiles are created by the registration trigger; metadata never grants roles.
do $$ begin
 if (select count(*) from public.lite_profiles where id in ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000005')) <> 5 then raise exception 'automatic profile creation failed'; end if;
 if exists (select 1 from public.lite_profiles where id in ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000005') and display_name <> 'Estudiante') then raise exception 'invalid metadata fallback failed'; end if;
 if (select count(*) from side_lite_private.lite_teacher_grants where user_id in ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000005')) <> 1 or not exists (select 1 from side_lite_private.lite_teacher_grants where user_id='00000000-0000-0000-0000-000000000003' and revoked_at is null) then raise exception 'institutional teacher grant incorrect'; end if;
end $$;
-- BYPASSRLS does not imply table write privileges: the runtime can verify a
-- grant, but cannot promote or revoke teachers even with its server credential.
set local role service_role;
do $$ begin
 if not exists(select 1 from side_lite_private.lite_teacher_grants where user_id='00000000-0000-0000-0000-000000000003') then raise exception 'runtime cannot verify teacher'; end if;
 perform 1 from side_lite_private.lite_teacher_grants where user_id='00000000-0000-0000-0000-000000000003' for share;
 begin insert into side_lite_private.lite_teacher_grants(user_id,approved_email) values ('00000000-0000-0000-0000-000000000004','other@upch.pe'); raise exception 'runtime may promote teacher'; exception when insufficient_privilege then null; end;
 begin update side_lite_private.lite_teacher_grants set revoked_at=now(); raise exception 'runtime may revoke teacher'; exception when insufficient_privilege then null; end;
 begin update side_lite_private.lite_teacher_grants set approved_email='other@upch.pe'; raise exception 'runtime may change approved email'; exception when insufficient_privilege then null; end;
 begin delete from side_lite_private.lite_teacher_grants; raise exception 'runtime may delete teacher grant'; exception when insufficient_privilege then null; end;
end $$;
reset role;
do $$ begin
 begin
  insert into side_lite_private.lite_teacher_grants(user_id,approved_email) values ('00000000-0000-0000-0000-000000000004','other@example.test');
  raise exception 'non-institutional teacher grant accepted';
 exception when check_violation then null; end;
 begin
  insert into side_lite_private.lite_teacher_grants(user_id,approved_email) values ('00000000-0000-0000-0000-000000000004','other@upch.pe.evil.test');
  raise exception 'spoofed institutional domain accepted';
 exception when check_violation then null; end;
end $$;
insert into public.lite_games(id, teacher_id,name,code,cycle_count,capital_min,capital_max,costs) values
 ('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000003','Game 1','ABCD0001',3,10000,10000,'{}'),
 ('10000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000004','Game 2','ABCD0002',3,10000,10000,'{}');
insert into public.lite_companies(id,game_id,student_id,name,store_id,initial_capital,cash) values
 ('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','Company A',(select id from public.lite_stores limit 1),10000,10000),
 ('20000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000002','Company B',(select id from public.lite_stores limit 1),10000,10000),
 ('20000000-0000-0000-0000-000000000005','10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000005','Company Peer',(select id from public.lite_stores limit 1),10000,10000);
insert into public.lite_cycles(id,game_id,number,ends_at) values
 ('30000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001',1,now()+interval '120 seconds'),
 ('30000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000002',1,now()+interval '120 seconds');
insert into side_lite_private.lite_cycle_secrets(cycle_id) select id from public.lite_cycles;
insert into public.lite_decisions(game_id,cycle_id,company_id,quality,quantity,price,marketing_amount)
values ('10000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','basic',1,100,0),
 ('10000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000005','premium',2,200,0);
insert into public.lite_results(game_id,cycle_id,company_id,result)
values ('10000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','{"cashStart":10000,"cashEnd":10100,"purchase":100,"marketing":0,"revenue":200,"sold":2,"demand":2,"profit":100,"inventory":[],"ruleVersion":2}'),
 ('10000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000005','{"cashEnd":10200}');

update public.lite_cycles set status='closed' where id='30000000-0000-0000-0000-000000000001';

-- Composite FKs reject linking a company and a cycle from different games.
do $$ begin
  if exists(select 1 from public.lite_cycles where ends_at - starts_at <> interval '120 seconds') then
    raise exception 'incorrect initial cycle duration';
  end if;
  begin
    insert into public.lite_decisions(game_id, cycle_id, company_id, quality, quantity, price, marketing_amount)
    values ('10000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000002','basic',1,100,0);
    raise exception 'cross-game decision was accepted';
  exception when foreign_key_violation then null; end;
  begin
    insert into public.lite_games(teacher_id,name,code,cycle_count,duration_seconds,capital_min,capital_max,costs)
    values ('00000000-0000-0000-0000-000000000003','Short game','ABCD0010',3,30,10000,10000,'{}');
    raise exception 'wrong duration was accepted';
  exception when check_violation then null; end;
end $$;
set local role anon;
do $$ begin
 begin perform id from public.lite_games; raise exception 'anonymous read permitted'; exception when insufficient_privilege then null; end;
end $$;
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
select set_config('request.jwt.claims','{"session_id":"00000000-0000-0000-0000-000000000001"}',true);
do $$ begin
 if (select count(*) from public.lite_games) <> 1 or (select count(*) from public.lite_companies) <> 1 then raise exception 'student A game/company isolation failed'; end if;
 if (select role from public.lite_my_identity()) <> 'student' then raise exception 'student identity incorrect'; end if;
 if (select count(*) from public.lite_cycle_history) <> 1 or (select count(*) from public.lite_economic_movements) <> 3 then raise exception 'student history isolation failed'; end if;
 if (select amount from public.lite_economic_movements where category='purchase') <> -100 or (select amount from public.lite_economic_movements where category='revenue') <> 200 then raise exception 'movement amounts incorrect'; end if;
 begin perform code from public.lite_games; raise exception 'join code exposed'; exception when insufficient_privilege then null; end;
 if (select count(*) from public.lite_cycles) <> 1 then raise exception 'student A cycle isolation failed'; end if;
 if (select count(*) from public.lite_decisions) <> 1 or (select count(*) from public.lite_results) <> 1 then raise exception 'same-game peer decision/result leaked'; end if;
 if exists(select 1 from public.lite_decisions where company_id='20000000-0000-0000-0000-000000000005') or exists(select 1 from public.lite_results where company_id='20000000-0000-0000-0000-000000000005') then raise exception 'same-game peer data leaked'; end if;
 begin perform seed from side_lite_private.lite_cycle_secrets; raise exception 'seed exposed'; exception when insufficient_privilege then null; end;
 begin update public.lite_companies set cash=999999; raise exception 'cash write permitted'; exception when insufficient_privilege then null; end;
 begin update public.lite_decisions set price=1 where company_id='20000000-0000-0000-0000-000000000005'; raise exception 'decision write permitted'; exception when insufficient_privilege then null; end;
 begin update public.lite_results set result='{}'; raise exception 'result write permitted'; exception when insufficient_privilege then null; end;
 begin insert into side_lite_private.lite_teacher_grants(user_id,approved_email) values ('00000000-0000-0000-0000-000000000001','a@example.test'); raise exception 'teacher escalation permitted'; exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',true);
select set_config('request.jwt.claims','{"session_id":"00000000-0000-0000-0000-000000000002"}',true);
do $$ begin
 if (select count(*) from public.lite_games) <> 1 or (select count(*) from public.lite_companies) <> 1 then raise exception 'student B isolation failed'; end if;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000003',true);
select set_config('request.jwt.claims','{"session_id":"00000000-0000-0000-0000-000000000003"}',true);
do $$ begin
 if (select count(*) from public.lite_games) <> 1 or (select count(*) from public.lite_companies) <> 2 then raise exception 'teacher isolation failed'; end if;
 if (select role from public.lite_my_identity()) <> 'teacher' then raise exception 'teacher identity incorrect'; end if;
 if (select count(*) from public.lite_cycle_history) <> 2 or (select count(*) from public.lite_economic_movements) <> 6 then raise exception 'teacher history incorrect'; end if;
 if exists(select 1 from public.lite_economic_movements where company_id='20000000-0000-0000-0000-000000000005' and amount is not null) then raise exception 'missing result fields must remain null'; end if;
 if (select count(*) from public.lite_decisions) <> 2 or (select count(*) from public.lite_results) <> 2 then raise exception 'authorized teacher cannot access game data'; end if;
end $$;
reset role;
-- A session belonging to a different user must not authorize this JWT.
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
select set_config('request.jwt.claims','{"session_id":"00000000-0000-0000-0000-000000000002"}',true);
do $$ begin
 if exists(select 1 from public.lite_my_identity()) or exists(select 1 from public.lite_games) then raise exception 'foreign session accepted'; end if;
end $$;
reset role;
update auth.sessions set not_after=now()-interval '1 second' where user_id='00000000-0000-0000-0000-000000000001';
set local role authenticated;
select set_config('request.jwt.claims','{"session_id":"00000000-0000-0000-0000-000000000001"}',true);
do $$ begin
 if exists(select 1 from public.lite_my_identity()) or exists(select 1 from public.lite_games) then raise exception 'expired session accepted'; end if;
end $$;
reset role;
update auth.sessions set not_after=null where user_id='00000000-0000-0000-0000-000000000001';
update auth.users set banned_until=now()+interval '1 hour' where id='00000000-0000-0000-0000-000000000001';
set local role authenticated;
do $$ begin
 if exists(select 1 from public.lite_my_identity()) or exists(select 1 from public.lite_games) then raise exception 'banned user accepted'; end if;
end $$;
reset role;
update side_lite_private.lite_teacher_grants set revoked_at = now() where user_id='00000000-0000-0000-0000-000000000003';
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000003',true);
select set_config('request.jwt.claims','{"session_id":"00000000-0000-0000-0000-000000000003"}',true);
do $$ begin
 if (select count(*) from public.lite_games) <> 0 or exists(select 1 from public.lite_cycle_history) or exists(select 1 from public.lite_economic_movements) then raise exception 'revoked teacher retained access'; end if;
 if (select role from public.lite_my_identity()) <> 'student' then raise exception 'revoked teacher retained role'; end if;
 perform set_config('request.jwt.claims','{}',true);
 if exists(select 1 from public.lite_my_identity()) or exists(select 1 from public.lite_profiles) then raise exception 'missing session retained access'; end if;
end $$;
rollback;
