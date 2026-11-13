import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import pg from 'pg';

test('teacher access requires an attributed grant even for auto-confirmed email', async t => {
  const raw=process.env.SIDE_LITE_TEST_DATABASE_URL;
  if (!raw) return t.skip('Requires isolated PostgreSQL');
  const url=new URL(raw);
  if (process.env.SIDE_TEST_DISPOSABLE!=='YES' || !['127.0.0.1','localhost'].includes(url.hostname) || url.pathname!=='/side_lite_supabase_test') throw Error('Disposable local database required');
  const db=new pg.Client({connectionString:raw}); await db.connect();
  try {
    await db.query('begin');
    const existing=randomUUID(), newcomer=randomUUID(), administrator=randomUUID(), session=randomUUID();
    await db.query("insert into auth.users(id,email,email_confirmed_at,is_anonymous) values($1,$2,now(),false)",[existing,`${existing}@upch.pe`]);
    assert.equal((await db.query('select 1 from side_lite_private.lite_teacher_grants where user_id=$1 and revoked_at is null',[existing])).rowCount,1);
    await db.query(await readFile('docs/propuestas/autorizacion-docente.sql','utf8'));
    assert.equal((await db.query('select 1 from side_lite_private.lite_teacher_grants where user_id=$1 and revoked_at is null',[existing])).rowCount,1);
    assert.equal((await db.query('select 1 from side_lite_private.teacher_grants_pending_review where user_id=$1',[existing])).rowCount,1);
    await db.query('update side_lite_private.lite_teacher_grants set lock_guard=lock_guard where user_id=$1',[existing]);
    await db.query("insert into auth.users(id,email,email_confirmed_at,is_anonymous) values($1,$2,now(),false),($3,$4,now(),false)",[newcomer,`${newcomer}@upch.pe`,administrator,`${administrator}@upch.pe`]);
    await db.query('insert into auth.sessions(id,user_id) values($1,$2)',[session,newcomer]);
    assert.equal((await db.query('select 1 from side_lite_private.lite_teacher_grants where user_id=$1',[newcomer])).rowCount,0);
    assert.equal((await db.query('select teacher_authorized from side_lite_private.api_identity($1,$2)',[newcomer,session])).rows[0].teacher_authorized,false);
    await db.query('savepoint invalid_grant');
    await assert.rejects(db.query('insert into side_lite_private.lite_teacher_grants(user_id,approved_email) values($1,$2)',[newcomer,`${newcomer}@upch.pe`]),error=>error.code==='23514');
    await db.query('rollback to savepoint invalid_grant');
    await db.query('insert into side_lite_private.lite_teacher_grants(user_id,approved_email,granted_by) values($1,$2,$3)',[newcomer,`${newcomer}@upch.pe`,administrator]);
    assert.equal((await db.query('select 1 from side_lite_private.lite_teacher_grants where user_id=$1 and revoked_at is null and granted_by=$2',[newcomer,administrator])).rowCount,1);
    assert.equal((await db.query('select teacher_authorized from side_lite_private.api_identity($1,$2)',[newcomer,session])).rows[0].teacher_authorized,true);
  } finally { await db.query('rollback'); await db.end(); }
});
