import {test,expect} from '@playwright/test';
import express from 'express';
import {readFileSync} from 'node:fs';
let server,base;
test('la entrada raíz carga la misma interfaz que public',()=>{
 expect(readFileSync('index.html','utf8')).toContain("public/index.html'+location.search+location.hash");
});
test.beforeAll(async()=>{const app=express();app.use('/SIDE-LITE',express.static('.'));server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s))});base=`http://127.0.0.1:${server.address().port}`});
test.afterAll(async()=>{await new Promise(resolve=>server.close(resolve))});
test('vista previa explicita conserva static=1 desde la entrada',async({page})=>{
 await page.goto(`${base}/SIDE-LITE/?static=1`);await expect(page).toHaveURL(/\/SIDE-LITE\/public\/index\.html\?static=1/);
 await expect(page.locator('#static-preview-notice')).toBeVisible();await expect(page.locator('#startBtn')).toBeVisible();
});
test('Pages muestra la entrada cuando responde la API preparada',async({page})=>{
 await page.addInitScript(()=>{window.sideLiteSupabaseClient={supabaseUrl:'https://hwwwoblfpsqqrkxvclag.supabase.co',auth:{getSession:async()=>({data:{session:{access_token:'test',user:{email_confirmed_at:'yes'}}}}),signOut:async()=>({data:{}})}}});
 await page.route('https://joelcastiss.github.io/**',async route=>{const url=new URL(route.request().url());const response=await route.fetch({url:base+url.pathname+url.search});await route.fulfill({response})});
 await page.route('https://hwwwoblfpsqqrkxvclag.supabase.co/functions/v1/side-lite-api/api/**',route=>{const headers={'access-control-allow-origin':'*','access-control-allow-methods':'GET,POST,PUT,OPTIONS','access-control-allow-headers':'authorization,apikey,content-type'};if(route.request().method()==='OPTIONS')return route.fulfill({status:204,headers});const path=new URL(route.request().url()).pathname;return route.fulfill({status:200,headers,json:path.endsWith('/me')?{id:'1',display_name:'Ana',role:'student'}:[]})});
 await page.goto('https://joelcastiss.github.io/SIDE-LITE/');await expect(page).toHaveURL('https://joelcastiss.github.io/SIDE-LITE/public/index.html');await page.locator('#startBtn').click();await page.locator('[data-profile=student]').click();await expect(page.getByRole('heading',{name:'Entrar a una partida'})).toBeVisible();await expect(page.locator('#integration-preview-notice')).toHaveCount(0);
});

test('invitación abre el formulario de estudiante con el código ya completado',async({page})=>{
 await page.goto(`${base}/SIDE-LITE/?partida=A7K2M`);
 await expect(page.locator('#studentModal')).toBeVisible();
 await expect(page.locator('#gameCode')).toHaveValue('A7K2M');
 await expect(page.locator('#companyLegalName')).toBeVisible();
 await expect(page.locator('#companyBrandName')).toBeVisible();
});

test('ingreso manual admite código de cinco caracteres en celular',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.goto(`${base}/SIDE-LITE/`);
 await page.locator('#startBtn').click();
 await page.locator('[data-profile=student]').click();
 await page.locator('#gameCode').fill('A7K2M');
 await expect(page.locator('#gameCode')).toHaveValue('A7K2M');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
