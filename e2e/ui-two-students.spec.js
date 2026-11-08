import {test,expect} from '@playwright/test';

// Requires local SIDE-LITE server and a disposable localhost database. It does not use Neon.
const base='http://127.0.0.1:4178';
const stamp=Date.now();
const pass='clave-prueba-segura-2026';
const key=process.env.TEACHER_REGISTRATION_KEY||'side-lite-local-testing-key-2026';
async function account(browser,role,name){
 const context=await browser.newContext();const page=await context.newPage();
 await page.goto(base);
 await page.locator('#startBtn').click();
 await page.locator(`[data-profile=${role}]`).click();
 await page.locator('#show-register').click();
 const email=`${name}-${stamp}@side.test`;
 const register=page.locator('#register');
 await register.locator('[name=name]').fill(name);
 await register.locator('[name=email]').fill(email);
 await register.locator('[name=password]').fill(pass);
 await register.locator('[name=role]').selectOption(role);
 if(role==='teacher')await register.locator('[name=key]').fill(key);
 await register.getByRole('button',{name:/crear cuenta/i}).click();
 await expect(page.locator('#access-message')).toContainText('Cuenta creada');
 const login=page.locator('#login');await login.locator('[name=email]').fill(email);await login.locator('[name=password]').fill(pass);
 await login.getByRole('button',{name:/iniciar sesión/i}).click();
 await expect(page.getByText('Mis partidas').first()).toBeVisible();
 return {context,page};
}
async function state(ctx,id){const r=await ctx.request.get(`${base}/api/games/${id}`);expect(r.ok()).toBeTruthy();return r.json()}

test('docente y dos estudiantes juegan desde el ingreso hasta los resultados',async({browser})=>{
 test.setTimeout(300000);const items=[];
 try{
  const teacher=await account(browser,'teacher','docente');items.push(teacher);
  const a=await account(browser,'student','alumna');items.push(a);
  const b=await account(browser,'student','alumno');items.push(b);
  const form=teacher.page.locator('#create');await form.locator('[name=name]').fill('Recorrido completo');
  await form.locator('[name=cycleCount]').selectOption('3');await form.locator('[name=duration]').fill('45');
  await form.getByRole('button',{name:'Crear partida'}).click();
  const codeText=await teacher.page.getByText(/Código:/).first().textContent();const code=codeText.match(/[A-F0-9]{8}/)?.[0];expect(code).toBeTruthy();
  for(const [person,name] of [[a,'Empresa Aurora'],[b,'Empresa Bahía']]){
   const join=person.page.locator('#join');await join.locator('[name=code]').fill(code);await join.locator('[name=name]').fill(name);
   await join.getByRole('button',{name:'Unirme'}).click();
   await expect(person.page.getByText(name).first()).toBeVisible();
  }
  const games=await teacher.context.request.get(`${base}/api/games`);expect(games.ok()).toBeTruthy();
  const game=(await games.json()).find(x=>x.code===code);expect(game).toBeTruthy();
  for(let n=1;n<=3;n++)await test.step(`Ciclo ${n}`,async()=>{
   const start=teacher.page.locator('#start');await expect(start).toBeEnabled({timeout:20000});await start.click();
   for(const [person,amount,quality] of [[a,200,'basic'],[b,400,'standard']]){
    const decision=person.page.locator('#decision');await expect(decision).toBeVisible({timeout:20000});
    await decision.locator('[name=quality]').selectOption(quality);await decision.locator('[name=quantity]').fill('10');
    await decision.locator('[name=price]').fill('120');await decision.locator('[name=marketingAmount]').fill(String(amount));
    await decision.getByRole('button',{name:'Confirmar decisión'}).click();
    await expect(person.page.getByText('Decisión confirmada.')).toBeVisible();
   }
   await expect.poll(async()=>{const gameState=await state(teacher.context,game.id);return gameState.cycles.find(x=>x.number===n)?.status},{timeout:65000,intervals:[500,1000]}).toBe('closed');
   for(const person of [a,b]){
    const own=await state(person.context,game.id);const faculty=await state(teacher.context,game.id);
    expect(own.results).toHaveLength(n);expect(own.results.at(-1).result).toEqual(faculty.results.find(x=>x.number===n&&x.company_id===own.company.id).result);
   }
  });
  await expect(teacher.page.getByText('Partida finalizada.').first()).toBeVisible({timeout:20000});
  await expect(teacher.page.getByRole('heading',{name:'Resultados'})).toBeVisible();
  await expect(teacher.page.getByRole('heading',{name:'Clasificación'})).toBeVisible();
  for(const person of items){await person.page.locator('#logout').click();await expect(person.page.locator('#startBtn')).toBeVisible()}
 }finally{await Promise.allSettled(items.map(x=>x.context.close()))}
});
