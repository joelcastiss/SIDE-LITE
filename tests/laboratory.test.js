import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {closeCycle} from '../js/engine.js';
import {simulateLaboratory,laboratoryLineChart} from '../public/laboratory.js';

test('el laboratorio utiliza una copia idéntica del motor y no modifica el inventario',async()=>{
 const [original,browser]=await Promise.all([readFile(new URL('../js/engine.js',import.meta.url),'utf8'),readFile(new URL('../public/laboratory-engine.js',import.meta.url),'utf8')]);
 assert.equal(browser,original);
 const input={cash:30000,costs:{basic:50,standard:80,premium:120},inventory:[{quantity:5,unitCost:40}],event:'demand_fair',decision:{quality:'basic',quantity:10,price:100,marketingAmount:200}};
 const snapshot=structuredClone(input);const actual=simulateLaboratory(input);
 assert.deepEqual(actual,closeCycle({cash:input.cash,batches:input.inventory,costs:input.costs,event:input.event,decision:input.decision,seed:'SIDE-LITE-LABORATORIO-LOCAL',companyId:'empresa-de-ejemplo'}));
 assert.deepEqual(input,snapshot);
});
test('el laboratorio rechaza valores inválidos y presupuesto insuficiente',()=>{
 assert.throws(()=>simulateLaboratory({decision:{quality:'basic',quantity:10,price:100,marketingAmount:100}}));
 assert.throws(()=>simulateLaboratory({cash:1,decision:{quality:'basic',quantity:10,price:100,marketingAmount:0}}));
 assert.throws(()=>simulateLaboratory({event:'inventado',decision:{quality:'basic',quantity:0,price:100,marketingAmount:0}}));
});

test('el gráfico original de evolución usa cierres reales y no une ciclos ausentes',()=>{
 const html=laboratoryLineChart('<Utilidad>',[[1,100],[2,null],[3,-50],[4,25]]);
 assert.match(html,/<svg class="lab-line-chart"/);
 assert.match(html,/&lt;Utilidad&gt;/);
 assert.match(html,/Ciclo 3:/);
 assert.equal((html.match(/stroke="#167f9d"/g)||[]).length,1);
 assert.match(laboratoryLineChart('Sin datos',[[1,null]]),/No disponible/);
});
