import {test, expect} from '@playwright/test';
import express from 'express';
let server, base;
test.beforeAll(async()=>{server=await new Promise(resolve=>{const s=express().use(express.static('public')).listen(0,'127.0.0.1',()=>resolve(s))});base=`http://127.0.0.1:${server.address().port}`});
test.afterAll(async()=>new Promise(resolve=>server.close(resolve)));

test.use({channel:'chrome'});
for (const viewport of [{width:1280,height:800},{width:390,height:844}]) {
 test(`aviso del ciclo: cola, persistencia y controles ${viewport.width}`, async ({page}) => {
  await page.setViewportSize(viewport);
  await page.goto(base+'/index.html', {waitUntil:'domcontentloaded'});
  await page.clock.install();
  await page.clock.pauseAt(Date.now());
  await page.evaluate(() => {
    document.querySelectorAll('#app > .screen').forEach(el => el.classList.add('hidden'));
    document.querySelector('#decisionMenu').classList.remove('hidden');
    localStorage.clear();
  });
  const result = await page.evaluate(() => {
    const host = document.querySelector('#decisionFormScroll');
    const item = {partida:'test', ciclo:'1', id:'uno', titulo:'Feria local', texto:'Una feria atrae más compradores.', tono:'favorable', host};
    return [SideEventFlash.show(item), SideEventFlash.show(item), SideEventFlash.show({...item,id:'dos',titulo:'Otra noticia',tono:'desfavorable'})];
  });
  expect(result).toEqual([true,false,true]);
  const banner = page.locator('.side-event-flash');
  await expect(banner).toHaveCount(1);
  await expect(banner).toContainText('Feria local');
  await expect(banner).toHaveAttribute('role','status');
  const overlap = await page.evaluate(() => {
    const rect = document.querySelector('.side-event-flash').getBoundingClientRect();
    return ['#decisionRoundTimer','#topSubmitAllDecisions','#decisionTabs','#sendDecisionSection'].some(selector => {
      const r=document.querySelector(selector).getBoundingClientRect();
      return r.width && r.height && rect.left<r.right && rect.right>r.left && rect.top<r.bottom && rect.bottom>r.top;
    });
  });
  expect(overlap).toBe(false);
  const remainsVisible = await page.evaluate(() => {
    const host=document.querySelector('#decisionFormScroll'), banner=host.querySelector('.side-event-flash');
    const filler=document.createElement('div'); filler.style.height='2000px'; host.append(filler);
    host.scrollTop=500;
    const h=host.getBoundingClientRect(), r=banner.getBoundingClientRect();
    const visible=r.top>=h.top-10 && r.top<h.bottom;
    filler.remove(); host.scrollTop=0; return visible;
  });
  expect(remainsVisible).toBe(true);
  await page.clock.fastForward(4999); await expect(banner).toContainText('Feria local');
  await page.clock.fastForward(1); await expect(banner).toHaveCount(1); await expect(banner).toContainText('Otra noticia');
  await page.clock.fastForward(5000); await expect(banner).toHaveCount(0);
  const reloaded=await page.context().newPage();
  await reloaded.goto(base+'/index.html');
  expect(await reloaded.evaluate(() => SideEventFlash.show({partida:'test',ciclo:'1',id:'uno',titulo:'Feria local',host:document.body}))).toBe(false);
  await reloaded.close();
 });
}


test('la noticia llega del snapshot y no se repite tras reconexi�n', async ({page}) => {
 await page.goto(base+'/index.html');
 await page.evaluate(()=>{
  localStorage.clear();
  const now=Date.now();
  window.__snapshot={game:{id:'event-game',name:'Prueba',code:'DEMO',cycle_count:3,costs:{basic:50,standard:80,premium:120}},company:{id:'co',name:'Empresa',cash:30000,store:'Tienda'},cycles:[{id:'cycle-a',number:1,status:'open',event_id:'demand_fair',server_now:new Date(now).toISOString(),ends_at:new Date(now+600000).toISOString()}],ownDecision:null,ranking:[],results:[]};
  window.SIDLiteGame={getGame:async()=>structuredClone(window.__snapshot),request:async()=>({})};
  window.__view=window.SIDELiteDecisions.mount({gameId:'event-game',showScreen:id=>{document.querySelectorAll('.screen').forEach(el=>el.classList.add('hidden'));document.getElementById(id).classList.remove('hidden')}});
 });
 await expect(page.locator('.side-event-flash')).toContainText('Feria local');
 await expect(page.locator('.side-event-flash')).toContainText('demanda potencial aumenta 15');
 await expect(page.locator('#studentNewsList')).toContainText('Feria local');
 await page.evaluate(async()=>{window.__view.dispose();document.querySelectorAll('.side-event-flash').forEach(el=>el.remove());window.__view=window.SIDELiteDecisions.mount({gameId:'event-game',showScreen:id=>{document.querySelectorAll('.screen').forEach(el=>el.classList.add('hidden'));document.getElementById(id).classList.remove('hidden')}});await window.__view.refresh()});
 await expect(page.locator('.side-event-flash')).toHaveCount(0);
 await expect(page.locator('#studentNewsList')).toContainText('Feria local');
});

