import {test, expect} from '@playwright/test';
import express from 'express';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
let server, base;
test.beforeAll(async()=>{server=await new Promise(resolve=>{const s=express().use('/SIDE-LITE',express.static('.')).use(express.static('public')).listen(0,'127.0.0.1',()=>resolve(s))});base=`http://127.0.0.1:${server.address().port}`});
test.afterAll(async()=>new Promise(resolve=>server.close(resolve)));
test('panel real: crear, iniciar y consultar cierres autorizados en API simulada',async({page})=>{
 let created=false,started=false;const calls=[];
 const game={id:'game1',code:'A7K2M',name:'Partida de prueba',cycle_count:3,enabled_events:[],costs:{basic:50,standard:80,premium:120}};
 const company={id:'co1',name:'Empresa de prueba',cash:30400,store:'Los Olivos'};
 const cycles=Array.from({length:3},(_,i)=>({id:'cycle'+(i+1),number:i+1,status:'closed',ends_at:'2026-11-10T10:02:00Z',server_now:'2026-11-10T10:02:00Z'}));
 const snapshot=()=>({isTeacher:true,game,companies:[company],decisions:[{company_id:'co1',confirmed:true}],cycles:started?cycles:[],results:started?cycles.map(c=>({company_id:'co1',cycle_id:c.id,number:c.number,result:{sold:10,revenue:1200,costOfSales:700,marketing:100,profit:400,cashStart:30000,cashEnd:30400}})):[],ranking:[{name:company.name,returnPercent:1.3}]});
 await page.route('https://joelcastiss.github.io/**',async route=>{const u=new URL(route.request().url());const response=await route.fetch({url:base+u.pathname+u.search});await route.fulfill({response})});
 await page.route('**/vendor/supabase-js/supabase.js*',route=>route.fulfill({contentType:'application/javascript',body:`window.supabase={createClient:()=>({supabaseUrl:'https://hwwwoblfpsqqrkxvclag.supabase.co',auth:{getSession:async()=>({data:{session:{access_token:'test-teacher',user:{email_confirmed_at:'yes'}}}}),onAuthStateChange:()=>({data:{subscription:{}}})}})};`}));
 await page.route('https://hwwwoblfpsqqrkxvclag.supabase.co/**',route=>{
  const req=route.request(),path=new URL(req.url()).pathname.split('/api')[1],headers={'access-control-allow-origin':'*','access-control-allow-methods':'GET,POST,PUT,OPTIONS','access-control-allow-headers':'authorization,apikey,content-type'};
  if(req.method()==='OPTIONS')return route.fulfill({status:204,headers});
  calls.push({path,method:req.method(),authorization:req.headers().authorization,body:req.postDataJSON()});
  if(req.headers().authorization!=='Bearer test-teacher')return route.fulfill({status:403,headers,json:{error:'No autorizado'}});
  let json={};if(path==='/me')json={id:'t1',display_name:'Docente',role:'teacher'};else if(path==='/catalog')json=[];else if(path==='/games'&&req.method()==='POST'){created=true;json=game}else if(path==='/games')json=created?[game]:[];else if(path==='/games/game1/start'){started=true;json=cycles[0]}else if(path==='/games/game1')json=snapshot();else if(path==='/games/game1/podium')json={companies:[],finished:true};
  return route.fulfill({status:200,headers,json});
 });
 await page.addInitScript(()=>{Object.defineProperty(navigator,'clipboard',{value:{writeText:async value=>{window.copiedInvitation=value}}})});
 await page.goto('https://joelcastiss.github.io/SIDE-LITE/public/docente.html');await expect(page.locator('#startGame')).toBeVisible();
 await page.locator('#cycles').fill('3');await page.locator('#gameName').fill(game.name);await page.locator('#startGame').click();
 await expect(page.locator('#gameCodeBadge')).toContainText(game.code);
 const expectedUrl='https://joelcastiss.github.io/SIDE-LITE/?partida=A7K2M';
 await page.locator('#copyGameLink').click();await expect.poll(()=>page.evaluate(()=>window.copiedInvitation)).toBe(expectedUrl);
 await page.locator('#showGameQr').click();await expect(page.locator('#gameQrDialog')).toBeVisible();await expect(page.locator('#gameQrCode')).toHaveText(game.code);
 await page.addScriptTag({path:require.resolve('jsqr/dist/jsQR.js')});
 for (const viewport of [{width:1366,height:768},{width:1920,height:1080}]) {
  await page.setViewportSize(viewport);
  const geometry=await page.locator('#gameQrDialog').evaluate(dialog=>{const qr=dialog.querySelector('svg').getBoundingClientRect(), rect=dialog.getBoundingClientRect();return {scroll:dialog.scrollHeight>dialog.clientHeight||dialog.scrollWidth>dialog.clientWidth,qr:{top:qr.top,bottom:qr.bottom,left:qr.left,right:qr.right},dialog:{top:rect.top,bottom:rect.bottom,left:rect.left,right:rect.right}}});
  expect(geometry.scroll).toBe(false);expect(geometry.qr.top).toBeGreaterThanOrEqual(geometry.dialog.top);expect(geometry.qr.bottom).toBeLessThanOrEqual(geometry.dialog.bottom);expect(geometry.qr.left).toBeGreaterThanOrEqual(geometry.dialog.left);expect(geometry.qr.right).toBeLessThanOrEqual(geometry.dialog.right);
 }
 const decoded=await page.locator('#gameQrImage svg').evaluate(async svg=>{const image=new Image();image.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(new XMLSerializer().serializeToString(svg));await image.decode();const canvas=document.createElement('canvas');canvas.width=canvas.height=768;const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0,768,768);const pixels=ctx.getImageData(0,0,768,768);return window.jsQR(pixels.data,768,768)?.data});
 expect(decoded).toBe(expectedUrl);
 const download=page.waitForEvent('download');await page.locator('#downloadGameQr').click();const png=await download;expect(png.suggestedFilename()).toBe('SIDE-A7K2M-QR.png');expect(await png.failure()).toBeNull();await page.locator('#closeGameQr').click();
 await expect(page.locator('#startTimer')).toBeVisible();await page.locator('#startTimer').click();
 await expect.poll(()=>started).toBeTruthy();await page.locator('[data-tab=resultados]').click();await expect(page.locator('#detailReports')).toContainText('Empresa de prueba');await expect(page.getByLabel('Seleccionar ciclo de resultados')).toHaveValue('3');await page.getByLabel('Seleccionar ciclo de resultados').selectOption('1');await expect(page.locator('#detailReports')).toContainText('Ciclo 1');await expect(page.locator('#detailReports .lite-result-company')).toContainText('S/ 1,200');
 await page.locator('[data-tab=historial]').click();await expect(page.locator('#historyGameSelect')).toContainText(game.name);await expect(page.locator('#historyStatus')).toContainText('Partidas finalizadas');
 const create=calls.find(c=>c.path==='/games'&&c.method==='POST');expect(create.body.duration).toBe(120);expect(create.body.cycleCount).toBe(3);expect(calls.some(c=>c.path==='/games/game1/start'&&c.method==='POST')).toBeTruthy();expect(calls.filter(c=>c.path!=='/catalog'||c.authorization).every(c=>c.authorization==='Bearer test-teacher')).toBeTruthy();
});

test('enlace del QR abre e ingresa desde un navegador móvil',async({browser})=>{
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 const page=await context.newPage();let joinBody;
 await page.route('https://joelcastiss.github.io/**',async route=>{const u=new URL(route.request().url());const response=await route.fetch({url:base+u.pathname+u.search});await route.fulfill({response})});
 await page.route('**/vendor/supabase-js/supabase.js*',route=>route.fulfill({contentType:'application/javascript',body:`window.supabase={createClient:()=>({supabaseUrl:'https://hwwwoblfpsqqrkxvclag.supabase.co',auth:{getSession:async()=>({data:{session:{access_token:'test-student',user:{is_anonymous:true}}}}),onAuthStateChange:()=>({data:{subscription:{}}})}})};`}));
 await page.route('**/js/lite-decisions.js*',route=>route.fulfill({contentType:'application/javascript',body:`window.SIDELiteDecisions={mount:async ({showScreen})=>showScreen('studentLobby')};`}));
 await page.route('https://hwwwoblfpsqqrkxvclag.supabase.co/**',route=>{
  const req=route.request(),path=new URL(req.url()).pathname.split('/api')[1],headers={'access-control-allow-origin':'*','access-control-allow-methods':'GET,POST,OPTIONS','access-control-allow-headers':'authorization,apikey,content-type'};
  if(req.method()==='OPTIONS')return route.fulfill({status:204,headers});
  let json={};if(path==='/me')json={id:'s1',role:'student'};else if(path==='/games')json=[];else if(path==='/join'){joinBody=req.postDataJSON();json={id:'co1',game_id:'game1',recoverySecret:joinBody.recoverySecret};}
  return route.fulfill({status:200,headers,json});
 });
 try{
  await page.goto('https://joelcastiss.github.io/SIDE-LITE/?partida=A7K2M');
  await expect(page.locator('#studentModal')).toBeVisible();await expect(page.locator('#gameCode')).toHaveValue('A7K2M');
  await page.locator('#companyLegalName').fill('Empresa Móvil');await page.locator('#companyBrandName').fill('Marca Móvil');await page.locator('#studentForm button[type=submit]').click();
  await expect(page.locator('#studentLobby')).toBeVisible();expect(joinBody).toMatchObject({code:'A7K2M',name:'Empresa Móvil',brand:'Marca Móvil'});expect(joinBody.recoverySecret).toMatch(/^[A-Za-z0-9_-]{43}$/);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 }finally{await page.unrouteAll({behavior:'ignoreErrors'});await context.close()}
});

test('el piloto habilita el cierre asistido únicamente después del vencimiento',async({page})=>{
 let created=false,closed=false,closeCalls=0;const end=Date.now()+5000;
 const game={id:'game1',code:'A7K2M',name:'Piloto',cycle_count:3,enabled_events:[],costs:{basic:50,standard:80,premium:120}};
 await page.route('https://joelcastiss.github.io/**',async route=>{const u=new URL(route.request().url());const response=await route.fetch({url:base+u.pathname+u.search});await route.fulfill({response})});
 await page.route('**/vendor/supabase-js/supabase.js*',route=>route.fulfill({contentType:'application/javascript',body:`window.supabase={createClient:()=>({supabaseUrl:'https://hwwwoblfpsqqrkxvclag.supabase.co',auth:{getSession:async()=>({data:{session:{access_token:'test-teacher',user:{email_confirmed_at:'yes'}}}}),onAuthStateChange:()=>({data:{subscription:{}}})}})};`}));
 await page.route('https://hwwwoblfpsqqrkxvclag.supabase.co/**',route=>{
  const req=route.request(),path=new URL(req.url()).pathname.split('/api')[1],headers={'access-control-allow-origin':'*','access-control-allow-methods':'GET,POST,PUT,OPTIONS','access-control-allow-headers':'authorization,apikey,content-type'};
  if(req.method()==='OPTIONS')return route.fulfill({status:204,headers});
  let json={};if(path==='/me')json={id:'t1',display_name:'Docente',role:'teacher'};else if(path==='/catalog')json=[];else if(path==='/games'&&req.method()==='POST'){created=true;json=game}else if(path==='/games')json=created?[game]:[];
  else if(path==='/games/game1/close'){closeCalls++;expect(req.headers().authorization).toBe('Bearer test-teacher');if(Date.now()<end)return route.fulfill({status:409,headers,json:{error:'Ciclo aún no vencido'}});closed=true;json={closed:true};}
  else if(path==='/games/game1')json={isTeacher:true,game,companies:[],decisions:[],results:[],ranking:[],cycles:[{id:'cycle1',number:1,status:closed?'closed':'open',ends_at:new Date(end).toISOString(),server_now:new Date().toISOString()}]};
  return route.fulfill({status:200,headers,json});
 });
 await page.goto('https://joelcastiss.github.io/SIDE-LITE/public/docente.html');await page.locator('#gameName').fill('Piloto');await page.locator('#startGame').click();
 await expect(page.locator('#gameStatusBanner')).toContainText('Piloto con cierre asistido');
 await expect(page.locator('#cutRound')).toBeVisible();await expect(page.locator('#cutRound')).toBeDisabled();expect(closeCalls).toBe(0);
 await expect(page.locator('#cutRound')).toBeEnabled({timeout:10000});await page.locator('#cutRound').click();
 await expect.poll(()=>closeCalls).toBe(1);await expect(page.locator('#cutRound')).toBeHidden();
});

test('el docente puede cancelar una sala sin ciclo abierto',async({page})=>{
 let created=false,finished=false,cancelCalls=0;
 const game={id:'game1',code:'A7K2M',name:'Sala',cycle_count:3,enabled_events:[],costs:{basic:50,standard:80,premium:120}};
 await page.route('https://joelcastiss.github.io/**',async route=>{const u=new URL(route.request().url());const response=await route.fetch({url:base+u.pathname+u.search});await route.fulfill({response})});
 await page.route('**/vendor/supabase-js/supabase.js*',route=>route.fulfill({contentType:'application/javascript',body:`window.supabase={createClient:()=>({supabaseUrl:'https://hwwwoblfpsqqrkxvclag.supabase.co',auth:{getSession:async()=>({data:{session:{access_token:'test-teacher',user:{email_confirmed_at:'yes'}}}}),onAuthStateChange:()=>({data:{subscription:{}}})}})};`}));
 await page.route('https://hwwwoblfpsqqrkxvclag.supabase.co/**',route=>{
  const req=route.request(),path=new URL(req.url()).pathname.split('/api')[1],headers={'access-control-allow-origin':'*','access-control-allow-methods':'GET,POST,PUT,OPTIONS','access-control-allow-headers':'authorization,apikey,content-type'};
  if(req.method()==='OPTIONS')return route.fulfill({status:204,headers});
  let json={};if(path==='/me')json={id:'t1',display_name:'Docente',role:'teacher'};else if(path==='/catalog')json=[];else if(path==='/games'&&req.method()==='POST'){created=true;json=game}else if(path==='/games')json=created?[game]:[];else if(path==='/games/game1/finish'){expect(req.headers().authorization).toBe('Bearer test-teacher');cancelCalls++;finished=true;json={ended_at:new Date().toISOString()}}else if(path==='/games/game1')json={isTeacher:true,game,companies:[],decisions:[],results:[],ranking:[],cycles:[]};
  return route.fulfill({status:200,headers,json});
 });
 await page.goto('https://joelcastiss.github.io/SIDE-LITE/public/docente.html');await page.locator('#startGame').click();
 await expect(page.locator('#liteCancelGame')).toBeVisible();await page.locator('#liteCancelGame').click();await expect(page.locator('#cancelGameDialog')).toBeVisible();
 await page.locator('#keepGame').click();expect(cancelCalls).toBe(0);await page.locator('#liteCancelGame').click();await Promise.all([page.waitForEvent('load'),page.locator('#confirmCancelGame').click()]);
 await expect.poll(()=>finished).toBe(true);await expect.poll(async()=>{try{return await page.evaluate(()=>sessionStorage.getItem('side-lite-teacher-game'))}catch{return 'navigating'}}).toBeNull();
});
