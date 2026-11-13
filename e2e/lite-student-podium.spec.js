import {test,expect} from '@playwright/test';
import express from 'express';
let server,base;
test.beforeAll(async()=>{server=await new Promise(resolve=>{const s=express().use(express.static('public')).listen(0,'127.0.0.1',()=>resolve(s))});base=`http://127.0.0.1:${server.address().port}`});
test.afterAll(async()=>new Promise(resolve=>server.close(resolve)));
test('consulta el podio solo después del cierre del último ciclo',async({page})=>{
 await page.goto(base+'/index.html');
 await page.evaluate(()=>{
  window.__cycles=[{id:'c1',number:1,status:'closed'}];window.__podiumRequests=0;
  window.SIDLiteGame={getGame:async()=>({game:{name:'Prueba',code:'DEMO',cycle_count:3,costs:{basic:10,standard:20,premium:30}},company:{id:'a',name:'A',cash:1000},companies:[],cycles:window.__cycles,ranking:[],results:[]}),request:async()=>{window.__podiumRequests++;return {published:null}}};
  window.__view=window.SIDELiteDecisions.mount({gameId:'test',showScreen:id=>{document.querySelectorAll('.screen').forEach(el=>el.classList.add('hidden'));document.getElementById(id).classList.remove('hidden')}});
 });
 await expect(page.locator('#enterDecisionsBtn')).toBeVisible();
 await page.evaluate(()=>window.__view.refresh());
 await expect.poll(()=>page.evaluate(()=>window.__podiumRequests)).toBe(0);
 await page.evaluate(()=>{window.__cycles.push({id:'c3',number:3,status:'closed'});window.__view.refresh()});
 await expect.poll(()=>page.evaluate(()=>window.__podiumRequests)).toBeGreaterThan(0);
});
for(const {width,height} of [{width:360,height:800},{width:390,height:844},{width:430,height:932},{width:768,height:1024},{width:1366,height:768}])test(`publicación estudiantil estable ${width}`,async({page})=>{
 await page.setViewportSize({width,height});await page.goto(base+'/index.html');
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
