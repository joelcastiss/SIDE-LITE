// Install the experimental engine for cron testing in an isolated local database.
// The caller must remove the specifically named test schema and its cron jobs.
import pg from 'pg';
import {readFile} from 'node:fs/promises';
import {marketingFactor} from '../../js/engine.js';
const raw=process.env.SIDE_LITE_TEST_DATABASE_URL;
if (!raw || process.env.SIDE_TEST_DISPOSABLE!=='YES') throw Error('Disposable localhost database required');
const u=new URL(raw);
if (!['127.0.0.1','localhost','[::1]','::1'].includes(u.hostname)) throw Error('Refusing non-local database');
const db=new pg.Client({connectionString:raw}); await db.connect();
try {
  await db.query('begin');
  await db.query('create schema side_lite_experiment');
  await db.query('revoke all on schema side_lite_experiment from public');
  await db.query('create table side_lite_experiment.side_marketing_factors(amount integer primary key, factor double precision not null)');
  const factors=[{amount:0,factor:marketingFactor(0)}];
  for(let amount=200;amount<=10000;amount++) factors.push({amount,factor:marketingFactor(amount)});
  await db.query('insert into side_lite_experiment.side_marketing_factors select x.amount,x.factor from jsonb_to_recordset($1::jsonb) x(amount integer, factor double precision)',[JSON.stringify(factors)]);
  for(const filename of ['engine-v2.sql','close-one.sql','sweep.sql','cron-procedure.sql']) {
    const source=await readFile(new URL(filename,import.meta.url),'utf8');
    await db.query(source.replaceAll('pg_temp.', 'side_lite_experiment.'));
  }
  await db.query('commit');
  console.log('Installed local-only side_lite_experiment; no cron was installed.');
} catch(e) {await db.query('rollback');throw e;} finally {await db.end();}
