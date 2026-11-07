import test from 'node:test';
import assert from 'node:assert/strict';
import { closeCycle, EVENTS, rank, marketingFactor } from '../js/engine.js';
const base={cash:30000,costs:{basic:50,standard:80,premium:120},seed:'cycle-1',companyId:'company-1'};
const decision={quality:'basic',quantity:200,price:100,marketingAmount:0};
test('ventas y caja coinciden con las reglas',()=>{const r=closeCycle({...base,decision});assert.equal(r.purchase,10000);assert.equal(r.revenue,r.sold*100);assert.equal(r.cashEnd,30000-r.purchase+r.revenue);assert.equal(r.profit,r.revenue-r.costOfSales);});
test('rechaza compras sin saldo',()=>assert.throws(()=>closeCycle({...base,decision:{...decision,quantity:1000}}),/insuficiente/));
test('FIFO conserva inventario y valora unidades vendidas',()=>{const r=closeCycle({...base,batches:[{quantity:5,unitCost:10}],decision:{...decision,quantity:500,price:1000}});assert.ok(r.sold>=5);assert.equal(r.costOfSales,50+(r.sold-5)*50);assert.equal(r.inventory.reduce((a,b)=>a+b.quantity,0),505-r.sold);});
test('sin decisión no compra ni gasta ni vende',()=>{const r=closeCycle({...base,batches:[{quantity:3,unitCost:10}]});assert.equal(r.cashEnd,base.cash);assert.equal(r.sold,0);assert.equal(r.inventory[0].quantity,3)});
test('hay decisiones con utilidad positiva y negativa',()=>{assert.ok(closeCycle({...base,decision}).profit>0);assert.ok(closeCycle({...base,decision:{...decision,price:1,marketingAmount:10000}}).profit<0)});
test('eventos comunes afectan compra o demanda y son reproducibles',()=>{assert.equal(EVENTS.length,12);const a=closeCycle({...base,decision,event:'cost_freight'});assert.equal(a.unitCost,55);assert.deepEqual(a,closeCycle({...base,decision,event:'cost_freight'}));assert.ok(closeCycle({...base,decision,event:'demand_fair'}).demand>closeCycle({...base,decision,event:'demand_slow'}).demand)});
test('ranking usa rentabilidad patrimonial y desempata por caja',()=>{const r=rank([{name:'A',cash:60000,inventoryValue:0,initialCapital:30000},{name:'B',cash:100000,inventoryValue:0,initialCapital:100000}]);assert.equal(r[0].name,'A')});

test('marketing monetario válido y gasto real',()=>{for (const amount of [0,200,2500,10000]) {const r=closeCycle({...base,decision:{...decision,marketingAmount:amount}});assert.equal(r.marketing,amount);assert.equal(r.cashEnd,base.cash-r.purchase-amount+r.revenue);}});
test('marketing rechaza valores inválidos y saldo insuficiente',()=>{for(const amount of [-1,1,199,10001,200.5,NaN]) assert.throws(()=>marketingFactor(amount));assert.throws(()=>closeCycle({...base,cash:10000,decision:{...decision,marketingAmount:200}}),/insuficiente/);});
test('marketing crece con rendimientos decrecientes y no asegura utilidad',()=>{assert.ok(marketingFactor(200)<marketingFactor(2500));assert.ok(marketingFactor(2500)<marketingFactor(10000));assert.ok(marketingFactor(2000)-marketingFactor(1000)>marketingFactor(10000)-marketingFactor(9000));assert.ok(closeCycle({...base,decision:{...decision,price:1,marketingAmount:10000}}).profit<0);});

test('inventario y caja se arrastran durante partidas de tres y seis ciclos',()=>{for(const cycles of [3,6]){let cash=30000,batches=[];for(let i=0;i<cycles;i++){const r=closeCycle({...base,cash,batches,seed:`cycle-${i}`,decision:{...decision,quantity:250,price:200}});assert.equal(r.cashStart,cash);assert.equal(r.inventory.reduce((n,b)=>n+b.quantity,0),batches.reduce((n,b)=>n+b.quantity,0)+250-r.sold);cash=r.cashEnd;batches=r.inventory;}assert.ok(batches.length>0);}});
