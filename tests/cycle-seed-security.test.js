import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createApi} from '../remote/api-app.js';

const fields=['id','game_id','number','starts_at','ends_at','status','event_id'];
const cycle={id:'cycle',game_id:'game',number:1,starts_at:'2026-11-08T12:00:00Z',ends_at:'2026-11-08T12:02:00Z',status:'open',event_id:null,seed:'secret-seed'};
function projection(sql){
 const section=sql.startsWith('INSERT')?sql.split(' RETURNING ')[1]:sql.slice(7,sql.indexOf(' FROM '));
 if(section.trim()==='*')return {...cycle};
 return Object.fromEntries(fields.filter(key=>new RegExp(`\\b${key}\\b`).test(section)).map(key=>[key,cycle[key]]));
}

test('API remota no expone semilla en inicio ni detalle de docente o estudiante',async()=>{
 const game={id:'game',teacher_id:'teacher',cycle_count:3,duration_seconds:120,enabled_events:[]};
 let started=false;
 const pool={async query(sql,params){
  if(sql.includes('identity_allowed')||sql.includes('teacher_authorized'))return {rows:[{allowed:true}]};
  if(sql.includes('FROM lite.lite_profiles'))return {rows:[{id:params[0],role:params[0]==='teacher'?'teacher':'student'}]};
  if(sql.includes('lite.lite_api_limits'))return {rows:[{attempts:1,retry_after:60}]};
  throw Error('pool: '+sql);
 },async connect(){return {async query(sql,params){
  if(['BEGIN','COMMIT','ROLLBACK'].includes(sql))return {rows:[]};
  if(sql.startsWith('SELECT * FROM lite.lite_games'))return {rows:[game]};
  if(sql.startsWith('SELECT * FROM lite.lite_companies WHERE'))return {rows:params[1]==='student'?[{id:'company',student_id:'student'}]:[]};
  if(sql.startsWith('SELECT c.id,c.name'))return {rows:[{id:'company',name:'Empresa',cash:100,initial_capital:100,inventory:[],store:'Tienda'}]};
  if(sql.includes('FROM lite.lite_cycles WHERE game_id=$1 ORDER BY number DESC'))return {rows:[]};
  if(sql.includes('FROM lite.lite_cycles WHERE game_id=$1 ORDER BY number'))return {rows:started?[{...projection(sql),server_now:cycle.starts_at}]:[]};
  if(sql.startsWith('SELECT 1 FROM lite.lite_companies'))return {rowCount:1,rows:[{'?column?':1}]};
  if(sql.startsWith('INSERT INTO lite.lite_cycles')){started=true;return {rows:[projection(sql)]}}
  if(sql.includes('FROM lite.lite_decisions')||sql.includes('FROM lite.lite_results'))return {rows:[]};
  throw Error('client: '+sql);
 },release(){}}}};
 const app=createApi({pool,verify:async auth=>({subject:auth.slice(7)})});
 const server=app.listen(0,'127.0.0.1');await new Promise(ok=>server.once('listening',ok));
 const base=`http://127.0.0.1:${server.address().port}`;
 try{
  const call=async(path,role,options={})=>{const r=await fetch(base+path,{...options,headers:{authorization:`Bearer ${role}`,'content-type':'application/json'}});assert.equal(r.status,options.method==='POST'?201:200);return r.json()};
  const initial=await call('/api/games/game/start','teacher',{method:'POST',body:'{}'});
  assert.equal(initial.number,1);assert.equal(initial.ends_at,cycle.ends_at);assert.equal('seed' in initial,false);
  for(const role of ['teacher','student']){const detail=await call('/api/games/game',role);assert.equal(detail.cycles[0].status,'open');assert.equal(detail.cycles[0].server_now,cycle.starts_at);assert.equal('seed' in detail.cycles[0],false)}
 }finally{server.close();await new Promise(ok=>server.once('close',ok))}
});

test('servidores devuelven lista explícita de ciclos pero motor conserva la semilla',async()=>{
 for(const file of ['../remote/api-app.js','../server/index.js']){
  const source=await readFile(new URL(file,import.meta.url),'utf8');
  assert.match(source,/SELECT id,game_id,number,starts_at,ends_at,status,event_id,now\(\) AS server_now FROM (?:lite\.)?lite_cycles/);
  assert.match(source,/RETURNING id,game_id,number,starts_at,ends_at,status,event_id/);
  assert.match(source,/seed:cycle\.seed/);
 }
});
