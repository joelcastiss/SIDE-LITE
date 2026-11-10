// Solo stack Supabase desechable de SIDE-LITE: crea un cron y secretos efímeros y los retira.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import os from 'node:os';import path from 'node:path';import pg from 'pg';
if(process.env.SIDE_TEST_DISPOSABLE!=='YES')throw Error('Requiere SIDE_TEST_DISPOSABLE=YES');
const name='side-lite-codex-guest-20261109',port=spawnSync('docker',['port',`supabase_db_${name}`,'5432/tcp'],{encoding:'utf8'});if(port.status!==0||!port.stdout.trim().split(/\r?\n/).every(x=>x.endsWith(':56622')))throw Error('Destino inesperado');
const env=await readFile(path.join(os.tmpdir(),name,'functions-local.env'),'utf8'),secret=env.split(/\r?\n/).find(s=>s.startsWith('SIDE_CLOSER_SECRET='))?.slice(19);if(!secret)throw Error('Falta secreto de pruebas');
const db=new pg.Client({connectionString:'postgresql://postgres:postgres@127.0.0.1:56622/postgres'});await db.connect();let ids=[];
try{
 const existing=await db.query("select 1 from cron.job where jobname='side-lite-close-cycle' union all select 1 from vault.secrets where name in ('side_lite_closer_secret','side_lite_gateway_key')");if(existing.rowCount)throw Error('Ya existen recursos de prueba con ese nombre');
 for(const [value,label] of [[secret,'side_lite_closer_secret'],[process.env.SIDE_TEST_LOCAL_ANON_KEY,'side_lite_gateway_key']]){if(!value)throw Error('Falta clave local');const r=await db.query('select vault.create_secret($1,$2) id',[value,label]);ids.push(r.rows[0].id)}
 const started=await db.query('select clock_timestamp() as value');let script=await readFile('supabase-side-lite/scheduler/install-cron.sql','utf8');script=script.replace('https://hwwwoblfpsqqrkxvclag.supabase.co','http://host.docker.internal:56621');await db.query("select set_config('app.side_lite_cron_approved','hwwwoblfpsqqrkxvclag',false)");await db.query(script);
 let success=false;for(let i=0;i<35;i++){await new Promise(r=>setTimeout(r,1000));const {rows}=await db.query("select status_code from net._http_response where created>=$1 and status_code=200 order by created desc limit 1",[started.rows[0].value]);if(rows.length){success=true;break}}assert.ok(success,'El cierre programado no respondió 200');console.log('PASS: pg_cron invocó la función Edge local mediante pg_net y secreto de Vault.');
}finally{await db.query("select cron.unschedule(jobid) from cron.job where jobname='side-lite-close-cycle'");for(const id of ids)await db.query('delete from vault.secrets where id=$1',[id]);await db.end()}
