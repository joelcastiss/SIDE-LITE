// Only use a fresh, disposable local Supabase stack; never print credentials.
import assert from 'node:assert/strict';
import {randomUUID, randomBytes} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import pg from 'pg';

if(process.env.SIDE_TEST_DISPOSABLE!=='YES' || process.env.SIDE_AUTH_LOCAL_URL!=='http://127.0.0.1:56821' || !process.env.SIDE_AUTH_LOCAL_ANON_KEY) throw Error('Se requiere stack local desechable.');
const db=new pg.Client({connectionString:'postgresql://postgres:postgres@127.0.0.1:56822/postgres'});
await db.connect();
try {
  const exists=await db.query("select to_regnamespace('side_lite_private') is not null as present");
  if(exists.rows[0].present) throw Error('La base no está vacía.');
  await db.query(`create schema side_lite_private;
    create table side_lite_private.lite_teacher_grants(user_id uuid primary key references auth.users(id),approved_email text not null,revoked_at timestamptz,granted_by uuid);
  `);
  await db.query(await readFile('supabase/migrations/20261112044948_restrict_teacher_signup_domain.sql','utf8'));
  await db.query(await readFile('supabase/migrations/20261113035244_automatic_teacher_test_access.sql','utf8'));
  const password=randomBytes(24).toString('base64url'),email=`test-${randomUUID()}@upch.pe`;
  const request=async(path,body)=>{const response=await fetch(process.env.SIDE_AUTH_LOCAL_URL+'/auth/v1/'+path,{method:'POST',headers:{apikey:process.env.SIDE_AUTH_LOCAL_ANON_KEY,'content-type':'application/json'},body:JSON.stringify(body)});return {status:response.status,data:await response.json()};};
  const signup=await request('signup',{email,password,data:{display_name:'Prueba Local'}});
  assert.equal(signup.status,200,'registro');assert.ok(signup.data.access_token && signup.data.user?.id,'sesión inmediata');
  assert.equal((await db.query('select count(*)::int as n from side_lite_private.lite_teacher_grants where user_id=$1 and revoked_at is null',[signup.data.user.id])).rows[0].n,1,'concesión docente');
  const duplicate=await request('signup',{email,password});assert.ok(duplicate.status>=400,'duplicado rechazado');
  assert.ok((await request('token?grant_type=password',{email,password})).data.access_token,'inicio de sesión');
  for(const suffix of ['example.com','upch.pe.evil.test']) assert.ok((await request('signup',{email:`test-${randomUUID()}@${suffix}`,password})).status>=400,'dominio externo rechazado');
  console.log('Supabase Auth local: registro, sesión, duplicado, dominios y concesión docente aprobados.');
} finally {await db.end();}
