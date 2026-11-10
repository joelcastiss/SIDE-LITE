import {test,expect} from '@playwright/test';
const base='http://127.0.0.1:4178';
test('laboratorio docente simula sin modificar partidas',async({browser})=>{
 const context=await browser.newContext();const page=await context.newPage();
 try{
  await page.goto(base+'/__local-ui-test');await page.locator('#startBtn').click();await page.locator('[data-profile=teacher]').click();await page.locator('#teacherLoginModal [data-switch=register]').click();
  const email=`lab-${Date.now()}@upch.pe`,password='clave-prueba-segura-2026';
  await page.locator('#registerName').fill('Docente');await page.locator('#registerLastName').fill('laboratorio');await page.locator('#registerCourse').fill('Finanzas');await page.locator('#registerEmail').fill(email);await page.locator('#registerPassword').fill(password);await page.locator('#teacherKey').fill(process.env.TEACHER_REGISTRATION_KEY||'side-lite-local-testing-key-2026');await page.locator('#registerForm button[type=submit]').click();await expect(page.locator('#registerMessage')).toContainText('Cuenta creada');
  await page.locator('#teacherRegisterModal [data-switch=login]').click();await page.locator('#loginEmail').fill(email);await page.locator('#loginPassword').fill(password);await page.locator('#loginForm button[type=submit]').click();
  const form=page.locator('#create');await form.locator('[name=name]').fill('Partida sin cambios');await form.locator('[name=cycleCount]').selectOption('3');await form.getByRole('button',{name:'Iniciar partida'}).click();
  await expect(page.locator('[data-tab=laboratorio]')).toBeVisible();
  const response=await context.request.get(`${base}/api/games`);const game=(await response.json()).find(g=>g.name==='Partida sin cambios');expect(game).toBeTruthy();
  const before=await (await context.request.get(`${base}/api/games/${game.id}`)).json();
  await page.locator('[data-tab=laboratorio]').click();await page.getByRole('button',{name:'Probar otra decisión'}).click();const lab=page.locator('#lab-lite-form');await expect(lab).toBeVisible();await lab.locator('[name=quantity]').fill('12');await lab.locator('[name=price]').fill('140');await lab.locator('[name=marketingAmount]').fill('200');await lab.getByRole('button',{name:'Simular'}).click();
  await expect(page.locator('#lab-lite-result')).not.toBeEmpty();await expect(page.locator('#lab-lite-error')).toBeEmpty();
  const after=await (await context.request.get(`${base}/api/games/${game.id}`)).json();expect(after).toEqual(before);
 }finally{await context.close()}
});
