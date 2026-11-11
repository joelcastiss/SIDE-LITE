// Dedicated GitHub Actions PostgreSQL cluster; all credentials and data are fictitious.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {createServer, request} from 'node:https';
import {readFile, mkdtemp} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import pg from 'pg';
const url='postgresql://postgres:local-test-only@127.0.0.1:5432/postgres';
if(process.env.SIDE_TEST_DISPOSABLE!=='YES'||process.env.SIDE_CI_POSTGRES_URL!==url||process.env.GITHUB_ACTIONS!=='true')throw Error('Solo el clúster desechable de Actions está permitido.');
const pool=new pg.Pool({connectionString:url,max:15});
const dir=await mkdtemp(join(tmpdir(),'side-cron-ci-'));
const keyPath=join(dir,'key.pem'),certPath=join(dir,'cert.pem');
execFileSync('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-keyout',keyPath,'-out',certPath,'-days','1','-subj','/CN=localhost','-addext','subjectAltName=IP:127.0.0.1'],{stdio:'ignore'});
const key=await readFile(keyPath),cert=await readFile(certPath);
let server, captured, calls=0, port;
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function serve(){
 server=createServer({key,cert},async(req,res)=>{
  const ticket=req.headers['x-side-test-token']||'';
  if(!/^[a-f0-9]{64}$/.test(ticket)){res.writeHead(401).end();return;}
  captured=ticket; calls++;
  try {
   const r=await pool.query(`delete from ci_ticket where hash=sha256(convert_to($1,'UTF8')) and expires_at>clock_timestamp() returning hash`,[ticket]);
   if(!r.rowCount){res.writeHead(401).end();return;}
   await pool.query(`update ci_cycle set closed=true where not closed and due_at<=clock_timestamp()`);
   res.writeHead(204).end();
  }catch{res.writeHead(500).end();}
 });
 await new Promise(resolve=>server.listen(port||0,'127.0.0.1',resolve));port=server.address().port;
}
function call(token){return new Promise((resolve,reject)=>{const req=request({hostname:'127.0.0.1',port,method:'POST',ca:cert,headers:{'x-side-test-token':token}},res=>{res.resume();res.on('end',()=>resolve(res.statusCode));});req.on('error',reject);req.end();});}
try {
 await serve();
 const version=await pool.query("select current_setting('server_version_num')::int as pg, (select extversion from pg_extension where extname='http') as http, (select extversion from pg_extension where extname='pg_cron') as cron");
 assert.ok(version.rows[0].pg>=170000&&version.rows[0].pg<180000);assert.equal(version.rows[0].http,'1.6');assert.ok(version.rows[0].cron);
 console.log('PostgreSQL 17; extensión http 1.6 (código fuente v1.6.3); pg_cron instalado.');
 await pool.query('create table ci_ticket(hash bytea primary key,expires_at timestamptz not null)');
 await pool.query("create table ci_cycle(closed boolean not null default false,due_at timestamptz not null); insert into ci_cycle(due_at) values(clock_timestamp()+interval '1 hour')");
 const bad=await pool.query(`select http_get('https://127.0.0.1:${port}/')`).catch(()=>null);assert.equal(bad,null,'debe rechazar certificado no confiable');
 await pool.query(`create procedure ci_wakeup() language plpgsql as $proc$
 declare token text := replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-',''); result integer;
 begin
  insert into ci_ticket values(sha256(convert_to(token,'UTF8')),clock_timestamp()+interval '30 seconds');
  commit;
  perform http_set_curlopt('CURLOPT_CAINFO','${certPath}');
  perform http_set_curlopt('CURLOPT_SSL_VERIFYPEER','1');
  perform http_set_curlopt('CURLOPT_SSL_VERIFYHOST','2');
  perform http_set_curlopt('CURLOPT_TIMEOUT_MS','3000');
  select r.status into result from http(('POST','https://127.0.0.1:${port}/',array[http_header('x-side-test-token',token)],'application/json','{}')::http_request) r;
  if result<>204 then raise exception 'wakeup rejected'; end if;
 end $proc$`);
 await pool.query("select cron.schedule('ci-side-wakeup','5 seconds','CALL ci_wakeup()')");
 for(let i=0;i<35&&!calls;i++)await pause(1000);
 assert.ok(calls,'Cron no completó la llamada TLS');
 assert.equal((await pool.query('select closed from ci_cycle')).rows[0].closed,false,'no cierra antes del vencimiento');
 assert.ok(captured);const replay=await Promise.all(Array.from({length:10},()=>call(captured)));assert.ok(replay.every(code=>code===401));
 await pool.query("update ci_cycle set due_at=clock_timestamp()-interval '1 second'");
 for(let i=0;i<20;i++){if((await pool.query('select closed from ci_cycle')).rows[0].closed)break;await pause(1000);}
 assert.equal((await pool.query('select closed from ci_cycle')).rows[0].closed,true,'no recuperó el trabajo vencido');
 const details=await pool.query("select count(*)::int as n from cron.job_run_details d join cron.job j on j.jobid=d.jobid where j.jobname='ci-side-wakeup' and d.status='succeeded'");assert.ok(details.rows[0].n);
 console.log('PASS: TLS confiable, certificado ajeno rechazado, CALL desde Cron, vencimiento y repetición.');
 const log=await readFile('/tmp/side-lite-ci-log/postgres.log','utf8');
 if(log.includes(captured)){console.error('FALLO DE SEGURIDAD: la cabecera de prueba aparece en registros DEBUG2. No desplegar esta arquitectura.');process.exitCode=1;}
 else console.log('PASS: la credencial ficticia capturada no apareció en el registro examinado.');
} finally {
 await pool.query("select cron.unschedule(jobid) from cron.job where jobname='ci-side-wakeup'").catch(()=>{});
 if(server)await new Promise(resolve=>server.close(resolve));
 await pool.end();
}
