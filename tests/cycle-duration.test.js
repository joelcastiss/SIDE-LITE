import test from 'node:test';
import assert from 'node:assert/strict';
import {isOfficialCycleDuration, OFFICIAL_CYCLE_SECONDS} from '../js/cycle-duration.js';

test('solo se acepta la duración oficial numérica de 120 segundos',()=>{
 assert.equal(OFFICIAL_CYCLE_SECONDS,120);
 assert.equal(isOfficialCycleDuration(120),true);
 for(const value of [0,1,30,119,121,3600,'120',null]) assert.equal(isOfficialCycleDuration(value),false);
});
