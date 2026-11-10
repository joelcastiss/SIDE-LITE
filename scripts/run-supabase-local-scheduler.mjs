// Test harness only: redirects the scheduler's fixed production target to the
// one verified local Supabase project. It cannot send a request to production.
import {readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import os from 'node:os';
import {runSweep} from '../supabase-side-lite/scheduler/worker.js';

const useCodex=process.env.SIDE_TEST_STACK==='codex-guest',stackName=useCodex?'side-lite-codex-guest-20261109':'side-lite-supabase-stack-verify',dbPort=useCodex?'56622':'56522',apiPort=useCodex?'56621':'56521';
const port=execFileSync('docker',['port',`supabase_db_${stackName}`,'5432/tcp'],{encoding:'utf8'});
if (!port.split(/\r?\n/).some(line=>line.endsWith(':'+dbPort))) throw Error('No está disponible el stack local autorizado');
const apiKey=process.env.SIDE_LITE_LOCAL_ANON_KEY;
if (!apiKey || !/^[A-Za-z0-9._-]+$/.test(apiKey)) throw Error('Falta la clave pública del stack local');
const env=await readFile(path.join(os.tmpdir(),stackName,'functions-local.env'),'utf8');
const secret=env.split(/\r?\n/).find(line=>line.startsWith('SIDE_CLOSER_SECRET='))?.slice('SIDE_CLOSER_SECRET='.length);
if (!secret) throw Error('Falta el secreto exclusivamente local');
const fetcher=(url,options)=>{
  if (url!=='https://hwwwoblfpsqqrkxvclag.supabase.co/functions/v1/close-cycle') throw Error('Ruta inesperada');
  return fetch(`http://127.0.0.1:${apiPort}/functions/v1/close-cycle`,{...options,headers:{...options.headers,apikey:apiKey}});
};
console.log('Barrido local de prueba activo; no es un programador de producción.');
while (true) {
  try {const result=await runSweep({SIDE_CLOSER_SECRET:secret},{fetcher}); if (result.closed) console.log(`Ciclos cerrados: ${result.closed}`);}
  catch {console.error('Falló el barrido local');}
  await new Promise(resolve=>setTimeout(resolve,2000));
}
