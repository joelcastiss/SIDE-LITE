// Local-only failure isolation test for the experimental pg_cron procedure.
import assert from 'node:assert/strict';
import {randomUUID,randomBytes} from 'node:crypto';
import pg from 'pg';
const raw=process.env.SIDE_LITE_TEST_DATABASE_URL,u=new URL(raw||'http://invalid');
if(process.env.SIDE_TEST_DISPOSABLE!=='YES'||u.hostname!=='127.0.0.1'||u.port!=='56522'||u.pathname!=='/postgres') throw Error('Solo stack local desechable 56522.');
const db=new pg.Client({connectionString:raw}),ids=Array.from({length:3},randomUUID),games=[];
let extensionCreated=false,jobCreated=false;
await db.connect();
try {
 const {rows:[prior]}=await db.query("select exists(select 1 from public.lite_cycles where status='open') as open,exists(select 1 from pg_extension where extname='pg_cron') as cron");
 if(prior.open) throw Error('Hay ciclos ajenos abiertos.');
 if(!prior.cron){await db.query('create extension pg_cron');extensionCreated=true;}
 if((await db.query("select 1 from cron.job where jobname='side-lite-experiment-failure'")).rowCount) throw Error('Job preexistente.');
 for(const id of ids) await db.query('insert into auth.users(id,is_anonymous) values($1,true)',[id]);
 const {rows:[store]}=await db.query('select id from public.lite_stores order by id limit 1');
 for(let i=0;i<2;i++) {
  const game=randomUUID(),company=randomUUID(),cycle=randomUUID(),seed=randomUUID();games.push({game,company,cycle,seed});
  await db.query("insert into public.lite_games(id,teacher_id,name,code,cycle_count,capital_min,capital_max,costs) values($1,$2,'Cron fallo',$3,3,30000,30000,$4)",[game,ids[0],randomBytes(4).toString('hex').toUpperCase(),JSON.stringify({basic:30,standard:50,premium:70})]);
  await db.query("insert into public.lite_companies(id,game_id,student_id,name,store_id,initial_capital,cash) values($1,$2,$3,'Prueba',$4,30000,30000)",[company,game,ids[i+1],store.id]);
  await db.query("insert into public.lite_cycles(id,game_id,number,starts_at,ends_at) values($1,$2,1,clock_timestamp()-interval '122 seconds',clock_timestamp()-interval '2 seconds')",[cycle,game]);
  await db.query("update public.lite_cycles set starts_at=clock_timestamp()-interval '122 seconds',ends_at=clock_timestamp()-interval '2 seconds' where id=$1",[cycle]);
  if(i===1) await db.query('insert into side_lite_private.lite_cycle_secrets(cycle_id,seed) values($1,$2)',[cycle,seed]);
  await db.query("insert into public.lite_decisions(game_id,cycle_id,company_id,quality,quantity,price,marketing_amount,confirmed) values($1,$2,$3,'basic',5,100,200,true)",[game,cycle,company]);
 }
 assert.ok((await db.query('select ends_at<=clock_timestamp() as expired from public.lite_cycles where id=any($1::uuid[])',[games.map(g=>g.cycle)])).rows.every(row=>row.expired));
 await db.query('begin');
 try {assert.equal((await db.query('select side_lite_experiment.side_close_one($1) as id',[games[1].game])).rows[0].id,games[1].cycle);}
 finally {await db.query('rollback');}
 await db.query("select cron.schedule('side-lite-experiment-failure','10 seconds','call side_lite_experiment.side_cron_sweep()')");jobCreated=true;
 const waitClosed=async cycle=>{for(let i=0;i<35;i++){if((await db.query('select status from public.lite_cycles where id=$1',[cycle])).rows[0].status==='closed')return;await new Promise(r=>setTimeout(r,1000));}throw Error('Cron no cerró el ciclo.');};
 await waitClosed(games[1].cycle);
 assert.equal((await db.query('select status from public.lite_cycles where id=$1',[games[0].cycle])).rows[0].status,'open');
 assert.equal((await db.query('select count(*)::int as n from public.lite_results where cycle_id=$1',[games[0].cycle])).rows[0].n,0);
 await db.query('insert into side_lite_private.lite_cycle_secrets(cycle_id,seed) values($1,$2)',[games[0].cycle,games[0].seed]);
 await waitClosed(games[0].cycle);
 for(const {cycle} of games) assert.equal((await db.query('select count(*)::int as n from public.lite_results where cycle_id=$1',[cycle])).rows[0].n,1);
 console.log('PASS: el fallo de un ciclo no bloquea otro; ambos se cierran tras reparar la semilla, sin duplicados.');
} finally {
 if(jobCreated) await db.query("select cron.unschedule(jobid) from cron.job where jobname='side-lite-experiment-failure'");
 for(const {game} of games){await db.query('delete from public.lite_results where game_id=$1',[game]);await db.query('delete from public.lite_decisions where game_id=$1',[game]);await db.query('delete from public.lite_games where id=$1',[game]);}
 for(const id of ids) await db.query('delete from auth.users where id=$1',[id]);
 if(extensionCreated) await db.query('drop extension pg_cron');
 await db.end();
}
