import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import pg from 'pg';
import {createGamesApp} from '../api/games.js';
import {createPodiumRouter} from '../api/podium.js';
test('podio privado: notas, propiedad, programación y caducidad',async t=>{
 const connectionString=process.env.SIDE_LITE_TEST_DATABASE_URL;if(!connectionString)return t.skip('PostgreSQL aislado requerido');const target=new URL(connectionString);if(!['127.0.0.1','localhost','::1','[::1]'].includes(target.hostname)||target.pathname!=='/side_lite_supabase_test')throw Error('Destino inseguro');
 const pool=new pg.Pool({connectionString}),apiPool=new pg.Pool({connectionString,options:'-c role=side_lite_api'}),ids=Array.from({length:4},()=>crypto.randomUUID()),sessions=ids.map(()=>crypto.randomUUID()),identities=ids.map((id,i)=>({id,sessionId:sessions[i],aal:'aal1',isAnonymous:i!==0}));let server;
 try{
  for(let i=0;i<ids.length;i++){const email=i===0?`podium-${ids[i]}@upch.pe`:null;await pool.query('insert into auth.users(id,email,email_confirmed_at,is_anonymous) values($1,$2,now(),$3)',[ids[i],email,i!==0]);await pool.query('insert into auth.sessions(id,user_id,aal) values($1,$2,$3)',[sessions[i],ids[i],'aal1'])}
  await pool.query('insert into side_lite_private.lite_teacher_grants(user_id,approved_email,granted_by) values($1,$2,$3) on conflict (user_id) do update set granted_by=excluded.granted_by',[ids[0],`podium-${ids[0]}@upch.pe`,ids[3]]);
  const verifyToken=async token=>{const m=/^token([0-3])$/.exec(token);if(!m)throw Error('invalid');return identities[Number(m[1])]};const app=createGamesApp({pool:apiPool,verifyToken,limitJoin:async()=>true});app.use(createPodiumRouter({pool:apiPool,verifyToken}));server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s))});const base=`http://127.0.0.1:${server.address().port}`;
  async function req(method,path,n,body){const r=await fetch(base+path,{method,headers:{authorization:`Bearer token${n}`,...(body!==undefined?{'content-type':'application/json'}:{})},...(body!==undefined?{body:JSON.stringify(body)}:{})});return {status:r.status,body:await r.json()}}
  const g=await req('POST','/api/games',0,{name:'Podio prueba',cycleCount:3,duration:120,costs:{basic:50,standard:80,premium:120},events:[]});assert.equal(g.status,201);const game=g.body.id;
  const a=await req('POST','/api/join',1,{code:g.body.code,name:'Empresa A'}),b=await req('POST','/api/join',2,{code:g.body.code,name:'Empresa B'});assert.equal(a.status,201);assert.equal(b.status,201);
  const factor=crypto.randomUUID();await pool.query('insert into auth.mfa_factors(id,user_id,status) values($1,$2,$3)',[factor,ids[0],'verified']);
  assert.equal((await req('GET',`/api/games/${game}/podium`,0)).status,403);
  await pool.query("update auth.sessions set aal='aal2' where id=$1",[sessions[0]]);assert.equal((await req('GET',`/api/games/${game}/podium`,0)).status,403);
  identities[0].aal='aal2';assert.equal((await req('GET',`/api/games/${game}/podium`,0)).status,200);
  assert.equal((await req('GET',`/api/games/${game}/podium`,3)).status,403);assert.equal((await req('PUT',`/api/games/${game}/grades/${a.body.id}`,1,{grade:20})).status,403);assert.equal((await req('PUT',`/api/games/${game}/grades/${a.body.id}`,0,{grade:21})).status,400);
  assert.equal((await req('PUT',`/api/games/${game}/grades/${a.body.id}`,0,{grade:18})).status,200);assert.equal((await req('PUT',`/api/games/${game}/grades/${b.body.id}`,0,{grade:19})).status,200);assert.equal((await req('POST',`/api/games/${game}/podium`,0,{reason:'Prueba'})).status,409);
  for(let n=1;n<=3;n++)await pool.query("insert into public.lite_cycles(game_id,number,ends_at,status) values($1,$2,now()+interval '120 seconds','closed')",[game,n]);
  assert.equal((await req('POST',`/api/games/${game}/podium`,0,{reason:'Justificación',delayMinutes:2})).status,200);assert.equal((await req('GET',`/api/games/${game}/podium`,1)).body.published,null);assert.equal((await req('DELETE',`/api/games/${game}/podium`,1)).status,403);assert.equal((await req('DELETE',`/api/games/${game}/podium`,0)).status,200);
  assert.equal((await req('POST',`/api/games/${game}/podium`,0,{reason:'Resultado'})).status,200);const published=await req('GET',`/api/games/${game}/podium`,1);assert.equal(published.body.published.ranking[0].companyId,b.body.id);assert.equal(published.body.published.reason,'Resultado');assert.equal((await req('DELETE',`/api/games/${game}/podium`,0)).status,409);
  await pool.query("update side_lite_private.teacher_podium set scheduled_at=now()-interval '25 hours' where game_id=$1",[game]);assert.equal((await req('GET',`/api/games/${game}/podium`,1)).body.published,null);
  for(const name of ['teacher_grades','teacher_podium'])for(const role of ['anon','authenticated']){const {rows:[r]}=await pool.query('select has_table_privilege($1,$2,$3) as allowed',[role,`side_lite_private.${name}`,'SELECT']);assert.equal(r.allowed,false)}
 }finally{if(server)await new Promise(resolve=>server.close(resolve));await apiPool.end();await pool.end()}
});
