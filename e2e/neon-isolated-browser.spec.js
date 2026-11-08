import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {resolve,relative,isAbsolute} from 'node:path';

// This suite mutates the target. Never run without an explicitly approved, isolated branch.
const enabled=process.env.SIDE_LITE_ISOLATED_E2E==='1';
async function isolatedSettings(){
 const id=process.env.SIDE_LITE_TEST_BRANCH_ID||'';
 const host=process.env.SIDE_LITE_TEST_ORIGIN||'';
 const root=resolve('tests/output'), file=resolve(process.env.SIDE_LITE_TEST_IDENTITIES||'');
 const rel=relative(root,file);
 if(!/^br-[a-z0-9-]+$/.test(id)||id==='br-snowy-moon-bcshnyw2')throw Error('Se requiere ID de una rama nueva y aislada; la rama de desarrollo existente está prohibida');
 const u=new URL(host);
 if(u.protocol!=='https:'||u.username||u.password||u.port||u.pathname!=='/'||u.search||u.hash||!u.hostname.startsWith(id+'-')||!u.hostname.endsWith('.neon.tech'))throw Error('El origen HTTPS debe pertenecer a la función de la rama aislada indicada');
 if(!rel||rel.startsWith('..')||isAbsolute(rel))throw Error('Las identidades de prueba deben estar en tests/output/ ignorado por Git');
 const c=JSON.parse(await readFile(file,'utf8'));
 if(typeof c.gateKey!=='string'||c.gateKey.length<1||!Array.isArray(c.users)||c.users.length!==3||c.users.some(x=>typeof x.email!=='string'||typeof x.password!=='string'))throw Error('Se requieren puerta privada y tres identidades de prueba');
 return {origin:u.origin,...c};
}
for(const scenario of [{cycles:3,duration:30,rounds:3},{cycles:6,duration:30,rounds:6},{cycles:3,duration:120,rounds:1}])test(`Neon aislado: ${scenario.cycles} ciclos, ${scenario.duration} segundos, ${scenario.rounds} cierres`,async({browser})=>{
 test.skip(!enabled,'Requiere autorización y una rama Neon de prueba nueva');test.setTimeout(720000);
 const {origin,gateKey,users}=await isolatedSettings(), contexts=[], pages=[];
 const gameName=`Aula aislada ${scenario.cycles} ${Date.now()}`,names=['Empresa Aurora','Empresa Bahía'];
 try{
  for(const user of users){
   const context=await browser.newContext({httpCredentials:{username:'side-lite',password:gateKey}});contexts.push(context);
   const page=await context.newPage();pages.push(page);await page.goto(origin);await page.locator('#startBtn').click();await page.locator('[data-profile=student]').click();
   await page.locator('#login [name=email]').fill(user.email);await page.locator('#login [name=password]').fill(user.password);await page.locator('#login button').click();
   await expect(page.getByRole('heading',{name:'Mis partidas'})).toBeVisible({timeout:30000});
   const session=(await context.cookies()).find(c=>c.name==='__Host-side_lite_dev');
   expect(session?.httpOnly).toBe(true);expect(session?.secure).toBe(true);expect(session?.sameSite).toBe('Strict');
  }
  const [teacher,...students]=pages;
  for(const page of students){expect(await page.locator('#create').count()).toBe(0);}
  await teacher.locator('#create [name=name]').fill(gameName);await teacher.locator('#create [name=cycleCount]').selectOption(String(scenario.cycles));await teacher.locator('#create [name=duration]').fill(String(scenario.duration));await teacher.locator('#create button').click();
  await expect(teacher.getByRole('heading',{name:gameName})).toBeVisible();
  const code=(await teacher.locator('.toolbar strong').innerText()).replace('Código:','').trim();expect(code).toMatch(/^[A-F0-9]{8}$/);
  for(const [i,page] of students.entries()){await page.locator('#join [name=code]').fill(code);await page.locator('#join [name=name]').fill(names[i]);await page.locator('#join button').click();await expect(page.getByRole('heading',{name:gameName})).toBeVisible()}
  for(let n=1;n<=scenario.rounds;n++)await test.step(`Ciclo ${n}`,async()=>{
   await expect(teacher.locator('#start')).toBeEnabled({timeout:30000});await teacher.locator('#start').click();
   for(const [i,page] of students.entries()){
    await expect(page.locator('#decision')).toBeVisible({timeout:20000});await page.locator('#decision [name=quantity]').fill('10');await page.locator('#decision [name=price]').fill(i?'120':'100');if(!i)await page.locator('#marketing-amount').fill('200');
    await page.getByRole('button',{name:'Confirmar decisión'}).click();await expect(page.getByText('Decisión confirmada.')).toBeVisible();
   }
   for(const [i,page] of students.entries()){
    const own=page.locator('section.panel').filter({has:page.getByRole('heading',{name:'Resultados'})}).locator('p').filter({hasText:`Ciclo ${n} · ${names[i]}`});
    const faculty=teacher.locator('section.panel').filter({has:teacher.getByRole('heading',{name:'Resultados'})}).locator('p').filter({hasText:`Ciclo ${n} · ${names[i]}`});
    await expect(own).toBeVisible({timeout:(scenario.duration+100)*1000});await expect(faculty).toBeVisible({timeout:20000});expect(await own.innerText()).toBe(await faculty.innerText());
   }
  });
  const ranking=await teacher.locator('section.panel').filter({has:teacher.getByRole('heading',{name:'Clasificación'})}).locator('tr').allInnerTexts();
  expect(ranking.join(' ')).toContain(names[0]);expect(ranking.join(' ')).toContain(names[1]);
  if(scenario.rounds===scenario.cycles)await expect(teacher.getByText('Partida finalizada.')).toBeVisible();
  for(const page of pages){await page.reload();await expect(page.getByRole('heading',{name:'Mis partidas'})).toBeVisible({timeout:30000});}
 }finally{await Promise.allSettled(contexts.map(x=>x.close()))}
});
