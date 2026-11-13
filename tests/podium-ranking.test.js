import test from 'node:test';
import assert from 'node:assert/strict';
import {rankCompanies} from '../supabase-side-lite/api/podium.js';
test('ranking conserva participantes y comparte posiciones en empates',()=>{
 const result=rankCompanies([{id:'1',name:'A',grade:'17'},{id:'2',name:'B',grade:'20'},{id:'3',name:'C',grade:'20'},{id:'4',name:'D',grade:'17'}]);
 assert.deepEqual(result.map(x=>[x.name,x.grade,x.position]),[['B',20,1],['C',20,1],['A',17,3],['D',17,3]]);
});
