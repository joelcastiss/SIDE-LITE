import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPair, SignJWT} from 'jose';
import {createTokenVerifier, createIdentityApp} from '../supabase-side-lite/api/identity.js';
const issuer='https://hwwwoblfpsqqrkxvclag.supabase.co/auth/v1';
const user='c529fd8d-6cec-4c01-9c18-16c079112e23', session='773d8048-bdeb-4bfb-973b-a0a808183235';
const {privateKey, publicKey}=await generateKeyPair('ES256');
const verify=createTokenVerifier({projectUrl:'https://hwwwoblfpsqqrkxvclag.supabase.co',keyResolver:async()=>publicKey});
async function token({iss=issuer,aud='authenticated',role='authenticated',sessionId=session,expiry='5m',metadata={}}={}) {
 return new SignJWT({role,session_id:sessionId,user_metadata:metadata}).setProtectedHeader({alg:'ES256'}).setSubject(user).setIssuer(iss).setAudience(aud).setIssuedAt().setExpirationTime(expiry).sign(privateKey);
}
async function withServer(record, callback){
 const calls=[];const pool={query:async(sql,params)=>(calls.push({sql,params}),{rows:record?[record]:[]})};
 const app=createIdentityApp({pool,verifyToken:verify});const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
 try {await callback(`http://127.0.0.1:${server.address().port}`,calls)} finally {await new Promise(r=>server.close(r))}
}
const student={id:user,display_name:'Ana',email_verified:true,teacher_authorized:false,session_active:true,banned:false};
test('requiere proyecto confirmado, firma, audiencia, emisor, vencimiento y sesión',async()=>{
 assert.throws(()=>createTokenVerifier({projectUrl:'https://otro.supabase.co'}));
 assert.deepEqual(await verify(await token()),{id:user,sessionId:session});
 for(const t of [await token({iss:'https://otro.supabase.co/auth/v1'}),await token({aud:'anon'}),await token({role:'service_role'}),await token({sessionId:'invalid'}),await token({expiry:'-1m'})]) await assert.rejects(()=>verify(t));
 const foreign=await generateKeyPair('ES256');const forged=await new SignJWT({role:'authenticated',session_id:session}).setProtectedHeader({alg:'ES256'}).setSubject(user).setIssuer(issuer).setAudience('authenticated').setExpirationTime('5m').sign(foreign.privateKey);await assert.rejects(()=>verify(forged));
});
test('identidad y aprobación provienen de base, no de metadatos del usuario',async()=>{
 await withServer(student,async(base,calls)=>{const response=await fetch(base+'/api/me',{headers:{authorization:`Bearer ${await token({metadata:{role:'teacher'}})}`}});assert.equal(response.status,200);assert.equal((await response.json()).role,'student');assert.deepEqual(calls[0].params,[user,session]);});
 await withServer({...student,teacher_authorized:true},async(base)=>{const r=await fetch(base+'/api/me',{headers:{authorization:`Bearer ${await token()}`}});assert.equal((await r.json()).role,'teacher')});
});
test('rechaza sesión revocada, usuario bloqueado, correo sin confirmar y perfil ausente',async()=>{
 for(const [record,status] of [[{...student,session_active:false},401],[{...student,banned:true},401],[{...student,email_verified:false},403],[{...student,id:null},409]]) {
  await withServer(record,async(base)=>{const r=await fetch(base+'/api/me',{headers:{authorization:`Bearer ${await token()}`}});assert.equal(r.status,status)});
 }
});
test('sin bearer y token alterado no llegan a la base',async()=>{
 await withServer(student,async(base,calls)=>{assert.equal((await fetch(base+'/api/me')).status,401);assert.equal((await fetch(base+'/api/me',{headers:{authorization:'Bearer bad.token.here'}})).status,401);assert.equal(calls.length,0)});
});

test('alta de perfil usa solo ID verificado y exige cuenta y sesión activas',async()=>{
 await withServer({...student,id:null,teacher_authorized:false},async(base,calls)=>{
  const bearer=`Bearer ${await token({metadata:{role:'teacher'}})}`;
  const response=await fetch(base+'/api/profile',{method:'POST',headers:{authorization:bearer,'content-type':'application/json'},body:JSON.stringify({display_name:'  Ana  '})});
  assert.equal(response.status,201);assert.deepEqual(calls[1].params,[user,session,'Ana']);assert.match(calls[1].sql,/auth\.sessions/);assert.match(calls[1].sql,/email_confirmed_at/);assert.match(calls[1].sql,/on conflict \(id\) do nothing/i);
 });
});
test('alta rechaza roles y campos no autorizados antes de escribir',async()=>{
 await withServer({...student,id:null},async(base,calls)=>{
  const headers={authorization:`Bearer ${await token()}`,'content-type':'application/json'};
  for(const body of [{display_name:'Ana',role:'teacher'},{display_name:'A'},{}]){const r=await fetch(base+'/api/profile',{method:'POST',headers,body:JSON.stringify(body)});assert.equal(r.status,400)}
  assert.equal(calls.length,3);assert.ok(calls.every(c=>!/^\s*insert/i.test(c.sql)));
 });
});
test('correo no confirmado no puede crear un perfil',async()=>{
 await withServer({...student,id:null,email_verified:false},async(base,calls)=>{
  const r=await fetch(base+'/api/profile',{method:'POST',headers:{authorization:`Bearer ${await token()}`,'content-type':'application/json'},body:JSON.stringify({display_name:'Ana'})});assert.equal(r.status,403);assert.equal(calls.length,1);
 });
});
