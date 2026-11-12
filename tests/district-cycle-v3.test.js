import test from 'node:test';import assert from 'node:assert/strict';import {closeDistrictCycle} from '../js/district-cycle-v3.js';
const district={id:'comas',baseDemand:900,shares:[.55,.35,.1]},costs={basic:30,standard:50,premium:70};
test('cierre de distrito conserva FIFO, caja y mercado compartido',()=>{
 const companies=[{id:'a',cash:30000,batches:[{quantity:4,unitCost:10}],decision:{quality:'basic',quantity:100,price:80,marketingAmount:200}},{id:'b',cash:100000,batches:[],decision:{quality:'premium',quantity:1000,price:100,marketingAmount:0}}];
 const [a,b]=closeDistrictCycle({district,companies,costs,event:{purchase:.9,demand:1.1}});
 assert.ok(a.demand+b.demand<=990);assert.equal(a.sold,104);assert.equal(a.costOfSales,4*10+100*27);assert.equal(a.cashEnd,30000-2700-200+104*80);assert.equal(a.profit,a.revenue-a.costOfSales-a.marketing);assert.ok(b.sold<=b.demand);assert.equal(companies[0].batches[0].quantity,4);
});
test('sin decisión no vende ni pierde inventario y rechaza caja insuficiente',()=>{
 const [x]=closeDistrictCycle({district,costs,companies:[{id:'x',cash:100,batches:[{quantity:2,unitCost:5}]}]});assert.equal(x.sold,0);assert.equal(x.cashEnd,100);assert.deepEqual(x.inventory,[{quantity:2,unitCost:5}]);
 assert.throws(()=>closeDistrictCycle({district,costs,companies:[{id:'x',cash:10,decision:{quality:'basic',quantity:1,price:100,marketingAmount:0}}]}),/Caja insuficiente/);
});
