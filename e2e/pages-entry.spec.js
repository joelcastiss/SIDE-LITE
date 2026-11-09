import {test,expect} from '@playwright/test';
import express from 'express';
let server,base;
test.beforeAll(async()=>{const app=express();app.use('/SIDE-LITE',express.static('.'));server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s))});base=`http://127.0.0.1:${server.address().port}`});
test.afterAll(async()=>{await new Promise(resolve=>server.close(resolve))});
test('la entrada estática abre SIDE Lite en subruta y explica que no hay backend',async({page})=>{
 await page.goto(`${base}/SIDE-LITE/`);await expect(page).toHaveURL(/\/SIDE-LITE\/public\/\?static=1/);
 await expect(page.locator('#static-preview-notice')).toContainText('no están conectados');await expect(page.locator('#startBtn')).toBeVisible();
 await page.locator('#startBtn').click();await page.locator('[data-profile=student]').click();const form=page.locator('#login');await form.locator('[name=email]').fill('alumno@example.test');await form.locator('[name=password]').fill('clave-prueba-segura');await form.getByRole('button',{name:/iniciar sesión/i}).click();
 await expect(page.locator('#access-message')).toContainText('no están conectados');
});
test('abrir /public directamente en github.io no envía credenciales',async({page})=>{
 let writes=0;await page.route('https://example.github.io/**',async route=>{const req=route.request(),url=new URL(req.url());if(url.pathname.startsWith('/api/')){if(req.method()!=='GET')writes++;return route.fulfill({status:404,contentType:'application/json',body:'{}'})}const response=await route.fetch({url:base+url.pathname+url.search});await route.fulfill({response})});
 await page.goto('https://example.github.io/SIDE-LITE/public/');await expect(page.locator('#static-preview-notice')).toBeVisible();await page.locator('#startBtn').click();await page.locator('[data-profile=student]').click();const form=page.locator('#login');await form.locator('[name=email]').fill('alumno@example.test');await form.locator('[name=password]').fill('clave-prueba-segura');await form.getByRole('button',{name:/iniciar sesión/i}).click();await expect(page.locator('#access-message')).toContainText('no están conectados');expect(writes).toBe(0);
});
