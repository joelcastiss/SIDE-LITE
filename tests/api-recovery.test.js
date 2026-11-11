import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {reportApiError} from '../supabase-side-lite/api/error-reporting.js';

async function bridge(fetch) {
 const source=await readFile(new URL('../public/services/lite-game-service.js',import.meta.url),'utf8');
 const auth={getSession:async()=>({data:{session:{access_token:'token'}}})};
 const window={SIDE:{SupabaseClient:{get:()=>({auth}),getStudent:()=>({auth})}},fetch,setTimeout:fn=>fn()};
 vm.runInNewContext(source,{window});return window.SIDLiteGame;
}
test('solo reintenta lecturas temporales; no repite escrituras',async()=>{
 let calls=0;const api=await bridge(async()=>{calls++;if(calls<3)throw Error('network');return {ok:true,json:async()=>({ok:true})}});
 assert.equal((await api.request('/games')).ok,true);assert.equal(calls,3);
 calls=0;await assert.rejects(api.request('/games','POST',{}),/comprobar si la operación se guardó/);assert.equal(calls,1);
});
test('el diagnóstico no incluye datos del error ni la ruta concreta',()=>{
 const logs=[];const original=console.error;console.error=x=>logs.push(x);
 try {let body;const res={headersSent:false,status(n){assert.equal(n,500);return this},json(x){body=x;return this}};
 reportApiError(Object.assign(new Error('secreto'),{code:'XX000'}),{method:'POST',route:{path:'/api/games/:id/close'},url:'/secret'},res,()=>{});
 assert.match(body.traceId,/^[0-9a-f-]{36}$/);assert.equal(JSON.parse(logs[0]).traceId,body.traceId);assert.doesNotMatch(logs[0],/secreto|\/secret/);
 } finally {console.error=original}
});
