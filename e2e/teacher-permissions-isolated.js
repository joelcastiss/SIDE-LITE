// Run only against a disposable, empty localhost database named side_lite_auth_test.
// No real Neon credentials, e-mail or identities are used. Changes are rolled back.
import pg from 'pg';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const value=process.env.SIDE_LITE_AUTH_TEST_DATABASE_URL;
let url;try{url=new URL(value)}catch{throw Error('Configure SIDE_LITE_AUTH_TEST_DATABASE_URL para la base aislada')}
if(!['postgres:','postgresql:'].includes(url.protocol)||!['localhost','127.0.0.1','[::1]'].includes(url.hostname)||url.pathname!=='/side_lite_auth_test'||['host','hostaddr','service'].some(k=>url.searchParams.has(k)))throw Error('Solo se admite side_lite_auth_test en localhost');
const pool=new pg.Pool({connectionString:url.toString(),max:1});
const c=await pool.connect();
try{
 await c.query('BEGIN');
 const pre=await c.query("SELECT nspname FROM pg_namespace WHERE nspname IN ('lite','neon_auth')");
 if(pre.rowCount)throw Error('La base de pruebas debe estar vacía');
 for(const role of ['lite_dev_api','lite_dev_unprivileged_test']){
  const found=await c.query('SELECT 1 FROM pg_roles WHERE rolname=$1',[role]);
  if(!found.rowCount)await c.query(`CREATE ROLE ${role} NOLOGIN`);
 }
 await c.query(`CREATE SCHEMA lite; CREATE SCHEMA neon_auth;
 CREATE TABLE neon_auth."user" (id uuid PRIMARY KEY,email text,"emailVerified" boolean,banned boolean);
 CREATE TABLE lite.lite_profiles(id uuid PRIMARY KEY,role text NOT NULL);
 GRANT USAGE ON SCHEMA lite TO lite_dev_api,lite_dev_unprivileged_test`);
 for(const file of ['202611040004_teacher_self_activation_dev.sql','202611040005_identity_state_dev.sql','202611070001_teacher_function_privileges_dev.sql','202611070002_teacher_grants_dev.sql']){
  await c.query(await readFile(new URL('../remote/migrations/'+file,import.meta.url),'utf8'));
 }
 const id='00000000-0000-4000-8000-000000000001';
 await c.query('INSERT INTO neon_auth."user" VALUES ($1,$2,true,false)',[id,'docente@upch.pe']);
 await c.query("INSERT INTO lite.lite_profiles VALUES ($1,'student')",[id]);
 await c.query('SET LOCAL ROLE lite_dev_api');
 let result=await c.query('SELECT lite.activate_teacher($1) AS value',[id]);assert.equal(result.rows[0].value,false);
 let privilege=await c.query("SELECT has_table_privilege(current_user,'lite.teacher_grants','SELECT') AS allowed");assert.equal(privilege.rows[0].allowed,false);
 await c.query('RESET ROLE');
 await c.query("INSERT INTO lite.teacher_grants(email,note) VALUES ('docente@upch.pe','Prueba aislada')");
 await c.query('SET LOCAL ROLE lite_dev_api');
 result=await c.query('SELECT lite.activate_teacher($1) AS value',[id]);assert.equal(result.rows[0].value,true);
 result=await c.query('SELECT lite.teacher_authorized($1) AS value',[id]);assert.equal(result.rows[0].value,true);
 await c.query('RESET ROLE');
 await c.query("UPDATE lite.teacher_grants SET active=false WHERE email='docente@upch.pe'");
 await c.query('SET LOCAL ROLE lite_dev_api');
 result=await c.query('SELECT lite.teacher_authorized($1) AS value',[id]);assert.equal(result.rows[0].value,false);
 await c.query('RESET ROLE');
 await c.query("UPDATE lite.teacher_grants SET active=true WHERE email='docente@upch.pe'");
 await c.query('UPDATE neon_auth."user" SET "emailVerified"=false WHERE id=$1',[id]);
 await c.query('SET LOCAL ROLE lite_dev_api');
 result=await c.query('SELECT lite.teacher_authorized($1) AS value,lite.activate_teacher($1) AS activation',[id]);
 assert.equal(result.rows[0].value,false);assert.equal(result.rows[0].activation,false);
 await c.query('RESET ROLE');
 await c.query('UPDATE neon_auth."user" SET "emailVerified"=true,banned=true WHERE id=$1',[id]);
 await c.query('SET LOCAL ROLE lite_dev_api');
 result=await c.query('SELECT lite.teacher_authorized($1) AS value',[id]);assert.equal(result.rows[0].value,false);
 await c.query('RESET ROLE');
 await c.query('SET LOCAL ROLE lite_dev_unprivileged_test');
 privilege=await c.query("SELECT has_function_privilege(current_user,'lite.activate_teacher(uuid)','EXECUTE') AS activate,has_function_privilege(current_user,'lite.teacher_authorized(uuid)','EXECUTE') AS authorize");
 assert.equal(privilege.rows[0].activate,false);assert.equal(privilege.rows[0].authorize,false);
 console.log('PASS: autorización explícita, revocación, verificación, bloqueo y privilegios docentes');
}finally{await c.query('ROLLBACK').catch(()=>{});c.release();await pool.end()}
