import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('../public/services/lite-game-service.js', import.meta.url), 'utf8');
const secret = 'A'.repeat(43);
function setup(recoverStatus) {
  const data = new Map([['side-lite-guest-join-ABCDEF12', secret]]);
  const localStorage = {getItem:k => data.get(k) ?? null, setItem:(k,v) => data.set(k,String(v)), removeItem:k => data.delete(k), key:i => [...data.keys()][i] ?? null, get length(){return data.size}};
  const calls = [];
  const auth = {getSession:async()=>({data:{session:{access_token:'token',user:{is_anonymous:true}}}})};
  const window = {localStorage, crypto:{getRandomValues:bytes => bytes.fill(7)}, btoa:s => Buffer.from(s,'binary').toString('base64'), SIDE:{SupabaseClient:{getStudent:()=>({auth})}}, fetch:async(url,options)=>{
    const path = new URL(url).pathname.split('/api')[1]; calls.push(path);
    let status = 200, body = {};
    if(path === '/me') body = {role:'student'};
    else if(path === '/games') body = [];
    else if(path === '/guest/recover') {status = recoverStatus; body = status === 200 ? {id:'company',game_id:'game'} : {error:'No se pudo recuperar'};}
    else if(path === '/join') {body = {id:'company',game_id:'game',recoverySecret:JSON.parse(options.body).recoverySecret};}
    return {ok:status < 400,status,json:async()=>body};
  }};
  vm.runInNewContext(source,{window,Uint8Array});
  return {window,data,calls};
}

test('recupera ingreso confirmado cuya respuesta y sesión se perdieron', async()=>{
  const {window,data,calls}=setup(200);
  const result=await window.SIDLiteGame.joinGame({code:'ABCDEF12',name:'Ana',brand:'Marca'});
  assert.equal(result.game_id,'game');
  assert.deepEqual(calls,['/me','/games','/guest/recover']);
  assert.equal(data.has('side-lite-guest-join-ABCDEF12'),false);
  assert.notEqual(JSON.parse(data.get('side-lite-guest-game')).secret,secret);
});

test('reintenta ingreso cuando el secreto pendiente nunca se registró', async()=>{
  const {window,data,calls}=setup(403);
  await window.SIDLiteGame.joinGame({code:'ABCDEF12',name:'Ana',brand:'Marca'});
  assert.deepEqual(calls,['/me','/games','/guest/recover','/join']);
  assert.equal(JSON.parse(data.get('side-lite-guest-game')).secret,secret);
  assert.equal(data.has('side-lite-guest-pending-ABCDEF12'),false);
});
