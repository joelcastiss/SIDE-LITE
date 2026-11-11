// Solo stack Supabase desechable de SIDE-LITE con migración de tickets y Edge actualizados.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import pg from 'pg';
if(process.env.SIDE_TEST_DISPOSABLE!=='YES')throw Error('Requiere SIDE_TEST_DISPOSABLE=YES');
const name='side-lite-codex-guest-20261109',port=spawnSync('docker',['port',`supabase_db_${name}`,'5432/tcp'],{encoding:'utf8'});if(port.status!==0||!port.stdout.trim().split(/\r?\n/).every(x=>x.endsWith(':56622')))throw Error('Destino inesperado');
if(!/^[A-Za-z0-9._-]+$/.test(process.env.SIDE_TEST_LOCAL_ANON_KEY||''))throw Error('Falta clave pública local válida.');
const db=new pg.Client({connectionString:'postgresql://postgres:postgres@127.0.0.1:56622/postgres'});await db.connect();let installed=false;
try{
 const existing=await db.query("select 1 from cron.job where jobname='side-lite-close-cycle'");if(existing.rowCount)throw Error('Ya existe un cron con ese nombre');
 const table=await db.query("select to_regclass('side_lite_private.lite_closer_tickets') as name");if(!table.rows[0].name)throw Error('Falta la migración local de tickets.');
 const started=await db.query('select clock_timestamp() as value');let script=await readFile('supabase-side-lite/scheduler/install-cron.sql','utf8');script=script.replace('https://hwwwoblfpsqqrkxvclag.supabase.co','http://host.docker.internal:56621').replace('sb_publishable_52fukw__BaCel-Igx5e0vg_RgsvhxiN',process.env.SIDE_TEST_LOCAL_ANON_KEY);await db.query("select set_config('app.side_lite_cron_approved','hwwwoblfpsqqrkxvclag',false)");await db.query(script);installed=true;
 let success=false;for(let i=0;i<35;i++){await new Promise(r=>setTimeout(r,1000));const {rows}=await db.query("select status_code from net._http_response where created>=$1 and status_code=200 order by created desc limit 1",[started.rows[0].value]);if(rows.length){success=true;break}}assert.ok(success,'El cierre programado no respondió 200');console.log('PASS: pg_cron invocó la función Edge local mediante pg_net y un ticket efímero.');
}finally{if(installed)await db.query("select cron.unschedule(jobid) from cron.job where jobname='side-lite-close-cycle'");await db.end()}
