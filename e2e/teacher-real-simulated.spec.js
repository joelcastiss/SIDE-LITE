import {test, expect} from '@playwright/test';
import express from 'express';
let server, base;
test.beforeAll(async()=>{server=await new Promise(resolve=>{const s=express().use(express.static('public')).listen(0,'127.0.0.1',()=>resolve(s))});base=`http://127.0.0.1:${server.address().port}`});
test.afterAll(async()=>new Promise(resolve=>server.close(resolve)));
test('panel real: crear, iniciar y consultar cierres autorizados en API simulada',async({page})=>{
 let created=false,started=false;const calls=[];
 const game={id:'game1',code:'AB12CD34',name:'Partida de prueba',cycle_count:3,enabled_events:[],costs:{basic:50,standard:80,premium:120}};
 const company={id:'co1',name:'Empresa de prueba',cash:30400,store:'Los Olivos'};
 const cycles=Array.from({length:3},(_,i)=>({id:'cycle'+(i+1),number:i+1,status:'closed',ends_at:'2026-11-10T10:02:00Z',server_now:'2026-11-10T10:02:00Z'}));
 const snapshot=()=>({isTeacher:true,game,companies:[company],decisions:[{company_id:'co1',confirmed:true}],cycles:started?cycles:[],results:started?cycles.map(c=>({company_id:'co1',cycle_id:c.id,number:c.number,result:{sold:10,revenue:1200,costOfSales:700,marketing:100,profit:400,cashStart:30000,cashEnd:30400}})):[],ranking:[{name:company.name,returnPercent:1.3}]});
 await page.route('**/vendor/supabase-js/supabase.js*',route=>route.fulfill({contentType:'application/javascript',body:`window.supabase={createClient:()=>({supabaseUrl:'https://hwwwoblfpsqqrkxvclag.supabase.co',auth:{getSession:async()=>({data:{session:{access_token:'test-teacher',user:{email_confirmed_at:'yes'}}}}),onAuthStateChange:()=>({data:{subscription:{}}})}})};`}));
 await page.route('https://hwwwoblfpsqqrkxvclag.supabase.co/**',route=>{
  const req=route.request(),path=new URL(req.url()).pathname.split('/api')[1],headers={'access-control-allow-origin':'*','access-control-allow-methods':'GET,POST,PUT,OPTIONS','access-control-allow-headers':'authorization,apikey,content-type'};
  if(req.method()==='OPTIONS')return route.fulfill({status:204,headers});
  calls.push({path,method:req.method(),authorization:req.headers().authorization,body:req.postDataJSON()});
  if(req.headers().authorization!=='Bearer test-teacher')return route.fulfill({status:403,headers,json:{error:'No autorizado'}});
  let json={};if(path==='/me')json={id:'t1',display_name:'Docente',role:'teacher'};else if(path==='/catalog')json=[];else if(path==='/games'&&req.method()==='POST'){created=true;json=game}else if(path==='/games')json=created?[game]:[];else if(path==='/games/game1/start'){started=true;json=cycles[0]}else if(path==='/games/game1')json=snapshot();else if(path==='/games/game1/podium')json={companies:[],finished:true};
  return route.fulfill({status:200,headers,json});
 });
 await page.goto(base+'/docente.html');await expect(page.locator('#startGame')).toBeVisible();
 await page.locator('#cycles').fill('3');await page.locator('#gameName').fill(game.name);await page.locator('#startGame').click();
 await expect(page.locator('#gameCodeBadge')).toContainText(game.code);await expect(page.locator('#startTimer')).toBeVisible();await page.locator('#startTimer').click();
 await expect.poll(()=>started).toBeTruthy();await page.locator('[data-tab=resultados]').click();await expect(page.locator('#detailReports')).toContainText('Empresa de prueba · Ciclo 1');await expect(page.locator('#detailReports')).toContainText('Ingresos S/ 1,200');
 await page.locator('[data-tab=historial]').click();await expect(page.locator('#historyGameSelect')).toContainText(game.name);await expect(page.locator('#historyStatus')).toContainText('Partidas finalizadas');
 const create=calls.find(c=>c.path==='/games'&&c.method==='POST');expect(create.body.duration).toBe(120);expect(create.body.cycleCount).toBe(3);expect(calls.some(c=>c.path==='/games/game1/start'&&c.method==='POST')).toBeTruthy();expect(calls.every(c=>c.authorization==='Bearer test-teacher')).toBeTruthy();
});
