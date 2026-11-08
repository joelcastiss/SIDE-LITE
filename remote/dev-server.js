import {devBridgeConnections} from './dev-database.js';
// Development bridge only: never expose to the public Internet.
import pg from 'pg';
import {createApi} from './api-app.js';
import {createIdentityVerifier} from './identity.js';
import {closeDue} from './close-cycle.js';
if(process.env.SIDE_LITE_NEON_DEV_ONLY!=='1')throw Error('Puente de desarrollo deshabilitado');
const connections=devBridgeConnections(process.env);
const pool=new pg.Pool({connectionString:connections.api,max:5});
const closingPool=new pg.Pool({connectionString:connections.closer,max:2});
pool.on('error',()=>console.error('Conexión Neon interrumpida; se volverá a conectar.'));
closingPool.on('error',()=>console.error('Conexión de cierre interrumpida; se volverá a conectar.'));
const verify=createIdentityVerifier({authBaseUrl:process.env.NEON_AUTH_BASE_URL,jwksUrl:process.env.NEON_AUTH_JWKS_URL});
const app=createApi({pool,verify});
// Verify actual database identities, not just user names in connection strings.
const [apiIdentity,closingIdentity]=await Promise.all([pool.query('SELECT current_user AS role'),closingPool.query('SELECT current_user AS role')]);
if(apiIdentity.rows[0]?.role!=='lite_dev_api'||closingIdentity.rows[0]?.role!=='lite_dev_closer')throw Error('Identidades de base de datos no autorizadas');
const server=app.listen(Number(process.env.PORT||4190),'127.0.0.1',()=>console.log('Puente Neon de desarrollo listo'));
// This timer is for local integration tests only. A hosted trigger is still required.
const timer=setInterval(()=>closeDue(closingPool).catch(()=>console.error('Error de cierre')),1000);timer.unref();
