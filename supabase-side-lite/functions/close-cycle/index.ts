// Prepared only: do not deploy before database permissions and contract review.
import postgres from 'npm:postgres@3.4.7';
import { closeOne, sweep } from './worker.js';
import { validateDatabaseTarget } from '../database-target.js';
import { validateCloserConfig } from './config.js';
import { consumeTicket } from './ticket.js';

const dbUrl = Deno.env.get('SIDE_CLOSER_DATABASE_URL') ?? '';
const caCertificate = Deno.env.get('SIDE_CLOSER_CA_CERT') ?? '';
validateCloserConfig(dbUrl, caCertificate);
validateDatabaseTarget(dbUrl);
const sql = postgres(dbUrl, { ssl: {ca: caCertificate, rejectUnauthorized: true}, max: 1, prepare: false, idle_timeout: 10, connect_timeout: 10 });

Deno.serve(async (request: Request) => {
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  try {
    if (!await consumeTicket(sql, request.headers.get('x-side-cron-ticket') || '')) return new Response('Unauthorized', { status: 401 });
    const result = await sweep((excluded: string[]) => closeOne(sql, excluded));
    // Surface failures to monitoring without leaking project data or credentials.
    return Response.json(result, { status: result.failed ? 500 : 200 });
  } catch {
    return Response.json({ error: 'Cycle sweep failed' }, { status: 500 });
  }
});
