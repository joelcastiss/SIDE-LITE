// Verify the retired endpoint only in the named disposable local stack.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
const anon=process.env.SIDE_LITE_LOCAL_ANON_KEY;
if(process.env.SIDE_TEST_DISPOSABLE!=='YES'||!anon||!/^[A-Za-z0-9._-]+$/.test(anon)) throw Error('Se requiere stack local desechable');
const ports=execFileSync('docker',['port','supabase_db_side-lite-supabase-stack-verify','5432/tcp'],{encoding:'utf8'});
if(!ports.split(/\r?\n/).includes('0.0.0.0:56522')) throw Error('Contenedor local inesperado');
for(const method of ['GET','POST']) {
  const response=await fetch('http://127.0.0.1:56521/functions/v1/close-cycle',{
    method,headers:{apikey:anon},signal:AbortSignal.timeout(30000)});
  assert.equal(response.status,410);
}
console.log('El endpoint Edge de cierre está retirado y responde 410.');
