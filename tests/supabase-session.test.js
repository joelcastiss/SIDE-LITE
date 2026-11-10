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

 const x=fixture();await x.client.verifyEmail({email:'a@example.test',otp:'123456'});await x.client.resendCode({email:'a@example.test',redirectTo:'https://joelcastiss.github.io/SIDE-LITE/public/'});await x.client.signOut();

 assert.deepEqual(x.calls,[['verify',{email:'a@example.test',token:'123456',type:'signup'}],['resend',{email:'a@example.test',type:'signup',options:{emailRedirectTo:'https://joelcastiss.github.io/SIDE-LITE/public/'}}],['logout',{scope:'local'}]]);

});

test('solicitudes solo a Edge del proyecto y no exponen token ante rutas externas',async()=>{

 const x=fixture();await x.client.request('/games/abc-123','POST',{n:1});assert.equal(x.requests[0].url,'https://hwwwoblfpsqqrkxvclag.supabase.co/functions/v1/side-lite-api/api/games/abc-123');assert.equal(x.requests[0].init.headers.Authorization,'Bearer signed-token');assert.equal(x.requests[0].init.redirect,'error');

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





test('identidad se consulta en la API protegida y preserva errores de perfil',async()=>{
 const x=fixture();await x.client.identity();
 assert.equal(x.requests[0].url,'https://hwwwoblfpsqqrkxvclag.supabase.co/functions/v1/side-lite-api/api/me');
 const missing=createSupabaseSession({supabaseUrl:'https://hwwwoblfpsqqrkxvclag.supabase.co',auth:x.auth},async()=>({ok:false,status:409,json:async()=>({error:'Perfil pendiente'})}));
 await assert.rejects(()=>missing.identity(),e=>e.status===409);
});

test('retorno de Auth conserva únicamente selector local y elimina parámetros ajenos',()=>{

 assert.equal(recoveryRedirect({href:'http://localhost:8080/public/?auth=supabase&next=https://otro.test'}),'http://localhost:8080/public/?auth=supabase');

 assert.equal(recoveryRedirect({href:'https://joelcastiss.github.io/SIDE-LITE/public/?auth=supabase&next=x'}),'https://joelcastiss.github.io/SIDE-LITE/public/');

});


test('sesiones con MFA pendiente no llegan a la API',async()=>{
 const x=fixture();x.auth.mfa={getAuthenticatorAssuranceLevel:async()=>({data:{currentLevel:'aal1',nextLevel:'aal2'}})};
 await assert.rejects(()=>x.client.identity(),/multifactor/);await assert.rejects(()=>x.client.request('/games'),/multifactor/);assert.equal(x.requests.length,0);
 x.auth.mfa.getAuthenticatorAssuranceLevel=async()=>({data:{currentLevel:'aal2',nextLevel:'aal2'}});await x.client.identity();assert.equal(x.requests.length,1);
});

test('MFA usa el factor verificado y no concede acceso con un código incorrecto',async()=>{
 const x=fixture();let verified=false;
 x.auth.mfa={getAuthenticatorAssuranceLevel:async()=>({data:{currentLevel:verified?'aal2':'aal1',nextLevel:'aal2'}}),listFactors:async()=>({data:{totp:[{id:'f1',status:'verified',friendly_name:'Teléfono'},{id:'f2',status:'unverified'}]}}),challenge:async v=>(x.calls.push(['challenge',v]),{data:{id:'c1'}}),verify:async v=>{x.calls.push(['verify-mfa',v]);if(v.code!=='123456')return {error:{message:'Código inválido'}};verified=true;return {data:{}}}};
 assert.deepEqual(await x.client.mfaFactors(),[{id:'f1',name:'Teléfono'}]);await assert.rejects(()=>x.client.verifyMfa({factorId:'f1',code:'000000'}),/Código inválido/);await assert.rejects(()=>x.client.identity(),/multifactor/);assert.equal(x.requests.length,0);await x.client.verifyMfa({factorId:'f1',code:'123456'});await x.client.identity();assert.equal(x.requests.length,1);
});

test('identidad invitada usa Supabase y nunca sustituye una sesión permanente',async()=>{
 const x=fixture();x.auth.getSession=async()=>({data:{session:null}});let created=0;x.auth.signInAnonymously=async()=>{created++;return {data:{user:{is_anonymous:true},session:{access_token:'anon-token',user:{is_anonymous:true}}}}};
 assert.equal((await x.client.signInGuest()).access_token,'anon-token');assert.equal(created,1);
 x.auth.getSession=async()=>({data:{session:{access_token:'existing',user:{is_anonymous:true}}}});assert.equal((await x.client.signInGuest()).access_token,'existing');assert.equal(created,1);
 x.auth.getSession=async()=>({data:{session:{access_token:'permanent',user:{is_anonymous:false,email_confirmed_at:'yes'}}}});await assert.rejects(()=>x.client.signInGuest(),/Cierra tu sesión/);
});

test('CAPTCHA se exige y entrega a Supabase para las solicitudes de Auth',async()=>{
 const x=fixture(),calls=[];let n=0;x.auth.signInAnonymously=async v=>{calls.push(['guest',v]);return {data:{user:{is_anonymous:true},session:{access_token:'t'}}}};x.auth.getSession=async()=>({data:{session:null}});
 const guarded=createSupabaseSession({supabaseUrl:'https://hwwwoblfpsqqrkxvclag.supabase.co',auth:x.auth},async()=>{}, {captchaTokenProvider:async()=>`token-${++n}`});
 await guarded.signInGuest();await guarded.signIn({email:'ana@upch.pe',password:'clave'});await guarded.register({email:'ana@upch.pe',password:'clave',name:'Ana'});await guarded.resetPassword({email:'ana@upch.pe',redirectTo:'https://example.test'});await guarded.resendCode({email:'ana@upch.pe'});await guarded.verifyEmail({email:'ana@upch.pe',otp:'123456'});
 assert.deepEqual(calls,[['guest',{options:{captchaToken:'token-1'}}]]);assert.deepEqual(x.calls[0],['login',{email:'ana@upch.pe',password:'clave',options:{captchaToken:'token-2'}}]);assert.equal(x.calls[1][1].options.captchaToken,'token-3');assert.equal(x.calls[2][2].captchaToken,'token-4');assert.equal(x.calls[3][1].options.captchaToken,'token-5');assert.equal(x.calls[4][1].options.captchaToken,'token-6');
});
test('si falla CAPTCHA no se envía la autenticación',async()=>{const x=fixture();const guarded=createSupabaseSession({supabaseUrl:'https://hwwwoblfpsqqrkxvclag.supabase.co',auth:x.auth},fetch,{captchaTokenProvider:async()=>{throw Error('captcha falló')}});await assert.rejects(()=>guarded.signIn({email:'a@upch.pe',password:'x'}),/captcha falló/);assert.equal(x.calls.length,0)});
