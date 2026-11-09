import test from 'node:test';
import assert from 'node:assert/strict';
import { closeOne, sweep, CycleCloseError } from './worker.js';

function database({ badSecond = false, missingSecret = false } = {}) {
  let state = { status: 'open', results: [], cash: 30000 };
  const sql = { get state() { return state; } };
  sql.begin = async fn => {
    const snapshot = structuredClone(state);
    const tx = async (parts, ...values) => {
      const q = parts.join('?').replace(/\s+/g, ' ').trim().toLowerCase();
      if (q.startsWith('select c.id')) return state.status === 'open' ? [{ id: 'cycle', game_id: 'game', seed: missingSecret ? null : 'seed', event_id: null }] : [];
      if (q.startsWith('select id, costs')) return [{ id: 'game', costs: { basic: 20, standard: 30, premium: 40 } }];
      if (q.startsWith('select id, cash, inventory')) return [{ id: 'company', cash: state.cash, inventory: [] }, ...(badSecond ? [{ id: 'bad', cash: -1, inventory: [] }] : [])];
      if (q.startsWith('select quality')) return [{ quality: 'basic', quantity: 10, price: 100, marketing_amount: 0 }];
      if (q.startsWith('insert into')) { state.results.push(values[3]); return []; }
      if (q.startsWith('update public.lite_companies')) { state.cash = values[0]; return []; }
      if (q.startsWith('update public.lite_cycles')) { state.status = 'closed'; return []; }
      throw new Error(`Unexpected query ${q}`);
    };
    tx.json = x => x;
    try { return await fn(tx); } catch (error) { state = snapshot; throw error; }
  };
  return sql;
}

test('cierre usa motor existente y vuelve inoperante una segunda ejecución', async () => {
  const db = database();
  assert.equal(await closeOne(db), 'cycle');
  assert.equal(db.state.status, 'closed');
  assert.equal(db.state.results.length, 1);
  assert.equal(db.state.results[0].purchase, 200);
  assert.equal(db.state.results[0].sold, 10);
  assert.equal(await closeOne(db), null);
});

test('un error económico revierte resultados y caja de todas las empresas', async () => {
  const db = database({ badSecond: true });
  await assert.rejects(closeOne(db), CycleCloseError);
  assert.deepEqual(db.state, { status: 'open', results: [], cash: 30000 });
});

test('el barrido aísla ciclo fallido y procesa otros, con trabajo acotado', async () => {
  const seen = [];
  const result = await sweep(async excluded => {
    seen.push([...excluded]);
    if (seen.length === 1) throw new CycleCloseError('broken');
    if (seen.length === 2) return 'ok';
    return null;
  });
  assert.deepEqual(result, { closed: 1, failed: 1 });
  assert.deepEqual(seen[1], ['broken']);
  let calls = 0;
  await sweep(async () => { calls++; return 'ok'; }, 3);
  assert.equal(calls, 3);
});

test('un ciclo vencido sin semilla se reporta como fallo y no se cierra', async () => {
  const db = database({missingSecret:true});
  await assert.rejects(closeOne(db), CycleCloseError);
  assert.deepEqual(db.state, { status: 'open', results: [], cash: 30000 });
});
