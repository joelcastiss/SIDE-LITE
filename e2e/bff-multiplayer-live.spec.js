import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
test.use({channel:'chrome'});
for(const scenario of [{cycles:3,duration:30,rounds:3},{cycles:6,duration:30,rounds:6},{cycles:3,duration:120,rounds:1}])test(`partida real ${scenario.cycles} ciclos, ${scenario.duration} segundos, ${scenario.rounds} cierres`,async({browser})=>{
 test.skip(process.env.SIDE_LITE_BFF_LIVE!=='1','Requiere vista previa privada e identidades autorizadas de desarrollo');test.setTimeout(720000);
 const c=JSON.parse(await readFile('.neon-dev-secrets.json','utf8')),users=JSON.parse(await readFile('tests/output/private-api/dev-identities.json','utf8'));
 const origin='https://br-snowy-moon-bcshnyw2-sideweb.compute.c-16.us-east-1.aws.neon.tech',contexts=[],pages=[];
 const gameName=`Aula ${scenario.cycles} ${scenario.duration} ${Date.now()}`,names=['Empresa Aurora','Empresa Bahía'];
 try{
  for(const u of users){const ctx=await browser.newContext({httpCredentials:{username:'side-lite',password:c.LITE_BFF_GATE_KEY}});contexts.push(ctx);const p=await ctx.newPage();pages.push(p);await p.goto(origin);await p.locator('#login [name=email]').fill(u.email);await p.locator('#login [name=password]').fill(u.password);await p.locator('#login button').click();await expect(p.getByRole('heading',{name:'Mis partidas'})).toBeVisible({timeout:30000})}
  const [teacher,a,b]=pages;
  await teacher.locator('#create [name=name]').fill(gameName);await teacher.locator('#create [name=cycleCount]').selectOption(String(scenario.cycles));await teacher.locator('#create [name=duration]').fill(String(scenario.duration));await teacher.locator('#create button').click();
  await expect(teacher.getByRole('heading',{name:gameName})).toBeVisible();const code=(await teacher.locator('.toolbar strong').innerText()).replace('Código:','').trim();expect(code).toMatch(/^[A-F0-9]{8}$/);
  for(const [i,p] of [a,b].entries()){await p.locator('#join [name=code]').fill(code);await p.locator('#join [name=name]').fill(names[i]);await p.locator('#join button').click();await expect(p.getByRole('heading',{name:gameName})).toBeVisible()}
  await expect(teacher.locator('tr').filter({hasText:names[1]}).first()).toBeVisible({timeout:15000});
  for(let n=1;n<=scenario.rounds;n++){
   await expect(teacher.locator('#start')).toBeEnabled({timeout:30000});await teacher.locator('#start').click();
   for(const [i,p] of [a,b].entries()){await expect(p.locator('#decision')).toBeVisible({timeout:20000});await p.locator('#decision [name=quantity]').fill('10');await p.locator('#decision [name=price]').fill(i?'120':'100');if(!i)await p.locator('#marketing-amount').fill('200');await p.getByRole('button',{name:'Confirmar decisión'}).click();await expect(p.getByText('Decisión confirmada.')).toBeVisible()}
   for(const p of [a,b]){await p.reload();await p.getByRole('button',{name:gameName}).click();await expect(p.getByText('Decisión confirmada.')).toBeVisible({timeout:15000})}
   for(const [i,p] of [a,b].entries()){
    const own=p.locator('section.panel').filter({has:p.getByRole('heading',{name:'Resultados'})}).locator('p').filter({hasText:`Ciclo ${n} · ${names[i]}`});
    const faculty=teacher.locator('section.panel').filter({has:teacher.getByRole('heading',{name:'Resultados'})}).locator('p').filter({hasText:`Ciclo ${n} · ${names[i]}`});
    await expect(own).toBeVisible({timeout:(scenario.duration+100)*1000});await expect(faculty).toBeVisible({timeout:20000});expect(await own.innerText()).toBe(await faculty.innerText());
   }
   console.log(`Escenario ${scenario.cycles}/${scenario.duration}: ciclo ${n} con resultados coincidentes en navegador.`);
  }
 }finally{for(const x of contexts)await x.close()}
});
