import test from 'node:test';
import assert from 'node:assert/strict';
import worker, {runSweep} from '../supabase-side-lite/scheduler/worker.js';

const secret = 'a'.repeat(40);
test('programador llama solo al cierre autorizado y no expone endpoint HTTP', async () => {
  let request;
  const result = await runSweep({SIDE_CLOSER_SECRET:secret}, {fetcher:async (...args) => {
    request = args;
    return Response.json({closed:2,failed:0});
  }});
  assert.equal(request[0], 'https://hwwwoblfpsqqrkxvclag.supabase.co/functions/v1/close-cycle');
  assert.equal(request[1].method,'POST');
  assert.equal(request[1].redirect,'error');
  assert.equal(request[1].headers['x-side-cron-secret'],secret);
  assert.deepEqual(result,{closed:2,failed:0});
  assert.equal(worker.fetch,undefined);
});

test('programador rechaza errores, fallos de cierre y configuración incompleta', async () => {
  await assert.rejects(runSweep({SIDE_CLOSER_SECRET:'short'}),/Invalid scheduler configuration/);
  await assert.rejects(runSweep({SIDE_CLOSER_SECRET:secret},{fetcher:async()=>new Response('private details',{status:500})}),/Scheduled cycle sweep failed/);
  await assert.rejects(runSweep({SIDE_CLOSER_SECRET:secret},{fetcher:async()=>Response.json({closed:1,failed:1})}),/Scheduled cycle sweep failed/);
  await assert.rejects(runSweep({SIDE_CLOSER_SECRET:secret},{fetcher:async()=>Response.json({closed:0})}),/Scheduled cycle sweep failed/);
});

test('una solicitud de cierre demasiado lenta termina y reporta fallo', async () => {
  await assert.rejects(runSweep({SIDE_CLOSER_SECRET:secret},{timeoutMs:10,fetcher:async (_url,{signal})=>new Promise((_resolve,reject)=>signal.addEventListener('abort',()=>reject(new Error('aborted'))))}),/Scheduled cycle sweep failed/);
});
