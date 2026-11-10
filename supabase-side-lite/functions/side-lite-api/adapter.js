import {toReqRes, toFetchResponse} from 'fetch-to-node';
import {Readable, Writable} from 'node:stream';
import {EventEmitter} from 'node:events';

const ORIGIN = 'https://joelcastiss.github.io';
const HEADERS = 'authorization, content-type, apikey';
const METHODS = new Set(['GET', 'POST', 'PUT', 'DELETE']);
const podiumDeletePath = pathname => /^(?:\/functions\/v1)?\/side-lite-api\/api\/games\/[0-9a-f-]{36}\/podium$/i.test(pathname);

// Express replaces req/res prototypes; keep the adapter's HTTP methods as own
// properties so its header and body state still backs Express responses.
function retainAdapterMethods(object, stop) {
  for (let proto=Object.getPrototypeOf(object); proto && proto!==stop; proto=Object.getPrototypeOf(proto)) {
    for (const key of Reflect.ownKeys(proto)) {
      if (key !== 'constructor' && !Object.hasOwn(object,key)) Object.defineProperty(object,key,Object.getOwnPropertyDescriptor(proto,key));
    }
  }
}

// The gateway may forward either its full external path or the function prefix.
// Never forward an arbitrary URL or client-provided proxy prefix to Express.
export function createEdgeHandler(app) {
  if (typeof app !== 'function') throw new TypeError('Falta la aplicación API.');
  return async request => {
    const origin = request.headers.get('origin');
    const cors = {'Vary': 'Origin', 'Cache-Control': 'no-store'};
    if (origin && origin !== ORIGIN) return new Response(null, {status: 403, headers: cors});
    if (origin) cors['Access-Control-Allow-Origin'] = ORIGIN;
    if (request.method === 'OPTIONS') {
      const method = request.headers.get('access-control-request-method');
      const requested = (request.headers.get('access-control-request-headers') || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
      if (!origin || !METHODS.has(method) || (method==='DELETE' && !podiumDeletePath(new URL(request.url).pathname)) || requested.some(h => !HEADERS.split(', ').includes(h))) return new Response(null, {status: 403, headers: cors});
      return new Response(null, {status: 204, headers: {...cors, 'Access-Control-Allow-Methods':'GET, POST, PUT, DELETE', 'Access-Control-Allow-Headers':HEADERS, 'Access-Control-Max-Age':'600'}});
    }
    if (!METHODS.has(request.method) || (request.method==='DELETE' && !podiumDeletePath(new URL(request.url).pathname))) return new Response(null, {status:405, headers:cors});
    const input = new URL(request.url);
    const match = /^(?:\/functions\/v1)?\/side-lite-api(\/api(?:\/[^?#]*)?)$/.exec(input.pathname);
    if (!match) return new Response(null, {status:404, headers:cors});
    input.pathname = match[1];
    const forwarded = new Request(input, request);
    // Express's body parser otherwise ignores streams lacking Content-Length.
    if (forwarded.body && !forwarded.headers.has('content-length') && !forwarded.headers.has('transfer-encoding')) forwarded.headers.set('transfer-encoding','chunked');
    try {
      const {req, res} = toReqRes(forwarded);
      retainAdapterMethods(req,Readable.prototype);
      retainAdapterMethods(res,Writable.prototype);
      // on-finished treats a socketless IncomingMessage as already consumed.
      // A local event emitter permits the existing body parser to read the stream.
      Object.defineProperty(req,'socket',{value:Object.assign(new EventEmitter(),{readable:true,writable:true})});
      const output = toFetchResponse(res);
      app(req, res);
      const response = await output;
      const headers = new Headers(response.headers);
      for (const [key,value] of Object.entries(cors)) headers.set(key,value);
      return new Response(response.body, {status:response.status, headers});
    } catch {
      return Response.json({error:'No se pudo completar la solicitud.'}, {status:500, headers:cors});
    }
  };
}
