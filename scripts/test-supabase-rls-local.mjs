// Live local Supabase Auth + REST + RLS; creates and removes only unique fixtures.
// Never run against a hosted project or a stack shared with real users.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import pg from 'pg';

if(process.env.SIDE_TEST_DISPOSABLE!=='YES')throw Error('Requiere SIDE_TEST_DISPOSABLE=YES');
const key=process.env.SIDE_TEST_LOCAL_ANON_KEY, dbUrl=new URL(process.env.SIDE_LOCAL_POSTGRES_URL||'invalid:');
if(!key||!['postgres:','postgresql:'].includes(dbUrl.protocol)||dbUrl.hostname!=='127.0.0.1'||dbUrl.port!=='56522'||dbUrl.pathname!=='/postgres'||dbUrl.search||dbUrl.hash)throw Error('Destino local aislado incorrecto');
const project='side-lite-supabase-stack-verify';
for(const [service,internal,port] of [['db','5432/tcp','56522'],['kong','8000/tcp','56521'],['inbucket','8025/tcp','56524']]){
 const name=`supabase_${service}_${project}`,running=spawnSync('docker',['inspect','--format','{{.State.Running}}',name],{encoding:'utf8'}),mapped=spawnSync('docker',['port',name,internal],{encoding:'utf8'});
 if(running.status!==0||running.stdout.trim()!=='true'||mapped.status!==0||!mapped.stdout.trim().split(/\r?\n/).every(x=>x.endsWith(`:${port}`)))throw Error('Contenedor o puerto inesperado');
}
const base='http://127.0.0.1:56521',mail='http://127.0.0.1:56524',suffix=randomUUID(),password=`T-${randomUUID()}-Local!`;
const users=[], gameIds=[randomUUID(),randomUUID()], companyIds=[randomUUID(),randomUUID(),randomUUID()],cycleId=randomUUID();
const db=new pg.Client({connectionString:dbUrl.toString()});await db.connect();
async function post(path,body,token){
 const r=await fetch(`${base}/auth/v1${path}`,{method:'POST',headers:{apikey:key,'content-type':'application/json',...(token?{authorization:`Bearer ${token}`}:{})},body:JSON.stringify(body)});
 let data={};try{data=await r.json()}catch{}return {status:r.status,data};
}
async function account(label,domain){
 const email=`rls-${label}-${suffix}@${domain}`,registered=await post('/signup',{email,password});assert.equal(registered.status,200);const id=registered.data.user?.id||registered.data.id;assert.ok(id);assert.ok(!registered.data.access_token);
 const user={id,email};users.push(user);
 let msg;for(let i=0;i<40&&!msg;i++){const r=await fetch(`${mail}/api/v1/messages`);if(r.ok)msg=(await r.json()).messages.find(m=>m.To?.some(x=>x.Address===email));if(!msg)await new Promise(resolve=>setTimeout(resolve,500));}
 assert.ok(msg,'confirmación por buzón local');const detail=await (await fetch(`${mail}/api/v1/message/${encodeURIComponent(msg.ID)}`)).json();
 const link=detail.HTML.match(/https?:\/\/[^\s"<>\\]+\/auth\/v1\/verify\?[^\s"<>\\]+/);assert.ok(link);
 const url=new URL(link[0].replaceAll('&amp;','&'));assert.equal(url.origin,base);assert.ok([200,302,303].includes((await fetch(url,{redirect:'manual'})).status));
 const signed=await post('/token?grant_type=password',{email,password});assert.equal(signed.status,200);user.token=signed.data.access_token;assert.ok(user.token);return user;
}
async function rest(path,user,method='GET',body){
 const response=await fetch(`${base}/rest/v1/${path}`,{method,headers:{apikey:key,authorization:`Bearer ${user?.token||key}`,...(body?{'content-type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
 let data=null;try{data=await response.json()}catch{}return {status:response.status,data};
}
try {
 const teacher=await account('teacher','upch.pe'),a=await account('student-a','example.test'),b=await account('student-b','example.test'),c=await account('outsider','example.test');
 const beforeGrant=await rest('rpc/lite_my_identity',teacher,'POST',{});assert.equal(beforeGrant.status,200);assert.equal(beforeGrant.data[0].role,'student','el correo institucional no otorga rol docente');
 const rights=await db.query(`select has_schema_privilege('side_lite_api_login','auth','USAGE') as direct_auth,has_function_privilege('side_lite_api_login','side_lite_private.api_identity(uuid,uuid)','execute') as bridge`);
 assert.equal(rights.rows[0].direct_auth,false);assert.equal(rights.rows[0].bridge,true);
 await db.query('begin');
 // This separate fixture represents an administrator in the disposable stack.
 await db.query('insert into side_lite_private.lite_teacher_grants(user_id,approved_email,granted_by) values($1,$2,$3)',[teacher.id,teacher.email,c.id]);
 for(let i=0;i<2;i++)await db.query('insert into public.lite_games(id,teacher_id,name,code,cycle_count,capital_min,capital_max,costs) values($1,$2,$3,$4,3,10000,10000,$5)',[gameIds[i],teacher.id,`RLS ${suffix}`,randomUUID().replaceAll('-','').slice(0,8).toUpperCase(),{}]);
 const {rows:[store]}=await db.query('select id from public.lite_stores order by id limit 1');
 for(let i=0;i<3;i++)await db.query('insert into public.lite_companies(id,game_id,student_id,name,store_id,initial_capital,cash) values($1,$2,$3,$4,$5,10000,10000)',[companyIds[i],gameIds[i===2?1:0],[a,b,c][i].id,`RLS ${i}`,store.id]);
 await db.query("insert into public.lite_cycles(id,game_id,number,ends_at) values($1,$2,1,now()+interval '120 seconds')",[cycleId,gameIds[0]]);
 for(let i=0;i<2;i++){
  await db.query("insert into public.lite_decisions(game_id,cycle_id,company_id,quality,quantity,price,marketing_amount) values($1,$2,$3,'basic',1,100,0)",[gameIds[0],cycleId,companyIds[i]]);
  await db.query('insert into public.lite_results(game_id,cycle_id,company_id,result) values($1,$2,$3,$4)',[gameIds[0],cycleId,companyIds[i],{profit:i}]);
 }
 await db.query('commit');
 const afterGrant=await rest('rpc/lite_my_identity',teacher,'POST',{});assert.equal(afterGrant.status,200);assert.equal(afterGrant.data[0].role,'teacher');
 const own=await rest(`lite_results?select=company_id&game_id=eq.${gameIds[0]}`,a);assert.equal(own.status,200);assert.deepEqual(own.data.map(x=>x.company_id),[companyIds[0]]);
 const peer=await rest(`lite_decisions?select=company_id&game_id=eq.${gameIds[0]}`,a);assert.equal(peer.status,200);assert.deepEqual(peer.data.map(x=>x.company_id),[companyIds[0]]);
 const foreign=await rest(`lite_games?select=id&id=eq.${gameIds[1]}`,a);assert.equal(foreign.status,200);assert.deepEqual(foreign.data,[]);
 const faculty=await rest(`lite_results?select=company_id&game_id=eq.${gameIds[0]}`,teacher);assert.equal(faculty.status,200);assert.equal(faculty.data.length,2);
 const wrongTeacher=await rest(`lite_results?select=company_id&game_id=eq.${gameIds[0]}`,c);assert.equal(wrongTeacher.status,200);assert.deepEqual(wrongTeacher.data,[]);
 assert.notEqual((await rest(`lite_results?select=id&game_id=eq.${gameIds[0]}`,null)).status,200,'anon no accede a resultados');
 assert.notEqual((await rest(`lite_games?select=code&id=eq.${gameIds[0]}`,a)).status,200,'código no accesible por Data API');
 assert.notEqual((await rest(`lite_companies?id=eq.${companyIds[0]}`,a,'PATCH',{cash:999999})).status,200,'no modifica caja');
 await db.query('update side_lite_private.lite_teacher_grants set revoked_at=now() where user_id=$1',[teacher.id]);
 const revoked=await rest(`lite_results?select=company_id&game_id=eq.${gameIds[0]}`,teacher);assert.equal(revoked.status,200);assert.deepEqual(revoked.data,[]);
 assert.ok([200,204].includes((await post('/logout',{},a.token)).status));
 const loggedOut=await rest(`lite_results?select=company_id&game_id=eq.${gameIds[0]}`,a);assert.equal(loggedOut.status,200);assert.deepEqual(loggedOut.data,[]);
 console.log('PASS: Auth y REST locales reales; RLS positiva/negativa, aislamiento, docente revocado, logout y API sin USAGE auth.');
} finally {
 try{
  await db.query('rollback');await db.query('begin');
  await db.query('delete from public.lite_results where game_id=any($1::uuid[])',[gameIds]);
  await db.query('delete from public.lite_decisions where game_id=any($1::uuid[])',[gameIds]);
  await db.query('delete from side_lite_private.lite_cycle_secrets where cycle_id=$1',[cycleId]);
  await db.query('delete from public.lite_games where id=any($1::uuid[])',[gameIds]);
  await db.query('delete from side_lite_private.lite_teacher_grants where user_id=any($1::uuid[])',[users.map(x=>x.id)]);
  await db.query('delete from auth.users where id=any($1::uuid[])',[users.map(x=>x.id)]);
  await db.query('commit');
 }catch(e){await db.query('rollback');console.error('No se completó la limpieza de los fixtures RLS aislados:',e.message);process.exitCode=1;}
 await db.end();
}
