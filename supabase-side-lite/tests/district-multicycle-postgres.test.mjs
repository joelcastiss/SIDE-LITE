// Disposable local PostgreSQL only. Auth/JWT are simulated; the economic worker is real.
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import pg from 'pg';
import postgres from 'postgres';
import {createGamesApp} from '../api/games.js';
import {closeOne} from '../functions/close-cycle/worker.js';
import {closeDistrictCycle} from '../../js/district-cycle-v3.js';
import {DISTRICT_EVENTS} from '../../js/district-events-v3.js';
import {EVENTS} from '../../js/engine.js';
import {readFile} from 'node:fs/promises';

test('district economy settles three and six cycles in SQL', async t => {
  const connectionString=process.env.SIDE_LITE_TEST_DATABASE_URL;
  if (!connectionString) return t.skip('Requires isolated PostgreSQL');
  const url=new URL(connectionString);
  if (process.env.SIDE_TEST_DISPOSABLE!=='YES' || !['127.0.0.1','localhost','[::1]','::1'].includes(url.hostname) || url.pathname!=='/side_lite_supabase_test') throw Error('Disposable local database required');
  const pool=new pg.Pool({connectionString});
  const apiPool=new pg.Pool({connectionString,options:'-c role=side_lite_api'});
  const sql=postgres(connectionString,{prepare:false,max:4,connection:{options:'-c role=side_lite_closer'}});
  const ids=Array.from({length:4},()=>crypto.randomUUID());
  const sessions=ids.map(()=>crypto.randomUUID());
  const tokens=new Map(ids.map((id,i)=>[`token${i}`,{id,sessionId:sessions[i]}]));
  let server;
  try {
    if (process.env.SIDE_TEST_REAL_CRON==='YES' && process.env.SIDE_TEST_EXTERNAL_CRON!=='YES') {
      assert.equal((await pool.query("select count(*)::int n from public.lite_cycles where status='open'")).rows[0].n,0);
      await pool.query(await readFile('supabase/migrations/20261111222502_side_lite_enable_sql_cron.sql','utf8'));
    }
    for (let i=0;i<ids.length;i++) {
      await pool.query('insert into auth.users(id,email,email_confirmed_at,is_anonymous) values($1,$2,now(),$3)',[ids[i],i===0?`multi-${ids[i]}@upch.pe`:null,i!==0]);
      await pool.query('insert into auth.sessions(id,user_id) values($1,$2)',[sessions[i],ids[i]]);
      await pool.query('update public.lite_profiles set display_name=$2 where id=$1',[ids[i],`Player ${i}`]);
    }
    await pool.query('insert into side_lite_private.lite_teacher_grants(user_id,approved_email,granted_by) values($1,$2,$3) on conflict (user_id) do update set granted_by=excluded.granted_by',[ids[0],`multi-${ids[0]}@upch.pe`,ids[1]]);
    const app=createGamesApp({pool:apiPool,verifyToken:async token=>{const x=tokens.get(token);if(!x)throw Error('invalid');return x;},limitJoin:async()=>true});
    server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});
    const request=async(method,path,token,body)=>{const response=await fetch(`http://127.0.0.1:${server.address().port}/api${path}`,{method,headers:{authorization:`Bearer token${token}`,...(body?{'content-type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});return {status:response.status,body:await response.json()};};
    const costs={basic:30,standard:50,premium:70};
    const counts=process.env.SIDE_TEST_CYCLE_COUNT ? [Number(process.env.SIDE_TEST_CYCLE_COUNT)] : [3,6];
    if (counts.some(count=>![3,6].includes(count))) throw Error('Invalid cycle count');
    for (const count of counts) {
      const game=await request('POST','/games',0,{name:`Partida ${count}`,cycleCount:count,duration:120,capitalMin:20000,capitalMax:100000,costs,events:[...EVENTS,...DISTRICT_EVENTS].map(e=>e.id),marketMode:'manual'});
      assert.equal(game.status,201);
      const players=[];
      for(let i=1;i<=3;i++) {const joined=await request('POST','/join',i,{code:game.body.code,name:`Empresa ${i}`});assert.equal(joined.status,201);assert.ok(joined.body.initial_capital>=20000 && joined.body.initial_capital<=100000);assert.equal(joined.body.initial_capital%10000,0);assert.equal(joined.body.cash,joined.body.initial_capital);players.push(joined.body);assert.equal((await request('PUT',`/games/${game.body.id}/markets/${joined.body.id}`,0,{mode:'manual',districtId:'comas'})).status,200);}
      for(let n=1;n<=count;n++) {
        const started=await request('POST',`/games/${game.body.id}/start`,0,{});
        assert.equal(started.status,201);assert.equal(started.body.number,n);
        assert.equal(Date.parse(started.body.ends_at)-Date.parse(started.body.starts_at),120000);
        const decision={quality:'basic',quantity:1,price:100,marketingAmount:0,confirmed:true};
        for(let i=1;i<=3;i++) assert.equal((await request('PUT',`/games/${game.body.id}/decision`,i,{...decision,confirmed:i!==3})).status,200);
        const {rows:[secret]}=await pool.query('select seed from side_lite_private.lite_cycle_secrets where cycle_id=$1',[started.body.id]);
        const {rows:districts}=await pool.query("select base_demand,economic_share,standard_share,premium_share from public.lite_game_districts where game_id=$1 and district_id='comas'",[game.body.id]);
        const {rows:[eventRow]}=await pool.query('select effect from public.lite_events where id=$1',[started.body.event_id]);
        const inputs=[];for(const [index,player] of players.entries()){const {rows:[company]}=await pool.query('select cash,inventory from public.lite_companies where id=$1',[player.id]);inputs.push({id:player.id,cash:company.cash,batches:company.inventory,decision:index===2?null:decision});}
        const gd=districts[0];const expected=closeDistrictCycle({district:{id:'comas',baseDemand:gd.base_demand,shares:[+gd.economic_share,+gd.standard_share,+gd.premium_share]},companies:inputs,costs,event:eventRow.effect});
        let closedByCron=false;
        if (process.env.SIDE_TEST_REAL_CRON==='YES' && (process.env.SIDE_TEST_ALL_REAL==='YES' || (count===3 && n===1))) {
          const timeout=Date.now()+150000;
          while (Date.now()<timeout) {
            const {rows:[state]}=await pool.query("select status,ends_at<=clock_timestamp() as due from public.lite_cycles where id=$1",[started.body.id]);
            if (!state.due) assert.equal(state.status,'open','cron must respect the deadline');
            if (state.status==='closed') { assert.equal(state.due,true); closedByCron=true; break; }
            await new Promise(resolve=>setTimeout(resolve,1000));
          }
          assert.ok(closedByCron,'cron did not close the cycle');
          assert.equal((await request('PUT',`/games/${game.body.id}/decision`,1,decision)).status,409);
          if (process.env.SIDE_TEST_ALL_REAL!=='YES') await pool.query("select cron.unschedule(jobid) from cron.job where jobname='side-lite-sql-close-v2'");
        } else if (process.env.SIDE_TEST_REAL_120==='YES' && count===3 && n===1) {
          // No client polling: wait for the database deadline and then simulate the scheduled worker.
          const {rows:[clock]}=await pool.query('select greatest(0,extract(epoch from (ends_at-clock_timestamp()))*1000)::int as ms from public.lite_cycles where id=$1',[started.body.id]);
          await new Promise(resolve=>setTimeout(resolve,clock.ms+250));
          assert.equal((await request('PUT',`/games/${game.body.id}/decision`,1,decision)).status,409);
        } else {
          // Accelerated closure exercises the same transaction and engine.
          await pool.query("update public.lite_cycles set starts_at=clock_timestamp()-interval '121 seconds', ends_at=clock_timestamp()-interval '1 second' where id=$1",[started.body.id]);
        }
        if(count===6 && n===1 && !closedByCron) {
          await pool.query('delete from side_lite_private.lite_cycle_secrets where cycle_id=$1',[started.body.id]);
          await assert.rejects(sql`select side_lite_private.side_close_one(${game.body.id}::uuid)`);
          assert.equal((await pool.query('select 1 from public.lite_results where cycle_id=$1',[started.body.id])).rowCount,0);
          await pool.query('insert into side_lite_private.lite_cycle_secrets(cycle_id,seed) values($1,$2)',[started.body.id,secret.seed]);
        }
        const closed=n%2 ? await closeOne(sql,[],game.body.id) : (await sql`select side_lite_private.side_close_one(${game.body.id}::uuid) id`)[0].id;
        assert.equal(closed,closedByCron?null:started.body.id);assert.equal((await sql`select side_lite_private.side_close_one(${game.body.id}::uuid) id`)[0].id,null);
        for(let i=0;i<players.length;i++) {
          const {rows}=await pool.query('select result from public.lite_results where cycle_id=$1 and company_id=$2',[started.body.id,players[i].id]);
          assert.equal(rows.length,1);assert.deepEqual(rows[0].result,expected[i]);
        }
        const view=await request('GET',`/games/${game.body.id}`,0);
        assert.equal(view.status,200);assert.equal(view.body.results.length,n*3);
        for(let i=0;i<players.length;i++) {
          // A fresh request models a reload and must contain only this student's
          // complete history, including the engine's exact latest result.
          const own=await request('GET',`/games/${game.body.id}`,i+1);
          assert.equal(own.status,200);
          assert.equal(own.body.company.id,players[i].id);
          assert.equal(own.body.company.initial_capital,players[i].initial_capital);
          assert.equal(view.body.companies.find(c=>c.id===players[i].id).initial_capital,players[i].initial_capital);
          assert.equal(own.body.results.length,n);
          assert.ok(own.body.results.every(row=>row.company_id===players[i].id));
          assert.deepEqual(own.body.results.find(row=>row.cycle_id===started.body.id).result,expected[i]);
          assert.equal(new Set(own.body.results.map(row=>row.cycle_id)).size,n);
          const reloaded=await request('GET',`/games/${game.body.id}`,i+1);
          assert.deepEqual(reloaded.body.results,own.body.results);
        }
        if(n===count) assert.equal(view.body.ranking.length,3,'el ranking final contiene las tres empresas');
        if (process.env.SIDE_TEST_ALL_REAL==='YES') console.log(`PASS: partida de ${count} ciclos, ciclo ${n}, 120 segundos y cierre automático`);
      }
      assert.equal((await request('POST',`/games/${game.body.id}/start`,0,{})).status,409);
    }
  } finally {
    if (process.env.SIDE_TEST_REAL_CRON==='YES' && process.env.SIDE_TEST_EXTERNAL_CRON!=='YES') await pool.query("select cron.unschedule(jobid) from cron.job where jobname='side-lite-sql-close-v2'").catch(()=>{});
    if(server)await new Promise(resolve=>server.close(resolve));await sql.end();await apiPool.end();await pool.end();
  }
});
