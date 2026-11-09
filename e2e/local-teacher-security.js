import assert from 'node:assert/strict';
import pg from 'pg';
const base=process.env.SIDE_LITE_AUTH_TEST_BASE || 'http://127.0.0.1:4197';
const key=process.env.TEACHER_REGISTRATION_KEY;
if (!key || !process.env.DATABASE_URL) throw Error('Se requieren DATABASE_URL y TEACHER_REGISTRATION_KEY de una base de prueba aislada');
const suffix=Date.now(), password='clave-segura-prueba-2026';
async function call(route,data,cookie) {return fetch(base+'/api'+route,{method:'POST',headers:{'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},body:JSON.stringify(data)})}
const register=(email,role,keyValue=key)=>call('/register',{email,role,key:keyValue,password,name:'Prueba'});
for (const email of [`wrong-${suffix}@example.test`,`wrong-${suffix}@upch.pe.ejemplo`,`wrong-${suffix}@notupch.pe`]) assert.equal((await register(email,'teacher')).status,403);
const email=`docente-${suffix}@upch.pe`;
assert.equal((await register(email,'teacher','incorrecta')).status,403);
assert.equal((await register(email,'teacher')).status,201);
assert.equal((await call('/login',{email,password:'contraseña-incorrecta'})).status,401);
const unauth=await call('/games',{name:'Sin sesión',cycleCount:3,costs:{basic:50,standard:80,premium:120}});assert.equal(unauth.status,401);
const student=`estudiante-${suffix}@example.test`;assert.equal((await register(student,'student')).status,201);
const studentLogin=await call('/login',{email:student,password});assert.equal(studentLogin.status,200);
const studentCookie=studentLogin.headers.get('set-cookie').split(';')[0];
assert.equal((await call('/games',{name:'Sin permiso',cycleCount:3,costs:{basic:50,standard:80,premium:120}},studentCookie)).status,403);
const login=await call('/login',{email,password});assert.equal(login.status,200);const cookie=login.headers.get('set-cookie').split(';')[0];
const create=await call('/games',{name:'Docente autorizado',cycleCount:3,costs:{basic:50,standard:80,premium:120}},cookie);assert.equal(create.status,201);
const pool=new pg.Pool({connectionString:process.env.DATABASE_URL});
try {await pool.query('UPDATE lite_profiles SET email=$1 WHERE email=$2',[`changed-${suffix}@example.test`,email]);
 const afterChange=await fetch(base+'/api/me',{headers:{Cookie:cookie}});assert.equal(afterChange.status,403);
 const retry=await call('/login',{email:`changed-${suffix}@example.test`,password});assert.equal(retry.status,403);
} finally {await pool.end()}
console.log('PASS: dominio exacto, clave, credenciales, sesión, rol y revalidación en servidor local; no prueba verificación de correo');
