import {test,expect} from '@playwright/test';
const base='http://127.0.0.1:4178';
test('laboratorio docente simula sin modificar partidas',async({browser})=>{
 const context=await browser.newContext();const page=await context.newPage();
 try{
  await page.goto(base);await page.locator('#startBtn').click();await page.locator('[data-profile=teacher]').click();await page.locator('#show-register').click();
  const email=`lab-${Date.now()}@side.test`,password='clave-prueba-segura-2026';
  const register=page.locator('#register');await register.locator('[name=name]').fill('Docente laboratorio');await register.locator('[name=email]').fill(email);await register.locator('[name=password]').fill(password);await register.locator('[name=role]').selectOption('teacher');await register.locator('[name=key]').fill(process.env.TEACHER_REGISTRATION_KEY||'side-lite-local-testing-key-2026');await register.getByRole('button',{name:/crear cuenta/i}).click();await expect(page.locator('#access-message')).toContainText('Cuenta creada');
  const login=page.locator('#login');await login.locator('[name=email]').fill(email);await login.locator('[name=password]').fill(password);await login.getByRole('button',{name:/iniciar sesión/i}).click();
  const form=page.locator('#create');await form.locator('[name=name]').fill('Partida sin cambios');await form.locator('[name=cycleCount]').selectOption('3');await form.getByRole('button',{name:'Crear partida'}).click();
  const response=await context.request.get(`${base}/api/games`);const game=(await response.json()).find(g=>g.name==='Partida sin cambios');expect(game).toBeTruthy();
  const before=await (await context.request.get(`${base}/api/games/${game.id}`)).json();
  await page.locator('[data-tab=laboratorio]').click();await page.getByRole('button',{name:'Probar otra decisión'}).click();const lab=page.locator('#lab-lite-form');await expect(lab).toBeVisible();await lab.locator('[name=quantity]').fill('12');await lab.locator('[name=price]').fill('140');await lab.locator('[name=marketingAmount]').fill('200');await lab.getByRole('button',{name:'Simular'}).click();
  await expect(page.locator('#lab-lite-result')).not.toBeEmpty();await expect(page.locator('#lab-lite-error')).toBeEmpty();
  const after=await (await context.request.get(`${base}/api/games/${game.id}`)).json();expect(after).toEqual(before);
 }finally{await context.close()}
});
