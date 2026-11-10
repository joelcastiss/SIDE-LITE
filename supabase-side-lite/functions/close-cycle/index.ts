// Prepared only: do not deploy before database permissions and contract review.
import postgres from 'npm:postgres@3.4.7';
import { closeOne, sweep } from './worker.js';
import { validateDatabaseTarget } from '../database-target.js';
import { validateCloserConfig } from './config.js';

const dbUrl = Deno.env.get('SIDE_CLOSER_DATABASE_URL') ?? '';
const cronSecret = Deno.env.get('SIDE_CLOSER_SECRET') ?? '';
const caCertificate = Deno.env.get('SIDE_CLOSER_CA_CERT') ?? '';
// A dedicated, high-entropy scheduler secret and a dedicated least-privilege
// database role are required. Never use this secret in the browser.
validateCloserConfig(dbUrl, cronSecret, caCertificate);
validateDatabaseTarget(dbUrl);
const sql = postgres(dbUrl, { ssl: {ca: caCertificate, rejectUnauthorized: true}, max: 1, prepare: false, idle_timeout: 10, connect_timeout: 10 });
const encoder = new TextEncoder();
const key = await crypto.subtle.importKey('raw', encoder.encode(cronSecret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);

Deno.serve(async (request: Request) => {
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  const supplied = request.headers.get('x-side-cron-secret') || '';
  if (supplied.length < 32 || supplied.length > 512) return new Response('Unauthorized', { status: 401 });
  const candidateKey = await crypto.subtle.importKey('raw', encoder.encode(supplied), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const candidate = await crypto.subtle.sign('HMAC', candidateKey, encoder.encode('side-lite-close'));
  if (!await crypto.subtle.verify('HMAC', key, candidate, encoder.encode('side-lite-close'))) return new Response('Unauthorized', { status: 401 });
  try {
    const result = await sweep((excluded: string[]) => closeOne(sql, excluded));
    // Surface failures to monitoring without leaking project data or credentials.
    return Response.json(result, { status: result.failed ? 500 : 200 });
  } catch {
    return Response.json({ error: 'Cycle sweep failed' }, { status: 500 });
  }
});
