// Run only against an exclusively disposable, already migrated local cluster.
import assert from 'node:assert/strict';
import {randomBytes, randomUUID} from 'node:crypto';
import {spawn} from 'node:child_process';
import postgres from 'postgres';

const raw = process.env.SIDE_TEST_DATABASE_URL;
if (process.env.SIDE_TEST_DISPOSABLE !== 'YES' || !raw) throw Error('Se requiere SIDE_TEST_DISPOSABLE=YES y base local desechable.');
const url = new URL(raw);
if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) || url.pathname !== '/side_lite_supabase_test') throw Error('Destino local desechable inesperado.');
const sql = postgres(raw, {prepare:false, max:2});
const teacher = randomUUID(), a = randomUUID(), b = randomUUID();
const game = randomUUID(), companyA = randomUUID(), companyB = randomUUID(), cycle = randomUUID();
let scheduler;
try {
  const [pending] = await sql`select count(*)::int as n from public.lite_cycles where status='open' and paused_at is null and (ends_at <= clock_timestamp() or close_requested_at is not null)`;
  assert.equal(pending.n, 0, 'El programador no debe procesar ciclos ajenos.');
  await sql`insert into auth.users(id,email,email_confirmed_at) values (${teacher},${teacher+'@example.test'},now()),(${a},${a+'@example.test'},now()),(${b},${b+'@example.test'},now())`;
  await sql`insert into public.lite_games(id,teacher_id,name,code,cycle_count,capital_min,capital_max,costs) values (${game},${teacher},'Prueba local',${randomBytes(4).toString('hex').toUpperCase()},3,30000,30000,${sql.json({basic:20,standard:30,premium:40})})`;
  await sql`insert into public.lite_companies(id,game_id,student_id,name,store_id,initial_capital,cash) values (${companyA},${game},${a},'A',(select id from public.lite_stores limit 1),30000,30000),(${companyB},${game},${b},'B',(select id from public.lite_stores limit 1),30000,30000)`;
  await sql`insert into public.lite_cycles(id,game_id,number,starts_at,ends_at) values (${cycle},${game},1,clock_timestamp(),clock_timestamp()+interval '120 seconds')`;
  await sql`insert into side_lite_private.lite_cycle_secrets(cycle_id) values (${cycle})`;
  await sql`insert into public.lite_decisions(game_id,cycle_id,company_id,quality,quantity,price,marketing_amount,confirmed) values (${game},${cycle},${companyA},'basic',10,100,0,true),(${game},${cycle},${companyB},'standard',10,100,0,true)`;
  const [deadline] = await sql`select extract(epoch from ends_at-starts_at) as seconds from public.lite_cycles where id=${cycle}`;
  assert.ok(Number(deadline.seconds) >= 120 && Number(deadline.seconds) < 121);
  // Separate process, no browser or application request. Real closing worker and PostgreSQL.
  const source = `import postgres from 'postgres'; import {closeOne,sweep} from './supabase-side-lite/functions/close-cycle/worker.js'; const db=postgres(process.env.SIDE_TEST_DATABASE_URL,{prepare:false,max:1}); let busy=false; const timer=setInterval(async()=>{if(busy)return; busy=true; try {const r=await sweep(excluded=>closeOne(db,excluded)); if(r.failed) throw Error('sweep failed');} catch(e){console.error(e.message);process.exitCode=1;clearInterval(timer);await db.end();} finally {busy=false;}},1000);`;
  scheduler = spawn(process.execPath, ['--input-type=module','-e',source], {cwd:process.cwd(), env:process.env, stdio:['ignore','ignore','pipe']});
  let childError = ''; scheduler.stderr.on('data', chunk => childError += chunk.toString());
  const timeout = Date.now() + 150000;
  let closed;
  while (Date.now() < timeout) {
    if (scheduler.exitCode !== null) throw Error('Programador terminó: ' + childError);
    const [row] = await sql`select c.status, c.ends_at <= clock_timestamp() as due, extract(epoch from clock_timestamp()-c.ends_at) as overdue, (select count(*)::int from public.lite_results r where r.cycle_id=c.id) as results from public.lite_cycles c where c.id=${cycle}`;
    if (!row.due) assert.equal(row.status, 'open', 'El ciclo no puede cerrarse antes del plazo.');
    if (row.status === 'closed') { assert.equal(row.due, true); assert.equal(row.results, 2); assert.ok(Number(row.overdue) < 30, 'La observación se retrasó demasiado para verificar el temporizador.'); closed = true; break; }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  assert.ok(closed, 'No se cerró el ciclo después de su plazo.');
  console.log('OK: proceso independiente cerró tras 120 segundos, con dos resultados y sin navegador.');
} finally {
  if (scheduler && scheduler.exitCode === null) scheduler.kill();
  await sql.end();
}
