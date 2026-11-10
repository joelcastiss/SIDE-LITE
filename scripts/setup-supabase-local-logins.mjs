// Creates only disposable roles in the named local CLI stack; never for hosted projects.
import {Client} from 'pg';
import {randomBytes} from 'node:crypto';
import {writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import os from 'node:os';
import path from 'node:path';

const useCodex=process.env.SIDE_TEST_STACK==='codex-guest', stackName=useCodex?'side-lite-codex-guest-20261109':'side-lite-supabase-stack-verify', dbPort=useCodex?'56622':'56522';
const raw = process.env.SIDE_LOCAL_POSTGRES_URL;
const url = new URL(raw);
if (!['postgres:', 'postgresql:'].includes(url.protocol) || url.hostname !== '127.0.0.1' || url.port !== dbPort || url.pathname !== '/postgres' || url.search || url.hash) throw Error('Se requiere el stack Supabase local desechable confirmado');
const mapped = execFileSync('docker',['port',`supabase_db_${stackName}`,'5432/tcp'],{encoding:'utf8'});
if (!mapped.split(/\r?\n/).some(line=>line.endsWith(':'+dbPort))) throw Error('El puerto no corresponde al contenedor autorizado');
const apiPassword=randomBytes(32).toString('hex'), closerPassword=randomBytes(32).toString('hex'), secret=randomBytes(32).toString('hex');
const db = new Client({connectionString:raw});
await db.connect();
try {
  await db.query('begin');
  const {rows:[s]}=await db.query(`select current_database() = 'postgres' as db_ok,
    to_regclass('public.lite_games') is not null as schema_ok,
    exists(select 1 from pg_roles where rolname='side_lite_api') as api_ok,
    exists(select 1 from pg_roles where rolname='side_lite_closer') as closer_ok,
    exists(select 1 from pg_roles where rolname in ('side_lite_api_login','side_lite_closer_login')) as logins_exist`);
  if (!s.db_ok || !s.schema_ok || !s.api_ok || !s.closer_ok || s.logins_exist) throw Error('Estado local inesperado; no se crearon roles');
  await db.query(`create role side_lite_api_login login inherit bypassrls password '${apiPassword}'`);
  await db.query(`create role side_lite_closer_login login inherit bypassrls password '${closerPassword}'`);
  await db.query('grant side_lite_api to side_lite_api_login');
  await db.query('grant side_lite_closer to side_lite_closer_login');
  const {rows:[rights]}=await db.query(`select
    has_table_privilege('side_lite_api_login','public.lite_results','insert') as api_insert_result,
    has_table_privilege('side_lite_closer_login','public.lite_results','insert') as closer_insert_result,
    has_table_privilege('side_lite_closer_login','public.lite_games','insert') as closer_insert_game`);
  if (rights.api_insert_result || !rights.closer_insert_result || rights.closer_insert_game) throw Error('Los roles locales no tienen la separación esperada');
  const local=(name,password)=>`postgresql://${name}:${password}@host.docker.internal:${dbPort}/postgres`;
  const envFile=path.join(os.tmpdir(),stackName,'functions-local.env');
  await writeFile(envFile,`SIDE_API_DATABASE_URL=${local('side_lite_api_login',apiPassword)}\nSIDE_CLOSER_DATABASE_URL=${local('side_lite_closer_login',closerPassword)}\nSIDE_CLOSER_SECRET=${secret}\n`,{flag:'wx',mode:0o600});
  await db.query('commit');
  console.log('Roles locales aislados creados y privilegios comprobados.');
} catch (error) { await db.query('rollback'); throw error; } finally { await db.end(); }
