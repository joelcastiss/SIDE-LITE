import { test, expect } from '@playwright/test';
import express from 'express';
let server, base;
test.beforeAll(async () => {
 const app=express();
 app.get('/fixture',(_req,res)=>res.type('html').send(`<!doctype html><html><body><select id="lab-game"></select><select id="lab-company"></select><select id="lab-cycle"></select><button id="lab-refresh">Actualizar</button><button data-lab-tab="results">Resultados</button><button data-lab-tab="scenario">Escenario</button><button data-lab-tab="compare">Comparar</button><p id="lab-status"></p><div id="lab-content"></div><script type="module" src="/js/lite-laboratory.js"></script></body></html>`));
 app.use(express.static('public'));
 server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s))});base=`http://127.0.0.1:${server.address().port}`;
});
test.afterAll(async()=>{if(server)await new Promise(resolve=>server.close(resolve))});
test('consulta cierres y simula cuatro decisiones sin modificar el resultado oficial',async({page})=>{
 await page.addInitScript(()=>{
  window.calls=[];window.SIDLiteGame={request:async(path,method,body)=>{window.calls.push({path,method,body});
   if(path==='/games')return [{id:'game',name:'Prueba',code:'ABC'}];
   if(path.endsWith('/simulate'))return {result:{revenue:250,profit:50,cashEnd:300,sold:2,costOfSales:200,marketing:0}};
   return {cycles:[{id:'cycle',number:1}],companies:[{id:'company',name:'Empresa'}],records:[{cycle_id:'cycle',company_id:'company',decision:{quality:'basic',quantity:2,price:100,marketingAmount:0},result:{revenue:200,profit:30,cashEnd:280,sold:2,costOfSales:170,marketing:0}}]};
  }};
 });
 await page.goto(base+'/fixture');await page.evaluate(()=>document.dispatchEvent(new CustomEvent('side-lite-laboratory-open')));
 await expect(page.locator('#lab-content')).toContainText('S/ 200');await page.getByRole('button',{name:'Escenario'}).click();
 await page.locator('[name=price]').fill('125');await page.getByRole('button',{name:'Simular decisión'}).click();
 await expect(page.locator('#lite-lab-outcome')).toContainText('S/ 250');await expect(page.locator('#lite-lab-outcome')).toContainText('S/ 200');
 expect(await page.evaluate(()=>window.calls.at(-1))).toEqual({path:'/games/game/laboratory/simulate',method:'POST',body:{cycleId:'cycle',companyId:'company',decision:{quality:'basic',quantity:2,price:125,marketingAmount:0}}});
});
test('muestra la lista vacía y permite volver a consultar ante un error',async({page})=>{
 await page.addInitScript(()=>{window.fail=false;window.SIDLiteGame={request:async()=>{if(window.fail)throw new Error('Servicio no disponible');return []}}});
 await page.goto(base+'/fixture');await page.evaluate(()=>document.dispatchEvent(new CustomEvent('side-lite-laboratory-open')));
 await expect(page.locator('#lab-status')).toHaveText('No hay partidas disponibles.');await page.evaluate(()=>window.fail=true);await page.getByRole('button',{name:'Actualizar'}).click();await expect(page.locator('#lab-status')).toHaveText('Servicio no disponible');
});
