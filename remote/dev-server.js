// Development bridge only: never expose to the public Internet.
import pg from 'pg';
import {createApi} from './api-app.js';
import {createIdentityVerifier} from './identity.js';
import {closeDue} from './close-cycle.js';
if(process.env.SIDE_LITE_NEON_DEV_ONLY!=='1')throw Error('Puente de desarrollo deshabilitado');
const db=new URL(process.env.NEON_DATABASE_URL);
if(db.protocol!=='postgresql:'||db.hostname!==process.env.NEON_DEV_DB_HOST||!db.hostname.endsWith('.neon.tech')||!['require','verify-full'].includes(db.searchParams.get('sslmode')))throw Error('Base de desarrollo Neon no autorizada');
db.searchParams.set('sslmode','verify-full');
const pool=new pg.Pool({connectionString:db.toString(),max:5});
pool.on('error',()=>console.error('Conexión Neon interrumpida; se volverá a conectar.'));
const verify=createIdentityVerifier({authBaseUrl:process.env.NEON_AUTH_BASE_URL,jwksUrl:process.env.NEON_AUTH_JWKS_URL});
const app=createApi({pool,verify});
await pool.query('SELECT 1');
const server=app.listen(Number(process.env.PORT||4190),'127.0.0.1',()=>console.log('Puente Neon de desarrollo listo'));
// This timer is for local integration tests only. A hosted trigger is still required.
const timer=setInterval(()=>closeDue(pool).catch(()=>console.error('Error de cierre')),1000);timer.unref();
