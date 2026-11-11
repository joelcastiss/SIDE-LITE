// Test harness only: issues one-use tickets in an explicitly local stack.
// This is not the hosted scheduler and does not validate its security.
import {execFileSync} from 'node:child_process';
import {randomBytes, createHash} from 'node:crypto';

const stacks = {
  'codex-guest': ['side-lite-codex-guest-20261109', '56622', '56621'],
  validation: ['side-lite-validation-20261110', '56722', '56721'],
  default: ['side-lite-supabase-stack-verify', '56522', '56521'],
};
const [stackName, dbPort, apiPort] = stacks[process.env.SIDE_TEST_STACK || 'default'] || [];
if (!stackName) throw Error('Stack local desconocido');
const container = `supabase_db_${stackName}`;
const ports = execFileSync('docker', ['port', container, '5432/tcp'], {encoding:'utf8'}).trim().split(/\r?\n/);
if (!ports.length || !ports.every(line => line.endsWith(':'+dbPort))) throw Error('Destino local inesperado');
const apiKey = process.env.SIDE_LITE_LOCAL_ANON_KEY;
if (!apiKey || !/^[A-Za-z0-9._-]+$/.test(apiKey)) throw Error('Falta la clave pública local');
console.log('Barrido local de prueba activo; no es un programador de producción.');
while (true) {
  try {
    const token = randomBytes(32).toString('hex');
    const hash = createHash('sha256').update(token).digest('hex');
    execFileSync('docker', ['exec', container, 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-c',
      `insert into side_lite_private.lite_closer_tickets(token_hash,expires_at) values (decode('${hash}','hex'),clock_timestamp()+interval '60 seconds')`], {stdio:'ignore'});
    const response = await fetch(`http://127.0.0.1:${apiPort}/functions/v1/close-cycle`, {
      method:'POST', headers:{'content-type':'application/json', apikey:apiKey, 'x-side-cron-ticket':token}, body:'{}', signal:AbortSignal.timeout(15000),
    });
    if (!response.ok) throw Error('Falló el cierre');
    const result = await response.json();
    if (result.failed) throw Error('Falló un ciclo');
    if (result.closed) console.log(`Ciclos cerrados: ${result.closed}`);
  } catch { console.error('Falló el barrido local'); }
  await new Promise(resolve=>setTimeout(resolve,2000));
}
