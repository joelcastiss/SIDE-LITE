-- Auth is emulated; this does not establish Supabase Auth/Realtime behavior.
begin;
insert into auth.users(id,email,email_confirmed_at) values
 ('00000000-0000-0000-0000-000000000001','a@example.test', now()),
 ('00000000-0000-0000-0000-000000000002','b@example.test', now()),
 ('00000000-0000-0000-0000-000000000003','teacher@upch.pe', now()),
 ('00000000-0000-0000-0000-000000000004','other@example.test', now()),
 ('00000000-0000-0000-0000-000000000005','peer@example.test', now());
insert into public.lite_profiles(id,display_name) select id, email from auth.users;
insert into side_lite_private.lite_teacher_grants(user_id,approved_email)
 values ('00000000-0000-0000-0000-000000000003','teacher@upch.pe');
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
values ('10000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','{"cashEnd":10100}'),
 ('10000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000005','{"cashEnd":10200}');

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
do $$ begin
 if (select count(*) from public.lite_games) <> 1 or (select count(*) from public.lite_companies) <> 1 then raise exception 'student A game/company isolation failed'; end if;
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
do $$ begin
 if (select count(*) from public.lite_games) <> 1 or (select count(*) from public.lite_companies) <> 1 then raise exception 'student B isolation failed'; end if;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000003',true);
do $$ begin
 if (select count(*) from public.lite_games) <> 1 or (select count(*) from public.lite_companies) <> 2 then raise exception 'teacher isolation failed'; end if;
 if (select count(*) from public.lite_decisions) <> 2 or (select count(*) from public.lite_results) <> 2 then raise exception 'authorized teacher cannot access game data'; end if;
end $$;
reset role;
update side_lite_private.lite_teacher_grants set revoked_at = now() where user_id='00000000-0000-0000-0000-000000000003';
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000003',true);
do $$ begin
 if (select count(*) from public.lite_games) <> 0 then raise exception 'revoked teacher retained access'; end if;
end $$;
rollback;
