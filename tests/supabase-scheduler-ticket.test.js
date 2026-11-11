import test from 'node:test';
import assert from 'node:assert/strict';
import {consumeTicket} from '../supabase-side-lite/functions/close-cycle/ticket.js';

test('una entrada mal formada se rechaza sin consultar la base', async () => {
  let calls = 0;
  const sql = async () => { calls++; return []; };
  for (const value of ['', 'a'.repeat(63), 'A'.repeat(64), 'z'.repeat(64)]) assert.equal(await consumeTicket(sql, value), false);
  assert.equal(calls, 0);
});

test('el ticket consumido no puede volver a usarse y los fallos se propagan', async () => {
  let available = true;
  const sql = async () => { if (!available) return []; available = false; return [{token_hash: 'unused'}]; };
  assert.equal(await consumeTicket(sql, 'a'.repeat(64)), true);
  assert.equal(await consumeTicket(sql, 'a'.repeat(64)), false);
  await assert.rejects(consumeTicket(async () => {throw Error('base no disponible');}, 'b'.repeat(64)), /base no disponible/);
});
