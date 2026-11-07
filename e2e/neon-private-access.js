// Remote authorization test: development identities are administratively verified, not email-verified by receipt.
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const c=JSON.parse(await readFile('.neon-dev-secrets.json','utf8'));
if(new URL(c.NEON_AUTH_BASE_URL).hostname!=='ep-broad-poetry-bc6rj0kr.neonauth.c-16.us-east-1.aws.neon.tech')throw Error('Solo se permite Neon SIDE-LITE de desarrollo');
const us=JSON.parse(await readFile('tests/output/private-api/dev-identities.json','utf8'));
const base='https://br-snowy-moon-bcshnyw2-sidepreview.compute.c-16.us-east-1.aws.neon.tech';
async function login(u){const origin='http://localhost:4178';let r=await fetch(c.NEON_AUTH_BASE_URL+'/sign-in/email',{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify({email:u.email,password:u.password})});assert.equal(r.status,200);const cookie=r.headers.getSetCookie().map(s=>s.split(';')[0]).join('; ');r=await fetch(c.NEON_AUTH_BASE_URL+'/token',{headers:{origin,cookie}});assert.equal(r.status,200);return (await r.json()).token}
async function req(token,path,method='GET',body){return fetch(base+'/api'+path,{method,headers:{'x-side-preview':c.LITE_PREVIEW_KEY,authorization:'Bearer '+token,...(body?{'content-type':'application/json'}:{})},body:body?JSON.stringify(body):undefined})}
const [teacher,student]=await Promise.all([login(us[0]),login(us[1])]);
let r=await req(teacher,'/games','POST',{name:'Control de aislamiento',cycleCount:3,duration:120,costs:{basic:50,standard:80,premium:120},events:[]});assert.equal(r.status,201);const g=await r.json();
r=await req(student,'/games/'+g.id);assert.equal(r.status,403,'partida ajena');
r=await req(student,'/teacher/activate','POST',{role:'teacher',userId:us[0].id});assert.equal(r.status,403,'dominio no institucional');
r=await req(student,'/games','POST',{name:'Juego no autorizado',cycleCount:3,costs:{basic:1,standard:1,premium:1},role:'teacher'});assert.equal(r.status,403,'rol no modificable');
r=await req(teacher.slice(0,-3)+'bad','/games');assert.equal(r.status,401,'firma falsificada');
console.log('PASS: HTTPS Neon rechaza acceso a partida ajena, elevación de rol y token falsificado.');
