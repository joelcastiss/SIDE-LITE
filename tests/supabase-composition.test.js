import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPair, SignJWT} from 'jose';
import {createSideLiteApp} from '../supabase-side-lite/api/app.js';
const user='c529fd8d-6cec-4c01-9c18-16c079112e23', session='773d8048-bdeb-4bfb-973b-a0a808183235';
const url='https://hwwwoblfpsqqrkxvclag.supabase.co';
const {privateKey,publicKey}=await generateKeyPair('ES256');
const token=await new SignJWT({role:'authenticated',session_id:session}).setProtectedHeader({alg:'ES256'}).setSubject(user).setIssuer(url+'/auth/v1').setAudience('authenticated').setExpirationTime('5m').sign(privateKey);
const student={id:user,display_name:'Ana',email_verified:true,teacher_authorized:false,session_active:true,banned:false};
async function serve(pool,fn){const app=createSideLiteApp({pool,projectUrl:url,keyResolver:async()=>publicKey});const s=app.listen(0,'127.0.0.1');await new Promise(r=>s.once('listening',r));try{await fn(`http://127.0.0.1:${s.address().port}`)}finally{await new Promise(r=>s.close(r))}}
const headers={authorization:`Bearer ${token}`,'content-type':'application/json'};
test('la composición exige pool completo y proyecto autorizado',()=>{
 assert.throws(()=>createSideLiteApp({projectUrl:url}));
 assert.throws(()=>createSideLiteApp({pool:{query(){},connect(){}},projectUrl:'https://otro.supabase.co'}));
});
test('identidad y juegos comparten verificación; perfil no depende de ruta juegos',async()=>{
 let connects=0;const pool={query:async sql=>({rows:[/api_mfa_ready/.test(sql)?{allowed:true}:student]}),connect:async()=>{connects++;throw new Error('should not connect')}};
 await serve(pool,async base=>{let r=await fetch(base+'/api/me',{headers});assert.equal(r.status,200);assert.equal((await r.json()).role,'student');r=await fetch(base+'/api/games',{method:'POST',headers:{'content-type':'application/json'},body:'{}'});assert.equal(r.status,401);assert.equal(connects,0)});
});
test('límite compartido deniega ingreso y no abre transacción de juego',async()=>{
 let connects=0;const pool={query:async sql=>({rows:[/lite_admission_global_window/i.test(sql)?{attempts:1}:/lite_join_attempt_windows/i.test(sql)?{attempts:11}:/api_mfa_ready/.test(sql)?{allowed:true}:student]}),connect:async()=>{connects++;throw new Error('should not connect')}};
 await serve(pool,async base=>{const r=await fetch(base+'/api/join',{method:'POST',headers,body:JSON.stringify({code:'12345678',name:'Empresa'})});assert.equal(r.status,429);assert.equal(connects,0)});
});
test('fallo del limitador cierra acceso y no abre transacción',async()=>{
 let connects=0;const pool={query:async sql=>{if(/lite_join_attempt_windows/i.test(sql))throw new Error('db unavailable');return {rows:[/api_mfa_ready/.test(sql)?{allowed:true}:student]}},connect:async()=>{connects++;throw new Error('should not connect')}};
 await serve(pool,async base=>{const r=await fetch(base+'/api/join',{method:'POST',headers,body:JSON.stringify({code:'12345678',name:'Empresa'})});assert.ok(r.status>=500);assert.equal(connects,0)});
});

test('la composición conecta los controles docentes y rechaza cuentas sin sesión vigente',async()=>{
 let connects=0;
 const c={query:async sql=>({rows:[],rowCount:0}),release(){}};
 const pool={query:async sql=>({rows:[/api_mfa_ready/.test(sql)?{allowed:true}:student]}),connect:async()=>{connects++;return c}};
 await serve(pool,async base=>{
   for(const action of ['pause','resume','finish']) {
     const r=await fetch(`${base}/api/games/${user}/${action}`,{method:'POST',headers,body:'{}'});
     assert.equal(r.status,403);
   }
 });
 assert.equal(connects,3);
});
