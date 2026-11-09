import pg from 'npm:pg@8.23.1';
import {createSideLiteApp} from '../../api/app.js';
import {createEdgeHandler} from './adapter.js';

// Only a dedicated server-side login for this project is accepted. A public or
// service key is never accepted as a database connection string.
const raw = Deno.env.get('SIDE_API_DATABASE_URL');
if (!raw) throw new Error('SIDE_API_DATABASE_URL no configurada');
const connection = new URL(raw);
const ref = 'hwwwoblfpsqqrkxvclag';
const direct = connection.hostname === `db.${ref}.supabase.co`;
const pooler = connection.hostname.endsWith('.pooler.supabase.com') && decodeURIComponent(connection.username).endsWith(`.${ref}`);
if (!['postgres:', 'postgresql:'].includes(connection.protocol) || (!direct && !pooler) || !connection.username || !connection.password || connection.search || connection.hash) throw new Error('Conexión SIDE-LITE inválida');
const pool = new pg.Pool({connectionString:raw, ssl:{rejectUnauthorized:true}, max:1, idleTimeoutMillis:10000, connectionTimeoutMillis:10000});
const app = createSideLiteApp({pool, projectUrl:`https://${ref}.supabase.co`});
export default {fetch:createEdgeHandler(app)};
