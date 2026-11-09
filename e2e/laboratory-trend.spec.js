import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';

test('laboratorio muestra evolución original solo de ciclos cerrados',async({page})=>{
 const files={'/laboratory.js':await readFile(new URL('../public/laboratory.js',import.meta.url)),'/laboratory-engine.js':await readFile(new URL('../public/laboratory-engine.js',import.meta.url))};
 await page.route('http://lab.side.test/**',async route=>{const path=new URL(route.request().url()).pathname;if(path==='/')return route.fulfill({contentType:'text/html',body:'<main id="lab"></main><script type="module">import {renderLaboratory} from "/laboratory.js";window.renderLab=renderLaboratory;</script>'});const body=files[path];return body?route.fulfill({contentType:'application/javascript',body}):route.fulfill({status:404,body:''})});
 await page.goto('http://lab.side.test/');await page.waitForFunction(()=>!!window.renderLab);
 await page.evaluate(()=>window.renderLab(document.querySelector('#lab'),{game:{code:'PRUEBA'},companies:[{id:'a',name:'Empresa de prueba'}],cycles:[{number:1,status:'closed'},{number:2,status:'closed'},{number:3,status:'open'}],results:[{number:1,company_id:'a',result:{profit:100,revenue:300,costOfSales:100,marketing:100,sold:2,demand:2,cashEnd:30000,inventory:[]}},{number:2,company_id:'a',result:{profit:-50,revenue:150,costOfSales:100,marketing:100,sold:1,demand:1,cashEnd:29950,inventory:[]}},{number:3,company_id:'a',result:{profit:999,revenue:999,costOfSales:0,marketing:0,sold:1,demand:1,cashEnd:99999,inventory:[]}}]}));
 await page.getByRole('button',{name:'Evolución'}).click();const chart=page.locator('.lab-line-chart');await expect(chart).toBeVisible();await expect(chart.locator('circle')).toHaveCount(2);await expect(chart.locator('title').first()).toContainText('Ciclo 1');await expect(chart.locator('title').last()).toContainText('Ciclo 2');await expect(page.locator('#lab-cycle option')).toHaveCount(3);
});
