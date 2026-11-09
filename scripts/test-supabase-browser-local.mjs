// Live Supabase CLI stack + Mailpit. This never targets a hosted Supabase project.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {chromium,expect} from '@playwright/test';

if(process.env.SIDE_TEST_DISPOSABLE!=='YES') throw Error('Requiere SIDE_TEST_DISPOSABLE=YES.');
const project='side-lite-supabase-stack-verify';
for(const [service,internal,port] of [['kong','8000/tcp',56521],['inbucket','8025/tcp',56524],['db','5432/tcp',56522]]) {
 const name=`supabase_${service}_${project}`;
 const running=spawnSync('docker',['inspect','--format','{{.State.Running}}',name],{encoding:'utf8'});
 const mapped=spawnSync('docker',['port',name,internal],{encoding:'utf8'});
 if(running.status!==0||running.stdout.trim()!=='true'||mapped.status!==0||!mapped.stdout.trim().split(/\r?\n/).every(x=>x.endsWith(`:${port}`)))throw Error('El stack aislado no coincide con el destino esperado.');
}
const fixture=await fetch('http://127.0.0.1:4178/supabase-session.js');
if(!fixture.ok||!(await fixture.text()).includes("projectUrl.origin !== 'http://127.0.0.1:56521'"))throw Error('La interfaz no es la copia preparada para el stack local.');
const base='http://127.0.0.1:4178', mail='http://127.0.0.1:56524',auth='http://127.0.0.1:56521';
const suffix=randomUUID(),password=`L-${randomUUID()}-prueba!`;
const mobile=process.env.SIDE_TEST_MOBILE==='YES',accelerated=process.env.SIDE_TEST_ACCELERATED==='YES';
const browser=await chromium.launch({headless:true});
const contexts=[];
async function confirm(email){
 let found;
 for(let i=0;i<40&&!found;i++){
  const response=await fetch(`${mail}/api/v1/messages`);
  if(response.ok)found=(await response.json()).messages.find(m=>m.To?.some(to=>to.Address===email));
  if(!found)await new Promise(r=>setTimeout(r,500));
 }
 assert.ok(found,'mensaje de confirmación local');
 const message=await (await fetch(`${mail}/api/v1/message/${encodeURIComponent(found.ID)}`)).json();
 const link=message.HTML.match(/https?:\/\/[^\s"<>\\]+\/auth\/v1\/verify\?[^\s"<>\\]+/);
 assert.ok(link,'enlace de verificación de correo');
 const url=new URL(link[0].replaceAll('&amp;','&'));assert.equal(url.origin,auth);
 const response=await fetch(url,{redirect:'manual'});assert.ok([200,302,303].includes(response.status));
}
function grantTeacher(email){
 if(!/^teacher-[a-f0-9-]+@upch\.pe$/.test(email))throw Error('Correo de prueba inesperado');
 const sql=`insert into side_lite_private.lite_teacher_grants(user_id,approved_email) select id,email from auth.users where email='${email}' and email_confirmed_at is not null returning user_id`;
 const result=spawnSync('docker',['exec',`supabase_db_${project}`,'psql','-U','postgres','-d','postgres','-tAc',sql],{encoding:'utf8'});
 if(result.status!==0||!/[a-f0-9-]{36}/.test(result.stdout))throw Error('No se concedió el permiso docente aislado.');
}
async function account(role,name,tag=''){
 const context=await browser.newContext(mobile?{viewport:{width:390,height:844},isMobile:true,hasTouch:true}:{});contexts.push(context);const page=await context.newPage();page.setDefaultTimeout(20000);
 const email=`${role}${tag}-${suffix}@${role==='teacher'?'upch.pe':'example.test'}`;
 await page.goto(base+'/?auth=supabase');await page.locator('#startBtn').click();await page.locator(`[data-profile=${role}]`).click();
 if(role==='student')await page.locator('#student-auth-switch button').click();
 await page.locator('#show-register').click();
 await page.locator('#register [name=name]').fill(name);await page.locator('#register [name=email]').fill(email);await page.locator('#register [name=password]').fill(password);
 await page.locator('#register button').click();await expect(page.locator('#access-message')).toContainText('Revisa tu correo');
 await confirm(email);if(role==='teacher')grantTeacher(email);
 await page.locator('#login [name=email]').fill(email);await page.locator('#login [name=password]').fill(password);await page.locator('#login button').click();
 await expect(role==='teacher'?page.locator('#create'):page.locator('#join')).toBeVisible();
 return {context,page,email};
}
try{
 const teacher=await account('teacher','Docente prueba');
 const a=await account('student','Alumna prueba');
 const b=await account('student','Alumno prueba','2');
 console.log('PASS: registro y confirmación reales desde Chromium para docente y dos estudiantes, autorización docente explícita y sesión de Edge.');
 for(const count of [3,6]){
  await teacher.page.locator('#create [name=name]').fill(`Partida real local ${count}`);
  await teacher.page.locator('#create [name=cycleCount]').selectOption(String(count));
  const response=teacher.page.waitForResponse(r=>r.request().method()==='POST'&&r.url().endsWith('/api/games'));
  await teacher.page.locator('#create').getByRole('button',{name:'Crear partida'}).click();
  const created=await response;assert.equal(created.status(),201,'crear partida');const game=await created.json();assert.match(game.id,/^[a-f0-9-]{36}$/i);
  for(const [person,name] of [[a,'Empresa Aurora'],[b,'Empresa Bahia']]){
   await person.page.locator('#join [name=code]').fill(game.code);await person.page.locator('#join [name=name]').fill(name);
   await person.page.locator('#join button').click();await expect(person.page.getByText(name).first()).toBeVisible();
   if(mobile)assert.ok(await person.page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'sin desbordamiento horizontal');
  }
  for(let cycle=1;cycle<=count;cycle++){
   await expect(teacher.page.locator('#start')).toBeEnabled({timeout:20000});await teacher.page.locator('#start').click();
   for(const [person,quality,amount] of [[a,'basic',200],[b,'standard',400]]){
    const decision=person.page.locator('#decision');await expect(decision).toBeVisible({timeout:20000});
    await decision.locator('[name=quality]').selectOption(quality);
    for(const [tab,field,value] of [['Cantidad','quantity','10'],['Precio','price','120'],['Marketing','marketingAmount',String(amount)]]){
     await person.page.getByRole('button',{name:tab,exact:true}).click();await decision.locator(`[name=${field}]`).fill(value);
    }
    await decision.getByRole('button',{name:'Confirmar decisión'}).click();await expect(person.page.getByText('Decisión confirmada.')).toBeVisible();
   }
   if(!accelerated&&count===3&&cycle===1){
    // Preserve the authenticated contexts but close every page while the real deadline elapses.
    for(const person of [teacher,a,b])await person.page.close();
    const query=()=>spawnSync('docker',['exec',`supabase_db_${project}`,'psql','-U','postgres','-d','postgres','-tAc',`select status from public.lite_cycles where game_id='${game.id}' and number=${cycle}`],{encoding:'utf8'}).stdout.trim();
    let closed=false;for(let i=0;i<160;i++){if(query()==='closed'){closed=true;break}await new Promise(r=>setTimeout(r,1000))}assert.ok(closed,'cierre automático sin páginas abiertas');
    for(const person of [teacher,a,b]){person.page=await person.context.newPage();person.page.setDefaultTimeout(20000);await person.page.goto(base+'/?auth=supabase');await person.page.getByRole('button',{name:`Partida real local ${count}`}).click()}
   }else{
    // Accelerate only the exclusive disposable database; the scheduled worker still closes it.
    const sql=`update public.lite_cycles set ends_at=clock_timestamp() where game_id='${game.id}' and number=${cycle} and status='open'`;
    const update=spawnSync('docker',['exec',`supabase_db_${project}`,'psql','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1','-c',sql],{encoding:'utf8'});assert.equal(update.status,0,'aceleración local');
   }
   await expect(teacher.page.locator('.round-number strong')).toContainText(`${cycle} / ${count}`);
   await expect(teacher.page.getByText(cycle===count?'Partida finalizada.':'Inicia el siguiente ciclo cuando todos estén listos.').first()).toBeVisible({timeout:30000});
   for(const person of [a,b])await expect(person.page.locator('#cycle-status')).toHaveText('Cerrado',{timeout:30000});
   const resultQuery=`select count(*) from public.lite_results r join public.lite_cycles c on c.id=r.cycle_id where c.game_id='${game.id}' and c.number=${cycle} and r.result ?& array['sold','revenue','purchase','profit','cashEnd']`;
   const results=spawnSync('docker',['exec',`supabase_db_${project}`,'psql','-U','postgres','-d','postgres','-tAc',resultQuery],{encoding:'utf8'});
   assert.equal(results.status,0,'consulta de resultados locales');assert.equal(results.stdout.trim(),'2','dos resultados económicos por ciclo');
  }
  await teacher.page.locator('[data-tab=resultados]').click();await expect(teacher.page.locator('#resultsHeading')).toBeVisible();
  await teacher.page.locator('[data-tab=podio]').click();await expect(teacher.page.locator('#tab-podio').getByRole('heading',{name:'Clasificación',exact:true})).toBeVisible();
  console.log(`PASS: partida de ${count} ciclos con Edge y Auth reales locales (${mobile?'móvil':'escritorio'}, ${accelerated?'todos los vencimientos acelerados':'un vencimiento real en la partida de tres'}).`);
  for(const person of [teacher,a,b]){await person.page.locator(person===teacher?'#teacher-home':'#back').click()}
 }
} finally {await Promise.allSettled(contexts.map(c=>c.close()));await browser.close()}
