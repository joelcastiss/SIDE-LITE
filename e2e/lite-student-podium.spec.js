import {test,expect} from '@playwright/test';
import express from 'express';
let server,base;
test.beforeAll(async()=>{server=await new Promise(resolve=>{const s=express().use(express.static('public')).listen(0,'127.0.0.1',()=>resolve(s))});base=`http://127.0.0.1:${server.address().port}`});
test.afterAll(async()=>new Promise(resolve=>server.close(resolve)));
for(const width of [1366,390])test(`publicación estudiantil estable ${width}`,async({page})=>{
 await page.setViewportSize({width,height:844});await page.goto(base+'/index.html');
 await page.evaluate(()=>{
  window.__published=null;window.__fail=false;
  window.SIDLiteGame={getGame:async()=>({game:{name:'Prueba',code:'DEMO',cycle_count:3,costs:{basic:10,standard:20,premium:30}},company:{id:'a',name:'A',cash:1000},companies:[],cycles:[{id:'c3',number:3,status:'closed'}],ranking:[],results:[]}),request:async()=>{if(window.__fail)throw Error('offline');return {published:window.__published}}};
  window.__mount=()=>window.SIDELiteDecisions.mount({gameId:'test',showScreen:id=>{document.querySelectorAll('.screen').forEach(el=>el.classList.add('hidden'));document.getElementById(id).classList.remove('hidden')}});window.__view=window.__mount();
 });
 const panel=page.locator('#studentLobby .student-podium').last();await expect(panel).toBeHidden();
 await page.evaluate(()=>{window.__published={ranking:[{name:'A',grade:20},{name:'B',grade:20},{name:'C',grade:17}],reason:'Criterios'};window.__view.refresh()});
 await expect(panel).toContainText('Criterios');await expect(panel.locator('li')).toHaveCount(3);expect(await panel.locator('li').evaluateAll(els=>els.map(x=>x.value))).toEqual([1,1,3]);
 await panel.evaluate(el=>el.dataset.testIdentity='retained');await page.evaluate(()=>window.__view.refresh());await expect(panel).toHaveAttribute('data-test-identity','retained');
 await page.evaluate(()=>{window.__fail=true;window.__view.refresh()});await expect(panel).toContainText('A');
 await page.evaluate(()=>{window.__fail=false;window.__view.dispose();window.__view=window.__mount()});await expect(page.locator('#studentLobby .student-podium').last()).toContainText('Criterios');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
});
