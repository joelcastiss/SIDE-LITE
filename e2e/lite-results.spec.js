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
  await expect(page.getByText('¿Qué pasó con mi empresa?')).toBeAttached();
  await expect(page.getByText(/Tu posición: 2 de 2/)).toBeAttached();
  await expect(page.getByText('Valor del inventario FIFO: S/ 50.',{exact:false})).toBeAttached();
  const panel=page.locator('#studentFinancialDetail');
  await panel.scrollIntoViewIfNeeded();
  expect(await panel.evaluate(el=>el.scrollWidth-el.clientWidth)).toBeLessThanOrEqual(1);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
  if(process.env.SIDE_VISUAL_OUTPUT){
    await page.screenshot({path:`${process.env.SIDE_VISUAL_OUTPUT}/resultados-${viewport.width}-superior.png`});
    await page.getByText('¿Qué pasó con mi empresa?').scrollIntoViewIfNeeded();
    await page.screenshot({path:`${process.env.SIDE_VISUAL_OUTPUT}/resultados-${viewport.width}-inferior.png`});
  }
  expect(errors).toEqual([]);
});
