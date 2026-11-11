// Local disposable Supabase only. This is an experimental SQL engine test,
// not a production scheduler or a deployed Edge/UI test.
import assert from 'node:assert/strict';
import {randomUUID,randomBytes} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import pg from 'pg';
import {closeCycle} from '../../js/engine.js';

const raw=process.env.SIDE_LITE_TEST_DATABASE_URL, url=new URL(raw||'http://invalid');
if(process.env.SIDE_TEST_DISPOSABLE!=='YES'||url.hostname!=='127.0.0.1'||url.port!=='56522'||url.pathname!=='/postgres') throw Error('Solo stack desechable local 56522.');
const db=new pg.Client({connectionString:raw}), ids=Array.from({length:3},randomUUID), game=randomUUID(), cycle=randomUUID(), seed=randomUUID(), companies=[randomUUID(),randomUUID()];
let extensionCreated=false, jobCreated=false;
await db.connect();
try {
 const {rows:[prior]}=await db.query("select exists(select 1 from public.lite_cycles where status='open') as open, exists(select 1 from pg_extension where extname='pg_cron') as cron");
 if(prior.open) throw Error('Hay ciclos ajenos abiertos; prueba cancelada.');
 if(!prior.cron) {await db.query('create extension pg_cron');extensionCreated=true;}
 const {rows:[job]}=await db.query("select exists(select 1 from cron.job where jobname='side-lite-experiment-test') as present");
 if(job.present) throw Error('Ya existe un job de prueba.');
 await db.query((await readFile(new URL('sweep.sql',import.meta.url),'utf8')).replaceAll('pg_temp.','side_lite_experiment.'));
 for(const id of ids) await db.query('insert into auth.users(id,is_anonymous) values($1,true)',[id]);
 const {rows:[store]}=await db.query('select id from public.lite_stores order by id limit 1');
 const costs={basic:30,standard:50,premium:70};
 await db.query("insert into public.lite_games(id,teacher_id,name,code,cycle_count,capital_min,capital_max,costs) values($1,$2,'Cron local',$3,3,30000,30000,$4)",[game,ids[0],randomBytes(4).toString('hex').toUpperCase(),JSON.stringify(costs)]);
 for(let i=0;i<2;i++) await db.query('insert into public.lite_companies(id,game_id,student_id,name,store_id,initial_capital,cash) values($1,$2,$3,$4,$5,30000,30000)',[companies[i],game,ids[i+1],`Cron ${i}`,store.id]);
 await db.query("insert into public.lite_cycles(id,game_id,number,ends_at) values($1,$2,1,clock_timestamp()+interval '120 seconds')",[cycle,game]);
 await db.query('insert into side_lite_private.lite_cycle_secrets(cycle_id,seed) values($1,$2)',[cycle,seed]);
 const expected=[];
 for(let i=0;i<2;i++) {
  const decision={quality:i?'standard':'basic',quantity:7,price:110+i*10,marketingAmount:201};
  expected.push(closeCycle({cash:30000,batches:[],decision,costs,event:null,seed,companyId:companies[i]}));
  await db.query('insert into public.lite_decisions(game_id,cycle_id,company_id,quality,quantity,price,marketing_amount,confirmed) values($1,$2,$3,$4,$5,$6,$7,true)',[game,cycle,companies[i],decision.quality,decision.quantity,decision.price,decision.marketingAmount]);
 }
 await db.query("select cron.schedule('side-lite-experiment-test','10 seconds','select side_lite_experiment.side_sweep()')");jobCreated=true;
 const {rows:[times]}=await db.query('select extract(epoch from ends_at)*1000 as deadline from public.lite_cycles where id=$1',[cycle]);
 console.log('Ciclo preparado: esperando vencimiento real de 120 segundos sin llamadas de cierre desde el cliente.');
 while(Date.now()<Number(times.deadline)-5000) await new Promise(resolve=>setTimeout(resolve,3000));
 assert.equal((await db.query('select status from public.lite_cycles where id=$1',[cycle])).rows[0].status,'open');
 while(Date.now()<Number(times.deadline)+30000) {
  await new Promise(resolve=>setTimeout(resolve,2000));
  if((await db.query('select status from public.lite_cycles where id=$1',[cycle])).rows[0].status==='closed') break;
 }
 assert.ok(Date.now()>=Number(times.deadline));
 assert.equal((await db.query('select status from public.lite_cycles where id=$1',[cycle])).rows[0].status,'closed');
 const {rows}=await db.query('select company_id,result from public.lite_results where cycle_id=$1',[cycle]);
 assert.equal(rows.length,2);
 for(let i=0;i<2;i++) assert.deepEqual(rows.find(row=>row.company_id===companies[i]).result,expected[i]);
 console.log('PASS: pg_cron cerró después de 120 s sin cliente; dos resultados persistidos coinciden con el motor JavaScript.');
} finally {
 if(jobCreated) await db.query("select cron.unschedule(jobid) from cron.job where jobname='side-lite-experiment-test'");
 await db.query('delete from public.lite_results where game_id=$1',[game]);
 await db.query('delete from public.lite_decisions where game_id=$1',[game]);
 await db.query('delete from public.lite_games where id=$1',[game]);
 for(const id of ids) await db.query('delete from auth.users where id=$1',[id]);
 if(extensionCreated) await db.query('drop extension pg_cron');
 await db.end();
}
