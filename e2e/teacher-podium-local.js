import assert from 'node:assert/strict';
import pg from 'pg';
import {assertLocalDatabase} from '../server/database-url.js';
const base='http://127.0.0.1:4184/api',db=new pg.Pool({connectionString:assertLocalDatabase(process.env.DATABASE_URL)}),suffix=Date.now(),password='prueba-segura-2026',key='side-lite-local-testing-key-2026';
async function call(path,method='GET',body,cookie){const r=await fetch(base+path,{method,headers:{...(cookie?{cookie}:{}),...(body?{'content-type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});return {status:r.status,body:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0]}}
async function account(role,name){const email=`${name}-${suffix}@upch.pe`;assert.equal((await call('/register','POST',{email,password,name,role,key})).status,201);const r=await call('/login','POST',{email,password});assert.equal(r.status,200);return r.cookie}
try{
 const teacher=await account('teacher','docente'),other=await account('teacher','otro'),a=await account('student','alumna'),b=await account('student','alumno');
 const game=(await call('/games','POST',{name:'Podio prueba',cycleCount:3,duration:120,costs:{basic:50,standard:80,premium:120}},teacher)).body;
 const ca=(await call('/join','POST',{code:game.code,name:'Empresa A'},a)).body,cb=(await call('/join','POST',{code:game.code,name:'Empresa B'},b)).body;
 assert.equal((await call(`/games/${game.id}/grades/${ca.id}`,'PUT',{grade:18},other)).status,403);
 assert.equal((await call(`/games/${game.id}/grades/${ca.id}`,'PUT',{grade:18},a)).status,403);
 assert.equal((await call(`/games/${game.id}/grades/${ca.id}`,'PUT',{grade:21},teacher)).status,400);
 assert.equal((await call(`/games/${game.id}/grades/${ca.id}`,'PUT',{grade:18},teacher)).status,200);
 assert.equal((await call(`/games/${game.id}/grades/${cb.id}`,'PUT',{grade:19},teacher)).status,200);
 assert.equal((await call(`/games/${game.id}/podium`,'POST',{reason:'Prueba'},teacher)).status,409);
 for(let n=1;n<=3;n++)await db.query("INSERT INTO lite_cycles(game_id,number,ends_at,status) VALUES($1,$2,now(),'closed')",[game.id,n]);
 assert.equal((await call(`/games/${game.id}/podium`,'POST',{reason:'Prueba',delayMinutes:2},teacher)).status,200);
 assert.equal((await call(`/games/${game.id}/podium`,'GET',null,a)).body.published,null);
 assert.equal((await call(`/games/${game.id}/podium`,'DELETE',null,other)).status,403);
 assert.equal((await call(`/games/${game.id}/podium`,'DELETE',null,teacher)).status,200);
 assert.equal((await call(`/games/${game.id}/podium`,'POST',{reason:'Resultado oficial'},teacher)).status,200);
 let visible=(await call(`/games/${game.id}/podium`,'GET',null,a)).body.published;assert.equal(visible.ranking[0].companyId,cb.id);assert.equal(visible.reason,'Resultado oficial');
 await db.query("UPDATE lite_teacher_podium SET scheduled_at=now()-interval '25 hours' WHERE game_id=$1",[game.id]);assert.equal((await call(`/games/${game.id}/podium`,'GET',null,a)).body.published,null);
 console.log('PASS: notas, permisos, programación, cancelación, clasificación, publicación y caducidad (PostgreSQL local).');
}finally{await db.end()}
