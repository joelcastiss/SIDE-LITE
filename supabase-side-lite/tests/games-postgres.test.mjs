// Disposable local PostgreSQL only; JWT verification and Auth are emulated.
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import pg from 'pg';
import {createGamesApp} from '../api/games.js';
import {createCycleControlsRouter} from '../api/cycle-controls.js';

test('create and join use confirmed identities, teacher approval, unique membership and database transactions', async t => {
  const connectionString = process.env.SIDE_LITE_TEST_DATABASE_URL;
  if (!connectionString) return t.skip('Requires disposable PostgreSQL with test Auth bootstrap and migration.');
  const url = new URL(connectionString);
  if (!['127.0.0.1','localhost','::1','[::1]'].includes(url.hostname)) throw new Error('Refusing nonlocal test database.');
  const pool = new pg.Pool({connectionString});
  // All API queries use the proposed restricted role; fixture setup remains
  // administrative. The cluster is disposable and never accepts remote URLs.
  const apiPool = new pg.Pool({connectionString, options:'-c role=side_lite_api'});
  const ids = Array.from({length:4},()=>crypto.randomUUID());
  const sessions = ids.map(()=>crypto.randomUUID());
  const tokens = new Map(ids.map((id,i)=>[`token${i}`,{id,sessionId:sessions[i]}]));
  let server;
  try {
    for(let i=0;i<ids.length;i++) {
      await pool.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())',[ids[i],`test-${ids[i]}@${i===0?'upch.pe':'example.test'}`]);
      await pool.query('insert into auth.sessions(id,user_id) values($1,$2)',[sessions[i],ids[i]]);
      await pool.query('update public.lite_profiles set display_name=$2 where id=$1',[ids[i],`User ${i}`]);
    }
    await pool.query('insert into side_lite_private.lite_teacher_grants(user_id,approved_email,granted_by) values($1,$2,$3)',[ids[0],`test-${ids[0]}@upch.pe`,ids[1]]);
    let allowed=true;
    const app=createGamesApp({pool:apiPool,verifyToken:async token=>{const identity=tokens.get(token);if(!identity)throw Error('invalid');return identity;},limitJoin:async()=>allowed});
    app.use(createCycleControlsRouter({pool:apiPool,verifyToken:async token=>{const identity=tokens.get(token);if(!identity)throw Error('invalid');return identity;}}));
    server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});
    const base=`http://127.0.0.1:${server.address().port}`;
    const request=async(method,path,token,body)=>{const r=await fetch(base+path,{method,headers:{authorization:`Bearer ${token}`,'content-type':'application/json'},body:JSON.stringify(body)});return {status:r.status,body:await r.json()};};
    const post=(path,token,body)=>request('POST',path,token,body);
    const get=async(path,token)=>{const r=await fetch(base+path,{headers:{authorization:`Bearer ${token}`}});return {status:r.status,body:await r.json()};};
    const config={name:'Partida de prueba',cycleCount:3,duration:120,capitalMin:30000,capitalMax:100000,costs:{basic:30,standard:50,premium:70},events:[]};
    assert.equal((await post('/api/games','unknown',config)).status,401);
    assert.equal((await post('/api/games','token1',config)).status,403);
    assert.equal((await post('/api/games','token0',{...config,duration:30})).status,400);
    const created=await post('/api/games','token0',config);
    assert.equal(created.status,201);
    assert.match(created.body.code,/^[A-F0-9]{8}$/);
    assert.equal(created.body.teacher_id,ids[0]);
    const ended=await post('/api/games','token0',config);
    assert.equal((await post(`/api/games/${ended.body.id}/finish`,'token0',{})).status,200);
    assert.equal((await post('/api/join','token3',{code:ended.body.code,name:'Alumno tres'})).status,409);
    assert.equal((await post(`/api/games/${ended.body.id}/start`,'token0',{})).status,409);
    const first=await post('/api/join','token1',{code:created.body.code,name:'Alumno uno'});
    const second=await post('/api/join','token2',{code:created.body.code,name:'Alumno dos'});
    assert.equal(first.status,201);assert.equal(second.status,201);
    assert.equal(first.body.student_id,ids[1]);assert.equal(second.body.student_id,ids[2]);
    assert.equal(first.body.initial_capital%10000,0);assert.equal(second.body.initial_capital%10000,0);
    assert.equal((await get('/api/catalog','token1')).status,200);
    assert.equal((await get('/api/games','token1')).body.length,1);
    assert.equal((await get('/api/games','token3')).body.length,0);
    assert.equal((await get(`/api/games/${created.body.id}`,'token3')).status,403);
    const studentView=await get(`/api/games/${created.body.id}`,'token1');
    assert.equal(studentView.status,200);
    const peer=studentView.body.companies.find(x=>x.id===second.body.id);
    assert.deepEqual(Object.keys(peer).sort(),['id','name','store']);
    assert.equal(studentView.body.company.id,first.body.id);
    assert.equal(studentView.body.isTeacher,false);
    const teacherView=await get(`/api/games/${created.body.id}`,'token0');
    assert.equal(teacherView.body.isTeacher,true);
    assert.equal(teacherView.body.companies.length,2);
    assert.ok('cash' in teacherView.body.companies[0]);
    assert.equal((await post('/api/join','token1',{code:created.body.code,name:'Otra empresa'})).status,409);
    assert.equal((await post('/api/join','token3',{code:'!INVALID',name:'Otro'})).status,400);
    allowed=false;
    assert.equal((await post('/api/join','token3',{code:created.body.code,name:'Alumno tres'})).status,429);
    allowed=true;
    assert.equal((await post(`/api/games/${created.body.id}/start`,'token1',{})).status,403);
    const started=await post(`/api/games/${created.body.id}/start`,'token0',{});
    assert.equal(started.status,201);
    assert.equal(Date.parse(started.body.ends_at)-Date.parse(started.body.starts_at),120000);
    assert.equal('seed' in started.body,false);
    assert.equal((await post(`/api/games/${created.body.id}/pause`,'token1',{})).status,403);
    assert.equal((await post(`/api/games/${created.body.id}/pause`,'token0',{})).status,200);
    assert.equal((await post(`/api/games/${created.body.id}/resume`,'token0',{})).status,200);
    assert.equal((await post('/api/join','token3',{code:created.body.code,name:'Alumno tres'})).status,409);
    const path=`/api/games/${created.body.id}/decision`;
    const decision={quality:'basic',quantity:1,price:100,marketingAmount:0,confirmed:false};
    assert.equal((await request('PUT',path,'token3',decision)).status,403);
    assert.equal((await request('PUT',path,'token1',{...decision,quantity:100000})).status,400);
    const draft=await request('PUT',path,'token1',decision);
    assert.equal(draft.status,200);assert.equal('seed' in draft.body,false);assert.equal('result' in draft.body,false);
    const confirmations=await Promise.all([
      request('PUT',path,'token1',{...decision,confirmed:true}),
      request('PUT',path,'token1',{...decision,confirmed:true})
    ]);
    assert.deepEqual(confirmations.map(x=>x.status).sort(),[200,409]);
    const ownDecisionView=await get(`/api/games/${created.body.id}`,'token1');
    assert.equal(ownDecisionView.body.ownDecision.confirmed,true);
    assert.deepEqual(ownDecisionView.body.decisions,[]);
    assert.equal('seed' in ownDecisionView.body.cycles[0],false);
    assert.equal((await get(`/api/games/${created.body.id}`,'token0')).body.decisions.length,1);
    await pool.query('update public.lite_cycles set paused_at=clock_timestamp() where id=$1',[started.body.id]);
    assert.equal((await request('PUT',path,'token2',decision)).status,409);
    await pool.query(`update public.lite_cycles set paused_at=null, starts_at=clock_timestamp()-interval '130 seconds', ends_at=clock_timestamp()-interval '10 seconds' where id=$1`,[started.body.id]);
    assert.equal((await request('PUT',path,'token2',decision)).status,409);
    // Force a waiter across the deadline; the insert must recheck DB time
    // after acquiring every lock, not rely on a previously read JS timestamp.
    await pool.query(`update public.lite_cycles set starts_at=clock_timestamp()-interval '119 seconds', ends_at=clock_timestamp()+interval '1 second' where id=$1`,[started.body.id]);
    const locker=await pool.connect();
    try {
      await locker.query('begin');
      await locker.query('select id from public.lite_companies where id=$1 for update',[second.body.id]);
      const waiting=request('PUT',path,'token2',decision);
      await new Promise(resolve=>setTimeout(resolve,1300));
      await locker.query('commit');
      assert.equal((await waiting).status,409);
    } finally { try { await locker.query('rollback'); } catch {} locker.release(); }
    // Synthetic results exercise projection, not correctness of the engine.
    for(const [i,company] of [first.body,second.body].entries()) {
      await pool.query(`insert into public.lite_results(game_id,cycle_id,company_id,result) values($1,$2,$3,$4)`,
        [created.body.id,started.body.id,company.id,JSON.stringify({marker:`private-${i}`})]);
    }
    await pool.query(`update public.lite_cycles set status='closed' where id=$1`,[started.body.id]);
    const studentResults=await get(`/api/games/${created.body.id}`,'token1');
    assert.deepEqual(studentResults.body.results.map(r=>r.result.marker),['private-0']);
    assert.ok(studentResults.body.ranking.every(r=>!('cash' in r) && !('inventory' in r)));
    assert.equal((await get(`/api/games/${created.body.id}`,'token0')).body.results.length,2);
    await pool.query('update side_lite_private.lite_teacher_grants set revoked_at=now() where user_id=$1',[ids[0]]);
    assert.equal((await post('/api/games','token0',config)).status,403);
    assert.equal((await get('/api/games','token0')).body.length,0);
    assert.equal((await get(`/api/games/${created.body.id}`,'token0')).status,403);
    await pool.query('update auth.sessions set not_after=now()-interval \'1 second\' where id=$1',[sessions[3]]);
    assert.equal((await post('/api/join','token3',{code:created.body.code,name:'Alumno tres'})).status,403);
  } finally {
    if(server) await new Promise(resolve=>server.close(resolve));
    await apiPool.end();
    await pool.end();
  }
});
