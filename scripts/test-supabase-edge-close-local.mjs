// Reproducible only against the explicitly named disposable Supabase CLI stack.
// Creates its own isolated records; never calls a remote project.
import assert from 'node:assert/strict';
import {randomUUID, randomBytes} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import pg from 'pg';

const raw=process.env.SIDE_LOCAL_POSTGRES_URL, anon=process.env.SIDE_LITE_LOCAL_ANON_KEY;
const url=new URL(raw);
if (process.env.SIDE_TEST_DISPOSABLE !== 'YES' || !['postgres:','postgresql:'].includes(url.protocol) || url.hostname !== '127.0.0.1' || url.port !== '56522' || url.pathname !== '/postgres' || url.search || url.hash || !anon || !/^[A-Za-z0-9._-]+$/.test(anon)) throw Error('Se requiere stack local desechable');
const ports=execFileSync('docker',['port','supabase_db_side-lite-supabase-stack-verify','5432/tcp'],{encoding:'utf8'});
if (!ports.split(/\r?\n/).includes('0.0.0.0:56522')) throw Error('Contenedor local inesperado');
const env=await readFile(path.join(os.tmpdir(),'side-lite-supabase-stack-verify','functions-local.env'),'utf8');
const secret=env.split(/\r?\n/).find(x=>x.startsWith('SIDE_CLOSER_SECRET='))?.slice('SIDE_CLOSER_SECRET='.length);
if (!secret) throw Error('Falta secreto local');
const db=new pg.Client({connectionString:raw});
const teacher=randomUUID(), student=randomUUID(), game=randomUUID(), company=randomUUID(), cycle=randomUUID();
const code=randomBytes(4).toString('hex').toUpperCase();
const endpoint='http://127.0.0.1:56521/functions/v1/close-cycle';
const invoke=async supplied=>{
  const response=await fetch(endpoint,{method:'POST',headers:{apikey:anon,'x-side-cron-secret':supplied,'content-type':'application/json'},body:'{}',signal:AbortSignal.timeout(30000)});
  return {status:response.status, body:await response.json().catch(()=>null)};
};
await db.connect();
try {
  const {rows:[existing]}=await db.query("select count(*)::int as n from public.lite_cycles where status='open' and paused_at is null and (ends_at<=clock_timestamp() or close_requested_at is not null)");
  if(existing.n) throw Error('Hay ciclos pendientes ajenos; no se ejecutó la prueba');
  await db.query('begin');
  for(const id of [teacher,student]) await db.query("insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values($1,$2,now(),$3)",[id,`edge-test-${id}@example.test`,{display_name:'Prueba aislada'}]);
  await db.query('insert into public.lite_games(id,teacher_id,name,code,cycle_count,capital_min,capital_max,costs) values ($1,$2,$3,$4,3,30000,30000,$5)',[game,teacher,'Prueba Edge aislada',code,{basic:20,standard:30,premium:40}]);
  await db.query('insert into public.lite_companies(id,game_id,student_id,name,store_id,initial_capital,cash) values($1,$2,$3,$4,(select id from public.lite_stores limit 1),30000,30000)',[company,game,student,'Empresa de prueba']);
  await db.query('insert into public.lite_cycles(id,game_id,number,ends_at) values($1,$2,1,now()+interval \'120 seconds\')',[cycle,game]);
  await db.query("insert into public.lite_decisions(game_id,cycle_id,company_id,quality,quantity,price,marketing_amount,confirmed) values($1,$2,$3,'basic',10,100,0,true)",[game,cycle,company]);
  await db.query('update public.lite_cycles set close_requested_at=clock_timestamp() where id=$1',[cycle]);
  await db.query('commit');
  assert.equal((await invoke('x'.repeat(40))).status,401);
  const failed=await invoke(secret); assert.equal(failed.status,500); assert.equal(failed.body?.failed,1);
  const before=await db.query('select c.status,co.cash,(select count(*)::int from public.lite_results r where r.cycle_id=c.id) as n from public.lite_cycles c join public.lite_companies co on co.game_id=c.game_id where c.id=$1',[cycle]);
  assert.deepEqual(before.rows[0],{status:'open',cash:30000,n:0});
  await db.query('insert into side_lite_private.lite_cycle_secrets(cycle_id) values($1)',[cycle]);
  const concurrent=await Promise.all([invoke(secret),invoke(secret)]);
  assert.ok(concurrent.every(x=>x.status===200 && x.body?.failed===0));
  assert.equal(concurrent.reduce((n,x)=>n+x.body.closed,0),1);
  const retry=await invoke(secret); assert.equal(retry.status,200); assert.equal(retry.body.closed,0);
  const result=await db.query('select c.status,(select count(*)::int from public.lite_results r where r.cycle_id=c.id) as n from public.lite_cycles c where c.id=$1',[cycle]);
  assert.deepEqual(result.rows[0],{status:'closed',n:1});
  console.log('Edge local: rechazo de secreto, rollback, recuperación, llamadas simultáneas y reintento sin duplicados: OK');
} finally {await db.end();}
