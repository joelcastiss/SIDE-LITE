import test from 'node:test';import assert from 'node:assert/strict';import {closeDue} from '../remote/close-cycle.js';
test('un ciclo defectuoso no impide cerrar los demás',async()=>{const events=[];let number=0;const pool={async query(){return {rows:[{id:'bad'},{id:'good'}]}},async connect(){const index=number++;return {async query(sql){if(sql==='BEGIN'||sql==='COMMIT'||sql==='ROLLBACK'){events.push([index,sql]);return {rows:[]}}if(sql.startsWith('SELECT * FROM lite.lite_cycles'))return {rows:[{id:index?'good':'bad',game_id:'game'}]};if(sql.startsWith('SELECT * FROM lite.lite_games')){if(index===0)throw Error('fallo de prueba');return {rows:[{id:'game'}]}}if(sql.startsWith('SELECT * FROM lite.lite_companies'))return {rows:[]};if(sql.startsWith('UPDATE lite.lite_cycles'))return {rows:[]};throw Error('Consulta inesperada')},release(){events.push([index,'release'])}}}};await assert.rejects(()=>closeDue(pool),AggregateError);assert.ok(events.some(([i,x])=>i===0&&x==='ROLLBACK'));assert.ok(events.some(([i,x])=>i===1&&x==='COMMIT'))});

test('ciclos fallidos no bloquean páginas posteriores ni pierden precisión del cursor',async()=>{
 const timestamp='2026-11-07 12:00:00.123456+00';
 const bad=Array.from({length:100},(_,i)=>({id:`bad-${i}`,cursor_ends_at:timestamp}));
 const cursors=[],committed=[];
 const pool={
  async query(sql,params){
   assert.match(sql,/\(ends_at,id\)>\(\$1::timestamptz,\$2::uuid\)/);
   cursors.push(params);
   if(cursors.length===1)return {rows:bad};
   assert.deepEqual(params,[timestamp,'bad-99']);
   return {rows:[{id:'good',cursor_ends_at:timestamp}]};
  },
  async connect(){let id;return {
   async query(sql,params){
    if(sql.startsWith('SELECT * FROM lite.lite_cycles')){id=params[0];return {rows:[{id,game_id:'game'}]}}
    if(sql.startsWith('SELECT * FROM lite.lite_games')){if(id!=='good')throw Error('fallo');return {rows:[{id:'game'}]}}
    if(sql.startsWith('SELECT * FROM lite.lite_companies'))return {rows:[]};
    if(sql==='COMMIT')committed.push(id);
    return {rows:[]};
   },release(){}
  }}
 };
 await assert.rejects(()=>closeDue(pool),e=>e instanceof AggregateError&&e.errors.length===100);
 assert.deepEqual(cursors[0],[null,null]);
 assert.deepEqual(committed,['good']);
});


test('el servidor local aísla el fallo de un ciclo y cierra los demás',async()=>{
 const {closeDue:closeLocal}=await import('../server/close-cycle.js');
 const outcomes=[];
 const pool={async query(){return {rows:[{id:'fallido'},{id:'correcto'}]}},async connect(){let id;return {async query(sql,params){
  if(sql.startsWith('SELECT * FROM lite_cycles')){id=params[0];return {rows:[{id,game_id:'game'}]}}
  if(sql.startsWith('SELECT * FROM lite_games')){if(id==='fallido')throw Error('error simulado');return {rows:[{id:'game'}]}}
  if(sql==='ROLLBACK'||sql==='COMMIT')outcomes.push([id,sql]);
  return {rows:[]};
 },release(){}}}};
 await assert.rejects(()=>closeLocal(pool),AggregateError);
 assert.deepEqual(outcomes,[['fallido','ROLLBACK'],['correcto','COMMIT']]);
});
