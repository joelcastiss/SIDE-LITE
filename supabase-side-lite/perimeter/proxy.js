import crypto from 'node:crypto';
import net from 'node:net';
import {protectedPaths, signature, validSecret} from './protocol.js';

const ORIGIN = 'https://joelcastiss.github.io';
const TARGET = 'https://hwwwoblfpsqqrkxvclag.supabase.co/functions/v1/side-lite-api';
const MAX_BODY = 16384;

// Must be attached directly to a TLS socket, never behind a reverse proxy.
// Atomic postgres upsert enforces a shared five-minute window per source IP.
export function createProxy({pool, secret, fetchImpl = fetch, now = () => Date.now()} = {}) {
  if (typeof pool?.query !== 'function' || !validSecret(secret)) throw new TypeError('Configuración de perímetro inválida.');
  return async (req, res) => {
    const send = (status, message) => { res.writeHead(status, {'Content-Type':'application/json', 'Cache-Control':'no-store', ...(req.headers.origin === ORIGIN ? {'Access-Control-Allow-Origin':ORIGIN, 'Vary':'Origin'} : {})}); res.end(JSON.stringify({error:message})); };
    try {
      if (req.headers.origin !== ORIGIN) return send(403, 'Origen no permitido.');
      const path = req.url;
      if (!protectedPaths.has(path)) return send(404, 'Ruta no disponible.');
      if (req.method === 'OPTIONS') {
        const headers = String(req.headers['access-control-request-headers'] || '').toLowerCase().split(',').map(v=>v.trim()).filter(Boolean);
        if (req.headers['access-control-request-method'] !== 'POST' || headers.some(h=>!['authorization','apikey','content-type'].includes(h))) return send(403,'Solicitud no permitida.');
        res.writeHead(204, {'Access-Control-Allow-Origin':ORIGIN, 'Access-Control-Allow-Methods':'POST', 'Access-Control-Allow-Headers':'authorization, apikey, content-type', 'Vary':'Origin'}); return res.end();
      }
      if (req.method !== 'POST' || !req.socket.encrypted) return send(403, 'Conexión no permitida.');
      const ip = (req.socket.remoteAddress || '').replace(/^::ffff:/, '');
      if (!net.isIP(ip)) return send(403, 'Conexión no permitida.');
      const key = crypto.createHmac('sha256', secret).update('ip\0' + ip).digest();
      const {rows:[row]} = await pool.query(`insert into side_lite_private.ingress_ip_windows as w (ip_hash,window_started_at,attempts)
        values ($1,clock_timestamp(),1) on conflict (ip_hash) do update set
        window_started_at=case when w.window_started_at<=excluded.window_started_at-interval '5 minutes' then excluded.window_started_at else w.window_started_at end,
        attempts=case when w.window_started_at<=excluded.window_started_at-interval '5 minutes' then 1 else least(w.attempts+1,61) end returning attempts`, [key]);
      if (!row || !Number.isInteger(row.attempts)) throw new Error('limit unavailable');
      if (row.attempts > 60) return send(429, 'Demasiados intentos. Inténtalo más tarde.');
      const authorization = req.headers.authorization || '', apikey = req.headers.apikey || '';
      if (typeof authorization !== 'string' || typeof apikey !== 'string' || !authorization || !apikey) return send(401,'Sesión requerida.');
      const chunks=[]; let size=0;
      for await (const chunk of req) { size += chunk.length; if (size > MAX_BODY) return send(413,'Solicitud demasiado grande.'); chunks.push(chunk); }
      const body = Buffer.concat(chunks), timestamp = String(now()), nonce = crypto.randomBytes(16).toString('hex');
      const sig = signature(secret,{timestamp,nonce,path,body,authorization,apikey});
      const response = await fetchImpl(TARGET+path,{method:'POST',redirect:'error',headers:{authorization,apikey,'content-type':'application/json','content-length':String(body.length),'x-side-ingress-time':timestamp,'x-side-ingress-nonce':nonce,'x-side-ingress-signature':sig},body});
      const result = Buffer.from(await response.arrayBuffer());
      res.writeHead(response.status, {'Content-Type':'application/json','Cache-Control':'no-store','Access-Control-Allow-Origin':ORIGIN,'Vary':'Origin'}); res.end(result);
    } catch { if (!res.headersSent) send(503,'Servicio temporalmente no disponible.'); else res.destroy(); }
  };
}
