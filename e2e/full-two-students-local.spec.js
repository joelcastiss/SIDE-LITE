import {test, expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';

// Requires the local server, its own local database and TEACHER_REGISTRATION_KEY.
// Never use this test against Neon or any existing production database.
const base=process.env.SIDE_TEST_BASE || 'http://127.0.0.1:4178';
const password='solo-pruebas-locales-2026';
const teacherKey=process.env.TEACHER_REGISTRATION_KEY||'side-lite-local-testing-key-2026';
const nonce=`${Date.now()}-${Math.random().toString(36).slice(2,8)}`;

async function call(ctx,path,method='GET',data){
 const response=await ctx.request.fetch(`${base}/api${path}`,{method,data});
 expect(response.ok(),`${method} ${path}: ${response.status()} ${await response.text()}`).toBeTruthy();
 return response.json();
}
async function register(browser,role,name){
 const context=await browser.newContext();
 const email=`${name}-${nonce}@upch.pe`;
 await call(context,'/register','POST',{email,password,name,role,key:teacherKey});
 await call(context,'/login','POST',{email,password});
 return context;
}
async function finishCycle(ctx,id,number){
 await expect.poll(async()=>{
  const state=await call(ctx,`/games/${id}`);
  return state.cycles.find(c=>c.number===number)?.status;
 },{timeout:20000,intervals:[300,500]}).toBe('closed');
}

for(const cycles of [3,6]) test(`partida local de ${cycles} ciclos con dos estudiantes`,async({browser})=>{
 test.setTimeout(240000);
 const contexts=[];
 try{
  const teacher=await register(browser,'teacher',`docente${cycles}`); contexts.push(teacher);
  const first=await register(browser,'student',`alumna${cycles}`); contexts.push(first);
  const second=await register(browser,'student',`alumno${cycles}`); contexts.push(second);
  const catalog=await call(teacher,'/catalog');
  expect(catalog.length).toBeGreaterThan(0);
  const game=await call(teacher,'/games','POST',{name:`Aula ${cycles}`,cycleCount:cycles,duration:120,
   capitalMin:30000,capitalMax:100000,costs:{basic:50,standard:80,premium:120},events:[catalog[0].id]});
  const companyA=await call(first,'/join','POST',{code:game.code,name:'Empresa Aurora'});
  const companyB=await call(second,'/join','POST',{code:game.code,name:'Empresa Bahia'});
  for(const company of [companyA,companyB]){
   expect(company.initial_capital).toBeGreaterThanOrEqual(30000);
   expect(company.initial_capital).toBeLessThanOrEqual(100000);
   expect(company.cash).toBe(company.initial_capital);
  }
  for(let number=1;number<=cycles;number++) await test.step(`Ciclo ${number}`,async()=>{
   const cycle=await call(teacher,`/games/${game.id}/start`,'POST',{});
   expect(cycle.number).toBe(number);
   expect((Date.parse(cycle.ends_at)-Date.parse(cycle.starts_at))/1000).toBe(120);
   expect(cycle.event_id).toBe(catalog[0].id);
   for(const [context,decision] of [[first,{quality:'basic',quantity:10,price:100,marketingAmount:200,confirmed:true}],
    [second,{quality:'standard',quantity:10,price:120,marketingAmount:0,confirmed:true}]]){
    await call(context,`/games/${game.id}/decision`,'PUT',decision);
   }
   const open=await call(teacher,`/games/${game.id}`);
   expect(open.decisions.filter(d=>d.confirmed)).toHaveLength(2);
   // Exercise authorized early close; the real 120-second deadline is tested separately.
   await call(teacher,`/games/${game.id}/cycle-control`,'POST',{action:'close'});
   await finishCycle(teacher,game.id,number);
   const faculty=await call(teacher,`/games/${game.id}`);
   expect(faculty.results).toHaveLength(number*2);
   for(const context of [first,second]){
    const own=await call(context,`/games/${game.id}`);
    expect(own.results).toHaveLength(number);
    expect(own.results.at(-1).result).toEqual(faculty.results.find(r=>r.number===number&&r.company_id===own.company.id).result);
    expect(own.ranking.map(r=>({id:r.id,returnPercent:r.returnPercent})))
     .toEqual(faculty.ranking.map(r=>({id:r.id,returnPercent:r.returnPercent})));
   }
   const calculated=faculty.companies.map(c=>({id:c.id,returnPercent:100*(c.cash+c.inventory.reduce((sum,b)=>sum+b.quantity*b.unitCost,0)-c.initial_capital)/c.initial_capital}));
   for(const row of faculty.ranking) expect(row.returnPercent).toBeCloseTo(calculated.find(x=>x.id===row.id).returnPercent,8);
   expect(faculty.ranking[0].returnPercent).toBeGreaterThanOrEqual(faculty.ranking[1].returnPercent);
  });
  const page=await teacher.newPage();
  await page.goto(base+'/__local-ui-test');
  await page.getByRole('button',{name:`Aula ${cycles}`}).click();
  await page.locator('[data-tab=podio]').click();await expect(page.locator('#tab-podio').getByRole('heading',{name:'Clasificación',exact:true})).toBeVisible();
  await page.locator('[data-tab=resultados]').click();await expect(page.locator('#resultsHeading')).toBeVisible();
  await expect(page.getByText('Partida finalizada.')).toBeVisible();
  await page.locator('[data-tab=rondas]').click();await expect(page.locator('#start')).toBeDisabled();
  await page.locator('[data-tab=historial]').click();
  const history=page.locator('#faculty-history');await expect(history.locator('#historyGameSelect option')).toHaveCount(1,{timeout:20000});
  await expect(history.locator('#historyContent')).toContainText('Empresa Aurora');
  await expect(history.locator('#historyContent')).toContainText(`Ciclo ${cycles}`);
  await history.locator('#historyCompanySelect').selectOption(companyB.id);
  await expect(history.locator('#historyContent')).toContainText('Empresa Bahia');
  const downloadPromise=page.waitForEvent('download');await history.locator('#downloadHistoryCsv').click();
  const download=await downloadPromise;expect(download.suggestedFilename()).toBe('resultados-side-lite.csv');
  const csv=await readFile(await download.path(),'utf8');
  expect(csv).toContain('Empresa Aurora');expect(csv).toContain('Empresa Bahia');
  expect(csv.trim().split('\r\n')).toHaveLength(1+cycles*2);
 }finally{await Promise.allSettled(contexts.map(context=>context.close()))}
});
