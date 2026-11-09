import test from 'node:test';
import assert from 'node:assert/strict';
import {createApi} from '../remote/api-app.js';

test('API niega accesos cruzados y roles no autorizados antes de modificar partidas',async()=>{
 const game={id:'owned-game',teacher_id:'teacher-owner'};
 let mutations=0,identityEnabled=true,teacherEnabled=true;
 const pool={async query(sql,params){
  if(sql.includes('identity_allowed'))return {rows:[{allowed:identityEnabled}]};
  if(sql.includes('teacher_authorized'))return {rows:[{allowed:teacherEnabled}]};
  if(sql.includes('FROM lite.lite_profiles'))return {rows:[{id:params[0],role:params[0].startsWith('teacher')?'teacher':'student'}]};
  if(sql.includes('lite.lite_api_limits'))return {rows:[{attempts:1,retry_after:60}]};
  throw Error('Unexpected pool query');
 },async connect(){return {async query(sql,params){
  if(['BEGIN','COMMIT','ROLLBACK'].includes(sql))return {rows:[]};
  if(sql.startsWith('SELECT * FROM lite.lite_games'))return {rows:params[0]===game.id?[game]:[]};
  if(sql.startsWith('SELECT * FROM lite.lite_companies WHERE'))return {rows:params[1]==='student-member'?[{id:'company',student_id:'student-member'}]:[]};
  if(/^\s*(INSERT|UPDATE|DELETE)/i.test(sql))mutations++;
  throw Error('Unexpected transaction query');
 },release(){}}}};
 const verify=async value=>{const m=/^Bearer (teacher-owner|teacher-other|student-member|student-other)$/.exec(value||'');if(!m)throw Error('unauthorized');return {subject:m[1]}};
 const server=createApi({pool,verify}).listen(0,'127.0.0.1');await new Promise(ok=>server.once('listening',ok));
 const base=`http://127.0.0.1:${server.address().port}`;
 const call=(path,who,method='GET',body)=>fetch(base+path,{method,headers:{...(who?{authorization:`Bearer ${who}`}:{ }),'content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
 try{
  assert.equal((await call('/api/games/owned-game',null)).status,401);
  assert.equal((await call('/api/games/owned-game','student-other')).status,403);
  assert.equal((await call('/api/games/owned-game','teacher-other')).status,403);
  assert.equal((await call('/api/games/owned-game/start','teacher-other','POST',{})).status,403);
  assert.equal((await call('/api/games/owned-game/start','student-member','POST',{})).status,403);
  assert.equal((await call('/api/games/owned-game/decision','student-other','PUT',{quality:'basic',quantity:1,price:100,marketingAmount:0,confirmed:true})).status,403);
  identityEnabled=false;assert.equal((await call('/api/games/owned-game','student-member')).status,403);identityEnabled=true;
  teacherEnabled=false;assert.equal((await call('/api/games/owned-game/start','teacher-owner','POST',{})).status,403);
  assert.equal(mutations,0);
 }finally{server.close();await new Promise(ok=>server.once('close',ok))}
});
