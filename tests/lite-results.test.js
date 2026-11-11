import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const context={window:{},Intl};
vm.runInNewContext(readFileSync('public/js/lite-results.js','utf8'),context);
const {metrics}=context.window.SIDELiteResults;

test('derives FIFO inventory and historical return from the official result',()=>{
  const m=metrics({purchase:200,unitCost:10,cashEnd:950,inventory:[{quantity:3,unitCost:8},{quantity:15,unitCost:10}]},1000);
  assert.equal(m.produced,20);assert.equal(m.unsold,18);assert.equal(m.inventory,18);assert.equal(m.value,174);assert.equal(m.returnPercent,12.4);
});

test('does not invent production or profitability when receipt information is missing',()=>{
  const m=metrics({purchase:0,unitCost:0,cashEnd:0,inventory:[]},0);
  assert.equal(m.produced,null);assert.equal(m.unsold,null);assert.equal(m.returnPercent,null);
});
