// SIDE Lite private-development BFF. Uses Managed Neon Auth HTTP endpoints and
// stores upstream cookies only inside an authenticated, encrypted first-party cookie.
// This is NOT a production-ready substitute for the Neon server SDK.
import {createCipheriv,createDecipheriv,createHash,randomBytes,timingSafeEqual} from 'node:crypto';

const COOKIE='__Host-side_lite_dev';
const MAX_BODY=16384;
const TTL_MS=8*3600_000;
const authBase=process.env.NEON_AUTH_BASE_URL;
const authUrl=authBase?new URL(authBase.endsWith('/')?authBase:authBase+'/'):null;
const origin=process.env.LITE_BFF_ORIGIN;
const previewUrl=process.env.LITE_PREVIEW_API_URL;
const previewKey=process.env.LITE_PREVIEW_KEY;
const sessionSecret=process.env.LITE_BFF_SESSION_KEY;
const gateSecret=process.env.LITE_BFF_GATE_KEY;
const validConfig=process.env.NEON_BRANCH==='side-lite-dev'&&authUrl?.protocol==='https:'&&
 authUrl.hostname.endsWith('.neon.tech')&&origin&&new URL(origin).protocol==='https:'&&
 previewUrl&&new URL(previewUrl).protocol==='https:'&&new URL(previewUrl).hostname.endsWith('.neon.tech')&&
 typeof previewKey==='string'&&previewKey.length>=43&&
 typeof sessionSecret==='string'&&sessionSecret.length>=43&&typeof gateSecret==='string'&&gateSecret.length>=43&&
 authUrl.hostname==='ep-broad-poetry-bc6rj0kr.neonauth.c-16.us-east-1.aws.neon.tech'&&
 new URL(previewUrl).hostname==='br-snowy-moon-bcshnyw2-sidepreview.compute.c-16.us-east-1.aws.neon.tech'&&
 new URL(origin).hostname==='br-snowy-moon-bcshnyw2-sideweb.compute.c-16.us-east-1.aws.neon.tech';
const sessionKey=validConfig?createHash('sha256').update(sessionSecret).digest():null;
const common={
 'cache-control':'no-store','referrer-policy':'no-referrer','x-content-type-options':'nosniff',
 'x-frame-options':'DENY',
 'content-security-policy':"default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self'; connect-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'"
};
const json=(data,status=200,headers={})=>new Response(JSON.stringify(data),{
 status,headers:{...common,'content-type':'application/json; charset=utf-8',...headers}
});
const error=(status,message,headers={})=>json({error:message},status,headers);
const clearCookie=()=>COOKIE+'=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict';

function seal(cookies){
 const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',sessionKey,iv);
 cipher.setAAD(Buffer.from('SIDE_LITE_DEV_V1'));
 const body=Buffer.from(JSON.stringify({cookies,exp:Date.now()+TTL_MS}));
 return Buffer.concat([iv,cipher.update(body),cipher.final(),cipher.getAuthTag()]).toString('base64url');
}
function unseal(request){
 const header=request.headers.get('cookie')||'';
 const item=header.split(';').map(x=>x.trim()).find(x=>x.startsWith(COOKIE+'='));
 if(!item)return null;
 try{
  const raw=Buffer.from(item.slice(COOKIE.length+1),'base64url');
  if(raw.length<29||raw.length>3600)return null;
  const d=createDecipheriv('aes-256-gcm',sessionKey,raw.subarray(0,12));
  d.setAAD(Buffer.from('SIDE_LITE_DEV_V1'));d.setAuthTag(raw.subarray(-16));
  const data=JSON.parse(Buffer.concat([d.update(raw.subarray(12,-16)),d.final()]).toString());
  const now=Date.now();
  if(!(data.exp>now&&data.exp<=now+TTL_MS&&Array.isArray(data.cookies)&&data.cookies.length<=12))return null;
  if(!data.cookies.every(s=>typeof s==='string'&&/^[A-Za-z0-9_.-]+=[^;\s]*$/.test(s)))return null;
  return data.cookies;
 }catch{return null}
}
function upstreamCookies(response){
 const list=response.headers.getSetCookie?.()||[];
 return list.map(c=>c.split(';')[0]).filter(c=>/^[A-Za-z0-9_.-]+=[^;\s]*$/.test(c)).slice(0,12);
}
function trustedMutation(request){
 if(request.headers.get('origin')!==origin)return false;
 const site=request.headers.get('sec-fetch-site');
 return (site===null||site==='same-origin'||site==='none')&&
  request.headers.get('content-type')?.toLowerCase().startsWith('application/json');
}
async function readBody(request){
 const length=Number(request.headers.get('content-length')||0);
 if(!Number.isFinite(length)||length<0||length>MAX_BODY)return null;
 if(!request.body)return '';
 const reader=request.body.getReader(),chunks=[];let size=0;
 try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>MAX_BODY){await reader.cancel();return null}chunks.push(value)}}finally{reader.releaseLock()}
 return Buffer.concat(chunks.map(x=>Buffer.from(x))).toString('utf8');
}
async function getInput(request){
 const text=await readBody(request);if(text===null)return null;
 try{const data=JSON.parse(text);return data&&typeof data==='object'&&!Array.isArray(data)?data:null}catch{return null}
}
async function neon(path,method='GET',body,cookies){
 const headers={accept:'application/json',origin,'cache-control':'no-store'};
 if(body!==undefined)headers['content-type']='application/json';
 if(cookies?.length)headers.cookie=cookies.join('; ');
 return fetch(new URL(path,authUrl),{
  method,headers,body:body===undefined?undefined:JSON.stringify(body),
  cache:'no-store',redirect:'manual',signal:AbortSignal.timeout(12000)
 });
}
async function currentSession(cookies){
 if(!cookies)return null;
 const r=await neon('get-session','GET',undefined,cookies);
 if(!r.ok)return null;
 const data=await r.json();return data?.user?.id&&data.user.banned!==true?data:null;
}
const publicUser=u=>u?{id:u.id,name:u.name||'',email:u.email||'',emailVerified:u.emailVerified===true}:null;
// Backstop only; per-isolate counters are NOT an Internet-scale edge rate limiter.
const limits=new Map();
function withinLimit(path,email){
 const id=path+':'+(typeof email==='string'?email.trim().toLowerCase().slice(0,254):'unknown');
 const now=Date.now(),state=limits.get(id)||{time:now,count:0};
 if(now-state.time>60_000){state.time=now;state.count=0}
 state.count++;limits.set(id,state);
 if(limits.size>1000){for(const [key,v] of limits)if(now-v.time>60_000)limits.delete(key);while(limits.size>1000)limits.delete(limits.keys().next().value)}
 return state.count<=5;
}
async function authHandler(request,path){
 if(path==='/auth/session'){
  if(request.method!=='GET')return error(405,'Método no permitido');
  return json({user:publicUser((await currentSession(unseal(request)))?.user)});
 }
 if(request.method!=='POST')return error(405,'Método no permitido');
 if(!trustedMutation(request))return error(403,'Origen no autorizado');
 const jar=unseal(request);
 if(path==='/auth/logout'){
  if(jar){const closed=await neon('sign-out','POST',{},jar).catch(()=>null);if(!closed?.ok)return error(503,'No se pudo cerrar la sesión en Neon',{'set-cookie':clearCookie()});}
  return json({success:true},200,{'set-cookie':clearCookie()});
 }
 const body=await getInput(request);
 if(!body)return error(400,'Solicitud inválida');
 if(!withinLimit(path,body.email))return error(429,'Demasiados intentos',{'retry-after':'60'});
 if(path==='/auth/login'){
  if(typeof body.email!=='string'||typeof body.password!=='string'||
     body.email.length>254||body.password.length>256)return error(400,'Datos inválidos');
  const r=await neon('sign-in/email','POST',{email:body.email,password:body.password});
  if(!r.ok)return error(r.status===429?429:401,'Credenciales incorrectas');
  const jarNew=upstreamCookies(r);
  if(jarNew.length===0||!(await currentSession(jarNew)))return error(502,'Neon Auth no devolvió una sesión válida');
  const value=seal(jarNew);
  if(value.length>3500)return error(502,'Sesión demasiado grande');
  return json({success:true},200,{'set-cookie':COOKIE+'='+value+'; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age='+Math.floor(TTL_MS/1000)});
 }
 const paths={
  '/auth/register':{up:'sign-up/email',fields:['name','email','password']},
  '/auth/verify':{up:'email-otp/verify-email',fields:['email','otp']},
  '/auth/resend':{up:'email-otp/send-verification-otp',fields:['email']}
 };
 const spec=paths[path];if(!spec)return error(404,'Ruta no encontrada');
 if(path==='/auth/register'&&process.env.LITE_BFF_REGISTRATION!=='enabled')return error(403,'Registro público desactivado para esta vista previa');
 const data={};for(const field of spec.fields){
  if(typeof body[field]!=='string'||!body[field]||body[field].length>256)return error(400,'Datos inválidos');
  data[field]=body[field];
 }
 if(path==='/auth/resend')data.type='email-verification';
 const r=await neon(spec.up,'POST',data,jar);
 return r.ok?json({success:true}):error(r.status===429?429:400,'No se pudo completar la solicitud');
}
async function gameHandler(request,path){
 if(!['GET','POST','PUT'].includes(request.method))return error(405,'Método no permitido');
 if(request.method!=='GET'&&!trustedMutation(request))return error(403,'Origen no autorizado');
 const jar=unseal(request),session=await currentSession(jar);
 if(!session)return error(401,'Inicia sesión');
 if(session.user.emailVerified!==true)return error(403,'Verifica tu correo antes de continuar');
 const tokenResult=await neon('token','GET',undefined,jar);
 if(!tokenResult.ok)return error(401,'Sesión vencida');
 const token=(await tokenResult.json())?.token;
 if(typeof token!=='string'||!token)return error(401,'Sesión vencida');
 let body;
 if(request.method!=='GET'){
  body=await readBody(request);if(body===null)return error(413,'Solicitud demasiado grande');
  try{JSON.parse(body)}catch{return error(400,'JSON inválido')}
 }
 const url=new URL(previewUrl),incoming=new URL(request.url);
 url.pathname=path;url.search=incoming.search;
 const r=await fetch(url,{method:request.method,headers:{authorization:'Bearer '+token,
  'x-side-preview':previewKey,...(body!==undefined?{'content-type':'application/json'}:{})},
  body,redirect:'manual',signal:AbortSignal.timeout(30_000),cache:'no-store'});
 const headers={...common,'content-type':r.headers.get('content-type')||'application/json; charset=utf-8'};
 const retry=r.headers.get('retry-after');if(retry)headers['retry-after']=retry;
 return new Response(r.body,{status:r.status,headers});
}
function serve(path){
 const name=path==='/'?'index.html':path.slice(1),item=ASSETS[name];
 if(!item)return error(404,'No encontrado');
 let content=Buffer.from(item.data,'base64');
 if(name==='index.html'){
  const html=content.toString().replace('<script type="module" src="app.js"></script>',
   '<script src="boot.js"></script><script type="module" src="app.js"></script>');
  content=Buffer.from(html);
 }
 return new Response(content,{status:200,headers:{...common,'content-type':item.type}});
}
export default {async fetch(request){
 if(!validConfig)return error(503,'Vista previa BFF no configurada');
 if(new URL(request.url).origin!==origin)return error(403,'Host no autorizado');
 const authorization=request.headers.get('authorization')||'';
 const expected=createHash('sha256').update('Basic '+Buffer.from('side-lite:'+gateSecret).toString('base64')).digest();
 const supplied=createHash('sha256').update(authorization.slice(0,1024)).digest();
 if(authorization.length>1024||!timingSafeEqual(supplied,expected))return new Response('Vista previa privada',{status:401,headers:{...common,'www-authenticate':'Basic realm="SIDE Lite desarrollo", charset="UTF-8"'}});
 const path=new URL(request.url).pathname;
 if(path==='/health')return json({ok:true,mode:'private-development'});
 if(path.startsWith('/auth/')){
  try{return await authHandler(request,path)}catch{return error(503,'Autenticación temporalmente no disponible')}
 }
 if(path.startsWith('/api/')){
  try{return await gameHandler(request,path)}catch{return error(503,'API temporalmente no disponible')}
 }
 if(!['GET','HEAD'].includes(request.method))return error(405,'Método no permitido');
 return serve(path);
}};
// ASSETS is injected by scripts/build-bff.mjs. Not a runtime file read.
