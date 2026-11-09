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
  const path=new URL(route.request().url()).pathname;
  if(path==='/api/me')return route.fulfill({status:profile?200:409,json:profile?{id:'1',display_name:'Ana',role:'student'}:{error:'El perfil todavía no está configurado.'}});
  if(path==='/api/profile'){expect(route.request().postDataJSON()).toEqual({display_name:'Ana'});profile=true;profileWrites++;return route.fulfill({status:201,json:{id:'1',display_name:'Ana'}})}
  if(path==='/api/games'||path==='/api/catalog')return route.fulfill({status:200,json:[]});
  return route.fulfill({status:404,json:{error:'No existe'}});
 });
 await page.goto(base);await page.locator('#startBtn').click();await page.locator('[data-profile=student]').click();
 await page.locator('#login [name=email]').fill('ana@example.test');await page.locator('#login [name=password]').fill('password-de-prueba');await page.locator('#login button').click();
 await expect(page.locator('#profile-setup')).toBeVisible();await page.locator('#profile-form [name=display_name]').fill('Ana');await page.locator('#profile-form button').click();
 await expect(page.getByText('Mis partidas').first()).toBeVisible();expect(profileWrites).toBe(1);
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
