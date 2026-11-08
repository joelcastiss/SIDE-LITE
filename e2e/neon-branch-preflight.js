// Read-only inspection only, after control-plane confirmation of this exact branch.
// A hostname match is an additional guard, not proof of branch identity.
import pg from 'pg';
const fixedBranch='br-bold-king-bc32g1vs';
if(process.env.SIDE_LITE_READONLY_PREFLIGHT!=='1'||process.env.SIDE_LITE_CONFIRMED_BRANCH!==fixedBranch)throw Error('Preinspección no habilitada o rama distinta de la confirmada');
let url;try{url=new URL(process.env.SIDE_LITE_ISOLATED_DATABASE_URL)}catch{throw Error('Se requiere la URL de conexión aislada')}
const expected=process.env.SIDE_LITE_CONFIRMED_ENDPOINT||'';
if(!['postgres:','postgresql:'].includes(url.protocol)||!expected.endsWith('.neon.tech')||url.hostname!==expected||expected.includes('-pooler.')||['host','hostaddr','service'].some(k=>url.searchParams.has(k)))throw Error('Se requiere el endpoint directo confirmado desde el proveedor');
// Forbid connection-string parameters that override TLS policy or connection target.
for(const k of url.searchParams.keys())if(k!=='sslmode'&&k!=='channel_binding')throw Error('Parámetro de conexión no permitido');
url.search='';
const pool=new pg.Pool({connectionString:url.toString(),ssl:{rejectUnauthorized:true},connectionTimeoutMillis:10000,max:1});
try{
 const c=await pool.connect();
 try{
  await c.query('BEGIN READ ONLY');
  const {rows:[r]}=await c.query(`SELECT current_database() AS db, current_user AS role,
    to_regnamespace('lite') IS NOT NULL AS lite_schema,
    to_regnamespace('neon_auth') IS NOT NULL AS auth_schema,
    to_regclass('neon_auth."user"') IS NOT NULL AS auth_user_table,
    to_regclass('lite.lite_cycles') IS NOT NULL AS cycle_table,
    to_regprocedure('lite.teacher_authorized(uuid)') IS NOT NULL AS teacher_authorized,
    to_regprocedure('lite.activate_teacher(uuid)') IS NOT NULL AS teacher_activate,
    to_regclass('lite.teacher_grants') IS NOT NULL AS teacher_grants`);
  console.log(JSON.stringify({branch:fixedBranch,...r}));
  await c.query('ROLLBACK');
 }finally{c.release()}
}finally{await pool.end()}
