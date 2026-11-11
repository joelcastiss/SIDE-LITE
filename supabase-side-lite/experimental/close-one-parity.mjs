// Local disposable Supabase only. Creates synthetic users and games and cleans them up.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {readFile} from 'node:fs/promises';
import pg from 'pg';
import {closeCycle, marketingFactor} from '../../js/engine.js';

const raw=process.env.SIDE_LITE_TEST_DATABASE_URL;
if (!raw || process.env.SIDE_TEST_DISPOSABLE!=='YES') throw Error('Disposable PostgreSQL required');
const url=new URL(raw);
if (!['127.0.0.1','localhost','[::1]','::1'].includes(url.hostname)) throw Error('Refusing non-local database');
const admin=new pg.Client({connectionString:raw});
const migrated=process.env.SIDE_TEST_SQL_MIGRATION==='YES';
const workers=[new pg.Client({connectionString:raw,...(migrated?{options:'-c role=side_lite_closer'}:{})}),new pg.Client({connectionString:raw,...(migrated?{options:'-c role=side_lite_closer'}:{})})];
const ids=Array.from({length:3},()=>crypto.randomUUID()); const games=[];
const factors=[{amount:0,factor:marketingFactor(0)}];
for(let amount=200;amount<=10000;amount++) factors.push({amount,factor:marketingFactor(amount)});
await admin.connect();
try {
  for(const c of workers) {
    await c.connect();
    if(!migrated) {
      await c.query('create temporary table side_marketing_factors(amount integer primary key, factor double precision not null)');
      await c.query('insert into side_marketing_factors select x.amount,x.factor from jsonb_to_recordset($1::jsonb) x(amount integer, factor double precision)',[JSON.stringify(factors)]);
      await c.query(await readFile(new URL('./engine-v2.sql',import.meta.url),'utf8'));
      await c.query(await readFile(new URL('./close-one.sql',import.meta.url),'utf8'));
    }
  }
  for(const id of ids) await admin.query('insert into auth.users(id,is_anonymous) values($1,true)',[id]);
  const {rows:[store]}=await admin.query('select id from public.lite_stores order by id limit 1');
  const costs={basic:30,standard:50,premium:70};
  for(const count of [3,6]) {
    const game=crypto.randomUUID();games.push(game);
    await admin.query(`insert into public.lite_games(id,teacher_id,name,code,cycle_count,capital_min,capital_max,costs)
      values($1,$2,'Parity test',$3,$4,30000,30000,$5)`,[game,ids[0],crypto.randomBytes(4).toString('hex').toUpperCase(),count,JSON.stringify(costs)]);
    const companies=[crypto.randomUUID(),crypto.randomUUID()];
    for(let i=0;i<2;i++) await admin.query(`insert into public.lite_companies(id,game_id,student_id,name,store_id,initial_capital,cash)
      values($1,$2,$3,$4,$5,30000,30000)`,[companies[i],game,ids[i+1],`Parity ${i}`,store.id]);
    for(let n=1;n<=count;n++) {
      const cycle=crypto.randomUUID(), seed=crypto.randomUUID();
      await admin.query('insert into public.lite_cycles(id,game_id,number,ends_at) values($1,$2,$3,now()+interval \'120 seconds\')',[cycle,game,n]);
      await admin.query('insert into side_lite_private.lite_cycle_secrets(cycle_id,seed) values($1,$2)',[cycle,seed]);
      const expected=[];
      for(let i=0;i<2;i++) {
        const decision={quality:i?'standard':'basic',quantity:5+n,price:90+i*20,marketingAmount:200+n};
        const {rows:[co]}=await admin.query('select cash,inventory from public.lite_companies where id=$1',[companies[i]]);
        expected.push(closeCycle({cash:co.cash,batches:co.inventory,decision,costs,event:null,seed,companyId:companies[i]}));
        await admin.query(`insert into public.lite_decisions(game_id,cycle_id,company_id,quality,quantity,price,marketing_amount,confirmed)
          values($1,$2,$3,$4,$5,$6,$7,true)`,[game,cycle,companies[i],decision.quality,decision.quantity,decision.price,decision.marketingAmount]);
      }
      await admin.query("update public.lite_cycles set starts_at=clock_timestamp()-interval '121 seconds',ends_at=clock_timestamp()-interval '1 second' where id=$1",[cycle]);
      if(count===6 && n===1) {
        await admin.query('delete from side_lite_private.lite_cycle_secrets where cycle_id=$1',[cycle]);
        await assert.rejects(workers[0].query(`select ${migrated?'side_lite_private':'pg_temp'}.side_close_one($1)`,[game]));
        assert.equal((await admin.query('select 1 from public.lite_results where cycle_id=$1',[cycle])).rowCount,0);
        assert.equal((await admin.query('select status from public.lite_cycles where id=$1',[cycle])).rows[0].status,'open');
        await admin.query('insert into side_lite_private.lite_cycle_secrets(cycle_id,seed) values($1,$2)',[cycle,seed]);
      }
      const closed=await Promise.all(workers.map(c=>c.query(`select ${migrated?'side_lite_private':'pg_temp'}.side_close_one($1) id`,[game])));
      assert.equal(closed.filter(x=>x.rows[0].id===cycle).length,1);
      const {rows}=await admin.query('select company_id,result from public.lite_results where cycle_id=$1',[cycle]);
      assert.equal(rows.length,2);
      for(let i=0;i<2;i++) assert.deepEqual(rows.find(x=>x.company_id===companies[i]).result,expected[i]);
    }
  }
  console.log('PASS: 3 and 6 cycles; 2 companies; rollback and recovery; concurrent single closure; persisted results match JS.');
} finally {
  for(const game of games) {
    await admin.query('delete from public.lite_results where game_id=$1',[game]);
    await admin.query('delete from public.lite_decisions where game_id=$1',[game]);
    await admin.query('delete from public.lite_games where id=$1',[game]);
  }
  for(const id of ids) await admin.query('delete from auth.users where id=$1',[id]);
  await Promise.all(workers.map(c=>c.end())); await admin.end();
}
