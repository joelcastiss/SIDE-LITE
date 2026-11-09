// Supabase CLI stack isolated for SIDE-LITE only; never pass remote keys or URLs.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {spawnSync} from 'node:child_process';

if (process.env.SIDE_TEST_DISPOSABLE !== 'YES') throw Error('Se requiere SIDE_TEST_DISPOSABLE=YES.');
const key=process.env.SIDE_TEST_LOCAL_ANON_KEY;
if (!key) throw Error('Se requiere SIDE_TEST_LOCAL_ANON_KEY del stack local.');
const project='side-lite-supabase-stack-verify';
for (const service of ['db','auth','kong','inbucket']) {
  const check=spawnSync('docker',['inspect','--format','{{.State.Running}}',`supabase_${service}_${project}`],{encoding:'utf8'});
  if(check.status!==0 || check.stdout.trim()!=='true') throw Error(`No está activo el contenedor aislado ${service}.`);
}
for (const [service,internal,port] of [['kong','8000/tcp','56521'],['inbucket','8025/tcp','56524'],['db','5432/tcp','56522']]) {
  const check=spawnSync('docker',['port',`supabase_${service}_${project}`,internal],{encoding:'utf8'});
  if(check.status!==0 || !check.stdout.trim().split(/\r?\n/).every(line=>line.endsWith(`:${port}`))) throw Error(`Puerto inesperado para ${service}.`);
}
const base='http://127.0.0.1:56521', mail='http://127.0.0.1:56524';
const settingsResponse=await fetch(`${base}/auth/v1/settings`,{headers:{apikey:key}});
assert.equal(settingsResponse.status,200,'ajustes del Auth local');
const settings=await settingsResponse.json();
assert.equal(settings.mailer_autoconfirm,false,'la confirmación de correo debe estar activada antes de registrar');
const email=`side-lite-${randomUUID()}@example.test`,password=`S-${randomUUID()}-Local-test!`;
async function auth(path,body,access) {
 const response=await fetch(`${base}/auth/v1${path}`,{method:'POST',headers:{apikey:key,'content-type':'application/json',...(access?{authorization:`Bearer ${access}`}:{})},body:JSON.stringify(body)});
 const text=await response.text();let data;try{data=text?JSON.parse(text):{}}catch{data={}};
 return {status:response.status,data};
}
const registered=await auth('/signup',{email,password});
assert.equal(registered.status,200,'registro local');
assert.ok(!registered.data.access_token,'registro no verificado no crea sesión');
const pending=await auth('/token?grant_type=password',{email,password});
assert.notEqual(pending.status,200,'cuenta sin confirmar no inicia sesión');
let matchedMessage;
for(let i=0;i<30&&!matchedMessage;i++){
 const response=await fetch(`${mail}/api/v1/messages`);
 if(response.ok) matchedMessage=(await response.json()).messages.find(message=>message.To?.some(to=>to.Address===email));
 if(!matchedMessage)await new Promise(resolve=>setTimeout(resolve,500));
}
assert.ok(matchedMessage,'mensaje de confirmación en buzón local');
const message=await (await fetch(`${mail}/api/v1/message/${encodeURIComponent(matchedMessage.ID)}`)).json();
const content=message.HTML;
const match=content.match(/https?:\/\/[^\s"<>\\]+\/auth\/v1\/verify\?[^\s"<>\\]+/);
assert.ok(match,'enlace de confirmación disponible');
const confirmUrl=new URL(match[0].replaceAll('&amp;','&'));
assert.equal(confirmUrl.origin,base,'enlace apunta exclusivamente al stack local');
const confirmation=await fetch(confirmUrl,{redirect:'manual'});
assert.ok([200,302,303].includes(confirmation.status),`confirmación ${confirmation.status}`);
const signedIn=await auth('/token?grant_type=password',{email,password});
assert.equal(signedIn.status,200,'inicio de sesión tras confirmar');
assert.ok(signedIn.data.access_token && signedIn.data.refresh_token,'sesión real y refresh');
assert.ok(signedIn.data.expires_at > Math.floor(Date.now()/1000),'caducidad futura');
const refreshed=await auth('/token?grant_type=refresh_token',{refresh_token:signedIn.data.refresh_token});
assert.equal(refreshed.status,200,'renovación de sesión');
assert.ok(refreshed.data.access_token && refreshed.data.refresh_token);
const logout=await auth('/logout',{},refreshed.data.access_token);
assert.ok([200,204].includes(logout.status),'cierre de sesión');
const revoked=await auth('/token?grant_type=refresh_token',{refresh_token:refreshed.data.refresh_token});
assert.notEqual(revoked.status,200,'refresh revocado tras cierre');
console.log('PASS: registro, confirmación por buzón local, ingreso, renovación y revocación de refresh.');
console.log('La fecha de caducidad se comprobó; no se esperó una hora para validar la expiración efectiva.');
