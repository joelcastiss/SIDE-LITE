import {test, expect} from '@playwright/test';
import express from 'express';

// Browser-only contract: all Auth and API responses are simulated. No real accounts are touched.
let server, base;
test.beforeAll(async()=>{ server=await new Promise(resolve=>{const s=express().use(express.static('public')).listen(0,'127.0.0.1',()=>resolve(s))}); base=`http://127.0.0.1:${server.address().port}`; });
test.afterAll(async()=>await new Promise(resolve=>server.close(resolve)));
const fakeClient = `
window.SIDE=window.SIDE||{};
const fakeUser=()=>JSON.parse(localStorage.getItem('test-user')||'null');
const active=()=>localStorage.getItem('test-session')==='yes';
const sb={supabaseUrl:'https://hwwwoblfpsqqrkxvclag.supabase.co',auth:{
 signUp:async({email,password,options})=>{const mode=localStorage.getItem('test-signup-mode');if(mode==='error')return {error:{message:'Registro rechazado'}};if(mode==='empty')return {data:{user:null,session:null},error:null};if(mode==='confirmation')return {data:{user:{id:'pending'},session:null},error:null};if(fakeUser()?.email===email)return {error:{message:'Cuenta ya registrada'}};localStorage.setItem('test-user',JSON.stringify({email,password,user_metadata:options.data}));localStorage.setItem('test-session','yes');return {data:{user:{id:'test-user'},session:{access_token:'fake'}},error:null}},
 signInWithPassword:async({email,password})=>{const u=fakeUser();if(!u||u.email!==email||u.password!==password)return {error:{message:'Credenciales incorrectas'}};localStorage.setItem('test-session','yes');return {data:{},error:null}},
 signOut:async()=>{localStorage.removeItem('test-session');return {data:{},error:null}},
 getSession:async()=>({data:{session:active()?{access_token:'fake',user:{...fakeUser(),id:'test-user',email_confirmed_at:'2026-01-01T00:00:00Z'}}:null},error:null}),
 onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})
 }};
window.SIDE.SupabaseClient={get:()=>sb,getStudent:()=>sb,isReady:()=>true,init:()=>sb};`;

for (const viewport of [{width:1280,height:800},{width:390,height:844}]) {
 test(`registro e ingreso simulado ${viewport.width}px`,async({page})=>{
  await page.setViewportSize(viewport);
  await page.route('**/services/supabase_client.js*',route=>route.fulfill({status:200,contentType:'application/javascript',body:fakeClient}));
  let role='teacher',identityCalls=0;
  await page.route('https://hwwwoblfpsqqrkxvclag.supabase.co/**',route=>{identityCalls++;return route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify({id:'test-user',display_name:'Ana Prueba',role})})});
  await page.goto(base+'/index.html');
  await page.locator('#startBtn').click({timeout:20000});
  await page.locator('[data-profile=teacher]').click();
  await page.locator('#teacherLoginModal [data-switch=register]').click();
  await page.locator('#registerName').fill('Ana');await page.locator('#registerLastName').fill('Prueba');
  await page.locator('#registerEmail').fill('ana@example.com');await page.locator('#registerPassword').fill('password-prueba-123');
  await page.locator('#registerForm button[type=submit]').click();
  await expect(page.locator('#registerMessage')).toContainText('@upch.pe');
  expect(await page.evaluate(()=>localStorage.getItem('test-user'))).toBeNull();
  await page.locator('#registerEmail').fill('ana.ficticia@upch.pe');
  for(const [mode,expected] of [['error','Registro rechazado'],['empty','No se pudo confirmar el registro'],['confirmation','Solicitud recibida']]){
   await page.evaluate(value=>localStorage.setItem('test-signup-mode',value),mode);
   await page.locator('#registerForm button[type=submit]').click();
   await expect(page.locator('#registerMessage')).toContainText(expected);
   await expect(page.locator('#registerMessage')).not.toContainText('Cuenta creada');
  }
  await page.evaluate(()=>localStorage.removeItem('test-signup-mode'));
  await page.locator('#registerName').fill('Ana');await page.locator('#registerLastName').fill('Prueba');
  await page.locator('#registerEmail').fill('ana.ficticia@upch.pe');await page.locator('#registerPassword').fill('password-prueba-123');
  await page.locator('#registerForm button[type=submit]').click();
  await expect(page.locator('#registerMessage')).toContainText('pendiente de aprobación');
  expect(await page.evaluate(()=>localStorage.getItem('test-session'))).toBeNull();
  const user=await page.evaluate(()=>JSON.parse(localStorage.getItem('test-user')));
  expect(user.user_metadata).toMatchObject({display_name:'Ana Prueba',nombre:'Ana',apellido:'Prueba'});
  expect(user.user_metadata).not.toHaveProperty('curso');
  await page.locator('#registerName').fill('Ana');await page.locator('#registerLastName').fill('Prueba');
  await page.locator('#registerEmail').fill('ana.ficticia@upch.pe');await page.locator('#registerPassword').fill('password-prueba-123');
  await page.locator('#registerForm button[type=submit]').click();
  await expect(page.locator('#registerMessage')).toContainText('Cuenta ya registrada');
  await page.locator('#teacherRegisterModal [data-switch=login]').click();
  await page.locator('#loginEmail').fill('ana.ficticia@upch.pe');
  await page.locator('#loginPassword').fill('incorrecta');await page.locator('#loginForm button[type=submit]').click();
  await expect(page.locator('#loginMessage')).toContainText('Credenciales incorrectas');
  role='student';
  await page.locator('#loginPassword').fill('password-prueba-123');await page.locator('#loginForm button[type=submit]').click();
  await expect(page.locator('#loginMessage')).toContainText('Esta cuenta no tiene un perfil docente');
  role='teacher';
  await page.locator('#loginForm button[type=submit]').click();
  await expect(page).toHaveURL(/docente\.html/);
  await expect(page.locator('body')).toContainText('Configuración');
  await page.reload();
  await expect(page).toHaveURL(/docente\.html/);
  await expect(page.locator('body')).toContainText('Configuración');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.locator('#teacherLogout').click();
  await expect(page).toHaveURL(/index\.html/);
  expect(await page.evaluate(()=>localStorage.getItem('test-session'))).toBeNull();
  await expect(page.locator('#teacherLoginModal')).toBeVisible();
 });
}
