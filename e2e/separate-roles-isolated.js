// Destructive fixture setup: use only a new empty localhost side_lite_roles_test DB.
import pg from 'pg';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {closeDue} from '../remote/close-cycle.js';
let u;try{u=new URL(process.env.SIDE_LITE_ROLES_TEST_DATABASE_URL)}catch{throw Error('Configure SIDE_LITE_ROLES_TEST_DATABASE_URL')}
if(!['postgres:','postgresql:'].includes(u.protocol)||!['localhost','127.0.0.1','[::1]'].includes(u.hostname)||u.pathname!=='/side_lite_roles_test'||['host','hostaddr','service'].some(k=>u.searchParams.has(k)))throw Error('Solo side_lite_roles_test vacía en localhost');
const admin=new pg.Pool({connectionString:u.toString(),max:2});
const rolePool={async connect(){const c=await admin.connect();await c.query('SET ROLE lite_dev_closer');return {query:c.query.bind(c),release(){c.query('RESET ROLE').then(()=>c.release(),()=>c.release(true))}}},async query(...a){const c=await this.connect();try{return await c.query(...a)}finally{c.release()}}};
try{
 if((await admin.query("SELECT 1 FROM pg_namespace WHERE nspname IN ('lite','neon_auth')")).rowCount)throw Error('La base de pruebas debe estar vacía');
 for(const role of ['lite_dev_api','lite_dev_closer']){if((await admin.query('SELECT 1 FROM pg_roles WHERE rolname=$1',[role])).rowCount)throw Error('Los roles de prueba ya existen; use un clúster desechable');await admin.query(`CREATE ROLE ${role} NOLOGIN NOINHERIT`)}
 await admin.query('CREATE SCHEMA neon_auth; CREATE TABLE neon_auth."user"(id uuid PRIMARY KEY)');
 for(const f of ['202611030001_neon_dev.sql','202611040001_api_grants_dev.sql','202611080002_separate_closer_privileges_dev.sql'])await admin.query(await readFile(new URL('../remote/migrations/'+f,import.meta.url),'utf8'));
 const uid=['00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002'];
 for(const id of uid)await admin.query('INSERT INTO neon_auth."user" VALUES($1)',[id]);
 await admin.query("INSERT INTO lite.lite_profiles(id,display_name,role) VALUES($1,'Docente','teacher'),($2,'Alumno','student')",uid);
 const store=(await admin.query('SELECT id FROM lite.lite_stores LIMIT 1')).rows[0].id;
 const game=(await admin.query("INSERT INTO lite.lite_games(teacher_id,name,code,cycle_count,capital_min,capital_max,costs) VALUES($1,'Prueba','TESTROLE',3,30000,30000,$2) RETURNING id",[uid[0],JSON.stringify({basic:50,standard:80,premium:120})])).rows[0].id;
 await admin.query("INSERT INTO lite.lite_companies(game_id,student_id,name,store_id,initial_capital,cash) VALUES($1,$2,'Prueba',$3,30000,30000)",[game,uid[1],store]);
 const cycle=(await admin.query("INSERT INTO lite.lite_cycles(game_id,number,ends_at) VALUES($1,1,now()-interval '1 minute') RETURNING id",[game])).rows[0].id;
 const perms=await admin.query(`SELECT has_column_privilege('lite_dev_api','lite.lite_profiles','id','UPDATE') api_profile_id,has_table_privilege('lite_dev_api','lite.lite_results','INSERT') api_results,has_column_privilege('lite_dev_api','lite.lite_cycles','status','UPDATE') api_status,has_column_privilege('lite_dev_api','lite.lite_companies','cash','UPDATE') api_cash,has_column_privilege('lite_dev_api','lite.lite_cycles','id','UPDATE') api_lock,has_table_privilege('lite_dev_closer','lite.lite_games','INSERT') closer_game,has_table_privilege('lite_dev_closer','lite.lite_profiles','SELECT') closer_profiles`);
 assert.deepEqual(perms.rows[0],{api_profile_id:false,api_results:false,api_status:false,api_cash:false,api_lock:true,closer_game:false,closer_profiles:false});
 // The actual API row lock remains possible after revoking status update.
 const c=await admin.connect();try{await c.query('BEGIN');await c.query('SET LOCAL ROLE lite_dev_api');assert.equal((await c.query('SELECT id FROM lite.lite_cycles WHERE id=$1 FOR UPDATE',[cycle])).rowCount,1);await c.query('ROLLBACK')}finally{c.release()}
 assert.equal(await closeDue(rolePool),1);assert.equal(await closeDue(rolePool),0);
 assert.equal((await admin.query('SELECT count(*)::int n FROM lite.lite_results WHERE cycle_id=$1',[cycle])).rows[0].n,1);
 console.log('PASS: privilegios separados, bloqueo de API y cierre real con rol de cierre');
}finally{await admin.end()}
