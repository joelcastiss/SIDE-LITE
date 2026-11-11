// Disposable local experiment. It does not use Supabase or verify TLS/pg_cron.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import pg from 'pg';
const url='postgresql://postgres@127.0.0.1:55482/postgres';
if(process.env.SIDE_TEST_DISPOSABLE!=='YES'||process.env.SIDE_WAKEUP_TEST_URL!==url)throw Error('Se requiere el clúster local exclusivo.');
const pool=new pg.Pool({connectionString:url,max:10});
let token,server;
try {
 await pool.query('create extension http');
 await pool.query('create table wakeup_ticket_experiment (hash bytea primary key, expires_at timestamptz not null)');
 server=createServer(async(req,res)=>{
  const candidate=req.headers['x-wakeup-token']||'';if(!/^[a-f0-9]{64}$/.test(candidate)){res.writeHead(401).end();return;}
  token=candidate;
  const result=await pool.query("delete from wakeup_ticket_experiment where hash=sha256(convert_to($1,'UTF8')) and expires_at>clock_timestamp() returning hash",[candidate]);
  res.writeHead(result.rowCount===1?200:401).end();
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const port=server.address().port;
 await pool.query(`create procedure wakeup_experiment() language plpgsql as $proc$
 declare secret text := replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-',''); status integer;
 begin
   insert into wakeup_ticket_experiment values(sha256(convert_to(secret,'UTF8')),clock_timestamp()+interval '60 seconds');
   commit;
   perform http_set_curlopt('CURLOPT_TIMEOUT_MS','3000');
   select r.status into status from http(('POST','http://127.0.0.1:${port}/',array[http_header('x-wakeup-token',secret)],'application/json','{}')::http_request) r;
   if status<>200 then raise exception 'wakeup rejected'; end if;
 end $proc$`);
 await pool.query('call wakeup_experiment()');
 assert.ok(token);assert.equal((await pool.query('select count(*)::int as n from wakeup_ticket_experiment')).rows[0].n,0);
 const response=await fetch(`http://127.0.0.1:${port}/`,{method:'POST',headers:{'x-wakeup-token':token}});assert.equal(response.status,401);
 const log=await readFile(join(tmpdir(),'side-lite-http-test','server.log'),'utf8');assert.equal(log.includes(token),false,'el token no aparece en el registro local');
 console.log('PASS: commit previo, entrega HTTP síncrona y consumo único; repetición rechazada; token ausente del log local.');
 console.log('NO VERIFICADO: TLS, pg_cron y extensión 1.6 de Supabase alojado; no es código de producción.');
} finally {if(server)await new Promise(resolve=>server.close(resolve));await pool.end();}
