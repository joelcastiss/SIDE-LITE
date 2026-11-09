import express from 'express';
import {jwtVerify, createRemoteJWKSet} from 'jose';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Only asymmetrically signed Supabase access tokens; never accepts a client-supplied JWKS URL. */
export function createTokenVerifier({projectUrl, keyResolver} = {}) {
  const url = new URL(projectUrl);
  if (url.protocol !== 'https:' || url.username || url.password || url.port || url.pathname !== '/' || url.search || url.hash || url.hostname !== 'hwwwoblfpsqqrkxvclag.supabase.co') {
    throw new Error('La URL debe corresponder al proyecto SIDE-LITE confirmado.');
  }
  const issuer = `${url.origin}/auth/v1`;
  const keys = keyResolver || createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks.json`));
  return async token => {
    const {payload} = await jwtVerify(token, keys, {issuer, audience: 'authenticated', algorithms: ['ES256', 'RS256']});
    if (payload.role !== 'authenticated' || typeof payload.sub !== 'string' || !UUID.test(payload.sub) || typeof payload.exp !== 'number' || typeof payload.session_id !== 'string' || !UUID.test(payload.session_id)) throw new Error('Identidad inválida');
    return {id: payload.sub, sessionId: payload.session_id};
  };
}

/** Trusted DB credential remains server-side; invoke for every protected operation. */
export function createIdentityMiddleware({pool, verifyToken} = {}) {
  if (!pool?.query || typeof verifyToken !== 'function') throw new TypeError('Faltan dependencias del servidor.');
  return async (req, res, next) => {
    const match = /^Bearer ([A-Za-z0-9._~-]+)$/.exec(req.get('authorization') || '');
    if (!match) return res.status(401).json({error:'Inicia sesión para continuar.'});
    let identity;
    try { identity = await verifyToken(match[1]); }
    catch { return res.status(401).json({error:'Sesión inválida o vencida.'}); }
    if (!identity?.id || !UUID.test(identity.id) || !UUID.test(identity.sessionId || '')) return res.status(401).json({error:'Sesión inválida o vencida.'});
    try {
      const {rows:[record]} = await pool.query('select * from side_lite_private.api_identity($1,$2)', [identity.id, identity.sessionId]);
      if (!record?.session_active || record.banned) return res.status(401).json({error:'Sesión inválida o vencida.'});
      if (!record.email_verified) return res.status(403).json({error:'Verifica tu correo antes de continuar.'});
      req.identity = {...identity, displayName: record.display_name || null, role: record.id ? (record.teacher_authorized ? 'teacher' : 'student') : null};
      next();
    } catch { return res.status(503).json({error:'No se pudo consultar la cuenta.'}); }
  };
}

/** Minimal preparation server; deliberately does not expose any game operation. */
export function createIdentityApp({pool, verifyToken} = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.use('/api', createIdentityMiddleware({pool, verifyToken}));
  app.get('/api/me', (req, res) => {
    if (!req.identity.role) return res.status(409).json({error:'El perfil todavía no está configurado.'});
    res.set('Cache-Control', 'no-store').json({id:req.identity.id, display_name:req.identity.displayName, role:req.identity.role});
  });
  app.post('/api/profile', express.json({limit:'1kb', strict:true}), async (req, res) => {
    const body = req.body;
    const name = typeof body?.display_name === 'string' ? body.display_name.trim() : '';
    if (!body || Array.isArray(body) || Object.keys(body).length !== 1 || !Object.hasOwn(body, 'display_name') || Array.from(name).length < 2 || Array.from(name).length > 80) {
      return res.status(400).json({error:'Nombre inválido.'});
    }
    try {
      // Bind the id to the verified JWT; repeat session/account predicates in the write statement.
      // It is safe to retry: never overwrite an existing profile or grant a role.
      const {rows} = await pool.query('select * from side_lite_private.api_create_profile($1,$2,$3)', [req.identity.id, req.identity.sessionId, name]);
      if (!rows.length) return res.status(409).json({error:'Perfil existente o sesión no disponible.'});
      return res.set('Cache-Control','no-store').status(201).json(rows[0]);
    } catch { return res.status(503).json({error:'No se pudo crear el perfil.'}); }
  });
  app.use((err, req, res, next) => {
    if (err?.status === 400 || err?.status === 413) return res.status(err.status).json({error:'Solicitud inválida.'});
    return res.status(500).json({error:'No se pudo completar la solicitud.'});
  });
  return app;
}
