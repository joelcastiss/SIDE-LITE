import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Readable} from 'node:stream';
import {createIngressGuard,signature} from '../supabase-side-lite/perimeter/protocol.js';
import {createProxy} from '../supabase-side-lite/perimeter/proxy.js';

const secret='12'.repeat(32), time=String(1700000000000), nonce='ab'.repeat(16), path='/api/join', body=Buffer.from('{"code":"A7K2M"}'), authorization='Bearer token', apikey='publishable';
const fields={timestamp:time,nonce,path,body,authorization,apikey};
function request(changes={}) {
 const headers={authorization,apikey,'content-type':'application/json','content-length':String(body.length),'x-side-ingress-time':time,'x-side-ingress-nonce':nonce,'x-side-ingress-signature':signature(secret,fields),...changes.headers};
 return new Request('https://api.test'+(changes.path||path),{method:'POST',headers,body:changes.body||body});
}
test('ingress requires signed body, credentials and path and consumes each nonce once',async()=>{
 const used=new Set();const guard=createIngressGuard({secret,now:()=>Number(time),consumeNonce:async n=>!used.has(n)&&!!used.add(n)});
 assert.equal(await guard(request({body:Buffer.from('{"code":"B7K2M"}')}),path),false);
 assert.equal(await guard(request({headers:{authorization:'Bearer other'}}),path),false);
 assert.equal(await guard(request(),'/api/guest/recover'),false);
 assert.equal(await guard(request({headers:{'x-side-ingress-signature':'a'.repeat(64)}}),path),false);
 assert.equal(await guard(request(),path),true);
 assert.equal(await guard(request(),path),false);
 assert.equal(await createIngressGuard({secret,now:()=>Number(time)+30001,consumeNonce:async()=>true})(request(),path),false);
 assert.throws(()=>createIngressGuard({secret:'bad',consumeNonce:async()=>true}));
});
function response(){return {headersSent:false,writeHead(status,headers){this.status=status;this.headers=headers;this.headersSent=true},end(body){this.body=body},destroy(){this.destroyed=true}}}
function incoming({ip='192.0.2.1',encrypted=true,headers={}}={}){
 const req=Readable.from([body]);req.url=path;req.method='POST';req.socket={remoteAddress:ip,encrypted};req.headers={origin:'https://joelcastiss.github.io',authorization,apikey,...headers};return req;
}
test('proxy uses only the direct TLS socket IP and signs the actual request',async()=>{
 let key,forwarded; const pool={query:async(_sql,args)=>{key=args[0];return {rows:[{attempts:1}]}}};
 const proxy=createProxy({pool,secret,now:()=>Number(time),fetchImpl:async(url,opts)=>{forwarded={url,opts};return new Response('{}',{status:200})}});
 const res=response();await proxy(incoming({headers:{'x-forwarded-for':'203.0.113.1','cf-connecting-ip':'203.0.113.2'}}),res);assert.equal(res.status,200);
 const another=response();await proxy(incoming({headers:{'x-forwarded-for':'203.0.113.9'}}),another);const otherKey=key;
 const one=response();await proxy(incoming({headers:{'x-forwarded-for':'203.0.113.1'}}),one);assert.deepEqual(key,otherKey);
 assert.equal(forwarded.url,'https://hwwwoblfpsqqrkxvclag.supabase.co/functions/v1/side-lite-api/api/join');
 const guard=createIngressGuard({secret,now:()=>Number(time),consumeNonce:async()=>true});
 assert.equal(await guard(new Request(forwarded.url,forwarded.opts),path),true);
 const rejected=response();await proxy(incoming({encrypted:false}),rejected);assert.equal(rejected.status,403);
});
test('proxy fails closed on unavailable or exceeded rate limit',async()=>{
 for(const pool of [{query:async()=>{throw Error('down')}},{query:async()=>({rows:[{attempts:61}]})}]){
  let called=false;const proxy=createProxy({pool,secret,fetchImpl:async()=>{called=true}}),res=response();await proxy(incoming(),res);assert.ok([429,503].includes(res.status));assert.equal(called,false);
 }
});
