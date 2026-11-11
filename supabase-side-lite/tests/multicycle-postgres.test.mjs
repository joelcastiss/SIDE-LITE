// Disposable local PostgreSQL only. Auth/JWT are simulated; the economic worker is real.
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import pg from 'pg';
import postgres from 'postgres';
import {createGamesApp} from '../api/games.js';
import {closeOne} from '../functions/close-cycle/worker.js';
import {closeCycle} from '../../js/engine.js';

test('three and six cycles persist official results for two students', async t => {
  const connectionString=process.env.SIDE_LITE_TEST_DATABASE_URL;
  if (!connectionString) return t.skip('Requires isolated PostgreSQL');
  const url=new URL(connectionString);
  if (process.env.SIDE_TEST_DISPOSABLE!=='YES' || !['127.0.0.1','localhost','[::1]','::1'].includes(url.hostname) || url.pathname!=='/side_lite_supabase_test') throw Error('Disposable local database required');
  const pool=new pg.Pool({connectionString});
  const apiPool=new pg.Pool({connectionString,options:'-c role=side_lite_api'});
  const sql=postgres(connectionString,{prepare:false,max:4,connection:{options:'-c role=side_lite_closer'}});
  const ids=Array.from({length:3},()=>crypto.randomUUID());
  const sessions=ids.map(()=>crypto.randomUUID());
  const tokens=new Map(ids.map((id,i)=>[`token${i}`,{id,sessionId:sessions[i]}]));
  let server;
  try {
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
    for (const count of [3,6]) {
      const game=await request('POST','/games',0,{name:`Partida ${count}`,cycleCount:count,duration:120,capitalMin:30000,capitalMax:30000,costs,events:[]});
      assert.equal(game.status,201);
      const players=[];
      for(let i=1;i<=2;i++) {const joined=await request('POST','/join',i,{code:game.body.code,name:`Empresa ${i}`});assert.equal(joined.status,201);players.push(joined.body);}
      for(let n=1;n<=count;n++) {
        const started=await request('POST',`/games/${game.body.id}/start`,0,{});
        assert.equal(started.status,201);assert.equal(started.body.number,n);
        assert.equal(Date.parse(started.body.ends_at)-Date.parse(started.body.starts_at),120000);
        const decision={quality:'basic',quantity:1,price:100,marketingAmount:0,confirmed:true};
        for(let i=1;i<=2;i++) assert.equal((await request('PUT',`/games/${game.body.id}/decision`,i,decision)).status,200);
        const {rows:[secret]}=await pool.query('select seed from side_lite_private.lite_cycle_secrets where cycle_id=$1',[started.body.id]);
        const expected=[];
        for(const player of players) {
          const {rows:[company]}=await pool.query('select cash,inventory from public.lite_companies where id=$1',[player.id]);
          expected.push(closeCycle({cash:company.cash,batches:company.inventory,costs,event:null,seed:secret.seed,companyId:player.id,decision}));
        }
        if (process.env.SIDE_TEST_REAL_120==='YES' && count===3 && n===1) {
          // No client polling: wait for the database deadline and then simulate the scheduled worker.
          const {rows:[clock]}=await pool.query('select greatest(0,extract(epoch from (ends_at-clock_timestamp()))*1000)::int as ms from public.lite_cycles where id=$1',[started.body.id]);
          await new Promise(resolve=>setTimeout(resolve,clock.ms+250));
          assert.equal((await request('PUT',`/games/${game.body.id}/decision`,1,decision)).status,409);
        } else {
          // Accelerated closure exercises the same transaction and engine.
          await pool.query("update public.lite_cycles set starts_at=clock_timestamp()-interval '121 seconds', ends_at=clock_timestamp()-interval '1 second' where id=$1",[started.body.id]);
        }
        if(count===6 && n===1) {
          await pool.query('delete from side_lite_private.lite_cycle_secrets where cycle_id=$1',[started.body.id]);
          await assert.rejects(closeOne(sql),/Cycle close failed/);
          assert.equal((await pool.query('select 1 from public.lite_results where cycle_id=$1',[started.body.id])).rowCount,0);
          await pool.query('insert into side_lite_private.lite_cycle_secrets(cycle_id,seed) values($1,$2)',[started.body.id,secret.seed]);
        }
        const closed=await Promise.all([closeOne(sql),closeOne(sql)]);
        assert.equal(closed.filter(id=>id===started.body.id).length,1);
        for(let i=0;i<players.length;i++) {
          const {rows}=await pool.query('select result from public.lite_results where cycle_id=$1 and company_id=$2',[started.body.id,players[i].id]);
          assert.equal(rows.length,1);assert.deepEqual(rows[0].result,expected[i]);
        }
        const view=await request('GET',`/games/${game.body.id}`,0);
        assert.equal(view.status,200);assert.equal(view.body.results.length,n*2);
        if(n===count) assert.equal(view.body.ranking.length,2,'el ranking final contiene ambas empresas');
      }
      assert.equal((await request('POST',`/games/${game.body.id}/start`,0,{})).status,409);
    }
  } finally {if(server)await new Promise(resolve=>server.close(resolve));await sql.end();await apiPool.end();await pool.end();}
});
