import {test,expect} from '@playwright/test';
import express from 'express';
import {readFileSync} from 'node:fs';
let server,base;
test('la entrada raíz carga la misma interfaz que public',()=>{
 expect(readFileSync('index.html','utf8')).toBe(readFileSync('public/index.html','utf8').replace('<head>','<head><base href="./public/">'));
});
test.beforeAll(async()=>{const app=express();app.use('/SIDE-LITE',express.static('.'));server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s))});base=`http://127.0.0.1:${server.address().port}`});
test.afterAll(async()=>{await new Promise(resolve=>server.close(resolve))});
test('vista previa explicita conserva static=1 desde la entrada',async({page})=>{
 await page.goto(`${base}/SIDE-LITE/?static=1`);await expect(page).toHaveURL(/\/SIDE-LITE\/\?static=1/);
 await expect(page.locator('#static-preview-notice')).toBeVisible();await expect(page.locator('#startBtn')).toBeVisible();
});
test('Pages mantiene aviso y conecta la sesión a la API preparada',async({page})=>{
 await page.addInitScript(()=>{window.sideLiteSupabaseClient={supabaseUrl:'https://hwwwoblfpsqqrkxvclag.supabase.co',auth:{getSession:async()=>({data:{session:{access_token:'test',user:{email_confirmed_at:'yes'}}}}),signOut:async()=>({data:{}})}}});
 await page.route('https://joelcastiss.github.io/**',async route=>{const url=new URL(route.request().url());const response=await route.fetch({url:base+url.pathname+url.search});await route.fulfill({response})});
 await page.route('https://hwwwoblfpsqqrkxvclag.supabase.co/functions/v1/side-lite-api/api/**',route=>{const headers={'access-control-allow-origin':'*','access-control-allow-methods':'GET,POST,PUT,OPTIONS','access-control-allow-headers':'authorization,apikey,content-type'};if(route.request().method()==='OPTIONS')return route.fulfill({status:204,headers});const path=new URL(route.request().url()).pathname;return route.fulfill({status:200,headers,json:path.endsWith('/me')?{id:'1',display_name:'Ana',role:'student'}:[]})});
 await page.goto('https://joelcastiss.github.io/SIDE-LITE/');await expect(page).toHaveURL('https://joelcastiss.github.io/SIDE-LITE/');await expect(page.getByRole('heading',{name:'Entrar a una partida'})).toBeVisible();await expect(page.locator('#integration-preview-notice')).toBeVisible();
});
