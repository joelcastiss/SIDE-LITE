import {test,expect} from '@playwright/test';
import express from 'express';
let server,base;
test.beforeAll(async()=>{server=await new Promise(resolve=>{const s=express().use(express.static('public')).listen(0,'127.0.0.1',()=>resolve(s))});base=`http://127.0.0.1:${server.address().port}`});
test.afterAll(async()=>{await new Promise(resolve=>server.close(resolve))});
async function setup(page,role='teacher'){
 await page.addInitScript(()=>{
  window.calls=[];window.sideLiteSupabaseClient={supabaseUrl:'https://hwwwoblfpsqqrkxvclag.supabase.co',auth:{
   signInWithPassword:async data=>{window.calls.push(['login',data.email]);if(data.password!=='correcta-segura')return {error:{message:'Credenciales incorrectas'}};localStorage.setItem('test-signed','yes');return {data:{}}},
   getSession:async()=>({data:{session:localStorage.getItem('test-signed')?{access_token:'signed',user:{email_confirmed_at:'yes',user_metadata:{display_name:'Ana Ramírez'}}}:null}}),
   signUp:async data=>{window.calls.push(['signup',data]);return {data:{user:{id:'new'}}}},
   signOut:async()=>{window.calls.push(['logout']);localStorage.removeItem('test-signed');return {data:{}}}
  }};
 });
 await page.route('**/api/**',route=>{const req=route.request(),headers={'access-control-allow-origin':'*','access-control-allow-methods':'GET,POST,PUT,OPTIONS','access-control-allow-headers':'authorization,apikey,content-type'};if(req.method()==='OPTIONS')return route.fulfill({status:204,headers});const path=new URL(req.url()).pathname;return route.fulfill({status:200,headers,json:path.endsWith('/me')?{id:'1',display_name:'Ana',role}:[]})});
 await page.goto(base);await page.locator('#startBtn').click();await page.locator('[data-profile=teacher]').click();
}
for(const width of [1440,390])test(`acceso docente original ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:900});await setup(page);
 await expect(page.locator('#teacherLoginModal')).toBeVisible();await expect(page.locator('#loginForm')).toBeVisible();await expect(page.locator('#verify-code')).toBeHidden();
 await page.locator('#loginEmail').fill('ana@upch.pe');await page.locator('#loginPassword').fill('incorrecta');await page.locator('#loginForm button').click();await expect(page.locator('#loginMessage')).toContainText('Credenciales incorrectas');
 await page.locator('#loginPassword').fill('correcta-segura');await page.locator('#loginForm button').click();await expect(page.locator('#create')).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
 await page.reload();await expect(page.locator('#create')).toBeVisible();await page.locator('#teacher-logout').click();await expect(page.locator('#startBtn')).toBeVisible();expect(await page.evaluate(()=>localStorage.getItem('test-signed'))).toBeNull();
});
test('una cuenta sin autorización no accede al panel',async({page})=>{await setup(page,'student');await page.locator('#loginEmail').fill('ana@upch.pe');await page.locator('#loginPassword').fill('correcta-segura');await page.locator('#loginForm button').click();await expect(page.locator('#loginMessage')).toContainText('no tiene autorización docente');await expect(page.locator('#create')).toHaveCount(0);expect(await page.evaluate(()=>localStorage.getItem('test-signed'))).toBeNull()});
test('registro original conserva los datos sin otorgar permisos',async({page})=>{await setup(page);await page.locator('#teacherLoginModal [data-switch=register]').click();await page.locator('#registerName').fill('Ana');await page.locator('#registerLastName').fill('Ramírez');await page.locator('#registerCourse').fill('Finanzas');await page.locator('#registerEmail').fill('ana@upch.pe');await page.locator('#registerPassword').fill('correcta-segura');await page.locator('#registerForm button').click();await expect(page.locator('#registerMessage')).toContainText('autorización docente');const calls=await page.evaluate(()=>window.calls);expect(calls[0][1].options.data).toEqual({display_name:'Ana Ramírez',nombre:'Ana',apellido:'Ramírez',curso:'Finanzas'});expect(calls[0][1].options.data.role).toBeUndefined();await expect(page.locator('#verify-code')).toBeHidden();});

test('el docente completa MFA solo si tiene un factor pendiente',async({page})=>{
 await page.addInitScript(()=>{let signed=false,verified=false;window.sideLiteSupabaseClient={supabaseUrl:'https://hwwwoblfpsqqrkxvclag.supabase.co',auth:{signInWithPassword:async()=>{signed=true;return {data:{}}},getSession:async()=>({data:{session:signed?{access_token:'signed',user:{email_confirmed_at:'yes'}}:null}}),signOut:async()=>({data:{}}),mfa:{getAuthenticatorAssuranceLevel:async()=>({data:{currentLevel:verified?'aal2':'aal1',nextLevel:'aal2'}}),listFactors:async()=>({data:{totp:[{id:'factor',status:'verified',friendly_name:'Mi teléfono'}]}}),challenge:async()=>({data:{id:'reto'}}),verify:async({code})=>code==='123456'?(verified=true,{data:{}}):{error:{message:'Código inválido'}}}}}});
 await page.route('**/api/**',route=>{const headers={'access-control-allow-origin':'*','access-control-allow-methods':'GET,POST,PUT,OPTIONS','access-control-allow-headers':'authorization,apikey,content-type'};if(route.request().method()==='OPTIONS')return route.fulfill({status:204,headers});return route.fulfill({status:200,headers,json:new URL(route.request().url()).pathname.endsWith('/me')?{id:'1',role:'teacher',display_name:'Ana'}:[]})});
 await page.goto(base);await page.locator('#startBtn').click();await page.locator('[data-profile=teacher]').click();await page.locator('#loginEmail').fill('ana@upch.pe');await page.locator('#loginPassword').fill('correcta-segura');await page.locator('#loginForm button').click();await expect(page.locator('#teacher-mfa')).toBeVisible();await expect(page.locator('#create')).toHaveCount(0);await page.locator('#teacherMfaCode').fill('000000');await page.locator('#teacher-mfa button').click();await expect(page.locator('#loginMessage')).toContainText('Código inválido');await page.locator('#teacherMfaCode').fill('123456');await page.locator('#teacher-mfa button').click();await expect(page.locator('#create')).toBeVisible();
});
