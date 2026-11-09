import test from 'node:test';
import assert from 'node:assert/strict';
import {createSupabaseSession,recoveryRedirect} from '../public/supabase-session.js';
function fixture(){
 const calls=[];
 const auth={
   signUp:async v=>(calls.push(['signup',v]),{data:{user:{id:'new-user'}}}),
   signInWithPassword:async v=>(calls.push(['login',v]),{data:{session:{}}}),
   verifyOtp:async v=>(calls.push(['verify',v]),{data:{}}),
   resend:async v=>(calls.push(['resend',v]),{data:{}}),
   getSession:async()=>({data:{session:{access_token:'signed-token',user:{email_confirmed_at:'2026-01-01'}}}}),
   signOut:async v=>(calls.push(['logout',v]),{error:null}),
   resetPasswordForEmail:async (...v)=>(calls.push(['reset',...v]),{data:{}}),
   updateUser:async v=>(calls.push(['update',v]),{data:{}})
 };
 const requests=[];const client=createSupabaseSession({supabaseUrl:'https://hwwwoblfpsqqrkxvclag.supabase.co',auth},async(url,init)=>{requests.push({url,init});return {ok:true,json:async()=>({role:'student'})}});
 return {auth,client,calls,requests};
}
test('registro no envía rol ni privilegios y acceso usa Supabase Auth',async()=>{
 const x=fixture();await x.client.register({email:'a@upch.pe',password:'long-password',name:'Ana',role:'teacher'});await x.client.signIn({email:'a@upch.pe',password:'long-password'});
 assert.deepEqual(x.calls,[['signup',{email:'a@upch.pe',password:'long-password',options:{data:{display_name:'Ana'}}}],['login',{email:'a@upch.pe',password:'long-password'}]]);
});
test('verificación, reenvío y cierre se delegan al proveedor',async()=>{
 const x=fixture();await x.client.verifyEmail({email:'a@example.test',otp:'123456'});await x.client.resendCode({email:'a@example.test'});await x.client.signOut();
 assert.deepEqual(x.calls,[['verify',{email:'a@example.test',token:'123456',type:'signup'}],['resend',{email:'a@example.test',type:'signup'}],['logout',{scope:'local'}]]);
});
test('solicitudes solo a API local y no exponen token ante rutas externas',async()=>{
 const x=fixture();await x.client.request('/games/abc-123','POST',{n:1});assert.equal(x.requests[0].url,'/api/games/abc-123');assert.equal(x.requests[0].init.headers.Authorization,'Bearer signed-token');assert.equal(x.requests[0].init.redirect,'error');
 await assert.rejects(()=>x.client.request('//example.test/path'),/Ruta/);assert.equal(x.requests.length,1);
});
test('sesiones ausentes y correo sin confirmar no alcanzan API',async()=>{
 const x=fixture();x.auth.getSession=async()=>({data:{session:null}});await assert.rejects(()=>x.client.request('/me'),/sesión terminó/);
 x.auth.getSession=async()=>({data:{session:{access_token:'x',user:{}}}});await assert.rejects(()=>x.client.request('/me'),/Verifica tu correo/);assert.equal(x.requests.length,0);
});
test('errores de autenticación y autorización se propagan',async()=>{
 const x=fixture();x.auth.signInWithPassword=async()=>({error:{message:'Acceso inválido'}});await assert.rejects(()=>x.client.signIn({}),/Acceso inválido/);
 const denied=createSupabaseSession({supabaseUrl:'https://hwwwoblfpsqqrkxvclag.supabase.co',auth:x.auth},async()=>({ok:false,status:403,json:async()=>({error:'No autorizado'})}));await assert.rejects(()=>denied.request('/me'),e=>e.status===403);
});
test('recuperación se delega a Supabase sin generar enlaces ni sesiones falsas',async()=>{
 const x=fixture();await x.client.resetPassword({email:'a@example.test',redirectTo:'https://example.test/reset'});await x.client.updatePassword('replacement');assert.deepEqual(x.calls,[['reset','a@example.test',{redirectTo:'https://example.test/reset'}],['update',{password:'replacement'}]]);
});

test('solo acepta el proyecto SIDE-LITE confirmado y retorno seguro al mismo origen',()=>{
 assert.throws(()=>createSupabaseSession({supabaseUrl:'https://otro.supabase.co',auth:{}}),/proyecto/);
 assert.throws(()=>createSupabaseSession({supabaseUrl:'http://hwwwoblfpsqqrkxvclag.supabase.co',auth:{}}),/proyecto/);
 assert.equal(recoveryRedirect({href:'https://side.example/app?next=https://otro.example#token'}),'https://side.example/app');
 assert.equal(recoveryRedirect({href:'http://127.0.0.1:8080/index.html'}),'http://127.0.0.1:8080/index.html');
 assert.throws(()=>recoveryRedirect({href:'http://example.test/index.html'}),/HTTPS/);
});
test('solo evento de recuperación activa la pantalla y se despacha fuera del callback SDK',async()=>{
 let callback,seen=0;const auth={onAuthStateChange:fn=>{callback=fn;return {data:{}}}};
 const client=createSupabaseSession({supabaseUrl:'https://hwwwoblfpsqqrkxvclag.supabase.co',auth});client.onPasswordRecovery(()=>seen++);
 callback('SIGNED_IN');await new Promise(r=>setTimeout(r,5));assert.equal(seen,0);
 callback('PASSWORD_RECOVERY');assert.equal(seen,0);await new Promise(r=>setTimeout(r,5));assert.equal(seen,1);
});
