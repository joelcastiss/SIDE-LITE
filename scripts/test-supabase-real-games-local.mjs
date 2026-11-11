// Real-time end-to-end API test: strictly limited to the disposable local stack.
// Runs both games concurrently; no cycle deadlines or security controls are changed.
import assert from 'node:assert/strict';
import {randomUUID, randomBytes} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {createClient} from '@supabase/supabase-js';

if (process.env.GUEST_TEST_DISPOSABLE !== 'YES' || !process.env.GUEST_TEST_ANON_KEY) throw Error('Se requiere stack local desechable y clave pública local.');
const validation=process.env.SIDE_TEST_STACK==='validation';
const project=validation?'side-lite-validation-20261110':'side-lite-codex-guest-20261109',apiPort=validation?'56721':'56621',mailPort=validation?'56724':'56624',dbPort=validation?'56722':'56622',base=`http://127.0.0.1:${apiPort}`,mail=`http://127.0.0.1:${mailPort}`,key=process.env.GUEST_TEST_ANON_KEY;
for(const [service,internal,port] of [['kong','8000/tcp',apiPort],['inbucket','8025/tcp',mailPort],['db','5432/tcp',dbPort]]) {
 const name=`supabase_${service}_${project}`, running=spawnSync('docker',['inspect','--format','{{.State.Running}}',name],{encoding:'utf8'}), mapped=spawnSync('docker',['port',name,internal],{encoding:'utf8'});
 if(running.stdout.trim()!=='true'||!mapped.stdout.trim().split(/\r?\n/).every(s=>s.endsWith(':'+port))) throw Error('Destino local inesperado.');
}
const clients=Array.from({length:4},()=>createClient(base,key,{auth:{persistSession:false,autoRefreshToken:false}}));
const [teacher,a,b,recovered]=clients, ids=[], games=[], adminId=randomUUID(), email=`real-games-${randomUUID()}@upch.pe`, password=`S-${randomUUID()}!`;
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let cancelled=false;
function sql(query) {const r=spawnSync('docker',['exec',`supabase_db_${project}`,'psql','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1','-tAc',query],{encoding:'utf8'});if(r.status!==0)throw Error('SQL local: '+r.stderr);return r.stdout.trim();}
async function req(client,path,method='GET',body) {
 const s=(await client.auth.getSession()).data.session;if(!s)throw Error('Sin sesión de prueba');
 const response=await fetch(base+'/functions/v1/side-lite-api/api'+path,{method,headers:{apikey:key,authorization:'Bearer '+s.access_token,...(body?{'content-type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
 const data=await response.json().catch(()=>({}));return {status:response.status,data};
}
function status(result, expected) {assert.equal(result.status,expected,JSON.stringify(result.data));return result.data;}
async function play(count) {
 const game=status(await req(teacher,'/games','POST',{name:`Real ${count} ${randomUUID()}`,cycleCount:count,duration:120,capitalMin:30000,capitalMax:30000,costs:{basic:50,standard:80,premium:120},events:[]}),201);games.push(game.id);
 const secrets=[randomBytes(32).toString('base64url'),randomBytes(32).toString('base64url')];
 const companies=[];
 for(const [i,student] of [a,b].entries()) companies.push(status(await req(student,'/join','POST',{code:game.code,name:`Empresa ${count}-${i}`,brand:`Marca ${count}-${i}`,recoverySecret:secrets[i]}),201));
 const initial=status(await req(teacher,`/games/${game.id}`),200);assert.equal(initial.companies.length,2);
 console.log(`Partida ${count}: docente ve dos empresas; comienzan ciclos reales.`);
 let players=[a,b];
 for(let cycle=1;cycle<=count;cycle++) {
  if(cancelled) throw Error('Prueba cancelada tras fallo en la otra partida.');
  const started=status(await req(teacher,`/games/${game.id}/start`,'POST',{}),201);
  assert.equal(started.number,cycle);assert.equal(Date.parse(started.ends_at)-Date.parse(started.starts_at),120000);
  for(const [i,student] of players.entries()) status(await req(student,`/games/${game.id}/decision`,'PUT',{quality:i?'standard':'basic',quantity:2,price:150,marketingAmount:0,confirmed:true}),200);
  const submitted=status(await req(teacher,`/games/${game.id}`),200);assert.equal(submitted.decisions.filter(x=>x.confirmed).length,2);
  // No client is asked to close or advance the game while the deadline runs.
  const end=Date.parse(started.ends_at), timeout=end+45000;
  while(Date.now()<timeout && !cancelled) {if(sql(`select status from public.lite_cycles where id='${started.id}'`)==='closed')break;await sleep(2000);}
  if(cancelled) throw Error('Prueba cancelada tras fallo en la otra partida.');
  assert.equal(sql(`select status from public.lite_cycles where id='${started.id}'`),'closed','el programador debe cerrar el ciclo');
  assert.ok(Date.now()>=end,'no debe cerrar antes del vencimiento');
  const view=status(await req(teacher,`/games/${game.id}`),200);
  assert.equal(view.results.length,cycle*2);assert.equal(view.ranking.length,2);
  assert.equal(sql(`select count(*) from public.lite_results where cycle_id='${started.id}'`),'2');
  for(const student of players) {const own=status(await req(student,`/games/${game.id}`),200);assert.equal(own.results.length,cycle);assert.ok(own.company);}
  console.log(`PASS: partida ${count}, ciclo ${cycle}/${count}, 120 s reales, cierre, dos resultados y ranking.`);
  if(count===3 && cycle===1) {
   const nextSecret=randomBytes(32).toString('base64url');
   const moved=status(await req(recovered,'/guest/recover','POST',{code:game.code,recoverySecret:secrets[0],newRecoverySecret:nextSecret}),200);
   assert.equal(moved.id,companies[0].id);assert.equal((await req(a,`/games/${game.id}`)).status,403);
   assert.equal(sql(`select count(*) from public.lite_companies where game_id='${game.id}'`),'2');players=[recovered,b];
   console.log('PASS: recuperación entre ciclos y sesión anterior revocada sin duplicar empresa.');
  }
 }
 assert.equal((await req(teacher,`/games/${game.id}/start`,'POST',{})).status,409);
 console.log(`PASS: partida completa de ${count} ciclos con dos estudiantes.`);
}
try {
 sql(`insert into auth.users(id,email,email_confirmed_at) values('${adminId}','admin-${adminId}@example.test',now())`);ids.push(adminId);
 const signup=await teacher.auth.signUp({email,password,options:{data:{display_name:'Docente prueba'}}});if(signup.error)throw signup.error;ids.push(signup.data.user.id);
 let message;for(let n=0;n<40&&!message;n++){const response=await fetch(mail+'/api/v1/messages');if(response.ok)message=(await response.json()).messages.find(m=>m.To?.some(x=>x.Address===email));if(!message)await sleep(400);}
 assert.ok(message,'correo local de confirmación');const detail=await(await fetch(mail+'/api/v1/message/'+encodeURIComponent(message.ID))).json(),found=detail.HTML.match(/https?:\/\/[^\s"<>\\]+\/auth\/v1\/verify\?[^\s"<>\\]+/);assert.ok(found);const link=new URL(found[0].replaceAll('&amp;','&'));assert.equal(link.origin,base);await fetch(link,{redirect:'manual'});
 sql(`insert into side_lite_private.lite_teacher_grants(user_id,approved_email,granted_by) select id,email,'${adminId}'::uuid from auth.users where email='${email}' on conflict (user_id) do nothing`);
 const signin=await teacher.auth.signInWithPassword({email,password});if(signin.error)throw signin.error;
 for(const student of [a,b,recovered]) {const signed=await student.auth.signInAnonymously();if(signed.error)throw signed.error;assert.equal(signed.data.user.is_anonymous,true);ids.push(signed.data.user.id);}
 const outcomes=await Promise.allSettled([3,6].map(count=>play(count).catch(error=>{cancelled=true;throw error;})));
 const failure=outcomes.find(result=>result.status==='rejected');if(failure)throw failure.reason;
} finally {
 for(const client of clients)await client.auth.signOut().catch(()=>{});
 for(const id of games)if(/^[a-f0-9-]{36}$/.test(id))sql(`delete from public.lite_results where game_id='${id}'; delete from public.lite_decisions where game_id='${id}'; delete from public.lite_games where id='${id}'`);
 for(const id of ids.reverse())if(/^[a-f0-9-]{36}$/.test(id))sql(`delete from side_lite_private.lite_teacher_grants where user_id='${id}'; delete from public.lite_profiles where id='${id}'; delete from auth.users where id='${id}'`);
}
