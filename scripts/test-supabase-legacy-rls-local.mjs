// Run only against the named disposable Supabase stack; transaction is rolled back.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import pg from 'pg';
if(process.env.SIDE_TEST_DISPOSABLE!=='YES')throw Error('Requiere SIDE_TEST_DISPOSABLE=YES');
const project='side-lite-codex-guest-20261109',mapped=spawnSync('docker',['port',`supabase_db_${project}`,'5432/tcp'],{encoding:'utf8'});
if(mapped.status!==0||!mapped.stdout.trim().split(/\r?\n/).every(s=>s.endsWith(':56622')))throw Error('Destino local inesperado');
const db=new pg.Client({connectionString:'postgresql://postgres:postgres@127.0.0.1:56622/postgres'}),tables=['lite_sessions','lite_auth_limits','lite_teacher_grades','lite_teacher_podium'];
await db.connect();try{
 await db.query('begin');for(const table of tables){const {rows:[state]}=await db.query('select to_regclass($1) as name',[`public.${table}`]);if(state.name)throw Error(`La tabla ${table} ya existe; se cancela`);await db.query(`create table public.${table}(id integer, secret text)`);await db.query(`grant select,insert,update,delete on public.${table} to anon,authenticated`);await db.query(`grant select(secret),update(secret) on public.${table} to anon,authenticated`)}
 await db.query(await readFile('supabase-side-lite/supabase/migrations/20261109204458_restrict_legacy_tables.sql','utf8'));
 const {rows}=await db.query(`select c.relname,c.relrowsecurity,has_table_privilege('anon',c.oid,'SELECT,INSERT,UPDATE,DELETE') as anon_table,has_table_privilege('authenticated',c.oid,'SELECT,INSERT,UPDATE,DELETE') as authenticated_table,has_column_privilege('anon',c.oid,'secret','SELECT') as anon_column,has_column_privilege('authenticated',c.oid,'secret','UPDATE') as authenticated_column from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname=any($1)`,[tables]);
 assert.equal(rows.length,4);for(const row of rows){assert.equal(row.relrowsecurity,true);for(const k of ['anon_table','authenticated_table','anon_column','authenticated_column'])assert.equal(row[k],false,`${row.relname} ${k}`)}
 console.log('PASS: cuatro tablas con RLS y sin permisos de tabla ni columna para anon/authenticated en Supabase local.');
}finally{await db.query('rollback');await db.end()}
