import {test, expect} from '@playwright/test';
import express from 'express';
let server, base;
test.beforeAll(async()=>{server=await new Promise(resolve=>{const s=express().use(express.static('public')).listen(0,'127.0.0.1',()=>resolve(s))});base=`http://127.0.0.1:${server.address().port}`});
test.afterAll(async()=>new Promise(resolve=>server.close(resolve)));
for(const viewport of [{width:1366,height:768},{width:390,height:844}])test(`resultados adaptables ${viewport.width}×${viewport.height}`,async({page})=>{
  await page.setViewportSize(viewport);
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'/index.html');
  await page.evaluate(()=>{
    localStorage.setItem('SIDE_COACHMARK_V1_student_lite','1');
    const result={cashStart:1000,cashEnd:1050,purchase:200,unitCost:10,marketing:100,revenue:350,costOfSales:150,profit:100,sold:15,inventory:[{quantity:5,unitCost:10}]};
    window.SIDLiteGame={getGame:async()=>({game:{name:'Prueba',code:'DEMO',cycle_count:3,costs:{basic:10,standard:20,premium:30}},company:{id:'mine',name:'Mi empresa',cash:1050,initial_capital:1000},cycles:[{id:'c1',number:1,status:'closed'}],ownDecision:null,ranking:[{id:'other',name:'Empresa 2',returnPercent:20},{id:'mine',name:'Mi empresa',returnPercent:10}],results:[{company_id:'mine',number:1,result}]}),request:async()=>({})};
    window.SIDELiteDecisions.mount({gameId:'test',showScreen:id=>{document.querySelectorAll('.screen').forEach(el=>el.classList.add('hidden'));document.getElementById(id).classList.remove('hidden')}});
  });
  await expect(page.locator('#studentFinancialDetail')).toContainText('Ciclo 1');
  await expect(page.getByText('Resumen sencillo')).toBeAttached();
  await expect(page.getByText(/Tu posición: 2 de 2/)).toBeAttached();
  await expect(page.locator('#studentFinancialDetail')).not.toContainText('FIFO');
  await expect(page.locator('#studentFinancialDetail')).toContainText('Disponibles para vender');
  await expect(page.locator('#studentFinancialDetail')).toContainText('20');
  const panel=page.locator('#studentFinancialDetail');
  await panel.scrollIntoViewIfNeeded();
  expect(await panel.evaluate(el=>el.scrollWidth-el.clientWidth)).toBeLessThanOrEqual(1);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
  if(process.env.SIDE_VISUAL_OUTPUT){
    await page.screenshot({path:`${process.env.SIDE_VISUAL_OUTPUT}/resultados-${viewport.width}-superior.png`});
    await page.getByText('Resumen sencillo').scrollIntoViewIfNeeded();
    await page.screenshot({path:`${process.env.SIDE_VISUAL_OUTPUT}/resultados-${viewport.width}-inferior.png`});
  }
  expect(errors).toEqual([]);
});
test('muestra el cierre aunque el siguiente ciclo ya haya comenzado y permite continuar',async({page})=>{
 await page.goto(base+'/index.html');
 await page.evaluate(()=>{
  const result={cashStart:1000,cashEnd:1100,purchase:100,unitCost:10,marketing:0,revenue:200,costOfSales:100,profit:100,sold:10,inventory:[]};
  window.__game={game:{name:'Prueba',code:'DEMO',cycle_count:3,costs:{basic:10,standard:20,premium:30}},company:{id:'mine',name:'Mi empresa',cash:1100,initial_capital:1000},cycles:[{id:'c1',number:1,status:'closed'},{id:'c2',number:2,status:'open',server_now:new Date().toISOString(),ends_at:new Date(Date.now()+120000).toISOString()}],ownDecision:null,ranking:[],results:[{company_id:'mine',cycle_id:'c1',number:1,result}]};
  window.SIDLiteGame={getGame:async()=>structuredClone(window.__game),request:async()=>({})};
  window.__view=window.SIDELiteDecisions.mount({gameId:'test',showScreen:id=>{document.querySelectorAll('.screen').forEach(el=>el.classList.add('hidden'));document.getElementById(id).classList.remove('hidden')}});
 });
 await expect(page.locator('#studentFinancialDetail')).toBeVisible();
 await expect(page.locator('#studentFinancialDetail')).toContainText('Ciclo 1');
 await page.evaluate(()=>window.__view.refresh());
 await expect(page.locator('#studentFinancialDetail')).toBeVisible();
 await page.getByRole('button',{name:'Volver a la sala de espera'}).click();
 await page.getByRole('button',{name:'Entrar al menú de decisiones'}).click();
 await expect(page.locator('#decisionMenu')).toBeVisible();
});
test('actualiza resultados propios, conserva historial y permite reintentar',async({page})=>{
 await page.goto(base+'/index.html');
 await page.evaluate(()=>{
  const result={cashStart:1000,cashEnd:1200,purchase:200,unitCost:10,marketing:0,revenue:400,costOfSales:200,profit:200,sold:20,demand:25,inventory:[],event:{label:'Feria local',demand:1.15}};
  window.__game={game:{name:'Prueba',code:'DEMO',cycle_count:3,costs:{basic:10,standard:20,premium:30}},company:{id:'mine',name:'Mi empresa',cash:1200,initial_capital:1000},cycles:[{id:'c1',number:1,status:'open',server_now:new Date().toISOString(),ends_at:new Date(Date.now()-1000).toISOString()}],ownDecision:null,ranking:[],results:[]};
  window.__fail=false;window.SIDLiteGame={getGame:async()=>{if(window.__fail)throw Error('fallo');return structuredClone(window.__game)},request:async()=>({})};
  window.__result=result;window.__view=window.SIDELiteDecisions.mount({gameId:'test',showScreen:id=>{document.querySelectorAll('.screen').forEach(el=>el.classList.add('hidden'));document.getElementById(id).classList.remove('hidden')}});
 });
 await page.getByRole('button',{name:'Ver noticias y resultados'}).click();
 await expect(page.locator('#studentTimerNote')).toHaveText('Procesando resultados oficiales');
 await expect(page.locator('#studentFinancialDetail')).toContainText('Aún no hay resultados oficiales');
 await page.evaluate(()=>{window.__game.cycles[0].status='closed';window.__game.results=[{company_id:'mine',number:1,decision:{quantity:20,price:20},result:window.__result},{company_id:'other',number:1,result:{...window.__result,revenue:99999}}]});
 await expect(page.locator('#studentFinancialDetail')).toContainText('Ciclo 1',{timeout:8000});
 for(const text of ['Ganancia del ciclo','Dinero disponible','Demanda potencial','Demanda sin atender','Feria local'])await expect(page.locator('#studentFinancialDetail')).toContainText(text);
 await expect(page.locator('#studentFinancialDetail')).not.toContainText('99.999');
 await page.evaluate(()=>{window.__fail=true;return window.__view.refresh()});
 await expect(page.getByRole('button',{name:'Reintentar actualización'})).toBeVisible();
 await page.evaluate(()=>{window.__fail=false;window.__game.results.push({company_id:'mine',number:2,decision:{quantity:20,price:20},result:window.__result})});
 await page.getByRole('button',{name:'Reintentar actualización'}).click();
 await expect(page.locator('#studentFinancialDetail')).toContainText('Ciclo 2');
 await expect(page.locator('#studentFinancialDetail')).toContainText('Ciclo 1');
 await expect(page.getByRole('button',{name:'Reintentar actualización'})).toBeHidden();
});
test('una consulta sin respuesta permite reintentar tras el tiempo límite',async({page})=>{
 await page.goto(base+'/index.html');
 await page.evaluate(()=>{
  window.__hang=true;
  window.SIDLiteGame={getGame:()=>window.__hang?new Promise(resolve=>window.__late=resolve):Promise.resolve({game:{name:'Prueba',code:'DEMO',cycle_count:3,costs:{basic:10,standard:20,premium:30}},company:{id:'mine',name:'Mi empresa',cash:1000,initial_capital:1000},cycles:[],ownDecision:null,ranking:[],results:[]}),request:async()=>({})};
  window.SIDELiteDecisions.mount({gameId:'test',showScreen:id=>{document.querySelectorAll('.screen').forEach(el=>el.classList.add('hidden'));document.getElementById(id).classList.remove('hidden')}});
 });
 await expect(page.getByRole('button',{name:'Reintentar actualización'})).toBeVisible({timeout:15000});
 await page.evaluate(()=>window.__hang=false);
 await page.getByRole('button',{name:'Reintentar actualización'}).click();
 await expect(page.locator('#studentFinancialDetail')).toContainText('Aún no hay resultados oficiales');
 await expect(page.getByRole('button',{name:'Reintentar actualización'})).toBeHidden();
 await page.evaluate(()=>window.__late({game:{name:'Obsoleto'},company:{id:'old',name:'Obsoleta'},cycles:[],ranking:[],results:[]}));
 await expect(page.locator('#lobbyGameName')).toHaveText('Prueba');
});
