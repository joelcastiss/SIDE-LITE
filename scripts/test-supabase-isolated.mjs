// Disposable PostgreSQL cluster only: this test creates cluster-wide roles.
import {Client} from 'pg';
import {readFile, readdir} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
const url = process.env.SIDE_LITE_TEST_DATABASE_URL;
if (process.env.SIDE_TEST_DISPOSABLE !== 'YES' || !url) throw Error('Se requiere SIDE_TEST_DISPOSABLE=YES y SIDE_LITE_TEST_DATABASE_URL.');
const target = new URL(url);
if (!['127.0.0.1', 'localhost', '[::1]', '::1'].includes(target.hostname) || target.pathname !== '/side_lite_supabase_test') throw Error('Se requiere una base local desechable llamada side_lite_supabase_test.');
const db = new Client({connectionString:url});
await db.connect();
try {
  const {rows:[state]}=await db.query(`select exists(select 1 from pg_namespace where nspname in ('auth','side_lite_private')) as schema_exists,
    exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind in ('r','p','v','m','S')) as objects_exist,
    exists(select 1 from pg_roles where rolname in ('anon','authenticated','service_role','side_lite_api','side_lite_closer')) as roles_exist`);
  if (state.schema_exists || state.objects_exist || state.roles_exist) throw Error('Se requiere un clúster y una base vacíos; no se modificó nada.');
  const run = async file => { await db.query(await readFile(file,'utf8')); console.log(`OK ${file}`); };
  await run('supabase-side-lite/tests/postgres-auth-bootstrap.sql');
  await run('supabase-side-lite/tests/legacy-tables-fixture.sql');
  const migrations=(await readdir('supabase-side-lite/supabase/migrations')).filter(n=>n.endsWith('.sql')).sort();
  for (const migration of migrations) await run(path.join('supabase-side-lite/supabase/migrations',migration));
  await run('supabase-side-lite/tests/legacy-tables-security.sql');
  await run('supabase-side-lite/tests/postgres-rls-smoke.sql');
  await run('supabase-side-lite/tests/postgres-server-roles.sql');
  await run('supabase-side-lite/tests/postgres-auth-bridge.sql');
  await run('supabase-side-lite/tests/postgres-mfa.sql');
} finally { await db.end(); }
const test=spawnSync(process.execPath,['--test','--test-concurrency=1','supabase-side-lite/tests/games-postgres.test.mjs','supabase-side-lite/tests/join-limiter-postgres.test.mjs','supabase-side-lite/tests/multicycle-postgres.test.mjs','supabase-side-lite/tests/podium-postgres.test.mjs'],{stdio:'inherit',env:process.env});
if(test.error) throw test.error;
if(test.status!==0) process.exit(test.status || 1);
