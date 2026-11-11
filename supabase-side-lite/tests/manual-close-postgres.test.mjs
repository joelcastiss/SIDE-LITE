// Isolated PostgreSQL only. JWT verification is simulated; role grants and worker are real.
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import express from 'express';
import pg from 'pg';
import postgres from 'postgres';
import {createGamesApp} from '../api/games.js';
import {createCycleControlsRouter} from '../api/cycle-controls.js';
import {closeOne} from '../functions/close-cycle/worker.js';

test('cierre asistido exige docente propietario y vencimiento, sin duplicar resultados',async()=>{
 const url=process.env.SIDE_LITE_TEST_DATABASE_URL,u=new URL(url||'http://invalid');
 if(process.env.SIDE_TEST_DISPOSABLE!=='YES'||!['127.0.0.1','localhost','::1','[::1]'].includes(u.hostname)||(u.pathname!=='/side_lite_supabase_test'&&!(process.env.SIDE_SQL_LOCAL_STACK_ALLOWED==='YES'&&u.pathname==='/postgres')))throw Error('Se requiere PostgreSQL local desechable.');
 const admin=new pg.Pool({connectionString:url}),api=new pg.Pool({connectionString:url,options:'-c role=side_lite_api'}),closer=postgres(url,{prepare:false,connection:{options:'-c role=side_lite_closer'}});
 const ids=Array.from({length:3},()=>crypto.randomUUID()),sessions=ids.map(()=>crypto.randomUUID()),tokens=new Map(ids.map((id,i)=>['token'+i,{id,sessionId:sessions[i]}]));let server,gameId;
 const closeWithEngine=async id=>{if(process.env.SIDE_TEST_SQL_MIGRATION!=='YES') return closeOne(closer,[],id);const [row]=await closer`select side_lite_private.side_close_one(${id}::uuid) as id`;return row.id;};
 try{
  for(let i=0;i<3;i++){
   await admin.query('insert into auth.users(id,email,email_confirmed_at,is_anonymous) values($1,$2,now(),$3)',[ids[i],i===0?`manual-${ids[i]}@upch.pe`:null,i!==0]);
   await admin.query('insert into auth.sessions(id,user_id) values($1,$2)',[sessions[i],ids[i]]);
   await admin.query('update public.lite_profiles set display_name=$2 where id=$1',[ids[i],`Piloto ${i}`]);
  }
  await admin.query('insert into side_lite_private.lite_teacher_grants(user_id,approved_email,granted_by) values($1,$2,$3) on conflict(user_id) do update set granted_by=excluded.granted_by',[ids[0],`manual-${ids[0]}@upch.pe`,ids[1]]);
  const verifyToken=async token=>{const identity=tokens.get(token);if(!identity)throw Error('invalid');return identity;};
  const app=express();app.use(createGamesApp({pool:api,verifyToken,limitJoin:async()=>true}));app.use(createCycleControlsRouter({pool:api,verifyToken,manualClose:closeWithEngine}));
  server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});
  const post=async(path,actor,body={})=>{const r=await fetch(`http://127.0.0.1:${server.address().port}/api${path}`,{method:'POST',headers:{authorization:'Bearer token'+actor,'content-type':'application/json'},body:JSON.stringify(body)});return {status:r.status,body:await r.json()};};
  const game=await post('/games',0,{name:'Piloto manual',cycleCount:3,duration:120,capitalMin:30000,capitalMax:30000,costs:{basic:30,standard:50,premium:70},events:[]});assert.equal(game.status,201);gameId=game.body.id;
  for(let i=1;i<=2;i++)assert.equal((await post('/join',i,{code:game.body.code,name:`Empresa piloto ${i}`})).status,201);
  const cycle=await post(`/games/${game.body.id}/start`,0);assert.equal(cycle.status,201);
  const decision={quality:'basic',quantity:10,price:100,marketingAmount:200,confirmed:true};
  for(let i=1;i<=2;i++){
   const response=await fetch(`http://127.0.0.1:${server.address().port}/api/games/${game.body.id}/decision`,{method:'PUT',headers:{authorization:'Bearer token'+i,'content-type':'application/json'},body:JSON.stringify(decision)});
   assert.equal(response.status,200);
  }
  const close=`/games/${game.body.id}/close`;
  assert.equal((await post(close,1)).status,403);
  assert.equal((await post(close,0)).status,409);
  assert.equal((await post(`/games/${game.body.id}/finish`,0)).status,409);
  await admin.query('update public.lite_cycles set close_requested_at=clock_timestamp() where id=$1',[cycle.body.id]);
  assert.equal(await closeWithEngine(game.body.id),null,'close_requested_at no adelanta el vencimiento');
  assert.equal((await post(close,0)).status,409);
  await admin.query("update public.lite_cycles set close_requested_at=null,starts_at=clock_timestamp()-interval '130 seconds',ends_at=clock_timestamp()-interval '10 seconds' where id=$1",[cycle.body.id]);
  const both=await Promise.all([post(close,0),post(close,0)]);assert.deepEqual(both.map(x=>x.status),[200,200]);assert.equal(both.filter(x=>x.body.already_closed===false).length,1);
  const {rows:[state]}=await admin.query("select status,(select count(*)::int from public.lite_results where cycle_id=$1) as results from public.lite_cycles where id=$1",[cycle.body.id]);
  assert.deepEqual(state,{status:'closed',results:2});
  const saved=await admin.query('select r.result,c.cash,c.inventory from public.lite_results r join public.lite_companies c on c.id=r.company_id where r.cycle_id=$1',[cycle.body.id]);
  for(const row of saved.rows){
   assert.equal(row.result.cashEnd,row.cash);
   assert.deepEqual(row.result.inventory,row.inventory);
   assert.equal(row.result.profit,row.result.revenue-row.result.costOfSales-row.result.marketing);
  }
  const next=await post(`/games/${game.body.id}/start`,0);
  assert.equal(next.status,201);assert.equal(next.body.number,2);
 }finally{if(server)await new Promise(resolve=>server.close(resolve));await closer.end();await api.end();if(gameId){await admin.query('delete from public.lite_results where game_id=$1',[gameId]);await admin.query('delete from public.lite_decisions where game_id=$1',[gameId]);await admin.query('delete from public.lite_games where id=$1',[gameId]);}for(const id of ids){await admin.query('delete from auth.sessions where user_id=$1',[id]);await admin.query('delete from auth.users where id=$1',[id]);}await admin.end();}
});
