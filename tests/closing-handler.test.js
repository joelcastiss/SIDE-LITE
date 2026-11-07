import test from 'node:test';
import assert from 'node:assert/strict';
import {createClosingHandler} from '../remote/closing-handler.js';
const body={version:1,invocation_id:'test-id',trigger:{id:'trigger-id',name:'side-lite-close-dev',type:'schedule'},data:{scheduled_at:'2026-11-07T00:00:00Z'}};
function request(method='POST',payload=body,header='test-id'){
 return new Request('https://example.invalid/',{method,headers:{...(header?{'x-neon-trigger-invocation-id':header}:{}),'content-type':'application/json'},...(method==='POST'?{body:JSON.stringify(payload)}:{})});
}
test('el cierre exige una entrega programada de desarrollo válida',async()=>{
 let calls=0;const handler=createClosingHandler(async()=>{calls++;return 2});
 for(const bad of [request('GET'),request('POST',body,null),request('POST',body,'mismatch'),request('POST',{...body,trigger:{...body.trigger,name:'otro'}})])assert.equal((await handler(bad)).status,401);
 assert.equal(calls,0);
 const response=await handler(request());assert.equal(response.status,200);assert.deepEqual(await response.json(),{closed:2});assert.equal(calls,1);
});
test('un error del cierre no expone detalles al cliente',async()=>{
 const handler=createClosingHandler(async()=>{throw Error('datos privados')});
 const original=console.error;console.error=()=>{};
 try{const response=await handler(request());assert.equal(response.status,500);assert.equal(await response.text(),'Error de cierre')}
 finally{console.error=original}
});
