// Private development preview only. A shared preview key AND a verified Neon Auth JWT are required.
// Do not deploy as a public production API; there is no edge abuse protection here.
import pg from 'pg';
import {createHash,timingSafeEqual} from 'node:crypto';
import {attachDatabasePool} from '@neon/functions';
import {createApi} from './api-app.js';
import {createIdentityVerifier} from './identity.js';
const secret=process.env.LITE_PREVIEW_KEY;
if(!secret||secret.length<43)throw Error('Vista previa privada no configurada');
const url=new URL(process.env.LITE_DATABASE_URL);
if(url.protocol!=='postgresql:'||url.hostname!==process.env.LITE_DATABASE_HOST||!url.hostname.endsWith('.neon.tech'))throw Error('Base Neon no autorizada');
url.searchParams.set('sslmode','verify-full');
const pool=new pg.Pool({connectionString:url.toString(),max:3});attachDatabasePool(pool);
const verify=createIdentityVerifier({authBaseUrl:process.env.NEON_AUTH_BASE_URL,jwksUrl:process.env.NEON_AUTH_JWKS_URL});
const app=createApi({pool,verify});
const listening=new Promise((resolve,reject)=>{const server=app.listen(0,'127.0.0.1',()=>{server.unref();resolve(server.address().port)});server.once('error',reject)});
const hash=value=>createHash('sha256').update(value).digest();
const expected=hash(secret);
export default {async fetch(request){
 const supplied=request.headers.get('x-side-preview')||'';
 if(supplied.length>256||!timingSafeEqual(hash(supplied),expected))return new Response('No autorizado',{status:401,headers:{'cache-control':'no-store'}});
 const parsed=new URL(request.url);
 if(!parsed.pathname.startsWith('/api/')||parsed.pathname.includes('%2f')||parsed.pathname.includes('%2F'))return new Response('No encontrado',{status:404});
 if(!['GET','POST','PUT'].includes(request.method))return new Response('Método no permitido',{status:405});
 if(Number(request.headers.get('content-length')||0)>16384)return new Response('Solicitud demasiado grande',{status:413});
 const headers=new Headers();for(const name of ['authorization','content-type']){const v=request.headers.get(name);if(v)headers.set(name,v)}
 try{const port=await listening;const init={method:request.method,headers,redirect:'manual',signal:AbortSignal.timeout(30000)};if(!['GET','HEAD'].includes(request.method)){init.body=request.body;init.duplex='half'}const response=await fetch(`http://127.0.0.1:${port}${parsed.pathname}${parsed.search}`,init);const out=new Headers();for(const name of ['content-type','cache-control','retry-after']){const v=response.headers.get(name);if(v)out.set(name,v)}out.set('cache-control','no-store');out.set('x-content-type-options','nosniff');return new Response(response.body,{status:response.status,headers:out})}catch{return new Response('Servicio no disponible',{status:503,headers:{'cache-control':'no-store'}})}
}};
