// Test harness only: redirects the scheduler's fixed production target to the
// one verified local Supabase project. It cannot send a request to production.
import {readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import os from 'node:os';
import {runSweep} from '../supabase-side-lite/scheduler/worker.js';

const port=execFileSync('docker',['port','supabase_db_side-lite-supabase-stack-verify','5432/tcp'],{encoding:'utf8'});
if (!port.split(/\r?\n/).includes('0.0.0.0:56522')) throw Error('No está disponible el stack local autorizado');
const apiKey=process.env.SIDE_LITE_LOCAL_ANON_KEY;
if (!apiKey || !/^[A-Za-z0-9._-]+$/.test(apiKey)) throw Error('Falta la clave pública del stack local');
const env=await readFile(path.join(os.tmpdir(),'side-lite-supabase-stack-verify','functions-local.env'),'utf8');
const secret=env.split(/\r?\n/).find(line=>line.startsWith('SIDE_CLOSER_SECRET='))?.slice('SIDE_CLOSER_SECRET='.length);
if (!secret) throw Error('Falta el secreto exclusivamente local');
const fetcher=(url,options)=>{
  if (url!=='https://hwwwoblfpsqqrkxvclag.supabase.co/functions/v1/close-cycle') throw Error('Ruta inesperada');
  return fetch('http://127.0.0.1:56521/functions/v1/close-cycle',{...options,headers:{...options.headers,apikey:apiKey}});
};
console.log('Barrido local de prueba activo; no es un programador de producción.');
while (true) {
  try {const result=await runSweep({SIDE_CLOSER_SECRET:secret},{fetcher}); if (result.closed) console.log(`Ciclos cerrados: ${result.closed}`);}
  catch {console.error('Falló el barrido local');}
  await new Promise(resolve=>setTimeout(resolve,2000));
}
