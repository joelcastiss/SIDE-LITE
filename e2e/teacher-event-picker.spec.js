import {test,expect} from '@playwright/test';
import express from 'express';
let server,base;
test.beforeAll(async()=>{server=await new Promise(resolve=>{const s=express().use('/SIDE-LITE',express.static('.')).listen(0,'127.0.0.1',()=>resolve(s))});base=`http://127.0.0.1:${server.address().port}`});
test.afterAll(async()=>new Promise(resolve=>server.close(resolve)));
for(const width of [1440,390]) test(`selector de eventos ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:844}); let sent;
 await page.route('https://joelcastiss.github.io/**',async route=>{const u=new URL(route.request().url());await route.fulfill({response:await route.fetch({url:base+u.pathname+u.search})})});
 await page.route('**/vendor/supabase-js/supabase.js*',route=>route.fulfill({contentType:'application/javascript',body:`window.supabase={createClient:()=>({supabaseUrl:'https://hwwwoblfpsqqrkxvclag.supabase.co',auth:{getSession:async()=>({data:{session:{access_token:'test',user:{email_confirmed_at:'yes'}}}}),onAuthStateChange:()=>({data:{subscription:{}}})}})};`}));
 await page.route('https://hwwwoblfpsqqrkxvclag.supabase.co/**',route=>{const req=route.request(),path=new URL(req.url()).pathname.split('/api')[1],headers={'access-control-allow-origin':'*','access-control-allow-methods':'GET,POST,PUT,OPTIONS','access-control-allow-headers':'authorization,apikey,content-type'};if(req.method()==='OPTIONS')return route.fulfill({status:204,headers});let json=[];if(path==='/me')json={id:'t1',role:'teacher'};else if(path==='/catalog')json=[{id:'demand_fair',label:'Feria local'},{id:'demand_rain',label:'Semana lluviosa'}];else if(path==='/games'&&req.method()==='POST'){sent=req.postDataJSON();json={id:'game1',code:'A7K2M'}}else if(path==='/games/game1')json={game:{id:'game1',code:'A7K2M',enabled_events:sent?.events||[]},companies:[],cycles:[],results:[],ranking:[]};return route.fulfill({status:200,headers,json});});
 await page.goto('https://joelcastiss.github.io/SIDE-LITE/public/docente.html');
 await page.locator('#liteOpenEventPicker').click(); await expect(page.locator('#liteEventPickerList input')).toHaveCount(2);
 await page.locator('#liteEventSearch').fill('lluviosa');await expect(page.locator('#liteEventPickerList input')).toHaveCount(1);await page.locator('#liteEventPickerList input').check();
 await page.locator('#liteDoneEventPicker').click();await expect(page.locator('#enabledEventsSummary')).toContainText('Semana lluviosa');
 await page.locator('#liteOpenEventPicker').click();await page.locator('#liteSelectAllEvents').click();await expect(page.locator('#liteEventPickerList input:checked')).toHaveCount(2);await page.locator('#liteClearEvents').click();await expect(page.locator('#liteEventPickerList input:checked')).toHaveCount(0);await page.locator('#liteEventPickerList input').first().check();await page.locator('#liteDoneEventPicker').click();
 await page.locator('#startGame').click();await expect.poll(()=>sent?.events).toEqual(['demand_fair']);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
