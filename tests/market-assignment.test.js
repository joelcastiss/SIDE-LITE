import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createGamesApp} from '../supabase-side-lite/api/games.js';

test('solo el docente propietario puede asignar mercados antes del inicio', async () => {
  const teacher=randomUUID(), other=randomUUID(), sessionId=randomUUID(), game=randomUUID(), company=randomUUID();
  let started=false, saved=null;
  const client={release(){},async query(sql,args=[]) {
    const q=sql.replace(/\s+/g,' ').toLowerCase();
    if (/^(begin|commit|rollback)/.test(q)) return {rows:[]};
    if(q.includes('lock_active_identity')) return {rows:[{active:true}]};
    if(q.includes('api_mfa_ready')) return {rows:[{allowed:true}]};
    if(q.includes('api_lock_teacher')) return {rows:[{authorized:true}]};
    if(q.includes('from public.lite_games where id=')) return {rows:[{id:game,teacher_id:teacher}]};
    if(q.includes('from public.lite_cycles')) return {rows:[],rowCount:started?1:0};
    if(q.includes('from public.lite_game_districts')) return {rows:[{district_id:'comas'},{district_id:'surco'}]};
    if(q.startsWith('update public.lite_company_markets')) {if(args[1]!==company)return {rows:[]};saved={company_id:args[1],district_id:args[2],assignment_mode:args[3]};return {rows:[saved]};}
    throw Error('Consulta inesperada: '+q);
  }};
  const app=createGamesApp({pool:{connect:async()=>client},verifyToken:async token=>({id:token==='teacher'?teacher:other,sessionId}),limitJoin:async()=>true});
  const server=app.listen(0,'127.0.0.1'); await new Promise(resolve=>server.once('listening',resolve));
  const put=async(token,body,id=company)=>{const response=await fetch(`http://127.0.0.1:${server.address().port}/api/games/${game}/markets/${id}`,{method:'PUT',headers:{authorization:`Bearer ${token}`,'content-type':'application/json'},body:JSON.stringify(body)});return response;};
  try {
    assert.equal((await put('other',{mode:'manual',districtId:'comas'})).status,403);
    assert.equal((await put('teacher',{mode:'manual',districtId:'ajeno'})).status,400);
    assert.equal((await put('teacher',{mode:'manual',districtId:'comas'},randomUUID())).status,404);
    assert.equal((await put('teacher',{mode:'manual',districtId:'comas'})).status,200);
    assert.deepEqual(saved,{company_id:company,district_id:'comas',assignment_mode:'manual'});
    assert.equal((await put('teacher',{mode:'random'})).status,200);
    assert.ok(['comas','surco'].includes(saved.district_id));
    started=true;
    assert.equal((await put('teacher',{mode:'manual',districtId:'surco'})).status,409);
  } finally {await new Promise(resolve=>server.close(resolve));}
});
