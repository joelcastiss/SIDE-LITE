import {test, expect} from '@playwright/test';
import express from 'express';
let server, base;
test.beforeAll(async()=>{server=await new Promise(resolve=>{const s=express().use('/SIDE-LITE',express.static('.')).listen(0,'127.0.0.1',()=>resolve(s))});base=`http://127.0.0.1:${server.address().port}`});
test.afterAll(async()=>new Promise(resolve=>server.close(resolve)));
for(const viewport of [{width:360,height:800},{width:390,height:844},{width:430,height:932},{width:768,height:1024},{width:1366,height:768}]) test(`panel docente y publicación ${viewport.width}×${viewport.height}`,async({page})=>{
 await page.setViewportSize(viewport);
 let created=false, published=false;
 const names=['Empresa con nombre largo para comprobar que toda la información permanece visible','Segunda empresa','Tercera empresa','Cuarta empresa'];
 const companies=names.map((name,i)=>({id:'co'+i,name,grade:20-i}));
 const game={id:'game1',code:'A7K2M',name:'Prueba',cycle_count:3,enabled_events:[],costs:{basic:50,standard:80,premium:120}};
 await page.route('https://joelcastiss.github.io/**',async route=>{const u=new URL(route.request().url());await route.fulfill({response:await route.fetch({url:base+u.pathname+u.search})})});
 await page.route('**/vendor/supabase-js/supabase.js*',route=>route.fulfill({contentType:'application/javascript',body:`window.supabase={createClient:()=>({supabaseUrl:'https://hwwwoblfpsqqrkxvclag.supabase.co',auth:{getSession:async()=>({data:{session:{access_token:'test',user:{email_confirmed_at:'yes'}}}}),onAuthStateChange:()=>({data:{subscription:{}}})}})};`}));
 await page.route('https://hwwwoblfpsqqrkxvclag.supabase.co/**',route=>{
  const req=route.request(),path=new URL(req.url()).pathname.split('/api')[1],headers={'access-control-allow-origin':'*','access-control-allow-methods':'GET,POST,PUT,OPTIONS','access-control-allow-headers':'authorization,apikey,content-type'};
  if(req.method()==='OPTIONS')return route.fulfill({status:204,headers});
  let json={};if(path==='/me')json={id:'t1',display_name:'Docente',role:'teacher'};else if(path==='/catalog')json=[];else if(path==='/games'&&req.method()==='POST'){created=true;json=game}else if(path==='/games')json=created?[game]:[];else if(path==='/games/game1/podium'&&req.method()==='POST'){published=true;json={}}else if(path==='/games/game1/podium')json={companies,finished:true};else if(path==='/games/game1')json={isTeacher:true,game,companies,decisions:[],cycles:[],results:[],ranking:[]};
  return route.fulfill({status:200,headers,json});
 });
 await page.goto('https://joelcastiss.github.io/SIDE-LITE/public/docente.html');
 await page.locator('#gameName').fill('Prueba');
 await page.locator('#liteOpenEventPicker').click();
 await expect(page.locator('.lite-event-picker')).toBeVisible();
 await page.locator('#liteDoneEventPicker').click();
 await page.locator('#startGame').click();
 await page.locator('[data-tab=podio]').click();
 await expect(page.locator('#podiumPreview input')).toHaveCount(4);
 for(const name of names){const input=page.getByLabel('Nota de '+name);await expect(input).toBeVisible();expect(await input.evaluate(el=>{const r=el.getBoundingClientRect();return r.width>0&&r.left>=0&&r.right<=innerWidth})).toBe(true)}
 await page.locator('#publishPodium').click();
 await page.locator('#podiumPublishMode').selectOption('schedule');
 await expect(page.locator('#podiumMinutes')).toBeVisible();
 await page.locator('#confirmPodiumPublish').click();
 await expect.poll(()=>published).toBe(true);
 await page.locator('[data-tab=resultados]').click();
 await expect(page.locator('#detailReports')).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
});
