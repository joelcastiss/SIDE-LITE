import {test, expect} from '@playwright/test';
import express from 'express';
let server,base;
test.beforeAll(async()=>{server=await new Promise(resolve=>{const s=express().use(express.static('public')).listen(0,'127.0.0.1',()=>resolve(s))});base=`http://127.0.0.1:${server.address().port}`});
test.afterAll(async()=>new Promise(resolve=>server.close(resolve)));
for(const width of [1440,390]) test(`sala sincronizada con dos estudiantes ${width}px`,async({browser})=>{
 const pages=[],contexts=[];
 try {
  for(const name of ['Aurora','Bahía']){
   const context=await browser.newContext({viewport:{width,height:844}});contexts.push(context);const page=await context.newPage();pages.push(page);
   await page.goto(base+'/index.html');
   await page.evaluate(({name})=>{window.__started=false;window.__name=name;window.__wheel=0;window.SideRuleta.playOnce=async()=>{window.__wheel++};window.SIDLiteGame={getGame:async()=>({game:{id:'g',name:'Aula',code:'ABC123',cycle_count:3,costs:{basic:50,standard:80,premium:120}},company:{id:name,name,cash:30000,district_id:'surco',district_name:'Santiago de Surco'},companies:[{name:'Aurora'},{name:'Bahía'}],cycles:window.__started?[{id:'c',number:1,status:'open',server_now:new Date().toISOString(),ends_at:new Date(Date.now()+120000).toISOString()}]:[],results:[],ranking:[]})};window.__mount=()=>window.SIDELiteDecisions.mount({gameId:'g',showScreen:id=>{document.querySelectorAll('.screen').forEach(el=>el.classList.add('hidden'));document.getElementById(id).classList.remove('hidden')}});window.__mount();},{name});
   await expect(page.locator('#liteWaitingCode')).toHaveText('ABC123');await expect(page.locator('#liteWaitingParticipants li')).toHaveCount(2);await expect(page.locator('#enterDecisionsBtn')).toBeDisabled();await expect(page.locator('#liteWaitingMarket')).toHaveText('Santiago de Surco');
  }
  for(const page of pages)await page.evaluate(()=>{window.__started=true});
  for(const page of pages){await expect(page.locator('#enterDecisionsBtn')).toBeEnabled({timeout:10000});await expect(page.locator('#liteWaitingState')).toHaveText('Partida en curso');await page.locator('#enterDecisionsBtn').click();await expect(page.locator('#decisionMenu')).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();}
 }finally{await Promise.all(contexts.map(c=>c.close()))}
});

test('la ruleta conserva la asignación al recargar',async({page})=>{
 await page.goto(base+'/index.html');
 await page.evaluate(()=>{localStorage.removeItem('side_ruleta_game_company');void SideRuleta.playOnce({partidaId:'game',companyId:'company',marketId:'surco'});});
 await expect(page.locator('.rm-overlay')).toBeVisible();
 await page.reload();
 expect(await page.evaluate(()=>SideRuleta.playOnce({partidaId:'game',companyId:'company',marketId:'surco'}))).toBe(false);
 await expect(page.locator('.rm-overlay')).toHaveCount(0);
});
