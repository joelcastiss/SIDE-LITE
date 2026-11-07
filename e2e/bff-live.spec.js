import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
test.use({channel:'chrome'});
test('BFF HTTPS: sesiones Neon aisladas, recarga, CSRF y cierre real',async({browser})=>{
 test.skip(process.env.SIDE_LITE_BFF_LIVE!=='1','Requiere vista previa privada e identidades autorizadas de desarrollo');
 const c=JSON.parse(await readFile('.neon-dev-secrets.json','utf8')),users=JSON.parse(await readFile('tests/output/private-api/dev-identities.json','utf8'));
 const url='https://br-snowy-moon-bcshnyw2-sideweb.compute.c-16.us-east-1.aws.neon.tech';
 const contexts=[];
 try{
  for(const u of users.slice(0,2)){
   const ctx=await browser.newContext({httpCredentials:{username:'side-lite',password:c.LITE_BFF_GATE_KEY}});contexts.push(ctx);const page=await ctx.newPage();
   await page.goto(url);await expect(page.getByRole('heading',{name:'Iniciar sesión'})).toBeVisible();
   await page.locator('#login [name=email]').fill(u.email);await page.locator('#login [name=password]').fill(u.password);await page.locator('#login button').click();
   await expect(page.getByRole('heading',{name:'Mis partidas'})).toBeVisible({timeout:20000});
   let me=await page.evaluate(async()=>{const r=await fetch('/api/me');return {status:r.status,body:await r.json()}});expect(me.status).toBe(200);expect(me.body.id).toBe(u.id);
   const cookies=await ctx.cookies();const session=cookies.find(x=>x.name==='__Host-side_lite_dev');expect(session).toBeTruthy();expect(session.httpOnly).toBe(true);expect(session.secure).toBe(true);expect(session.sameSite).toBe('Strict');
   expect(await page.content()).not.toContain(c.LITE_PREVIEW_KEY);expect(await page.content()).not.toContain(c.NEON_DATABASE_URL);
   for(const resource of ['/app.js','/bff-session.js','/boot.js','/api/me']){const response=await ctx.request.get(url+resource);expect(response.ok()).toBe(true);const text=await response.text();expect(text).not.toContain(c.LITE_PREVIEW_KEY);expect(text).not.toContain(c.NEON_DATABASE_URL);expect(text).not.toContain(c.LITE_BFF_SESSION_KEY);}
   await page.reload();await expect(page.getByRole('heading',{name:'Mis partidas'})).toBeVisible({timeout:20000});me=await page.evaluate(async()=>(await fetch('/api/me')).json());expect(me.id).toBe(u.id);
  }
  const other=await contexts[1].pages()[0].evaluate(async()=>(await fetch('/api/me')).json());expect(other.id).toBe(users[1].id);expect(other.id).not.toBe(users[0].id);
  const req=await browser.newContext({httpCredentials:{username:'side-lite',password:c.LITE_BFF_GATE_KEY}});contexts.push(req);const anon=await req.newPage();await anon.goto(url);expect(await anon.evaluate(async()=>(await fetch('/api/me')).status)).toBe(401);
  const bad=await contexts[0].request.post(url+'/api/teacher/activate',{headers:{origin:'https://attacker.invalid','content-type':'application/json'},data:{}});expect(bad.status()).toBe(403);
  const teacherPage=contexts[0].pages()[0];await teacherPage.locator('#create [name=name]').fill('Reconexión '+Date.now());await teacherPage.locator('#create button').click();await expect(teacherPage.locator('#back')).toBeVisible();
  await contexts[0].setOffline(true);await expect(teacherPage.locator('#error')).toContainText('Sin conexión',{timeout:12000});await contexts[0].setOffline(false);await expect(teacherPage.locator('#error')).toContainText('Conexión recuperada',{timeout:20000});
  const oldCookie=(await contexts[0].cookies()).find(x=>x.name==='__Host-side_lite_dev');
  await contexts[0].pages()[0].getByRole('button',{name:'Salir'}).click();await expect(contexts[0].pages()[0].getByRole('heading',{name:'Iniciar sesión'})).toBeVisible();expect(await contexts[0].pages()[0].evaluate(async()=>(await fetch('/api/me')).status)).toBe(401);
  await contexts[0].addCookies([oldCookie]);expect(await contexts[0].pages()[0].evaluate(async()=>(await fetch('/api/me')).status)).toBe(401);
  expect(await contexts[1].pages()[0].evaluate(async()=>(await fetch('/api/me')).status)).toBe(200);
 }finally{for(const x of contexts)await x.close()}
});
test('BFF HTTPS: acceso en pantalla móvil',async({browser})=>{
 test.skip(process.env.SIDE_LITE_BFF_LIVE!=='1','Requiere vista previa privada e identidad autorizada de desarrollo');
 const c=JSON.parse(await readFile('.neon-dev-secrets.json','utf8')),u=JSON.parse(await readFile('tests/output/private-api/dev-identities.json','utf8'))[1];
 const ctx=await browser.newContext({viewport:{width:390,height:844},httpCredentials:{username:'side-lite',password:c.LITE_BFF_GATE_KEY}});
 try{const p=await ctx.newPage();await p.goto('https://br-snowy-moon-bcshnyw2-sideweb.compute.c-16.us-east-1.aws.neon.tech');await p.locator('#login [name=email]').fill(u.email);await p.locator('#login [name=password]').fill(u.password);await p.locator('#login button').click();await expect(p.getByRole('heading',{name:'Mis partidas'})).toBeVisible({timeout:30000});expect(await p.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true)}finally{await ctx.close()}
});
