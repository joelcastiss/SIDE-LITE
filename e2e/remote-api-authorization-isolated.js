// Destructive fixtures: run ONLY against an empty disposable localhost database.
import pg from 'pg';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {createApi} from '../remote/api-app.js';
import {closeDue} from '../remote/close-cycle.js';
import {randomUUID} from 'node:crypto';
const u=new URL(process.env.SIDE_LITE_API_TEST_DATABASE_URL||'');
if(!['postgres:','postgresql:'].includes(u.protocol)||!['localhost','127.0.0.1','[::1]'].includes(u.hostname)||u.pathname!=='/side_lite_api_test'||['host','hostaddr','service'].some(k=>u.searchParams.has(k)))throw Error('Solo se permite side_lite_api_test local y aislada');
const owner=new pg.Pool({connectionString:u.toString(),max:2});let apiPool,closerPool,server;
try{
 if((await owner.query("SELECT 1 FROM pg_namespace WHERE nspname IN ('lite','neon_auth')")).rowCount)throw Error('La base de pruebas debe estar vacía');
 await owner.query('CREATE SCHEMA neon_auth; CREATE TABLE neon_auth."user" (id uuid PRIMARY KEY,email text,"emailVerified" boolean,banned boolean)');
 await owner.query('CREATE ROLE lite_dev_api NOLOGIN NOINHERIT; CREATE ROLE lite_dev_closer NOLOGIN NOINHERIT');
 const directory=new URL('../remote/migrations/',import.meta.url);
 for(const name of (await readdir(directory)).filter(x=>/^\d+.*\.sql$/.test(x)).sort())await owner.query(await readFile(new URL(name,directory),'utf8'));
 const names=['teacher','otherTeacher','student','otherStudent','outsider','revokedTeacher'];
 const ids=Object.fromEntries(names.map(name=>[name,randomUUID()]));
 for(const name of names){
  const email=`${name.toLowerCase()}@upch.pe`;await owner.query('INSERT INTO neon_auth."user" VALUES ($1,$2,true,false)',[ids[name],email]);
  await owner.query('INSERT INTO lite.lite_profiles(id,display_name,role) VALUES($1,$2,$3)',[ids[name],name,name.toLowerCase().includes('teacher')?'teacher':'student']);
  if(['teacher','otherTeacher'].includes(name))await owner.query("INSERT INTO lite.teacher_grants(email,note) VALUES($1,'Prueba local')",[email]);
 }
 apiPool=new pg.Pool({connectionString:u.toString(),options:'-c role=lite_dev_api',max:4});
 const app=createApi({pool:apiPool,verify:async value=>{const key=value?.replace(/^Bearer /,'');if(!ids[key])throw Error('unauthorized');return {subject:ids[key]}}});
 server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s))});const base=`http://127.0.0.1:${server.address().port}`;
 async function req(who,path,method='GET',data){const r=await fetch(base+path,{method,headers:{authorization:`Bearer ${who}`,...(data?{'content-type':'application/json'}:{})},...(data?{body:JSON.stringify(data)}:{})});const body=await r.json();return {status:r.status,body}}
 const gameConfig={name:'Aula aislada',cycleCount:3,duration:120,capitalMin:30000,capitalMax:30000,costs:{basic:50,standard:80,premium:120},events:[]};
 assert.equal((await req('student','/api/games','POST',gameConfig)).status,403);
 assert.equal((await req('revokedTeacher','/api/games','POST',gameConfig)).status,403);
 const created=await req('teacher','/api/games','POST',gameConfig);assert.equal(created.status,201);const game=created.body;
 const a=await req('student','/api/join','POST',{code:game.code,name:'Empresa A'}),b=await req('otherStudent','/api/join','POST',{code:game.code,name:'Empresa B'});assert.equal(a.status,201);assert.equal(b.status,201);
 assert.equal((await req('outsider',`/api/games/${game.id}`)).status,403);
 assert.equal((await req('otherTeacher',`/api/games/${game.id}`)).status,403);
 assert.equal((await req('otherTeacher',`/api/games/${game.id}/start`,'POST',{})).status,403);
 const started=await req('teacher',`/api/games/${game.id}/start`,'POST',{});assert.equal(started.status,201);assert.equal('seed' in started.body,false);
 const choice={quality:'basic',quantity:10,price:100,marketingAmount:200,confirmed:true};
 assert.equal((await req('outsider',`/api/games/${game.id}/decision`,'PUT',choice)).status,403);
 assert.equal((await req('teacher',`/api/games/${game.id}/decision`,'PUT',choice)).status,403);
 const spoof=await req('student',`/api/games/${game.id}/decision`,'PUT',{...choice,company_id:b.body.id});assert.equal(spoof.status,200);assert.equal(spoof.body.company_id,a.body.id);
 const view=await req('otherStudent',`/api/games/${game.id}`);assert.equal(view.status,200);assert.equal(view.body.ownDecision==null,true);assert.deepEqual(view.body.decisions,[]);assert.equal(view.body.companies.find(c=>c.id===a.body.id).cash,undefined);assert.equal('seed' in view.body.cycles[0],false);
 const faculty=await req('teacher',`/api/games/${game.id}`);assert.equal(faculty.status,200);assert.equal('seed' in faculty.body.cycles[0],false);
 const {rows:[priv]}=await owner.query("SELECT has_table_privilege('lite_dev_api','lite.lite_results','INSERT') api_result_insert, has_column_privilege('lite_dev_api','lite.lite_companies','cash','UPDATE') api_cash_update, has_column_privilege('lite_dev_api','lite.lite_cycles','status','UPDATE') api_cycle_update, has_table_privilege('lite_dev_closer','lite.lite_results','INSERT') closer_result_insert, has_column_privilege('lite_dev_closer','lite.lite_companies','cash','UPDATE') closer_cash_update, has_column_privilege('lite_dev_closer','lite.lite_cycles','status','UPDATE') closer_cycle_update");
 assert.deepEqual(priv,{api_result_insert:false,api_cash_update:false,api_cycle_update:false,closer_result_insert:true,closer_cash_update:true,closer_cycle_update:true});
 await assert.rejects(()=>apiPool.query('UPDATE lite.lite_cycles SET status=$1 WHERE id=$2',['closed',started.body.id]),e=>e.code==='42501');
 await owner.query("UPDATE lite.lite_cycles SET ends_at=now()-interval '1 second' WHERE id=$1",[started.body.id]);
 closerPool=new pg.Pool({connectionString:u.toString(),options:'-c role=lite_dev_closer',max:2});
 assert.equal(await closeDue(closerPool),1);
 const results=await owner.query('SELECT company_id FROM lite.lite_results WHERE cycle_id=$1',[started.body.id]);assert.equal(results.rowCount,2);
 await owner.query("UPDATE lite.teacher_grants SET active=false WHERE email='teacher@upch.pe'");
 assert.equal((await req('teacher',`/api/games/${game.id}`)).status,403);
 assert.equal((await req('teacher','/api/games','POST',gameConfig)).status,403);
 console.log('PASS: autorización docente, revocación, aislamiento entre partidas y decisiones por identidad');
}finally{if(server)await new Promise(resolve=>server.close(resolve));if(closerPool)await closerPool.end();if(apiPool)await apiPool.end();await owner.end()}
