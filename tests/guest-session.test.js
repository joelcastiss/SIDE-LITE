import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {createGamesApp} from '../supabase-side-lite/api/games.js';
const game=randomUUID(),first=randomUUID(),second=randomUUID(),teacher=randomUUID(),sid=randomUUID(),store=randomUUID();
const identities={a:{id:first,sessionId:sid,isAnonymous:true},b:{id:second,sessionId:sid,isAnonymous:true},teacher:{id:teacher,sessionId:sid,isAnonymous:false}};
function fixture(){const companies=[],hashes=new Map();const client={release(){},async query(sql,args=[]){
 const q=sql.replace(/\s+/g,' ').toLowerCase();if(/^(begin|commit|rollback)/.test(q))return {rows:[]};
 if(q.includes('lock_active_identity'))return {rows:[{active:true}]};if(q.includes('api_mfa_ready'))return {rows:[{allowed:true}]};
 if(q.includes('from public.lite_games where code='))return {rows:['AABBCCDD','A7K2M'].includes(args[0])?[{id:game,capital_min:20000,capital_max:100000,ended_at:null}]:[]};
 if(q.includes('api_find_guest_join')){const found=companies.find(c=>c.student_id===args[0]&&c.game_id===args[2]&&hashes.get(c.id)?.equals(args[3]));return {rows:found?[found]:[]}}
 if(q.includes('from public.lite_cycles'))return {rows:[]};if(q.includes('from public.lite_stores'))return {rows:[{id:store}]};
 if(q.startsWith('insert into public.lite_companies')){if(companies.some(c=>c.student_id===args[1]||c.name.toLowerCase()===args[2].toLowerCase()))throw Object.assign(Error('duplicate'),{code:'23505'});const c={id:randomUUID(),game_id:args[0],student_id:args[1],name:args[2],brand_name:args[5],initial_capital:args[4],cash:args[4],inventory:[]};companies.push(c);return {rows:[c]}}
 if(q.startsWith('insert into side_lite_private.lite_guest_recovery')){hashes.set(args[0],Buffer.from(args[1]));return {rows:[]}}
 if(q.includes('api_recover_guest')){const found=companies.find(c=>c.game_id===game&&args[2]==='AABBCCDD'&&hashes.get(c.id)?.equals(args[3]));if(!found)return {rows:[]};found.student_id=args[0];hashes.set(found.id,Buffer.from(args[4]));return {rows:[{id:found.id,game_id:found.game_id,name:found.name}]}}
 throw Error('Unexpected SQL: '+q)
 }};return {companies,hashes,pool:{connect:async()=>client}}}
async function serve(fn){const f=fixture(),app=createGamesApp({pool:f.pool,verifyToken:async token=>{if(!identities[token])throw Error('no');return identities[token]},limitJoin:async()=>true});const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const base=`http://127.0.0.1:${server.address().port}`;const post=async(path,token,body)=>{const r=await fetch(base+path,{method:'POST',headers:{authorization:`Bearer ${token}`,'content-type':'application/json'},body:JSON.stringify(body)});return {status:r.status,body:await r.json()}};try{await fn({...f,post})}finally{await new Promise(r=>server.close(r))}}
test('invitado requiere nombre comercial y la credencial es aleatoria, secreta y vinculada a la empresa',async()=>{await serve(async({post,companies,hashes})=>{
 assert.equal((await post('/api/join','a',{code:'AABBCCDD',name:'Empresa'})).status,400);const joined=await post('/api/join','a',{code:'AABBCCDD',name:'Empresa',brand:'Marca',recoverySecret:'x'.repeat(43)});assert.equal(joined.status,201);assert.match(joined.body.recoverySecret,/^[A-Za-z0-9_-]{43}$/);assert.equal(joined.body.brand_name,'Marca');assert.deepEqual(hashes.get(joined.body.id),createHash('sha256').update(joined.body.recoverySecret).digest());assert.notEqual(hashes.get(joined.body.id).toString('base64url'),joined.body.recoverySecret);assert.equal((await post('/api/join','b',{code:'AABBCCDD',name:'empresa',brand:'otra',recoverySecret:'y'.repeat(43)})).status,409);assert.equal((await post('/api/join','a',{code:'AABBCCDD',name:'Empresa',brand:'Marca',recoverySecret:'x'.repeat(43)})).body.id,joined.body.id);assert.equal(companies.length,1);
})});
test('recuperación rechaza secretos incorrectos, códigos ajenos y cuentas no invitadas; secreto válido transfiere propiedad',async()=>{await serve(async({post,companies})=>{const joined=await post('/api/join','a',{code:'AABBCCDD',name:'Empresa',brand:'Marca',recoverySecret:'x'.repeat(43)}),secret=joined.body.recoverySecret,next='b'.repeat(43);assert.equal((await post('/api/guest/recover','b',{code:'AABBCCDD',recoverySecret:'a'.repeat(43),newRecoverySecret:next})).status,403);assert.equal((await post('/api/guest/recover','b',{code:'00112233',recoverySecret:secret,newRecoverySecret:next})).status,403);assert.equal((await post('/api/guest/recover','teacher',{code:'AABBCCDD',recoverySecret:secret,newRecoverySecret:next})).status,403);assert.equal(companies[0].student_id,first);const restored=await post('/api/guest/recover','b',{code:'AABBCCDD',recoverySecret:secret,newRecoverySecret:next});assert.equal(restored.status,200);assert.equal(companies[0].student_id,second);assert.equal(Object.hasOwn(restored.body,'recoverySecret'),false);assert.equal((await post('/api/guest/recover','a',{code:'AABBCCDD',recoverySecret:secret,newRecoverySecret:'c'.repeat(43)})).status,403);assert.equal((await post('/api/guest/recover','a',{code:'AABBCCDD',recoverySecret:next,newRecoverySecret:'c'.repeat(43)})).status,200);
})});


test('acepta códigos nuevos y anteriores; rechaza formatos inválidos antes de buscar partidas',async()=>{await serve(async({post})=>{
 const secret='x'.repeat(43);
 for(const code of ['A7K2M','a7k2m','AABBCCDD']){const result=await post('/api/join','a',{code,name:'Empresa',brand:'Marca',recoverySecret:secret});assert.equal(result.status,201,code)}
 for(const code of ['A7K2','A7K2M9','ZZZZZZZZ','A7K-2','A7K2M ','']){const result=await post('/api/join','a',{code,name:'Empresa',brand:'Marca',recoverySecret:secret});assert.equal(result.status,400,code)}
})});


test('capital de empresas es un múltiplo válido, inicializa caja y sobrevive a un reintento',async()=>{
 const capitals=new Set();
 for(let i=0;i<40;i++) await serve(async({post,companies})=>{
  const body={code:'AABBCCDD',name:'Empresa',brand:'Marca',recoverySecret:'x'.repeat(43),initial_capital:25500,cash:37800};
  const first=await post('/api/join','a',body);
  assert.equal(first.status,201);
  assert.ok(first.body.initial_capital>=20000 && first.body.initial_capital<=100000);
  assert.equal(first.body.initial_capital%10000,0);
  assert.equal(first.body.cash,first.body.initial_capital);
  capitals.add(first.body.initial_capital);
  companies[0].cash-=1000;
  const retry=await post('/api/join','a',body);
  assert.equal(retry.body.initial_capital,first.body.initial_capital);
  assert.equal(retry.body.cash,first.body.initial_capital-1000);
  assert.equal(companies.length,1);
 });
 assert.ok(capitals.size>1,'Las empresas pueden recibir importes diferentes');
});
