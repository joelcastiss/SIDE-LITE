// Print only allowlisted categories from the private CLI startup log; that log
// may contain API and database credentials and must never be uploaded or echoed.
import {readFile} from 'node:fs/promises';
const file=process.argv[2];
if(process.env.CI!=='true'||!file||!file.endsWith('/side-lite-start.log'))throw Error('Diagnóstico solo para CI local');
const log=await readFile(file,'utf8');
const tests=[
 ['dns',/temporary failure resolving|no such host|lookup .*?(?:timeout|failed)|name resolution/i],
 ['docker',/cannot connect to the docker daemon|permission denied.*docker|error during connect/i],
 ['image_pull',/pull access denied|manifest unknown|toomanyrequests|error pulling image|failed to pull/i],
 ['database_start',/database.*(?:unhealthy|failed to start)|failed to start.*(?:postgres|database)/i],
 ['migration',/applying migration|failed to apply migration|migration .*failed/i],
 ['configuration',/failed to parse config|invalid config|unknown config|error parsing|unrecognized configuration/i],
 ['resource',/no space left on device|out of memory|oomkilled/i],
 ['bind_port',/port is already allocated|address already in use/i],
 ['container_health',/unhealthy|health check.*(?:failed|timeout)|timed out waiting/i],
];
const matches=tests.filter(([,pattern])=>pattern.test(log)).map(([name])=>name);
const migrations=[...log.matchAll(/(?:Applying migration|failed to apply migration)\s+(\d{14}_[a-z0-9_]+\.sql)/gi)].map(m=>m[1]);
const states=[...new Set([...log.matchAll(/SQLSTATE[ :]*([0-9A-Z]{5})/g)].map(m=>m[1]))];
console.log('Categorías de error de inicio:',matches.length?matches.join(', '):'sin clasificar');
if(migrations.length) console.log('Última migración identificada:',migrations.at(-1));
if(states.length) console.log('SQLSTATE:',states.join(', '));
console.log('El registro completo se conserva solo en el runner y no se publica.');
