// PostgreSQL real, disposable local database; Auth itself is simulated.
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import pg from 'pg';
import {createJoinLimiter} from '../api/join-limiter.js';

test('el límite compartido serializa intentos concurrentes y renueva ventana', async t => {
  const url = process.env.SIDE_LITE_TEST_DATABASE_URL;
  if (!url) return t.skip('Requiere PostgreSQL local desechable con migraciones y Auth simulado.');
  if (process.env.SIDE_TEST_DISPOSABLE !== 'YES' || !['localhost','127.0.0.1','::1','[::1]'].includes(new URL(url).hostname)) throw new Error('Solo PostgreSQL local desechable.');
  const pool = new pg.Pool({connectionString:url,max:20});
  const userId = crypto.randomUUID();
  try {
    await pool.query('insert into auth.users(id,is_anonymous) values($1,true)',[userId]);
    const limiter = createJoinLimiter({pool});
    assert.equal(await limiter({userId:'invalid'}),false);
    const results = await Promise.all(Array.from({length:20},()=>limiter({userId,code:'AABBCCDD'})));
    assert.equal(results.filter(Boolean).length,10);
    assert.equal(results.filter(x=>!x).length,10);
    await pool.query("update side_lite_private.lite_join_attempt_windows set window_started_at=clock_timestamp()-interval '6 minutes' where user_id=$1",[userId]);
    assert.equal(await limiter({userId,code:'AABBCCDD'}),true);
    const {rows:[state]}=await pool.query('select attempts from side_lite_private.lite_join_attempt_windows where user_id=$1',[userId]);
    assert.equal(state.attempts,1);
    const broken = createJoinLimiter({pool:{query:async()=>{throw Error('database unavailable')}}});
    await assert.rejects(broken({userId,code:'AABBCCDD'}),/database unavailable/);
  } finally { await pool.end(); }
});

test('límite de sala es atómico entre identidades concurrentes y renovable',async t=>{
 const url=process.env.SIDE_LITE_TEST_DATABASE_URL;if(!url)return t.skip('Requiere PostgreSQL local desechable');if(process.env.SIDE_TEST_DISPOSABLE!=='YES'||!['localhost','127.0.0.1','::1','[::1]'].includes(new URL(url).hostname))throw Error('Solo PostgreSQL local desechable');
 const pool=new pg.Pool({connectionString:url,max:25}),ids=Array.from({length:14},()=>crypto.randomUUID()),code=crypto.randomBytes(4).toString('hex').toUpperCase(),hash=crypto.createHash('sha256').update(code).digest();
 try{for(const id of ids)await pool.query('insert into auth.users(id,is_anonymous) values($1,true)',[id]);const limiter=createJoinLimiter({pool});const all=await Promise.all(ids.flatMap(id=>Array.from({length:10},()=>limiter({userId:id,code}))));assert.equal(all.filter(Boolean).length,120);assert.equal(all.filter(v=>!v).length,20);const {rows:[state]}=await pool.query('select attempts from side_lite_private.lite_admission_code_windows where code_hash=$1',[hash]);assert.equal(state.attempts,121);await pool.query("update side_lite_private.lite_admission_code_windows set window_started_at=clock_timestamp()-interval '6 minutes' where code_hash=$1",[hash]);const fresh=crypto.randomUUID();await pool.query('insert into auth.users(id,is_anonymous) values($1,true)',[fresh]);ids.push(fresh);assert.equal(await limiter({userId:fresh,code}),true)}finally{await pool.query('delete from side_lite_private.lite_admission_code_windows where code_hash=$1',[hash]);await pool.query('delete from auth.users where id=any($1::uuid[])',[ids]);await pool.end()}
});
