// Preview only: pin the two PostgreSQL endpoints of the SIDE-Lite development branch.
// A configurable host alone is not isolation: both values could point at another project.
const DEV_HOSTS=new Set([
 'ep-broad-poetry-bc6rj0kr.c-16.us-east-1.aws.neon.tech',
 'ep-broad-poetry-bc6rj0kr-pooler.c-16.us-east-1.aws.neon.tech'
]);
export function assertLiteDevDatabase(value,expectedHost){
 let url;
 try{url=new URL(value)}catch{throw Error('Base Neon de desarrollo no autorizada')}
 if(url.protocol!=='postgresql:'||!DEV_HOSTS.has(url.hostname)||url.hostname!==expectedHost||
    (url.port&&url.port!=='5432')||url.hash||!url.username||!url.password||url.pathname!=='/neondb')
  throw Error('Base Neon de desarrollo no autorizada');
 // libpq/pg may interpret query parameters as connection overrides. Keep only the
 // options needed for the known Neon endpoint; force certificate verification.
 for(const key of url.searchParams.keys())if(!['sslmode','channel_binding'].includes(key))throw Error('Parámetros de conexión no autorizados');
 if(url.searchParams.getAll('sslmode').length>1||url.searchParams.getAll('channel_binding').length>1||
    (url.searchParams.has('channel_binding')&&!['require','prefer'].includes(url.searchParams.get('channel_binding'))))
  throw Error('Parámetros de conexión no autorizados');
 url.searchParams.set('sslmode','verify-full');
 return url.toString();
}

/** Fail closed unless the development bridge uses two distinct limited logins. */
export function devBridgeConnections(env){
 const api=assertLiteDevDatabase(env.NEON_DATABASE_URL,env.NEON_DEV_DB_HOST);
 const closer=assertLiteDevDatabase(env.NEON_CLOSER_DATABASE_URL,env.NEON_DEV_DB_HOST);
 if(decodeURIComponent(new URL(api).username)!=='lite_dev_api'||
    decodeURIComponent(new URL(closer).username)!=='lite_dev_closer')
  throw Error('Se requieren roles de API y cierre separados');
 return {api,closer};
}
