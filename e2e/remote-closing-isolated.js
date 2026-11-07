// Solo para una base local desechable y vacía denominada side_lite_closing_test.
import pg from 'pg';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {closeDue} from '../remote/close-cycle.js';
const url=new URL(process.env.SIDE_LITE_CLOSING_TEST_DATABASE_URL||'');
if(!['postgres:','postgresql:'].includes(url.protocol)||!['localhost','127.0.0.1','[::1]'].includes(url.hostname)||url.pathname!=='/side_lite_closing_test'||['host','hostaddr','service'].some(x=>url.searchParams.has(x)))throw Error('Se requiere side_lite_closing_test aislada en localhost');
const pool=new pg.Pool({connectionString:url.toString(),max:5});
try{
 if((await pool.query("SELECT 1 FROM pg_namespace WHERE nspname IN ('lite','neon_auth')")).rowCount)throw Error('La base debe estar vacía');
 await pool.query('CREATE SCHEMA neon_auth; CREATE TABLE neon_auth."user" (id uuid PRIMARY KEY)');
 await pool.query(await readFile(new URL('../remote/migrations/202611030001_neon_dev.sql',import.meta.url),'utf8'));
 const ids=['00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002'];
 for(const id of ids){await pool.query('INSERT INTO neon_auth."user" VALUES($1)',[id]);await pool.query("INSERT INTO lite.lite_profiles(id,display_name,role) VALUES($1,'Prueba',$2)",[id,id===ids[0]?'teacher':'student']);}
 const store=(await pool.query('SELECT id FROM lite.lite_stores LIMIT 1')).rows[0].id;
 const cycles=[];
 for(const [index,cost] of [[0,-1],[1,50]]){
  const game=(await pool.query("INSERT INTO lite.lite_games(teacher_id,name,code,cycle_count,capital_min,capital_max,costs) VALUES($1,$2,$3,3,30000,30000,$4) RETURNING id",[ids[0],`Prueba ${index}`,`TEST000${index}`,JSON.stringify({basic:cost,standard:80,premium:120})])).rows[0].id;
  const company=(await pool.query("INSERT INTO lite.lite_companies(game_id,student_id,name,store_id,initial_capital,cash) VALUES($1,$2,'Tienda',$3,30000,30000) RETURNING id",[game,ids[1],store])).rows[0].id;
  const cycle=(await pool.query("INSERT INTO lite.lite_cycles(game_id,number,ends_at) VALUES($1,1,now()-interval '1 second') RETURNING id",[game])).rows[0].id;
  await pool.query("INSERT INTO lite.lite_decisions(cycle_id,company_id,quality,quantity,price,marketing_amount,confirmed) VALUES($1,$2,'basic',10,100,0,true)",[cycle,company]); cycles.push({cycle,game});
 }
 const outcomes=await Promise.allSettled([closeDue(pool),closeDue(pool)]);
 assert.ok(outcomes.some(x=>x.status==='rejected'&&x.reason instanceof AggregateError));
 let rows=(await pool.query('SELECT id,status FROM lite.lite_cycles ORDER BY id')).rows;
 assert.equal(rows.find(x=>x.id===cycles[0].cycle).status,'open');
 assert.equal(rows.find(x=>x.id===cycles[1].cycle).status,'closed');
 assert.equal((await pool.query('SELECT count(*)::int AS n FROM lite.lite_results WHERE cycle_id=$1',[cycles[1].cycle])).rows[0].n,1);
 await pool.query("UPDATE lite.lite_games SET costs=$1 WHERE id=$2",[JSON.stringify({basic:50,standard:80,premium:120}),cycles[0].game]);
 assert.equal(await closeDue(pool),1);
 assert.equal(await closeDue(pool),0);
 assert.equal((await pool.query('SELECT count(*)::int AS n FROM lite.lite_results')).rows[0].n,2);
 console.log('PASS: cierre remoto aísla errores, recupera ciclos y evita duplicados bajo concurrencia');
}finally{await pool.end()}
