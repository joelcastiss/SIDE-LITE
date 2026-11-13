// Run only on a fresh, disposable PostgreSQL cluster dedicated to this test.
import {Client} from 'pg';
import {readFile, readdir} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';

const url = process.env.SIDE_LITE_TEST_DATABASE_URL;
if (process.env.SIDE_TEST_DISPOSABLE !== 'YES' || !url) throw Error('Se requiere una base local desechable.');
const target = new URL(url);
if (!['127.0.0.1', 'localhost', '[::1]', '::1'].includes(target.hostname) || target.pathname !== '/side_lite_supabase_test') throw Error('Destino de prueba inválido.');
const db = new Client({connectionString: url});
await db.connect();
try {
  const {rows: [state]} = await db.query(`select
    exists(select 1 from pg_namespace where nspname in ('auth','side_lite_private')) as schema_exists,
    exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind in ('r','p','v','m','S')) as objects_exist,
    exists(select 1 from pg_roles where rolname in ('anon','authenticated','service_role','side_lite_api','side_lite_closer')) as roles_exist`);
  if (state.schema_exists || state.objects_exist || state.roles_exist) throw Error('Se requiere un clúster vacío; no se modificó nada.');
  await db.query(await readFile('supabase-side-lite/tests/postgres-auth-bootstrap.sql', 'utf8'));
  for (const file of (await readdir('supabase/migrations')).filter(x => /^\d+_[a-z0-9_]+\.sql$/.test(x)).sort()) {
    if (file === '20261113025642_independent_teacher_authorization.sql') {
      const upgrade = spawnSync(process.execPath, ['--test', 'supabase-side-lite/tests/teacher-attribution-postgres.test.mjs'], {stdio:'inherit', env:process.env});
      if (upgrade.error || upgrade.status !== 0) throw upgrade.error || Error('Teacher authorization upgrade failed');
    }
    // The plain PostgreSQL fixture has no pg_cron; the full CLI stack tests it.
    if (file === '20261111222502_side_lite_enable_sql_cron.sql') continue;
    if (file === '20261112044948_restrict_teacher_signup_domain.sql') {
      // Existing noninstitutional accounts must survive the new signup rule.
      await db.query("insert into auth.users(id,email,is_anonymous) values ('78000000-0000-4000-8000-000000000001','existing@example.test',false)");
    }
    // Exercise the LF checkout used by Linux CI even when developing on Windows.
    await db.query((await readFile(`supabase/migrations/${file}`, 'utf8')).replace(/\r\n/g, '\n'));
    console.log(`OK ${file}`);
  }
  await db.query("update auth.users set email=email where id='78000000-0000-4000-8000-000000000001'");
  const existing = await db.query("select 1 from auth.users where id='78000000-0000-4000-8000-000000000001'");
  if (existing.rowCount !== 1) throw Error('No se conservó la cuenta existente.');
  try {
    await db.query("insert into auth.users(id,email,is_anonymous) values ('78000000-0000-4000-8000-000000000002','new@example.test',false)");
    throw Error('El registro no institucional fue aceptado.');
  } catch (error) {
    if (error.code !== '23514') throw error;
  }
  try {
    await db.query("update auth.users set email='other@example.test' where id='78000000-0000-4000-8000-000000000001'");
    throw Error('El cambio a un correo no institucional fue aceptado.');
  } catch (error) {
    if (error.code !== '23514') throw error;
  }
  for (const file of ['postgres-rls-smoke.sql', 'postgres-server-roles.sql', 'postgres-auth-bridge.sql', 'postgres-mfa.sql']) {
    await db.query(await readFile(`supabase-side-lite/tests/${file}`, 'utf8'));
    console.log(`OK ${file}`);
  }
  const {rows: [result]} = await db.query("select to_regclass('side_lite_private.migration_replay_marker') is null as cleaned");
  if (!result.cleaned) throw Error('El marcador temporal de reconstrucción no se eliminó.');
  await db.query(await readFile('supabase-side-lite/tests/automatic-teacher.sql','utf8'));
  console.log('OK automatic-teacher.sql');
} finally { await db.end(); }
const result = spawnSync(process.execPath, ['--test', '--test-concurrency=1', 'supabase-side-lite/tests/games-postgres.test.mjs', 'supabase-side-lite/tests/markets-postgres.test.mjs', 'supabase-side-lite/tests/district-multicycle-postgres.test.mjs', 'supabase-side-lite/tests/join-limiter-postgres.test.mjs', 'supabase-side-lite/tests/multicycle-postgres.test.mjs', 'supabase-side-lite/tests/podium-postgres.test.mjs', 'supabase-side-lite/tests/manual-close-postgres.test.mjs'], {stdio: 'inherit', env: process.env});
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status || 1);

const parity = spawnSync(process.execPath,['supabase-side-lite/experimental/district-v3-full-parity.mjs'],{stdio:'inherit',env:process.env});
if(parity.error) throw parity.error;
if(parity.status!==0) process.exit(parity.status || 1);
