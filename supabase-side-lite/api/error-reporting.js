import crypto from 'node:crypto';

// Only fixed route templates and SQLSTATE are logged: never request bodies,
// tokens, query parameters, database messages, or student data.
export function reportApiError(error, req, res, next) {
  if (res.headersSent) return next(error);
  const status = Number.isInteger(error?.status) && error.status >= 400 && error.status < 600 ? error.status : 500;
  if (status < 500) return res.status(status).json({error:error.message});
  const traceId = crypto.randomUUID();
  const route = typeof req.route?.path === 'string' ? req.route.path : 'unmatched';
  const code = /^[0-9A-Z]{5}$/.test(error?.code || '') ? error.code : undefined;
  console.error(JSON.stringify({event:'api_error', traceId, method:req.method, route, status, ...(code ? {code} : {})}));
  return res.status(status).json({error:'El servidor no pudo completar la operación. Inténtalo más tarde.', traceId});
}
