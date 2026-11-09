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
    await pool.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())',[userId,`${userId}@example.test`]);
    const limiter = createJoinLimiter({pool});
    assert.equal(await limiter({userId:'invalid'}),false);
    const results = await Promise.all(Array.from({length:20},()=>limiter({userId})));
    assert.equal(results.filter(Boolean).length,10);
    assert.equal(results.filter(x=>!x).length,10);
    await pool.query("update side_lite_private.lite_join_attempt_windows set window_started_at=clock_timestamp()-interval '6 minutes' where user_id=$1",[userId]);
    assert.equal(await limiter({userId}),true);
    const {rows:[state]}=await pool.query('select attempts from side_lite_private.lite_join_attempt_windows where user_id=$1',[userId]);
    assert.equal(state.attempts,1);
    const broken = createJoinLimiter({pool:{query:async()=>{throw Error('database unavailable')}}});
    await assert.rejects(broken({userId}),/database unavailable/);
  } finally { await pool.end(); }
});
