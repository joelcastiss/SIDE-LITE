// Real Auth and Edge against the named disposable Supabase CLI stack only.
// No scheduler, hosted endpoint, deadline manipulation or production credential.
import assert from 'node:assert/strict';
import {randomUUID, randomBytes} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {createClient} from '@supabase/supabase-js';
import {closeCycle, rank} from '../js/engine.js';

if(process.env.SIDE_TEST_STACK!=='validation'||process.env.GUEST_TEST_DISPOSABLE!=='YES') throw Error('Se requiere stack validation desechable.');
const key=process.env.GUEST_TEST_ANON_KEY;
if(!key || !/^[A-Za-z0-9._-]+$/.test(key)) throw Error('Falta clave pública local.');
const project='side-lite-validation-20261110',base='http://127.0.0.1:56721',mail='http://127.0.0.1:56724';
for(const [service,internal,port] of [['kong','8000/tcp','56721'],['inbucket','8025/tcp','56724'],['db','5432/tcp','56722']]){
 const name=`supabase_${service}_${project}`,running=spawnSync('docker',['inspect','--format','{{.State.Running}}',name],{encoding:'utf8'}),mapped=spawnSync('docker',['port',name,internal],{encoding:'utf8'});
 if(running.status!==0||running.stdout.trim()!=='true'||mapped.status!==0||!mapped.stdout.trim()||!mapped.stdout.trim().split(/\r?\n/).every(line=>line.endsWith(':'+port))) throw Error(`Destino local inesperado: ${service}`);
}
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const teacher=createClient(base,key,{auth:{persistSession:false,autoRefreshToken:false}}), a=createClient(base,key,{auth:{persistSession:false,autoRefreshToken:false}}),b=createClient(base,key,{auth:{persistSession:false,autoRefreshToken:false}});
const email=`test-${randomUUID()}@upch.pe`, password=`S-${randomUUID()}!`;
const uuid=id=>{assert.match(id,/^[a-f0-9-]{36}$/i);return id;};
function sql(query){const result=spawnSync('docker',['exec',`supabase_db_${project}`,'psql','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1','-tAc',query],{encoding:'utf8'});if(result.status!==0)throw Error('Error SQL en stack local');return result.stdout.trim();}
async function req(client,path,method='GET',body){
 const session=client && (await client.auth.getSession()).data.session;
 const response=await fetch(base+'/functions/v1/side-lite-api/api'+path,{method,headers:{apikey:key,...(session?{authorization:'Bearer '+session.access_token}:{}),...(body===undefined?{}:{'content-type':'application/json'})},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(45000)});
 return {status:response.status,data:await response.json().catch(()=>({}))};
}
const expectStatus=(r,s)=>{assert.equal(r.status,s,`HTTP esperado ${s}, recibido ${r.status}`);return r.data;};
try {
 const signup=await teacher.auth.signUp({email,password,options:{data:{display_name:'Docente local'}}});if(signup.error)throw signup.error;assert.ok(signup.data.user);assert.equal(signup.data.session,null);
 let message;for(let i=0;i<50&&!message;i++){const r=await fetch(mail+'/api/v1/messages');if(r.ok)message=(await r.json()).messages.find(m=>m.To?.some(x=>x.Address===email));if(!message)await sleep(400);}
 assert.ok(message,'Confirmación enviada al buzón local');const detail=await(await fetch(mail+'/api/v1/message/'+encodeURIComponent(message.ID))).json();
 const match=detail.HTML.match(/https?:\/\/[^\s"<>\\]+\/auth\/v1\/verify\?[^\s"<>\\]+/);assert.ok(match,'Enlace de confirmación');const link=new URL(match[0].replaceAll('&amp;','&'));assert.equal(link.origin,base);const confirm=await fetch(link,{redirect:'manual'});assert.ok([200,302,303].includes(confirm.status));
 const signin=await teacher.auth.signInWithPassword({email,password});if(signin.error)throw signin.error;
 for(const client of [a,b]){const signed=await client.auth.signInAnonymously();if(signed.error)throw signed.error;assert.equal(signed.data.user.is_anonymous,true);}
 const profile=expectStatus(await req(teacher,'/me'),200);assert.equal(profile.role,'teacher','Autorización docente real de la política del stack local');
 const costs={basic:50,standard:80,premium:120};
 const game=expectStatus(await req(teacher,'/games','POST',{name:'Cierre manual aislado',cycleCount:3,duration:120,capitalMin:30000,capitalMax:30000,costs,events:[]}),201);uuid(game.id);
 const companies=[];for(const [i,c] of [a,b].entries())companies.push(expectStatus(await req(c,'/join','POST',{code:game.code,name:`Empresa local ${i}`,brand:`Marca ${i}`,recoverySecret:randomBytes(32).toString('base64url')}),201));
 const started=expectStatus(await req(teacher,`/games/${game.id}/start`,'POST',{}),201);uuid(started.id);assert.equal(Date.parse(started.ends_at)-Date.parse(started.starts_at),120000);
 const decisions=[{quality:'basic',quantity:250,price:150,marketingAmount:0,confirmed:true},{quality:'standard',quantity:250,price:200,marketingAmount:200,confirmed:true}];
 for(const [i,c] of [a,b].entries())expectStatus(await req(c,`/games/${game.id}/decision`,'PUT',decisions[i]),200);
 for(const [i,c] of [a,b].entries()){const view=expectStatus(await req(c,`/games/${game.id}`),200);assert.equal(view.ownDecision.confirmed,true);assert.equal(view.ownDecision.quantity,decisions[i].quantity);}
 const path=`/games/${game.id}/close`;
 const preflight=await fetch(base+'/functions/v1/side-lite-api/api'+path,{method:'OPTIONS',headers:{origin:'http://127.0.0.1:4178','access-control-request-method':'POST','access-control-request-headers':'authorization,apikey,content-type'}});
 assert.equal(preflight.status,204,'Preflight de cierre');
 expectStatus(await req(null,path,'POST',{}),401);expectStatus(await req(a,path,'POST',{}),403);expectStatus(await req(teacher,path,'POST',{}),409);
 // A deliberately wrong route is a reproducible 404 control; the actual route
 // returns 409 before expiry, demonstrating it exists in this local build.
 expectStatus(await req(teacher,path+'-missing','POST',{}),404);
 const seed=uuid(sql(`select seed from side_lite_private.lite_cycle_secrets where cycle_id='${started.id}'`));
 const expected=companies.map((c,i)=>closeCycle({cash:30000,batches:[],costs,event:null,seed,companyId:uuid(c.id),decision:decisions[i]}));
 // Reproduce a transient close failure after expiry without changing the timer.
 sql(`delete from side_lite_private.lite_cycle_secrets where cycle_id='${started.id}'`);
 const remaining=Date.parse(started.ends_at)-Date.now();if(remaining>0)await sleep(remaining+350);
 const failed=await req(teacher,path,'POST',{});expectStatus(failed,500);
 assert.equal(sql(`select count(*) from public.lite_results where cycle_id='${started.id}'`),'0');
 assert.equal(sql(`select status from public.lite_cycles where id='${started.id}'`),'open');
 sql(`insert into side_lite_private.lite_cycle_secrets(cycle_id,seed) values('${started.id}','${seed}')`);
 const closed=await Promise.all([req(teacher,path,'POST',{}),req(teacher,path,'POST',{})]);assert.deepEqual(closed.map(x=>x.status),[200,200]);assert.equal(closed.filter(x=>x.data.already_closed===false).length,1);
 expectStatus(await req(teacher,path,'POST',{}),200);assert.equal(sql(`select count(*) from public.lite_results where cycle_id='${started.id}'`),'2');
 const view=expectStatus(await req(teacher,`/games/${game.id}`),200);assert.equal(view.results.length,2);assert.equal(view.ranking.length,2);
 const predictedRanking=rank(companies.map((c,i)=>({id:c.id,name:c.name,cash:expected[i].cashEnd,initialCapital:30000,inventoryValue:expected[i].inventory.reduce((sum,b)=>sum+b.quantity*b.unitCost,0)})));
 assert.deepEqual(view.ranking.map(x=>x.id),predictedRanking.map(x=>x.id));
 for(let i=0;i<2;i++)assert.ok(expected[i].inventory.length>0,'Inventario no vendido conservado');
 for(let i=0;i<2;i++){const item=view.results.find(r=>r.company_id===companies[i].id);assert.ok(item);assert.deepEqual(item.result,expected[i]);const own=expectStatus(await req([a,b][i],`/games/${game.id}`),200);assert.equal(own.results.length,1);assert.equal(own.results[0].company_id,companies[i].id);}
 const next=expectStatus(await req(teacher,`/games/${game.id}/start`,'POST',{}),201);assert.equal(next.number,2);
 console.log('PASS: Auth local real, ruta Edge, 120 s, rechazo de acceso, rollback, recuperación, concurrencia, resultados y siguiente ciclo.');
 console.log('La ruta errónea de control produjo 404; no reproduce el código histórico desplegado que generó 404 en producción.');
} finally {for(const client of [teacher,a,b])await client.auth.signOut().catch(()=>{});}
