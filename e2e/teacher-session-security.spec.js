import {test,expect} from '@playwright/test';
import express from 'express';
let server,base;
test.beforeAll(async()=>{server=await new Promise(resolve=>{const s=express().use(express.static('public')).listen(0,'127.0.0.1',()=>resolve(s))});base=`http://127.0.0.1:${server.address().port}`});
test.afterAll(async()=>{await new Promise(resolve=>server.close(resolve))});
for(const role of ['student','teacher'])test(`sesión guardada ${role}: servidor decide acceso real`,async({page})=>{
 await page.route('**/vendor/supabase-js/supabase.js*',route=>route.fulfill({contentType:'application/javascript',body:`window.supabase={createClient:()=>({supabaseUrl:'https://hwwwoblfpsqqrkxvclag.supabase.co',auth:{getSession:async()=>({data:{session:{access_token:'test',user:{email_confirmed_at:'yes'}}}}),onAuthStateChange:()=>({data:{subscription:{}}})}})};`}));
 await page.route('https://hwwwoblfpsqqrkxvclag.supabase.co/**',route=>{const headers={'access-control-allow-origin':'*','access-control-allow-methods':'GET,POST,OPTIONS','access-control-allow-headers':'authorization,apikey,content-type'};if(route.request().method()==='OPTIONS')return route.fulfill({status:204,headers});return route.fulfill({headers,json:new URL(route.request().url()).pathname.endsWith('/me')?{id:'1',display_name:'Ana',role}:[]})});
 await page.route('https://challenges.cloudflare.com/**',route=>route.abort());
 await page.goto(base+'/?acceso=docente');
 if(role==='student'){await expect(page.locator('#loginMessage')).toContainText('autorización docente');await expect(page).not.toHaveURL(/docente\.html/)}else await expect(page).toHaveURL(/docente\.html/);
});
test('una comprobación de sesión bloqueada termina con explicación',async({page})=>{
 await page.route('**/vendor/supabase-js/supabase.js*',route=>route.fulfill({contentType:'application/javascript',body:`window.supabase={createClient:()=>({supabaseUrl:'https://hwwwoblfpsqqrkxvclag.supabase.co',auth:{getSession:()=>new Promise(()=>{}),onAuthStateChange:()=>({data:{subscription:{}}})}})};`}));
 await page.route('https://challenges.cloudflare.com/**',route=>route.abort());
 await page.goto(base+'/?acceso=docente');await expect(page.locator('#loginMessage')).toContainText('No se pudo comprobar la sesión',{timeout:12000});await expect(page.locator('#loginForm')).toBeVisible();
});
