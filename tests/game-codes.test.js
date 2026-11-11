import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createGamesApp} from '../supabase-side-lite/api/games.js';

const identity={id:randomUUID(),sessionId:randomUUID(),isAnonymous:false};
const config={name:'Partida de prueba',cycleCount:3,costs:{basic:10,standard:20,premium:30}};
async function withApp({collisions=0,authorized=true}={},fn){
 const codes=[]; const c={release(){},async query(sql,args=[]){
  const q=sql.replace(/\s+/g,' ').toLowerCase();
  if(/^(begin|commit|rollback)/.test(q))return {rows:[]};
  if(q.includes('lock_active_identity'))return {rows:[{active:true}]};
  if(q.includes('api_mfa_ready'))return {rows:[{allowed:true}]};
  if(q.includes('api_lock_teacher'))return {rows:[{authorized}]};
  if(q.includes('insert into public.lite_games')){assert.match(q,/on conflict\s*\(code\)\s*do nothing/);codes.push(args[2]);return {rows:codes.length<=collisions?[]:[{id:randomUUID(),code:args[2]}]};}
  if(q.includes('insert into public.lite_products'))return {rows:[]};
  throw Error('SQL inesperado: '+q);
 }};
 const app=createGamesApp({pool:{connect:async()=>c},verifyToken:async()=>identity,limitJoin:async()=>true});
 const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
 const post=async()=>{const response=await fetch(`http://127.0.0.1:${server.address().port}/api/games`,{method:'POST',headers:{authorization:'Bearer test','content-type':'application/json'},body:JSON.stringify(config)});return {status:response.status,body:await response.json()}};
 try{await fn({post,codes})}finally{await new Promise(resolve=>server.close(resolve))}
}
test('creación reintenta colisiones y produce código alfanumérico de cinco caracteres',async()=>{
 await withApp({collisions:2},async({post,codes})=>{const result=await post();assert.equal(result.status,201);assert.equal(codes.length,3);assert.ok(codes.every(code=>/^[A-Z0-9]{5}$/.test(code)));assert.equal(result.body.code,codes[2]);});
});
test('creación falla tras agotar reintentos y exige autorización docente',async()=>{
 await withApp({collisions:100},async({post,codes})=>{assert.equal((await post()).status,503);assert.ok(codes.length>1&&codes.length<=20)});
 await withApp({authorized:false},async({post,codes})=>{assert.equal((await post()).status,403);assert.equal(codes.length,0)});
});
