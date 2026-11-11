import {test, expect} from '@playwright/test';
import express from 'express';
let server, base;
test.beforeAll(async()=>{server=await new Promise(resolve=>{const s=express().use(express.static('public')).listen(0,'127.0.0.1',()=>resolve(s))});base=`http://127.0.0.1:${server.address().port}`});
test.afterAll(async()=>new Promise(resolve=>server.close(resolve)));
async function mount(page){
 await page.goto(base+'/index.html');
 await page.evaluate(()=>{
  window.__requests=[];window.__own=null;
  const now=Date.now();
  window.SIDLiteGame={getGame:async()=>({game:{id:'g1',name:'demo1',code:'DEMO',cycle_count:3,costs:{basic:50,standard:80,premium:120}},company:{name:'demo1',cash:30000,store:'Tienda'},cycles:[{id:'c1',number:1,status:'open',server_now:new Date(now).toISOString(),ends_at:new Date(now+600000).toISOString()}],ownDecision:window.__own,ranking:[],results:[]}),request:async(path,method,payload)=>{window.__requests.push({path,method,payload});window.__own={...payload,marketing_amount:payload.marketingAmount};return {};}};
  window.SIDELiteDecisions.mount({gameId:'g1',showScreen:id=>{document.querySelectorAll('.screen').forEach(el=>el.classList.add('hidden'));document.getElementById(id).classList.remove('hidden')}});

 });
 await expect(page.locator('#enterDecisionsBtn')).toBeEnabled();
 await page.locator('#enterDecisionsBtn').click();
 await expect(page.locator('#categoryTitle')).toHaveText('Calidad');
}
for(const viewport of [{width:1366,height:768},{width:1920,height:1080},{width:390,height:844}])test(`decisiones adaptables ${viewport.width}×${viewport.height}`,async({page})=>{
 await page.setViewportSize(viewport);const errors=[];page.on('pageerror',e=>errors.push(e.message));await mount(page);
 for(const key of ['quality','quantity','price','marketingAmount']){
  await page.locator(`[data-cat="${key}"]`).click();
  const metrics=await page.evaluate(()=>{const scroll=document.querySelector('#decisionFormScroll'),footer=document.querySelector('.section-save-bar').getBoundingClientRect();return {overflow:document.documentElement.scrollWidth-innerWidth,scroll:scroll.scrollHeight-scroll.clientHeight,footerTop:footer.top,footerBottom:footer.bottom,height:innerHeight}});
  expect(metrics.overflow).toBeLessThanOrEqual(1);
  if(viewport.width>=1366){expect(metrics.scroll).toBeLessThanOrEqual(1);expect(metrics.footerTop).toBeGreaterThanOrEqual(0);expect(metrics.footerBottom).toBeLessThanOrEqual(metrics.height)}
 }
 expect(errors).toEqual([]);
});
test('conserva valores, guarda el borrador y confirma una decisión global',async({page})=>{
 await mount(page);
 await page.locator('[data-cat="quantity"]').click();await page.locator('[name="quantity"]').fill('100');
 await page.locator('[data-cat="price"]').click();await page.locator('[name="price"]').fill('150');
 await page.locator('[data-cat="marketingAmount"]').click();await page.locator('[name="marketingAmount"]').fill('500');
 await page.locator('#saveDecisionSection').click();
 await expect.poll(()=>page.evaluate(()=>window.__requests.length)).toBe(1);
 expect(await page.evaluate(()=>window.__requests[0])).toEqual({path:'/games/g1/decision',method:'PUT',payload:{quality:'basic',quantity:100,price:150,marketingAmount:500,confirmed:false}});
 await page.locator('#sendDecisionSection').click();
 await expect.poll(()=>page.evaluate(()=>window.__requests.length)).toBe(2);
 expect((await page.evaluate(()=>window.__requests[1])).payload.confirmed).toBe(true);
 await expect(page.locator('#sendDecisionSection')).toBeDisabled();
});




test('calidad se selecciona con teclado y se guarda',async({page})=>{
 await mount(page);
 const options=page.getByRole('radiogroup',{name:'Calidad de los bolsos'}).getByRole('radio');
 await expect(options).toHaveCount(3);await expect(options.nth(0)).toHaveAttribute('aria-checked','true');
 await options.nth(0).focus();await page.keyboard.press('ArrowRight');
 await expect(options.nth(1)).toBeFocused();await expect(options.nth(1)).toHaveAttribute('aria-checked','true');
 await page.locator('[data-cat="quantity"]').click();await page.locator('[name="quantity"]').fill('10');
 await page.locator('#saveDecisionSection').click();await expect.poll(()=>page.evaluate(()=>window.__requests.length)).toBe(1);
 expect((await page.evaluate(()=>window.__requests[0])).payload.quality).toBe('standard');
});
