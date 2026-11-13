import test from 'node:test';
import assert from 'node:assert/strict';
import {rankCompanies} from '../supabase-side-lite/api/podium-ranking.js';

test('podium keeps equal grades tied and skips the next position', () => {
  const companies = [
    {id:'3', name:'Zeta', grade:'17.00'},
    {id:'2', name:'Beta', grade:'19.00'},
    {id:'1', name:'Alfa', grade:'19.00'},
    {id:'4', name:'Delta', grade:'15.00'}
  ];
  const result = rankCompanies(companies);
  assert.deepEqual(result.map(x => [x.name, x.position, x.grade]), [
    ['Alfa', 1, 19], ['Beta', 1, 19], ['Zeta', 3, 17], ['Delta', 4, 15]
  ]);
  assert.equal(companies[0].name, 'Zeta');
});
