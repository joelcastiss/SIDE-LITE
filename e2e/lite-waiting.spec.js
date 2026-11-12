import {test, expect} from '@playwright/test';
import express from 'express';
let server,base;
test.beforeAll(async()=>{server=await new Promise(resolve=>{const s=express().use(express.static('public')).listen(0,'127.0.0.1',()=>resolve(s))});base=`http://127.0.0.1:${server.address().port}`});
test.afterAll(async()=>new Promise(resolve=>server.close(resolve)));
for(const {width,height} of [{width:1792,height:854},{width:1366,height:768},{width:390,height:844}]) test(`sala sincronizada con dos estudiantes ${width}×${height}`,async({browser})=>{
 const pages=[],contexts=[];
 try {
  for(const name of ['Aurora','Bahía']){
   const context=await browser.newContext({viewport:{width,height}});contexts.push(context);const page=await context.newPage();pages.push(page);
   await page.goto(base+'/index.html');
   await page.evaluate(({name})=>{window.__started=false;window.__name=name;window.__wheel=0;window.SideRuleta.playOnce=async()=>{window.__wheel++};window.SIDLiteGame={getGame:async()=>({game:{id:'g',name:'Aula',code:'ABC123',cycle_count:3,costs:{basic:50,standard:80,premium:120}},company:{id:name,name,cash:30000,district_id:'surco',district_name:'Santiago de Surco'},companies:[{name:'Aurora'},{name:'Bahía'}],cycles:window.__started?[{id:'c',number:1,status:'open',server_now:new Date().toISOString(),ends_at:new Date(Date.now()+120000).toISOString()}]:[],results:[],ranking:[]})};window.__mount=()=>window.SIDELiteDecisions.mount({gameId:'g',showScreen:id=>{document.querySelectorAll('.screen').forEach(el=>el.classList.add('hidden'));document.getElementById(id).classList.remove('hidden')}});window.__mount();},{name});
   await expect(page.locator('#liteWaitingCode')).toHaveText('ABC123');await expect(page.locator('#liteWaitingParticipants li')).toHaveCount(2);await expect(page.locator('#enterDecisionsBtn')).toBeDisabled();await expect(page.locator('#liteWaitingMarket')).toHaveText('Santiago de Surco');
  }
  for(const page of pages)await page.evaluate(()=>{window.__started=true});
  for(const page of pages){await expect(page.locator('#enterDecisionsBtn')).toBeEnabled({timeout:10000});await expect(page.locator('#liteWaitingState')).toHaveText('Partida en curso');await expect(page.locator('#decisionMenu')).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();}
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

test('autoentra una vez al abrir cada ciclo, no durante pausa ni en cada actualización',async({page})=>{
 await page.goto(base+'/index.html');
 await page.evaluate(()=>{
   window.__cycleState='waiting';
   window.SIDLiteGame={getGame:async()=>{
     const state=window.__cycleState,hasCycle=state!=='waiting',second=state==='open2';
     const cycle=hasCycle?{id:second?'cycle-2':'cycle-1',number:second?2:1,
       status:state==='closed'?'closed':'open',paused_at:state==='paused'?new Date().toISOString():null,
       server_now:new Date().toISOString(),ends_at:new Date(Date.now()+120000).toISOString()}:null;
     return {game:{id:'g',name:'Aula',code:'ABCDE',cycle_count:3,costs:{basic:50,standard:80,premium:120}},
       company:{id:'co',name:'Aurora',cash:30000,district_name:'Santiago de Surco'},
       companies:[{id:'co',name:'Aurora'}],cycles:cycle?[cycle]:[],ownDecision:null,results:[],ranking:[]};
   }};
   window.SIDELiteDecisions.mount({gameId:'g',showScreen:id=>{
     document.querySelectorAll('#app > .screen').forEach(el=>el.classList.toggle('hidden',el.id!==id));
   }});
 });
 await expect(page.locator('#studentWaiting')).toBeVisible();
 await page.evaluate(()=>window.__cycleState='paused');
 await expect(page.locator('#liteWaitingState')).toHaveText('Ciclo pausado',{timeout:11000});
 await expect(page.locator('#decisionMenu')).toBeHidden();
 await page.evaluate(()=>window.__cycleState='open');
 await expect(page.locator('#decisionMenu')).toBeVisible({timeout:11000});
 await page.locator('#exitDecisions').click();
 await expect(page.locator('#studentLobby')).toBeVisible();
 await page.waitForTimeout(5200);
 await expect(page.locator('#decisionMenu')).toBeHidden();
 await page.evaluate(()=>window.__cycleState='closed');
 await expect(page.locator('#liteWaitingState')).toHaveText('Ciclo cerrado',{timeout:11000});
 await page.evaluate(()=>window.__cycleState='open2');
 await expect(page.locator('#decisionMenu')).toBeVisible({timeout:11000});
});

test('estados no editables no permiten entrar',async({page})=>{
 await page.goto(base+'/index.html');
 await page.evaluate(()=>{ window.__cycle={id:'c',number:2,status:'open',server_now:new Date().toISOString(),ends_at:new Date(Date.now()+120000).toISOString()}; window.__own=null; window.SIDLiteGame={getGame:async()=>({game:{id:'g',name:'Aula',code:'ABC',cycle_count:3,costs:{basic:50,standard:80,premium:120}},company:{id:'a',name:'A',cash:30000},companies:[],cycles:[window.__cycle],ownDecision:window.__own,results:[]})}; window.__mounted=window.SIDELiteDecisions.mount({gameId:'g',showScreen:id=>{document.querySelectorAll('.screen').forEach(el=>el.classList.add('hidden'));document.getElementById(id).classList.remove('hidden')}}); });
 await expect(page.locator('#enterDecisionsBtn')).toBeEnabled();
 for(const [state,label] of [['paused','Ciclo pausado'],['expired','Ciclo vencido'],['closed','Ciclo cerrado'],['confirmed','Decisión confirmada']]) {
  await page.evaluate(async state=>{const now=Date.now(); window.__cycle={id:'c',number:2,status:state==='closed'?'closed':'open',server_now:new Date(now).toISOString(),ends_at:new Date(now+(state==='expired'?-1000:120000)).toISOString(),paused_at:state==='paused'?new Date(now).toISOString():null};window.__own=state==='confirmed'?{confirmed:true}:null; await (await window.__mounted).refresh();},state);
  await expect(page.locator('#liteWaitingState')).toHaveText(label); await expect(page.locator('#enterDecisionsBtn')).toBeDisabled();
 }
});

test('un inicio recibido durante una consulta pendiente se sincroniza y conserva el borrador',async({page})=>{
 await page.goto(base+'/index.html');
 await page.evaluate(()=>{
  let notify, release, calls=0;
  const cycle={id:'cycle-1',number:1,status:'open',server_now:new Date().toISOString(),ends_at:new Date(Date.now()+120000).toISOString()};
  const snapshot=cycles=>({game:{id:'g',name:'Aula',code:'ABC',cycle_count:3,costs:{basic:50,standard:80,premium:120}},company:{id:'a',name:'A',cash:30000},companies:[],cycles,ownDecision:cycles.length?{quality:'premium',quantity:7,price:130,marketing_amount:500}:null,results:[]});
  const channel={on(type,filter,fn){if(type==='postgres_changes' && filter.table==='lite_cycles')notify=fn;return this},subscribe(){return this},presenceState(){return {}}};
  window.SIDE={SupabaseClient:{getStudent:()=>({channel:()=>channel,removeChannel(){}})}};
  window.SIDLiteGame={getGame:()=>{calls++;if(calls===1)return Promise.resolve(snapshot([]));if(calls===2)return new Promise(resolve=>{release=()=>resolve(snapshot([]))});return Promise.resolve(snapshot([cycle]));}};
  window.__controller=window.SIDELiteDecisions.mount({gameId:'g',showScreen:id=>document.querySelectorAll('#app > .screen').forEach(el=>el.classList.toggle('hidden',el.id!==id))});
  window.__race=async()=>{void window.__controller.refresh();await Promise.resolve();notify();release();};
 });
 await expect(page.locator('#liteWaitingState')).toHaveText('Esperando inicio del docente');
 await page.evaluate(()=>window.__race());
 await expect(page.locator('#decisionMenu')).toBeVisible({timeout:3000});
 await expect(page.locator('.decision-tab')).toHaveCount(4);
 for(const [key,value] of [['quantity','7'],['price','130'],['marketingAmount','500']]) {await page.locator(`[data-cat=${key}]`).click();await expect(page.locator(`[name=${key}]`)).toHaveValue(value)}
 await expect(page.locator('[name=quality]')).toHaveValue('premium');
 await page.locator('[data-cat=quantity]').click();
 await page.locator('[name=quantity]').fill('9');
 await page.evaluate(()=>window.__controller.refresh());
 await expect(page.locator('[name=quantity]')).toHaveValue('9');
 await page.locator('#exitDecisions').click();
 await page.evaluate(()=>window.__controller.refresh());
 await expect(page.locator('#decisionMenu')).toBeHidden();
});

test('descarta una respuesta abierta antigua cuando el ciclo fue pausado',async({page})=>{
 await page.goto(base+'/index.html');
 await page.evaluate(()=>{
  let notify,release,calls=0;
  const now=Date.now(),cycle={id:'c',number:1,status:'open',server_now:new Date(now).toISOString(),ends_at:new Date(now+120000).toISOString()};
  const snapshot=paused=>({game:{id:'g',name:'Aula',code:'ABC',cycle_count:3,costs:{basic:50,standard:80,premium:120}},company:{id:'a',name:'A',cash:30000},companies:[],cycles:[{...cycle,paused_at:paused?new Date(now).toISOString():null}],ownDecision:{quality:'basic',quantity:3,price:100,marketing_amount:0},results:[]});
  const channel={on(type,filter,fn){if(type==='postgres_changes'&&filter.table==='lite_cycles')notify=fn;return this},subscribe(){return this},presenceState(){return {}}};
  window.SIDE={SupabaseClient:{getStudent:()=>({channel:()=>channel,removeChannel(){}})}};
  window.SIDLiteGame={getGame:()=>{calls++;if(calls===1)return Promise.resolve(snapshot(true));if(calls===2)return new Promise(resolve=>{release=()=>resolve(snapshot(false))});return Promise.resolve(snapshot(true));}};
  window.__screens=[];
  window.__controller=window.SIDELiteDecisions.mount({gameId:'g',showScreen:id=>{window.__screens.push(id);document.querySelectorAll('#app > .screen').forEach(el=>el.classList.toggle('hidden',el.id!==id))}});
  window.__race=()=>{void window.__controller.refresh();notify();release();};
 });
 await expect(page.locator('#liteWaitingState')).toHaveText('Ciclo pausado');
 await page.evaluate(()=>window.__race());
 await expect.poll(()=>page.evaluate(()=>window.__screens)).toEqual(['studentLobby']);
 await expect(page.locator('#liteWaitingState')).toHaveText('Ciclo pausado');
 await page.waitForTimeout(200);
 expect(await page.evaluate(()=>window.__screens)).toEqual(['studentLobby']);
});
