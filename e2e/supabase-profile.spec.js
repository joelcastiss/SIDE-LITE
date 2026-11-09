import {test,expect} from '@playwright/test';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve, extname, sep} from 'node:path';
let server, base;
if (process.env.SIDE_TEST_CHROME === '1') test.use({channel:'chrome'});
test.beforeAll(async()=>{
 const root=resolve('public');
 server=createServer(async(req,res)=>{
  const path=resolve(root,'.'+new URL(req.url,'http://localhost').pathname.replace(/^\/$/,'/index.html'));
  if(!path.startsWith(root+sep)){res.writeHead(403).end();return}
  try{const data=await readFile(path);const mime={'.js':'text/javascript','.html':'text/html','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp'}[extname(path)]||'application/octet-stream';res.writeHead(200,{'Content-Type':mime});res.end(data)}catch{res.writeHead(404).end()}
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));base=`http://127.0.0.1:${server.address().port}`;
});
test.afterAll(async()=>{if(server)await new Promise(r=>server.close(r))});
test('primera sesión solicita perfil sin atribuir rol desde el navegador',async({page})=>{
 let profile=false,profileWrites=0;
 await page.addInitScript(()=>{let signed=false;window.sideLiteSupabaseClient={supabaseUrl:'https://hwwwoblfpsqqrkxvclag.supabase.co',auth:{signInWithPassword:async()=>{signed=true;return {data:{}}},getSession:async()=>({data:{session:signed?{access_token:'example',user:{email_confirmed_at:'yes'}}:null}}),signOut:async()=>({data:{}})}}});
 await page.route('**/api/**',async route=>{
  const path=new URL(route.request().url()).pathname.replace('/functions/v1/side-lite-api','');
  if(route.request().method()==='OPTIONS')return route.fulfill({status:204,headers:{'access-control-allow-origin':'*','access-control-allow-methods':'GET,POST,PUT,OPTIONS','access-control-allow-headers':'authorization,apikey,content-type'}});
  if(path==='/api/me')return route.fulfill({headers:{'access-control-allow-origin':'*'},status:profile?200:409,json:profile?{id:'1',display_name:'Ana',role:'student'}:{error:'El perfil todavía no está configurado.'}});
  if(path==='/api/profile'){expect(route.request().postDataJSON()).toEqual({display_name:'Ana'});profile=true;profileWrites++;return route.fulfill({headers:{'access-control-allow-origin':'*'},status:201,json:{id:'1',display_name:'Ana'}})}
  if(path==='/api/games'||path==='/api/catalog')return route.fulfill({headers:{'access-control-allow-origin':'*'},status:200,json:[]});
  return route.fulfill({status:404,json:{error:'No existe'}});
 });
 await page.goto(base);await page.locator('#startBtn').click();await page.locator('[data-profile=student]').click();
 await page.locator('#login [name=email]').fill('ana@example.test');await page.locator('#login [name=password]').fill('password-de-prueba');await page.locator('#login button').click();
 await expect(page.locator('#profile-setup')).toBeVisible();await page.locator('#profile-form [name=display_name]').fill('Ana');await page.locator('#profile-form button').click();
 await expect(page.getByRole('heading',{name:'Mis partidas'}).first()).toBeVisible();expect(profileWrites).toBe(1);
});
test('solicitud y formulario de recuperación se limitan a Supabase y al mismo origen',async({page})=>{
 await page.addInitScript(()=>{let callback;window.sideLiteSupabaseClient={supabaseUrl:'https://hwwwoblfpsqqrkxvclag.supabase.co',auth:{
  getSession:async()=>({data:{session:null}}),onAuthStateChange:fn=>{callback=fn;window.triggerRecovery=()=>callback('PASSWORD_RECOVERY');return {data:{}}},
  resetPasswordForEmail:async(email,options)=>{window.resetCalled={email,options};return {data:{}}},
  updateUser:async(data)=>{window.updateCalled=data;return {data:{}}},signOut:async()=>({data:{}})
 }}});
 await page.goto(base+'/?next=https://otro.test');await page.locator('#startBtn').click();await page.locator('[data-profile=student]').click();
 await page.locator('#show-recovery').click();await page.locator('#reset-password [name=email]').fill('ana@example.test');await page.locator('#reset-password button').click();
 await expect(page.locator('#access-message')).toContainText('Si existe una cuenta');
 expect(await page.evaluate(()=>window.resetCalled)).toEqual({email:'ana@example.test',options:{redirectTo:base+'/'} });
 await page.evaluate(()=>window.triggerRecovery());await expect(page.locator('#new-password')).toBeVisible();
 await page.locator('#new-password [name=password]').fill('nueva-contraseña-segura');await page.locator('#new-password [name=confirm]').fill('nueva-contraseña-segura');await page.locator('#new-password button').click();
 await expect(page.locator('#error')).toContainText('Contraseña actualizada');expect(await page.evaluate(()=>window.updateCalled)).toEqual({password:'nueva-contraseña-segura'});
});


test('docente demo exige dominio exacto y no llama API ni emite bearer',async({page})=>{
 let calls=0;await page.addInitScript(()=>{window.sideLiteSupabaseClient={supabaseUrl:'https://hwwwoblfpsqqrkxvclag.supabase.co',auth:{getSession:async()=>({data:{session:null}})}}});
 await page.route('**/api/**',route=>{calls++;return route.abort()});await page.goto(base);await page.locator('#startBtn').click();await page.locator('[data-profile=teacher]').click();
 await expect(page.locator('#login')).toBeVisible();await page.locator('#teacher-demo [name=email]').fill('ana@upch.pe.evil.test');await page.locator('#teacher-demo button').click();await expect(page.locator('#access-message')).toContainText('@upch.pe');
 await page.locator('#teacher-demo [name=email]').fill('ana@upch.pe');await page.locator('#teacher-demo button').click();await expect(page.getByRole('heading',{name:'Panel docente'}).first()).toBeVisible();await expect(page.getByText('Modo de prueba local. No concede permisos docentes ni acceso a datos reales.')).toBeVisible();expect(calls).toBe(0);
 await page.locator('#teacher-logout').click();await expect(page.locator('#startBtn')).toBeVisible();
});

test('sesión restaurada muestra partidas desde la API',async({page})=>{
 await page.addInitScript(()=>{window.sideLiteSupabaseClient={supabaseUrl:'https://hwwwoblfpsqqrkxvclag.supabase.co',auth:{getSession:async()=>({data:{session:{access_token:'signed',user:{email_confirmed_at:'yes'}}}}),signOut:async()=>({data:{}})}}});
 await page.route('**/api/**',route=>{
  const req=route.request(),headers={'access-control-allow-origin':'*','access-control-allow-methods':'GET,POST,PUT,OPTIONS','access-control-allow-headers':'authorization,apikey,content-type'};
  if(req.method()==='OPTIONS')return route.fulfill({status:204,headers});
  const path=new URL(req.url()).pathname;
  return route.fulfill({status:200,headers,json:path.endsWith('/me')?{id:'1',display_name:'María',role:'teacher'}:[]});
 });
 await page.goto(base);await expect(page.getByRole('heading',{name:'Crear partida'})).toBeVisible();await expect(page.locator('#create')).toBeVisible();
});

test('login docente real no eleva una cuenta institucional de estudiante',async({page})=>{
 await page.addInitScript(()=>{let signed=false;window.sideLiteSupabaseClient={supabaseUrl:'https://hwwwoblfpsqqrkxvclag.supabase.co',auth:{signInWithPassword:async()=>{signed=true;return {data:{}}},getSession:async()=>({data:{session:signed?{access_token:'test',user:{email_confirmed_at:'yes'}}:null}}),signOut:async()=>{signed=false;return {data:{}}}}}});
 await page.route('**/api/**',route=>{const headers={'access-control-allow-origin':'*','access-control-allow-methods':'GET,POST,PUT,OPTIONS','access-control-allow-headers':'authorization,apikey,content-type'};if(route.request().method()==='OPTIONS')return route.fulfill({status:204,headers});return route.fulfill({status:200,headers,json:{id:'1',display_name:'Ana',role:'student'}})});
 await page.goto(base);await page.locator('#startBtn').click();await page.locator('[data-profile=teacher]').click();await page.locator('#login [name=email]').fill('ana@upch.pe');await page.locator('#login [name=password]').fill('password-seguro');await page.locator('#login button').click();await expect(page.locator('#access-message')).toContainText('no tiene autorización docente');await expect(page.locator('#logout')).toBeHidden();
});
