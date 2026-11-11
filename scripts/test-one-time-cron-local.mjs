// Integration against the explicitly named disposable Supabase stack only.
// A local HTTP endpoint invokes the same Edge ticket consumer; it does not
// exercise the deployed Edge runtime or the economic engine.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import postgres from 'postgres';
import {consumeTicket} from '../supabase-side-lite/functions/close-cycle/ticket.js';
if(process.env.SIDE_TEST_DISPOSABLE!=='YES') throw Error('Se requiere stack local desechable.');
const project='side-lite-codex-guest-20261109';
const port=spawnSync('docker',['port',`supabase_db_${project}`,'5432/tcp'],{encoding:'utf8'});
if(port.status!==0||!port.stdout.trim().split(/\r?\n/).every(x=>x.endsWith(':56622')))throw Error('Destino local inesperado.');
const sql=postgres('postgresql://postgres:postgres@127.0.0.1:56622/postgres',{max:5,prepare:false});
const localEnv=await readFile(path.join(os.tmpdir(),project,'functions-local.env'),'utf8');
const localCloserUrl=localEnv.split(/\r?\n/).find(line=>line.startsWith('SIDE_CLOSER_DATABASE_URL='))?.slice('SIDE_CLOSER_DATABASE_URL='.length);
if(!localCloserUrl)throw Error('Falta la conexión local de cierre.');
const closerUrl=new URL(localCloserUrl);closerUrl.hostname='127.0.0.1';closerUrl.port='56622';
const closer=postgres(closerUrl.toString(),{max:2,prepare:false});
let created=false,installed=false,server;
try {
  const [prior]=await sql`select to_regclass('side_lite_private.lite_closer_tickets') is not null as present,
    exists(select 1 from cron.job where jobname='side-lite-close-cycle') as job`;
  if(prior.present||prior.job)throw Error('El stack ya contiene recursos con estos nombres.');
  await sql.unsafe(await readFile('supabase-side-lite/supabase/migrations/20261110195138_side_lite_one_time_scheduler.sql','utf8'));
  created=true;
  let accepted=0;
  server=createServer(async(req,res)=>{
    try {
      if(req.method!=='POST') {res.writeHead(405).end();return;}
      const ok=await consumeTicket(closer,req.headers['x-side-cron-ticket']||'');
      if(ok)accepted++;
      res.writeHead(ok?200:401).end();
    } catch (error) {console.error('Falló la validación local del ticket:', error.message);res.writeHead(500).end();}
  });
  await new Promise(resolve=>server.listen(0,'0.0.0.0',resolve));
  const address=`http://host.docker.internal:${server.address().port}`;
  const script=(await readFile('supabase-side-lite/scheduler/install-cron.sql','utf8')).replace('https://hwwwoblfpsqqrkxvclag.supabase.co',address);
  await sql`select set_config('app.side_lite_cron_approved','hwwwoblfpsqqrkxvclag',false)`;
  await sql.unsafe(script);
  installed=true;
  for(let n=0;n<35&&!accepted;n++)await new Promise(resolve=>setTimeout(resolve,1000));
  assert.ok(accepted>0,'Cron no entregó un ticket válido mediante pg_net.');
  console.log('PASS: pg_cron generó y entregó un ticket efímero por pg_net; el consumidor lo validó con el rol de cierre.');
} finally {
  if(created) {
    if(installed)await sql`select cron.unschedule(jobid) from cron.job where jobname='side-lite-close-cycle'`;
    await sql`drop table side_lite_private.lite_closer_tickets`;
  }
  if(server)await new Promise(resolve=>server.close(resolve));
  await closer.end();
  await sql.end();
}
