// Experimental local-only scheduler test: never deploy or target a hosted DB.
import assert from 'node:assert/strict';
import {randomUUID,randomBytes} from 'node:crypto';
import pg from 'pg';
import {closeCycle} from '../../js/engine.js';
const raw=process.env.SIDE_LITE_TEST_DATABASE_URL, u=new URL(raw||'http://invalid');
if(process.env.SIDE_TEST_DISPOSABLE!=='YES'||u.hostname!=='127.0.0.1'||u.port!=='56522'||u.pathname!=='/postgres') throw Error('Solo stack local desechable 56522.');
const db=new pg.Client({connectionString:raw}), ids=Array.from({length:5},randomUUID), games=[];
let extensionCreated=false,jobCreated=false;
await db.connect();
try {
 const {rows:[prior]}=await db.query("select exists(select 1 from public.lite_cycles where status='open') as open,exists(select 1 from pg_extension where extname='pg_cron') as cron");
 if(prior.open) throw Error('Hay ciclos ajenos abiertos.');
 if(!prior.cron){await db.query('create extension pg_cron');extensionCreated=true;}
 if((await db.query("select 1 from cron.job where jobname='side-lite-experiment-multicycle'")).rowCount) throw Error('Job preexistente.');
 for(const id of ids) await db.query('insert into auth.users(id,is_anonymous) values($1,true)',[id]);
 const {rows:[store]}=await db.query('select id from public.lite_stores order by id limit 1');
 const costs={basic:30,standard:50,premium:70};
 for(const [index,count] of [3,6].entries()) {
  const game=randomUUID(),companies=[randomUUID(),randomUUID()];games.push({game,count,companies});
  await db.query("insert into public.lite_games(id,teacher_id,name,code,cycle_count,capital_min,capital_max,costs) values($1,$2,'Prueba cron',$3,$4,30000,30000,$5)",[game,ids[0],randomBytes(4).toString('hex').toUpperCase(),count,JSON.stringify(costs)]);
  for(let i=0;i<2;i++) await db.query('insert into public.lite_companies(id,game_id,student_id,name,store_id,initial_capital,cash) values($1,$2,$3,$4,$5,30000,30000)',[companies[i],game,ids[1+index*2+i],`Empresa ${index}-${i}`,store.id]);
 }
 await db.query("select cron.schedule('side-lite-experiment-multicycle','10 seconds','call side_lite_experiment.side_cron_sweep()')");jobCreated=true;
 for(let n=1;n<=6;n++) {
  const pending=[];
  for(const {game,count,companies} of games.filter(g=>n<=g.count)) {
   const cycle=randomUUID(),seed=randomUUID(),expected=[];
   await db.query("insert into public.lite_cycles(id,game_id,number,ends_at) values($1,$2,$3,clock_timestamp()+interval '120 seconds')",[cycle,game,n]);
   await db.query('insert into side_lite_private.lite_cycle_secrets(cycle_id,seed) values($1,$2)',[cycle,seed]);
   for(let i=0;i<2;i++) {
    const decision={quality:i?'standard':'basic',quantity:5+n,price:100+i*20,marketingAmount:200+n};
    const {rows:[company]}=await db.query('select cash,inventory from public.lite_companies where id=$1',[companies[i]]);
    expected.push(closeCycle({cash:company.cash,batches:company.inventory,decision,costs,event:null,seed,companyId:companies[i]}));
    await db.query('insert into public.lite_decisions(game_id,cycle_id,company_id,quality,quantity,price,marketing_amount,confirmed) values($1,$2,$3,$4,$5,$6,$7,true)',[game,cycle,companies[i],decision.quality,decision.quantity,decision.price,decision.marketingAmount]);
   }
   const {rows:[timing]}=await db.query('select extract(epoch from ends_at)*1000 as deadline from public.lite_cycles where id=$1',[cycle]);
   pending.push({cycle,companies,expected,deadline:Number(timing.deadline),count});
  }
  console.log(`Ciclo ${n}: partidas activas ${pending.map(p=>p.count).join(', ')}; esperando vencimiento real.`);
  while(Date.now()<Math.min(...pending.map(p=>p.deadline))-5000) await new Promise(resolve=>setTimeout(resolve,3000));
  for(const p of pending) assert.equal((await db.query('select status from public.lite_cycles where id=$1',[p.cycle])).rows[0].status,'open');
  for(const p of pending) {
   while(Date.now()<p.deadline+45000 && (await db.query('select status from public.lite_cycles where id=$1',[p.cycle])).rows[0].status!=='closed') await new Promise(resolve=>setTimeout(resolve,2000));
   assert.ok(Date.now()>=p.deadline);
   assert.equal((await db.query('select status from public.lite_cycles where id=$1',[p.cycle])).rows[0].status,'closed');
   const {rows}=await db.query('select company_id,result from public.lite_results where cycle_id=$1',[p.cycle]);assert.equal(rows.length,2);
   for(let i=0;i<2;i++) assert.deepEqual(rows.find(r=>r.company_id===p.companies[i]).result,p.expected[i]);
   console.log(`PASS: partida ${p.count}, ciclo ${n}, resultados exactos de ambas empresas.`);
  }
 }
} finally {
 if(jobCreated) await db.query("select cron.unschedule(jobid) from cron.job where jobname='side-lite-experiment-multicycle'");
 for(const {game} of games) {await db.query('delete from public.lite_results where game_id=$1',[game]);await db.query('delete from public.lite_decisions where game_id=$1',[game]);await db.query('delete from public.lite_games where id=$1',[game]);}
 for(const id of ids) await db.query('delete from auth.users where id=$1',[id]);
 if(extensionCreated) await db.query('drop extension pg_cron');
 await db.end();
}
