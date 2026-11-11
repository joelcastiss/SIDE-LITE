// Transaction-semantics experiment against the specifically named local cluster.
import assert from 'node:assert/strict';
import pg from 'pg';
const url='postgresql://postgres@127.0.0.1:55482/postgres';
if(process.env.SIDE_TEST_DISPOSABLE!=='YES'||process.env.SIDE_WAKEUP_TEST_URL!==url)throw Error('Se requiere el clúster local exclusivo.');
const pool=new pg.Pool({connectionString:url,max:3});
try {
 await pool.query('create table wakeup_commit_experiment (hash bytea not null, phase integer not null)');
 await pool.query(`create procedure wakeup_commit_experiment() language plpgsql as $proc$
 declare secret text := replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-','');
 begin
   insert into wakeup_commit_experiment values(sha256(convert_to(secret,'UTF8')),1);
   commit;
   perform pg_sleep(1);
   insert into wakeup_commit_experiment values(sha256(convert_to(secret,'UTF8')),2);
 end $proc$`);
 const running=pool.query('call wakeup_commit_experiment()');
 let observed=false;
 for(let i=0;i<20;i++){const r=await pool.query('select phase from wakeup_commit_experiment');if(r.rows.some(x=>x.phase===1)){observed=true;break;}await new Promise(resolve=>setTimeout(resolve,50));}
 assert.ok(observed,'otra sesión debe ver el primer commit mientras sigue el procedimiento');
 await running;
 const r=await pool.query('select count(*)::int as n, count(distinct encode(hash,\'hex\'))::int as hashes from wakeup_commit_experiment');
 assert.deepEqual(r.rows[0],{n:2,hashes:1});
 console.log('PASS: CALL confirma el hash antes de continuar y conserva la variable tras COMMIT.');
 console.log('NO VERIFICADO: pg_cron, HTTP, TLS, registros ni ejecución en Supabase.');
} finally {await pool.end();}
