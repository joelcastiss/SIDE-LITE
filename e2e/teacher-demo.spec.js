import {test,expect} from '@playwright/test';
import express from 'express';
let server,base;
test.beforeAll(async()=>{const app=express();app.use(express.static('.'));server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s))});base=`http://127.0.0.1:${server.address().port}`});
test.afterAll(async()=>{await new Promise(resolve=>server.close(resolve))});
const sections=[['configuracion','Configuración'],['rondas','Rondas y eventos'],['empresas','Empresas'],['resultados','Resultados'],['podio','Ganador y podio'],['laboratorio','Laboratorio Estratégico'],['historial','Historial']];
for(const width of [1440,390])test(`demo abre y muestra siete secciones sin conexión ${width}px`,async({page},testInfo)=>{
 await page.setViewportSize({width,height:900});
 let externalRequests=0;
 await page.route('https://**/*',route=>{externalRequests++;return route.abort()});
 await page.goto(base+'/');await page.locator('#startBtn').click();await page.locator('[data-profile=teacher]').click();
 await expect(page).toHaveURL(/demo-docente\.html/);externalRequests=0;
 await expect(page.getByRole('status').filter({hasText:'Modo demostración local'})).toBeVisible();
 await expect(page.getByRole('link',{name:'Administrar partidas reales'})).toBeVisible();
 for(const [id,label] of sections){
  const nav=page.locator(`.nav-btn[data-tab="${id}"]`);await expect(nav,label).toBeVisible();await nav.click();
  await expect(page.locator(`#tab-${id}`),label).toBeVisible();await expect(page.locator('#pageTitle')).not.toBeEmpty();
  const noOverflow=await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1);expect(noOverflow,`desbordamiento horizontal: ${label} ${width}px`).toBe(true);
  await page.screenshot({path:testInfo.outputPath(`${width}-${id}.png`),fullPage:true});
 }
 expect(externalRequests).toBe(0);
});
test('laboratorio calcula un escenario local sin escribir en la API',async({page})=>{
 const writes=[];page.on('request',request=>{if(!['GET','HEAD'].includes(request.method()))writes.push(request.url())});
 await page.goto(base+'/public/demo-docente.html');await page.locator('[data-tab=laboratorio]').click();
 await page.getByRole('button',{name:'Probar otra decisión'}).click();await expect(page.locator('#lab-lite-form')).toBeVisible();
 await page.locator('#lab-lite-form button[type=submit]').click();await expect(page.locator('#lab-lite-result')).not.toBeEmpty();
 expect(writes).toEqual([]);
});

test('simulación de ciclo usa datos locales y presenta resultados identificados',async({page})=>{
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 const writes=[];page.on('request',request=>{if(!['GET','HEAD'].includes(request.method()))writes.push(request.url())});
 await page.goto(base+'/public/demo-docente.html');await page.locator('#demo-start').click();
 await expect(page.locator('#tab-rondas')).toBeVisible();await expect(page.locator('#roundTimer')).toHaveText('00:02:00');
 await page.locator('[data-tab=empresas]').click();await expect(page.locator('.demo-decision')).toHaveCount(2);await page.locator('.demo-decision').first().locator('[name=quantity]').fill('5');
 await page.locator('[data-tab=rondas]').click();await page.locator('#cutRound').click();await expect(page.locator('#roundState')).toContainText('Ciclo cerrado');
 await page.locator('[data-tab=resultados]').click();await expect(page.locator('#resultStats')).toContainText('Utilidad');await expect(page.locator('#detailReports')).toContainText('simulados');
 await page.locator('[data-tab=podio]').click();await expect(page.locator('#sidePodium')).toContainText('Empresa ejemplo');
 await page.locator('[data-tab=historial]').click();await expect(page.locator('#historyContent')).toContainText('Ciclo 1');
 expect(writes).toEqual([]);expect(errors).toEqual([]);
});
