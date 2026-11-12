import test from 'node:test';
import assert from 'node:assert/strict';
import {allocateDistrictDemand} from '../js/market-engine-v3.js';
const decision=(quality,price,marketingAmount=0)=>({quality,price,marketingAmount});
test('empresas comparten consumidores finitos y diferencias de precio y calidad influyen',()=>{
 const result=allocateDistrictDemand({baseDemand:900,shares:[.5,.35,.15],companies:[{id:'a',decision:decision('basic',60)},{id:'b',decision:decision('premium',140)},{id:'c',decision:decision('standard',90)},{id:'d',decision:decision('basic',100)}]});
 assert.ok(Object.values(result).reduce((a,b)=>a+b,0)<=900);assert.ok(Object.values(result).every(x=>x>0));assert.ok(result.a>result.d);
});
test('preferencias y marketing modifican la distribución sin eliminar productos',()=>{
 const companies=[{id:'b',decision:decision('basic',100)},{id:'p',decision:decision('premium',100)}];
 const basic=allocateDistrictDemand({baseDemand:900,shares:[.7,.2,.1],companies});
 const premium=allocateDistrictDemand({baseDemand:900,shares:[.1,.2,.7],companies});
 assert.ok(basic.b>premium.b);assert.ok(premium.p>basic.p);assert.ok(basic.p>0 && premium.b>0);
 const promoted=allocateDistrictDemand({baseDemand:900,shares:[.7,.2,.1],companies:[companies[0],{id:'p',decision:decision('premium',100,10000)}]});
 assert.ok(promoted.p>basic.p);
});
test('no hay ventas para decisiones ausentes y se rechazan entradas inválidas',()=>{
 assert.deepEqual(allocateDistrictDemand({baseDemand:10,shares:[.3,.4,.3],companies:[{id:'a'}]}),{a:0});
 assert.throws(()=>allocateDistrictDemand({baseDemand:10,shares:[.3,.4,.2],companies:[]}));
 assert.throws(()=>allocateDistrictDemand({baseDemand:10,shares:[.3,.4,.3],companies:[{id:'a'},{id:'a'}]}));
});
