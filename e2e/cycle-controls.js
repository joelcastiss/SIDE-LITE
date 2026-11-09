import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
import pg from 'pg';
import {closeDue} from '../server/close-cycle.js';
const base='http://127.0.0.1:4186',env={...process.env,PORT:'4186'},sleep=n=>new Promise(r=>setTimeout(r,n));let proc;
async function start(){const p=spawn(process.execPath,['server/index.js'],{env,stdio:'ignore'});for(let i=0;i<60;i++){try{if((await fetch(base+'/api/me')).status===401)return p}catch{}await sleep(200)}p.kill();throw Error('Servidor no inició')}
async function req(path,method='GET',data,cookie,expected=200){const r=await fetch(base+'/api'+path,{method,headers:{...(data?{'content-type':'application/json'}:{}),...(cookie?{cookie}:{})},body:data?JSON.stringify(data):undefined});const body=await r.json();assert.equal(r.status,expected,JSON.stringify(body));return {body,cookie:r.headers.get('set-cookie')?.split(';')[0]}}
try{
 proc=await start();const n=Date.now(),pass='contraseña-larga-2026';
 for(const role of ['teacher','student','other'])await req('/register','POST',{email:`control-${role}-${n}@side.test`,password:pass,name:role,role:role==='student'?'student':'teacher',...(role==='student'?{}:{key:env.TEACHER_REGISTRATION_KEY})},undefined,201);
 const login=async role=>(await req('/login','POST',{email:`control-${role}-${n}@side.test`,password:pass})).cookie;
 const t=await login('teacher'),s=await login('student'),other=await login('other');
 const game=(await req('/games','POST',{name:'Control',cycleCount:3,duration:120,costs:{basic:50,standard:80,premium:120},events:[]},t,201)).body;
 await req('/join','POST',{code:game.code,name:'Tienda'},s,201);
 await req(`/games/${game.id}/start`,'POST',{},t,201);
 const control=(action,cookie,code=200)=>req(`/games/${game.id}/cycle-control`,'POST',{action},cookie,code);
 await control('pause',s,403);await control('pause',other,403);await control('pause',t);
 await req(`/games/${game.id}/start`,'POST',{},t,409);
 await req(`/games/${game.id}/decision`,'PUT',{quality:'basic',quantity:1,price:10,marketingAmount:0,confirmed:true},s,409);
 proc.kill();await sleep(4200);proc=await start();await sleep(1200);
 let state=(await req(`/games/${game.id}`,'GET',undefined,t)).body;assert.equal(state.cycles[0].status,'open');assert.ok(state.cycles[0].paused_at);assert.equal(state.results.length,0);
 await control('resume',t);state=(await req(`/games/${game.id}`,'GET',undefined,t)).body;assert.equal(state.cycles[0].paused_at,null);assert.ok(new Date(state.cycles[0].ends_at)>new Date(state.cycles[0].server_now));
 await control('close',t);await req(`/games/${game.id}/decision`,'PUT',{quality:'basic',quantity:1,price:10,marketingAmount:0,confirmed:true},s,409);
 proc.kill();await sleep(400);const pool=new pg.Pool({connectionString:env.DATABASE_URL});try{const counts=await Promise.all([closeDue(pool),closeDue(pool),closeDue(pool)]);assert.equal(counts.reduce((a,b)=>a+b,0),1)}finally{await pool.end()}proc=await start();await sleep(1800);state=(await req(`/games/${game.id}`,'GET',undefined,t)).body;assert.equal(state.cycles[0].status,'closed');assert.equal(state.results.length,1);
 await sleep(1300);state=(await req(`/games/${game.id}`,'GET',undefined,t)).body;assert.equal(state.results.length,1);
 console.log('PASS PostgreSQL 17: permisos, pausa, reinicio, reanudación, cierre anticipado, cerradores concurrentes y resultado único');
}finally{proc?.kill()}
