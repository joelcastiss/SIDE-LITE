import {test} from 'node:test';
import assert from 'node:assert/strict';
import {EVENTS,closeCycle} from '../js/engine.js';
import '../public/js/lite-events.js';

test('catálogo explica todos los eventos y sus efectos reales',()=>{
 assert.deepEqual([...globalThis.SIDELiteEvents.ids].sort(),EVENTS.map(e=>e.id).sort());
 for(const event of EVENTS){
  const text=globalThis.SIDELiteEvents.text(event.id);
  const factor=event.demand??event.purchase;
  assert.match(text,new RegExp(Math.round(Math.abs(factor-1)*100)+' %'));
  assert.ok(!text.includes(event.id));
  assert.match(text,event.demand?/demanda potencial/i:/costo unitario/i);
  const result=closeCycle({cash:100000,batches:[],costs:{standard:80},event:event.id,seed:'seed',companyId:'empresa',decision:{quality:'standard',quantity:10,price:100,marketingAmount:0}});
  assert.equal(result.event.id,event.id);
  assert.equal(globalThis.SIDELiteEvents.text(result.event),text);
 }
 assert.match(globalThis.SIDELiteEvents.text(null),/Neutro/);
 assert.match(globalThis.SIDELiteEvents.text({label:'Feria local',demand:1.15}),/Feria local.*15 %/);
 assert.match(globalThis.SIDELiteEvents.text({purchase:0.9}),/Evento del ciclo.*10 % menos/);
 assert.ok(!globalThis.SIDELiteEvents.text('evento_desconocido').includes('evento_desconocido'));
});
