import test from 'node:test';
import assert from 'node:assert/strict';
import {buildFinalRanking} from '../supabase-side-lite/api/final-ranking.js';

const companies = [
  {id:'a', name:'Alfa', initial_capital:100, cash:110, inventory:[]},
  {id:'b', name:'Beta', initial_capital:100, cash:105, inventory:[{quantity:1,unitCost:5}]},
  {id:'c', name:'Ceta', initial_capital:100, cash:120, inventory:[]}
];
const results = companies.map(c => ({company_id:c.id}));
test('el podio económico usa rentabilidad y caja; las notas no cambian el orden', () => {
  const ranked = buildFinalRanking({companies, results, grades:[{company_id:'b',grade:'20'}]});
  assert.deepEqual(ranked.map(x => x.companyId), ['c','a','b']);
  assert.deepEqual(ranked.map(x => x.grade), [null,null,20]);
});
test('el podio rechaza resultados incompletos o duplicados', () => {
  assert.throws(() => buildFinalRanking({companies, results:results.slice(1)}), /incompletos/);
  assert.throws(() => buildFinalRanking({companies, results:[results[0],results[0],results[2]]}), /incompletos/);
});
