// Only an isolated, already migrated PostgreSQL database may be used.
import assert from 'node:assert/strict';
import {randomBytes, createHash} from 'node:crypto';
import postgres from 'postgres';
import {consumeTicket} from '../supabase-side-lite/functions/close-cycle/ticket.js';
const url = process.env.SIDE_TICKET_TEST_URL;
if (process.env.SIDE_TEST_DISPOSABLE !== 'YES' || !url) throw Error('Se requiere una base local desechable.');
const target = new URL(url);
if (!['127.0.0.1','localhost'].includes(target.hostname) || target.pathname !== '/side_ticket_test') throw Error('Destino inesperado.');
const sql = postgres(url, {max: 5, prepare:false});
try {
  const token = randomBytes(32).toString('hex');
  const hash = createHash('sha256').update(token).digest();
  await sql`insert into side_lite_private.lite_closer_tickets values (${hash}, clock_timestamp() + interval '60 seconds')`;
  const asCloser = ticket => sql.begin(async tx => {await tx`set local role side_lite_closer`; return consumeTicket(tx, ticket);});
  const outcomes = await Promise.all(Array.from({length: 10}, () => asCloser(token)));
  assert.equal(outcomes.filter(Boolean).length, 1, 'una sola invocación gana la carrera');
  assert.equal(await asCloser(token), false, 'la repetición se rechaza');
  const expired = randomBytes(32).toString('hex');
  await sql`insert into side_lite_private.lite_closer_tickets values (${createHash('sha256').update(expired).digest()}, clock_timestamp() - interval '1 second')`;
  assert.equal(await asCloser(expired), false, 'el ticket vencido se rechaza');
  const [priv] = await sql`select has_table_privilege('anon','side_lite_private.lite_closer_tickets','select') anon_read,
    has_table_privilege('authenticated','side_lite_private.lite_closer_tickets','delete') auth_delete,
    has_table_privilege('side_lite_closer','side_lite_private.lite_closer_tickets','delete') closer_delete`;
  assert.deepEqual(priv, {anon_read:false, auth_delete:false, closer_delete:true});
  console.log('PASS: PostgreSQL consume un ticket una sola vez bajo concurrencia y rechaza vencidos y roles no autorizados.');
} finally {await sql.end();}
