import test from 'node:test';
import assert from 'node:assert/strict';
import {createGamesApp} from '../supabase-side-lite/api/games.js';
import {closeCycle} from '../js/engine.js';
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const owner=id(1),other=id(2),session=id(3),game=id(4),company=id(5),cycle=id(6);
const decision={quality:'basic',quantity:10,price:100,marketingAmount:0},costs={basic:50,standard:80,premium:120},seed='historical-secret';
const official=closeCycle({cash:30000,batches:[],costs,event:null,seed,companyId:company,decision});
function fixture(){
 const state={owner,closed:true,ruleVersion:official.ruleVersion,number:1,prior:null,result:official};const statements=[];
 const client={release(){},async query(sql,args=[]){statements.push(sql);const q=sql.toLowerCase().replace(/\s+/g,' ');
  if (/^(begin|commit|rollback|set transaction)/.test(q))return {rows:[]};
  if(q.includes('lock_active_identity'))return {rows:[{active:true}]};
  if(q.includes('api_mfa_ready'))return {rows:[{allowed:true}]};
  if(q.includes('api_lock_teacher'))return {rows:[{authorized:true}]};
  if(q.includes('select id,costs from public.lite_games'))return {rows:args[1]===state.owner?[{id:game,costs}]:[]};
  if(q.includes('select id from public.lite_games'))return {rows:args[1]===state.owner?[{id:game}]:[]};
  if(q.includes('select cy.number,cy.event_id,r.result,s.seed'))return {rows:state.closed?[{number:state.number,event_id:null,result:{...state.result,ruleVersion:state.ruleVersion},seed}]:[]};
  if(q.includes('select r.result from public.lite_results'))return {rows:state.prior?[{result:state.prior}]:[]};
  if(q.includes('select id,number,event_id from public.lite_cycles'))return {rows:state.closed?[{id:cycle,number:1,event_id:null}]:[]};
  if(q.includes('select id,name from public.lite_companies'))return {rows:[{id:company,name:'Empresa'}]};
  if(q.includes('select r.cycle_id,r.company_id'))return {rows:state.closed?[{cycle_id:cycle,company_id:company,result:official,quality:'basic',quantity:10,price:100,marketing_amount:0,confirmed:true}]:[]};
  throw Error('Unexpected SQL: '+sql);
 }};
 return {state,statements,pool:{connect:async()=>client}};
}
async function run(fn){const f=fixture(),app=createGamesApp({pool:f.pool,verifyToken:async token=>({id:token==='owner'?owner:other,sessionId:session}),limitJoin:async()=>true});const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const base=`http://127.0.0.1:${server.address().port}`;
 const req=async(path,token='owner',body)=>{const r=await fetch(base+path,{method:body?'POST':'GET',headers:{authorization:`Bearer ${token}`,...(body?{'content-type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});return {status:r.status,data:await r.json()}};
 try{await fn({...f,req})}finally{await new Promise(r=>server.close(r))}}
const path=`/api/games/${game}/laboratory`,payload={cycleId:cycle,companyId:company,decision};
test('laboratorio entrega únicamente información histórica y exige propietario',()=>run(async({req})=>{
 const ok=await req(path);assert.equal(ok.status,200);assert.deepEqual(ok.data.records[0].decision,decision);assert.ok(!JSON.stringify(ok.data).includes(seed));assert.equal((await req(path,'other')).status,403);
}));
test('simulación reproduce cierre y no realiza escrituras',()=>run(async({req,statements})=>{
 const response=await req(path+'/simulate','owner',payload);assert.equal(response.status,200);assert.deepEqual(response.data.result,official);assert.ok(!JSON.stringify(response.data).includes(seed));assert.ok(!statements.some(s=>/^\s*(insert|update|delete)/i.test(s)));
 assert.equal((await req(path+'/simulate','other',payload)).status,403);
}));
test('simulación rechaza ciclo abierto, versión incompatible, historial ausente y caja insuficiente',()=>run(async({req,state})=>{
 state.closed=false;assert.equal((await req(path+'/simulate','owner',payload)).status,404);state.closed=true;
 state.ruleVersion=999;assert.equal((await req(path+'/simulate','owner',payload)).status,409);state.ruleVersion=official.ruleVersion;
 state.number=2;assert.equal((await req(path+'/simulate','owner',payload)).status,409);state.number=1;
 assert.equal((await req(path+'/simulate','owner',{...payload,decision:{...decision,quantity:10000}})).status,400);
}));

test('simulación del segundo ciclo conserva inventario FIFO de apertura',()=>run(async({req,state})=>{
 const firstDecision={quality:'basic',quantity:500,price:100,marketingAmount:0};
 const first=closeCycle({cash:30000,batches:[],costs,event:null,seed,companyId:company,decision:firstDecision});
 assert.ok(first.inventory.length>0);
 const second=closeCycle({cash:first.cashEnd,batches:first.inventory,costs,event:null,seed,companyId:company,decision});
 state.number=2;state.prior=first;state.result=second;
 const response=await req(path+'/simulate','owner',payload);assert.equal(response.status,200);assert.deepEqual(response.data.result,second);
}));
