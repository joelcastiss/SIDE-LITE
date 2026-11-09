import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,unlink} from 'node:fs/promises';
import {join} from 'node:path';
const origin='https://br-snowy-moon-bcshnyw2-sideweb.compute.c-16.us-east-1.aws.neon.tech';
Object.assign(process.env,{
 NEON_BRANCH:'side-lite-dev',NEON_AUTH_BASE_URL:'https://ep-broad-poetry-bc6rj0kr.neonauth.c-16.us-east-1.aws.neon.tech/neondb/auth',
 LITE_PREVIEW_API_URL:'https://br-snowy-moon-bcshnyw2-sidepreview.compute.c-16.us-east-1.aws.neon.tech/',LITE_PREVIEW_KEY:'p'.repeat(45),
 LITE_BFF_SESSION_KEY:'s'.repeat(45),LITE_BFF_GATE_KEY:'g'.repeat(45),LITE_BFF_ORIGIN:origin,LITE_BFF_REGISTRATION:'disabled'
});
const source=await readFile(new URL('../remote/bff-function.js',import.meta.url),'utf8');
const entry=source+'\nconst ASSETS={"index.html":{"type":"text/html","data":"'+Buffer.from('<script type="module" src="app.js"></script>').toString('base64')+'"}};';
const tmp=new URL('./output/bff/bff-test-index.mjs',import.meta.url);
await mkdir(new URL('./output/bff/',import.meta.url),{recursive:true});
await writeFile(tmp,entry);
const handler=(await import(tmp.href+'?t='+Date.now())).default;
let logout=false,verified=true,tokenCalls=0;
const originalFetch=globalThis.fetch;
globalThis.fetch=async(url,options={})=>{
 const u=String(url),headers=new Headers(options.headers);
 if(u.includes('/sign-in/email'))return new Response(JSON.stringify({}),{status:200,headers:{'set-cookie':'better-auth.session_token=SECRETUPSTREAM; Path=/; HttpOnly; Secure','content-type':'application/json'}});
 if(u.includes('/get-session'))return new Response(JSON.stringify(headers.get('cookie')?.includes('SECRETUPSTREAM')&&!logout?{user:{id:'test-student',email:'student@test.edu',name:'Estudiante',emailVerified:verified}}:null),{headers:{'content-type':'application/json'}});
 if(u.includes('/token')){tokenCalls++;return new Response(JSON.stringify({token:'token-for-test'}),{headers:{'content-type':'application/json'}})}
 if(u.includes('/sign-out')){logout=true;return new Response('{}',{headers:{'content-type':'application/json'}})}
 if(u.includes('sidepreview.compute.c-16.us-east-1.aws.neon.tech')){
  assert.equal(headers.get('x-side-preview'),'p'.repeat(45));
  assert.equal(headers.get('authorization'),'Bearer token-for-test');
  return new Response(JSON.stringify({id:'test-student',role:'student'}),{headers:{'content-type':'application/json'}});
 }
 return new Response('{}',{status:404});
};
const request=(path,init={})=>{const headers=new Headers(init.headers);headers.set('authorization','Basic '+Buffer.from('side-lite:'+'g'.repeat(45)).toString('base64'));return new Request(origin+path,{...init,headers})};
test('rechaza otras originaciones',async()=>{
 const response=await handler.fetch(request('/auth/login',{method:'POST',headers:{origin:'https://evil.test','content-type':'application/json'},body:'{}'}));
 assert.equal(response.status,403);
});
test('no permite API sin cookie y protege mutaciones',async()=>{
 assert.equal((await handler.fetch(request('/api/me'))).status,401);
 assert.equal((await handler.fetch(request('/api/games',{method:'POST',headers:{origin:'https://evil.test','content-type':'application/json'},body:'{}'}))).status,403);
});
test('correo sin verificar no obtiene token ni acceso a partidas',async()=>{
 const r=await handler.fetch(request('/auth/login',{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify({email:'pending@test.edu',password:'123456789012'})}));
 assert.equal(r.status,200);
 const cookie=r.headers.get('set-cookie').split(';')[0];
 verified=false;
 try{
  const before=tokenCalls;
  assert.equal((await handler.fetch(request('/api/me',{headers:{cookie}}))).status,403);
  assert.equal(tokenCalls,before);
 }finally{verified=true}
});
test('sesión HttpOnly cifrada; BFF agrega clave privada solo al servidor; logout',async()=>{
 let r=await handler.fetch(request('/auth/login',{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify({email:'student@test.edu',password:'123456789012'})}));
 assert.equal(r.status,200);const cookie=r.headers.get('set-cookie');
 assert.match(cookie,/HttpOnly/);assert.match(cookie,/Secure/);assert.match(cookie,/SameSite=Strict/);
 assert.doesNotMatch(cookie,/SECRETUPSTREAM/);
 assert.doesNotMatch(cookie,/p{30,}/);
 const header=cookie.split(';')[0];
 r=await handler.fetch(request('/api/me',{headers:{cookie:header}}));
 assert.equal(r.status,200);
 assert.deepEqual(await r.json(),{id:'test-student',role:'student'});
 assert.equal((await handler.fetch(request('/api/me',{headers:{cookie:header.slice(0,-4)+'xxxx'}}))).status,401);
 r=await handler.fetch(request('/auth/logout',{method:'POST',headers:{origin,'content-type':'application/json',cookie:header},body:'{}'}));
 assert.equal(r.status,200);assert.match(r.headers.get('set-cookie'),/Max-Age=0/);
 assert.equal((await handler.fetch(request('/api/me',{headers:{cookie:header}}))).status,401);
});
test('registro de vista previa desactivado y HTML seguro',async()=>{
 const r=await handler.fetch(request('/auth/register',{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify({email:'teacher@upch.pe',name:'Docente',password:'123456789012'})}));
 assert.equal(r.status,403);
 const h=await handler.fetch(request('/'));
 assert.equal(h.status,200);assert.match(await h.text(),/boot\.js/);
 assert.match(h.headers.get('content-security-policy'),/frame-ancestors 'none'/);
 assert.match(h.headers.get('content-security-policy'),/frame-src blob:/);
});
test('vista previa requiere clave y limita cuerpos sin longitud declarada',async()=>{
 const noGate=await handler.fetch(new Request(origin+'/'));
 assert.equal(noGate.status,401);assert.match(noGate.headers.get('www-authenticate'),/Basic/);
 const large=await handler.fetch(request('/auth/login',{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify({email:'a'.repeat(17000),password:'x'})}));
 assert.equal(large.status,400);
});
test.after(async()=>{globalThis.fetch=originalFetch;await unlink(tmp).catch(()=>{});});
