import { pathToFileURL } from 'node:url';
import { closeOne, CycleCloseError } from '../functions/close-cycle/worker.js';
import assert from 'node:assert/strict';
if (process.env.SIDE_TEST_DISPOSABLE !== 'YES' || !process.env.SIDE_TEST_DATABASE_URL || !process.env.SIDE_TEST_POSTGRES_MODULE) {
 throw new Error('Use una DB local desechable e indique SIDE_TEST_DISPOSABLE=YES, SIDE_TEST_DATABASE_URL y SIDE_TEST_POSTGRES_MODULE');
}
const dbURL = new URL(process.env.SIDE_TEST_DATABASE_URL);
if (!['localhost','127.0.0.1','[::1]'].includes(dbURL.hostname)) throw new Error('Solo se acepta PostgreSQL local desechable');
const { default: postgres } = await import(pathToFileURL(process.env.SIDE_TEST_POSTGRES_MODULE));
const sql = postgres(process.env.SIDE_TEST_DATABASE_URL, {prepare:false,max:4});
const teacher='10000000-0000-4000-8000-000000000001', student='10000000-0000-4000-8000-000000000002';
const g='20000000-0000-4000-8000-000000000001', co='30000000-0000-4000-8000-000000000001', cy='40000000-0000-4000-8000-000000000001';
try {
 await sql`insert into auth.users(id,email,email_confirmed_at) values (${teacher}, 'teacher@example.com',now()),(${student},'student@example.com',now())`;
 // Current Auth bootstrap creates profiles automatically on user insertion.
 await sql`insert into public.lite_profiles(id,display_name) values (${teacher},'Teacher'),(${student},'Student') on conflict (id) do nothing`;
 await sql`insert into public.lite_games(id,teacher_id,name,code,cycle_count,capital_min,capital_max,costs) values (${g},${teacher},'Game','ABCDEF11',3,30000,30000,${sql.json({basic:20,standard:30,premium:40})})`;
 await sql`insert into public.lite_companies(id,game_id,student_id,name,store_id,initial_capital,cash) values (${co},${g},${student},'Company',(select id from public.lite_stores limit 1),30000,30000)`;
 await sql`insert into public.lite_cycles(id,game_id,number,starts_at,ends_at,close_requested_at) values (${cy},${g},1,now(),now()+interval '1 second',now())`;
 const [t]=await sql`select extract(epoch from (ends_at-starts_at))::int as seconds from public.lite_cycles where id=${cy}`;assert.equal(t.seconds,120);
 await sql`insert into side_lite_private.lite_cycle_secrets(cycle_id) values (${cy})`;
 await sql`insert into public.lite_decisions(game_id,cycle_id,company_id,quality,quantity,price,marketing_amount,confirmed) values (${g},${cy},${co},'basic',10,100,0,true)`;
 const results=await Promise.all([closeOne(sql),closeOne(sql)]); assert.equal(results.filter(Boolean).length,1);
 const [row]=await sql`select c.status, (select count(*)::int from public.lite_results where cycle_id=${cy}) as n, co.cash from public.lite_cycles c join public.lite_companies co on co.game_id=c.game_id where c.id=${cy}`;
 assert.equal(row.status,'closed');assert.equal(row.n,1);assert.equal(row.cash,30800);
 const cy2='40000000-0000-4000-8000-000000000002';
 await sql`insert into public.lite_cycles(id,game_id,number,starts_at,ends_at) values (${cy2},${g},2,now(),now()+interval '1 second')`;
 await sql`insert into side_lite_private.lite_cycle_secrets(cycle_id) values (${cy2})`;
 await sql`insert into public.lite_decisions(game_id,cycle_id,company_id,quality,quantity,price,marketing_amount,confirmed) values (${g},${cy2},${co},'basic',100000,100,0,true)`;
 assert.equal(await closeOne(sql),null);
 await sql`update public.lite_cycles set close_requested_at=now() where id=${cy2}`;
 await assert.rejects(closeOne(sql),CycleCloseError);
 const [failed]=await sql`select status, (select count(*)::int from public.lite_results where cycle_id=${cy2}) as n from public.lite_cycles where id=${cy2}`;
 assert.deepEqual({...failed},{status:'open',n:0});
 console.log('PostgreSQL real: plazo 120 s; vencimiento no anticipado; cierre concurrente único; fallo revierte transacción.');
} finally {await sql.end()}
