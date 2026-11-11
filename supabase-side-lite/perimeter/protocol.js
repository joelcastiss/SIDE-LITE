import crypto from 'node:crypto';

const hex = value => crypto.createHash('sha256').update(value).digest('hex');
export const protectedPaths = new Set(['/api/join', '/api/guest/recover']);

function payload({timestamp, nonce, path, body, authorization, apikey}) {
  return ['side-lite-ingress-v1', timestamp, nonce, 'POST', path, hex(body), hex(authorization), hex(apikey)].join('\n');
}
export function signature(secret, fields) {
  return crypto.createHmac('sha256', secret).update(payload(fields)).digest('hex');
}
export function validSecret(secret) { return typeof secret === 'string' && /^[a-f0-9]{64}$/i.test(secret); }

async function readBounded(request, max) {
  const stream = request.clone().body;
  if (!stream) return Buffer.alloc(0);
  const reader = stream.getReader(), chunks = []; let size = 0;
  try {
    for (;;) {
      const {value, done} = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > max) { void reader.cancel(); return null; }
      chunks.push(Buffer.from(value));
    }
    return Buffer.concat(chunks);
  } finally { reader.releaseLock(); }
}

// Caller must provide a durable, atomic consume-once function. No fallback to
// an unsigned request, an in-memory nonce set, or a client-provided IP exists.
export function createIngressGuard({secret, consumeNonce, now = () => Date.now()} = {}) {
  if (!validSecret(secret) || typeof consumeNonce !== 'function') throw new TypeError('Configuración de perímetro inválida.');
  return async (request, path) => {
    if (!protectedPaths.has(path) || request.method !== 'POST') return false;
    const timestamp = request.headers.get('x-side-ingress-time') || '';
    const nonce = request.headers.get('x-side-ingress-nonce') || '';
    const supplied = request.headers.get('x-side-ingress-signature') || '';
    if (!/^\d{13}$/.test(timestamp) || Math.abs(now() - Number(timestamp)) > 30000 || !/^[a-f0-9]{32}$/.test(nonce) || !/^[a-f0-9]{64}$/.test(supplied)) return false;
    const authorization = request.headers.get('authorization') || '', apikey = request.headers.get('apikey') || '';
    if (!authorization || !apikey) return false;
    const length = Number(request.headers.get('content-length'));
    if (!Number.isSafeInteger(length) || length < 0 || length > 16384) return false;
    const body = await readBounded(request, 16384);
    if (!body || body.length !== length) return false;
    const expected = signature(secret, {timestamp, nonce, path, body, authorization, apikey});
    if (!crypto.timingSafeEqual(Buffer.from(supplied, 'hex'), Buffer.from(expected, 'hex'))) return false;
    return (await consumeNonce(nonce, Number(timestamp))) === true;
  };
}

export function postgresNonceConsumer(pool) {
  if (typeof pool?.query !== 'function') throw new TypeError('Falta almacenamiento de nonces.');
  return async nonce => {
    const result = await pool.query('insert into side_lite_private.ingress_nonces(nonce, expires_at) values ($1, clock_timestamp() + interval \'2 minutes\') on conflict do nothing returning nonce', [nonce]);
    return result.rowCount === 1;
  };
}
