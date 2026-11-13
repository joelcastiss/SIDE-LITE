// Builds an explicitly local-only copy for the disposable CLI project.
// It never edits the production entrypoints or the CLI project's own files.
import {cp, mkdir, readFile, writeFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const useCodex = process.env.SIDE_TEST_STACK === 'codex-guest';
const validation = process.env.SIDE_TEST_STACK === 'validation';
const stackName=validation?'side-lite-validation-20261110':useCodex?'side-lite-codex-guest-20261109':'side-lite-codex-results-20261112';
const apiPort=validation?56721:useCodex?56621:59521, dbPort=validation?56722:useCodex?56622:59522;
const stack = path.join(os.tmpdir(), stackName);
const fixtureName = process.env.SIDE_TEST_FIXTURE_NAME || (useCodex ? 'side-lite-fixture-final2' : 'side-lite-fixture');
if (!/^side-lite-fixture(?:-[a-z0-9]+)*$/.test(fixtureName)) throw Error('Nombre de copia local inválido');
const target = path.join(stack, fixtureName);
const config = await readFile(path.join(stack,'supabase','config.toml'),'utf8');
if (!config.includes(`project_id = "${stackName}"`) || !config.includes(`port = ${apiPort}`) || !config.includes(`port = ${dbPort}`)) throw Error('Proyecto local o puertos inesperados');
const anon = process.env.SIDE_LITE_LOCAL_ANON_KEY;
if (typeof anon !== 'string' || anon.length < 40 || !/^[A-Za-z0-9._-]+$/.test(anon)) throw Error('Defina SIDE_LITE_LOCAL_ANON_KEY del stack desechable');
// mkdir without recursive fails if the fixture already exists: never overwrite it.
await mkdir(target);
for (const dir of ['public','js','supabase-side-lite/api','supabase-side-lite/functions','supabase-side-lite/supabase/functions']) {
  await cp(path.join(root,dir),path.join(target,dir),{recursive:true});
}
async function transform(file, replacements) {
  const dest=path.join(target,file); let source=await readFile(dest,'utf8');
  for (const [before,after] of replacements) {
    if (!source.includes(before)) throw Error(`La fuente cambió; no se generó una copia válida: ${file}`);
    source=source.replaceAll(before,after);
  }
  await writeFile(dest,source);
}
const productionUrl='https://hwwwoblfpsqqrkxvclag.supabase.co';
const localUrl=`http://127.0.0.1:${apiPort}`;
const productionKey='sb_publishable_52fukw__BaCel-Igx5e0vg_RgsvhxiN';
await transform('public/supabase-client.js',[[productionUrl,localUrl],[productionKey,anon]]);
// The game bridge has its own endpoint and key; leaving it untouched would
// send a local browser session to the hosted project.
await transform('public/services/lite-game-service.js',[[productionUrl,localUrl],[productionKey,anon]]);
await transform('public/supabase-session.js',[
  ["projectUrl.protocol !== 'https:' || projectUrl.hostname !== 'hwwwoblfpsqqrkxvclag.supabase.co' || projectUrl.port",`projectUrl.origin !== '${localUrl}'`],
  [productionUrl,localUrl],[productionKey,anon],
]);
await transform('supabase-side-lite/functions/side-lite-api/adapter.js',[["https://joelcastiss.github.io","http://127.0.0.1:4178"]]);
const localValidator=`export function validateDatabaseTarget(raw) {
  const url = new URL(raw);
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || url.hostname !== 'host.docker.internal' || url.port !== '${dbPort}' || !url.username || !url.password || url.search || url.hash) throw Error('Solo PostgreSQL local aislado');
  return raw;
}`;
await writeFile(path.join(target,'supabase-side-lite/functions/database-target.js'),localValidator);
await transform('supabase-side-lite/functions/side-lite-api/index.ts',[
  ["const ref = 'hwwwoblfpsqqrkxvclag';", "// This fixture has no hosted project reference."],
  ["ssl:{rejectUnauthorized:true}, ",""],
  ["ssl:{ca:closerCa,rejectUnauthorized:true},", ""],
  ["const closerCa=Deno.env.get('SIDE_CLOSER_CA_CERT') || '';", "const closerCa='-----BEGIN CERTIFICATE-----\\nlocal-only\\n-----END CERTIFICATE-----';"],
  ["projectUrl:`https://${ref}.supabase.co`",`projectUrl:'${localUrl}'`],
]);
// Local Auth signs with an asymmetric key. Its issuer is the browser-visible
// loopback URL, while Edge reaches the same local gateway via Docker's host alias.
await transform('supabase-side-lite/api/identity.js',[
  ["url.protocol !== 'https:' || url.username || url.password || url.port || url.pathname !== '/' || url.search || url.hash || url.hostname !== 'hwwwoblfpsqqrkxvclag.supabase.co'",`url.origin !== '${localUrl}' || url.username || url.password || url.pathname !== '/' || url.search || url.hash`],
  ["const keys = keyResolver || createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks.json`));", `const keys = keyResolver || createRemoteJWKSet(new URL('http://host.docker.internal:${apiPort}/auth/v1/.well-known/jwks.json'));`],
]);
for (const file of ['public/supabase-client.js','public/supabase-session.js','public/services/lite-game-service.js','supabase-side-lite/api/identity.js','supabase-side-lite/functions/database-target.js','supabase-side-lite/functions/side-lite-api/index.ts','supabase-side-lite/functions/side-lite-api/adapter.js']) {
  const source=await readFile(path.join(target,file),'utf8');
  if (source.includes('hwwwoblfpsqqrkxvclag') || source.includes('plfuwfdpsagzrlveqkvl') || source.includes('https://joelcastiss.github.io')) throw Error(`Referencia alojada en fixture activo: ${file}`);
}
console.log(`Copia local creada en ${target}. No apta para desplegar.`);
