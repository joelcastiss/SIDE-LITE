// Remote development integration: identities were administratively verified; no email was sent or received.
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const c=JSON.parse(await readFile('.neon-dev-secrets.json','utf8'));
if(new URL(c.NEON_AUTH_BASE_URL).hostname!=='ep-broad-poetry-bc6rj0kr.neonauth.c-16.us-east-1.aws.neon.tech')throw Error('Solo se permite Neon SIDE-LITE de desarrollo');
const users=JSON.parse(await readFile('tests/output/private-api/dev-identities.json','utf8'));
const url='https://br-snowy-moon-bcshnyw2-sidepreview.compute.c-16.us-east-1.aws.neon.tech';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const cycles=Number(process.env.LITE_TEST_CYCLES||3),duration=Number(process.env.LITE_TEST_DURATION||15),rounds=Number(process.env.LITE_TEST_ROUNDS||cycles);
if(![3,6].includes(cycles)||![15,120].includes(duration)||rounds<1||rounds>cycles)throw Error('Parámetros de prueba inválidos');
async function login(u){const origin='http://localhost:4178';let r=await fetch(c.NEON_AUTH_BASE_URL+'/sign-in/email',{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify({email:u.email,password:u.password})});assert.equal(r.status,200,'inicio Neon');const cookie=r.headers.getSetCookie().map(x=>x.split(';')[0]).join('; ');assert.ok(cookie);r=await fetch(c.NEON_AUTH_BASE_URL+'/token',{headers:{origin,cookie}});assert.equal(r.status,200,'token Neon');return (await r.json()).token}
async function call(token,path,method='GET',body){const r=await fetch(url+'/api'+path,{method,headers:{'x-side-preview':c.LITE_PREVIEW_KEY,authorization:'Bearer '+token,...(body?{'content-type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});const data=await r.json();if(!r.ok)throw Error(`${method} ${path}: ${r.status} ${data.error}`);return data}
const [teacher,a,b]=await Promise.all(users.map(login));
await Promise.all([call(a,'/me'),call(b,'/me')]);
assert.equal((await call(teacher,'/teacher/activate','POST',{})).role,'teacher');
const game=await call(teacher,'/games','POST',{name:`Prueba remota ${cycles} ciclos`,cycleCount:cycles,duration,costs:{basic:50,standard:80,premium:120},events:[]});
const [ca,cb]=await Promise.all([call(a,'/join','POST',{code:game.code,name:'Empresa prueba A'}),call(b,'/join','POST',{code:game.code,name:'Empresa prueba B'})]);
console.log('Partida remota creada; dos empresas y tres sesiones Neon independientes.');
for(let n=1;n<=rounds;n++){
 await call(teacher,`/games/${game.id}/start`,'POST',{});
 await Promise.all([call(a,`/games/${game.id}/decision`,'PUT',{quality:'basic',quantity:10,price:100,marketingAmount:200,confirmed:true}),call(b,`/games/${game.id}/decision`,'PUT',{quality:'standard',quantity:10,price:120,marketingAmount:0,confirmed:true})]);
 const loaded=await call(a,`/games/${game.id}`);assert.equal(loaded.ownDecision.confirmed,true);
 const deadline=Date.now()+(duration+90)*1000;let t;
 while(Date.now()<deadline){await sleep(2500);t=await call(teacher,`/games/${game.id}`);if(t.cycles.at(-1)?.status==='closed')break}
 assert.equal(t.cycles.at(-1)?.status,'closed','cierre alojado');
 const [va,vb]=await Promise.all([call(a,`/games/${game.id}`),call(b,`/games/${game.id}`)]);
 const tr=t.results.filter(x=>x.number===n);assert.equal(tr.length,2);
 assert.deepEqual(va.results.find(x=>x.number===n).result,tr.find(x=>x.company_id===ca.id).result);
 assert.deepEqual(vb.results.find(x=>x.number===n).result,tr.find(x=>x.company_id===cb.id).result);
 console.log(`Ciclo ${n}: cierre remoto único y resultados coincidentes.`);
}
console.log(`PASS: ${rounds} ciclos HTTPS remotos de ${duration} segundos, Neon Auth y sideclose; identidades administrativas de prueba.`);
