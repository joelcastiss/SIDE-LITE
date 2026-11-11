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
const codes=[...new Set([...log.matchAll(/"code"\s*:\s*"([A-Za-z][A-Za-z0-9]{0,79}Error)"/g)].map(m=>m[1]))];
const filenames=[...new Set([...log.matchAll(/\b(config\.toml|seed\.sql|docker|supabase|migrations|functions|deno\.json|import_map\.json|\.env)\b/gi)].map(m=>m[1].toLowerCase()))];
console.log('Categorías de error de inicio:',matches.length?matches.join(', '):'sin clasificar');
if(migrations.length) console.log('Última migración identificada:',migrations.at(-1));
if(states.length) console.log('SQLSTATE:',states.join(', '));
if(codes.length) console.log('Códigos CLI:',codes.join(', '));
if(filenames.length) console.log('Archivos o componentes conocidos:',filenames.join(', '));
// Preserve only known harmless diagnostic words from candidate error lines;
// everything else, including tokens, paths, URLs, hosts and user data, is lost.
const allowed=new Set('error failed failure fatal invalid unexpected unsupported unknown cannot could not unable missing required bad format malformed config configuration parse parsing project local stack docker container engine image pull download registry manifest access denied permission forbidden unauthorized conflict already exists not found version cli api key token jwt secret database postgres migration migrations auth schema relation role extension dependency start starting startup stop stopped health unhealthy timeout network connection connect dns socket port bind address allocated listener command flag argument syntax response status unprocessable entity password certificate issuer signing keys server platform architecture compatible latest tags rate limit refused unreachable exceeded requires sql no such file directory closed existing service services exit code read reading open opening stat executable binary create creating load loading resolve resolving write writing initialize initializing source copy path client request'.split(' '));
const candidates=log.split(/\r?\n/).filter(line=>/\b(error|failed|failure|fatal|invalid|unexpected|unsupported|unable|denied|forbidden|timeout|not found)\b/i.test(line)).slice(-12);
for(const line of candidates){const words=(line.toLowerCase().match(/[a-z]+/g)||[]).filter(word=>allowed.has(word));if(words.length)console.log('Detalle filtrado:',words.join(' '));}
console.log('El registro completo se conserva solo en el runner y no se publica.');
