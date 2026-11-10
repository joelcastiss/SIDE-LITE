import {test,expect} from '@playwright/test';
import express from 'express';
let server,base;
test.beforeAll(async()=>{server=await new Promise(resolve=>{const s=express().use('/SIDE-LITE',express.static('.')).listen(0,'127.0.0.1',()=>resolve(s))});base=`http://127.0.0.1:${server.address().port}`});
test.afterAll(async()=>{if(server)await new Promise(resolve=>server.close(resolve))});
for(const viewport of [{name:'escritorio',width:1440,height:900},{name:'móvil',width:390,height:844}]){
 test.describe(`vista previa ${viewport.name}`,()=>{
  test.use({viewport:{width:viewport.width,height:viewport.height}});
  for(const role of ['student','teacher'])test(`${role}: navega sin enviar datos al servidor`,async({page})=>{
   test.setTimeout(60000);const calls=[];
   page.on('request',r=>{const u=new URL(r.url());if(u.pathname.includes('/api/')||!['GET','HEAD'].includes(r.method()))calls.push(`${r.method()} ${u.pathname}`)});
   await page.goto(`${base}/SIDE-LITE/public/?static=1`);await expect(page.locator('#static-preview-notice')).toBeVisible();
   await page.locator('#startBtn').click();await page.locator(`[data-profile=${role}]`).click();
   if(role==='student'){
    await expect(page.locator('#student-entry')).toBeVisible();
    for(const field of ['code','name','brand'])await expect(page.locator(`#student-entry [name=${field}]`)).toBeVisible();
    await page.locator('#student-auth-switch button').click();
   }
   if(role==='teacher'){await expect(page.locator('#loginForm')).toBeVisible();await page.locator('#teacherLoginModal [data-switch=register]').click();await expect(page.locator('#registerForm')).toBeVisible();await page.locator('#teacherRegisterModal [data-switch=login]').click();await page.locator('#teacher-preview').click()}else{await expect(page.locator('#login')).toBeVisible();await page.locator('#show-register').click();await expect(page.locator('#register')).toBeVisible();await page.locator('#explore-preview').click()}
   await expect(page.getByRole('button',{name:'Partida de demostración',exact:true})).toBeVisible();
   await page.getByRole('button',{name:'Partida de demostración',exact:true}).click();
   if(role==='student'){
    await expect(page.locator('#decision')).toBeVisible();
    for(const [section,field] of [['Calidad','quality'],['Cantidad','quantity'],['Precio','price'],['Marketing','marketingAmount']]){
     await page.getByRole('button',{name:section,exact:true}).click();
     await expect(page.locator(`#decision [name=${field}]`)).toBeVisible();
    }
    await expect(page.locator('#lite-ranking')).toBeAttached();await expect(page.locator('#lite-results')).toBeAttached();
    await page.getByRole('button',{name:'Cantidad',exact:true}).click();await page.locator('#decision [name=quantity]').fill('10');await page.locator('#decision button[value=confirm]').click();
    await expect(page.locator('#error')).toContainText(/demostración|disponible|conectad/i);
   }else{
    for(const id of ['configuracion','rondas','empresas','resultados','podio','laboratorio','historial']){
     await page.locator(`[data-tab=${id}]`).click();await expect(page.locator(`#tab-${id}`)).toBeVisible();
    }
    await page.locator('[data-tab=laboratorio]').click();await page.getByRole('button',{name:'Probar otra decisión'}).click();await expect(page.locator('#lab-lite-form')).toBeVisible();
   }
   expect(calls).toEqual([]);
  });
 });
}
