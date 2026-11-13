import {test,expect} from '@playwright/test';
async function setup(page){
 await page.setContent('<div id="detailReports"></div>');
 await page.addStyleTag({path:'public/css/lite-teacher-results.css'});
 await page.addScriptTag({path:'public/services/lite-teacher-results.js'});
}
const data={
 companies:[{id:'a',name:'Prueba Uno',district_name:'Surco'},{id:'b',name:'Prueba Dos',district_name:'Comas'},{id:'c',name:'<img onerror=alert(1)>',district_name:'Miraflores'}],
 cycles:[{id:'x1',number:1,status:'closed'},{id:'x2',number:2,status:'closed'},{id:'x3',number:3,status:'open'}],
 results:[
  {company_id:'a',number:1,result:{sold:200,revenue:30000,costOfSales:16000,profit:13500,cashEnd:53500},decision:{quality:'basic',quantity:200,price:150,marketingAmount:500}},
  {company_id:'a',number:2,result:{sold:249,revenue:37350,costOfSales:19920,profit:16430,cashEnd:69850},decision:{quality:'standard',quantity:250,price:150,marketingAmount:1000}},
  {company_id:'b',number:2,result:{sold:0,revenue:0,costOfSales:0,profit:0,cashEnd:49000},decision:null}
 ]
};
test('presenta el ciclo cerrado más reciente y permite cambiar de ciclo',async({page})=>{
 await setup(page);await page.evaluate(v=>SIDELiteTeacherResults.render(document.querySelector('#detailReports'),v),data);
 await expect(page.getByRole('heading',{name:'Ciclo 2'})).toBeVisible();
 await expect(page.getByText('S/ 37,350')).toHaveCount(2);
 await expect(page.getByText('Resultado pendiente')).toBeVisible();
 await expect(page.getByText('2 de 3')).toBeVisible();
 await page.getByLabel('Seleccionar ciclo de resultados').selectOption('1');
 await expect(page.getByRole('heading',{name:'Ciclo 1'})).toBeVisible();
 await expect(page.getByText('S/ 30,000')).toHaveCount(2);
 await page.locator('details[data-company="a"] summary').click();
 await expect(page.getByText('Cantidad planificada')).toBeVisible();
 await expect(page.locator('#detailReports img')).toHaveCount(0);
});
test('sin ciclos cerrados indica pendiente sin inventar cifras',async({page})=>{
 await setup(page);
 await page.evaluate(v=>SIDELiteTeacherResults.render(document.querySelector('#detailReports'),v),{companies:data.companies,cycles:[{number:1,status:'open'}],results:[]});
 await expect(page.getByText('Resultados pendientes')).toBeVisible();
 await expect(page.locator('.lite-result-company')).toHaveCount(0);
});
for(const width of [1366,390])test('resultado adaptado a '+width+'px',async({page})=>{
 await page.setViewportSize({width,height:844});await setup(page);
 await page.evaluate(v=>SIDELiteTeacherResults.render(document.querySelector('#detailReports'),v),data);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await expect(page.locator('.lite-result-company')).toHaveCount(3);
});
