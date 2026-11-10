/* Inventory-aware deterministic production by productive day. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.SIDE_TEMPORAL_PRODUCTION=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const recipes={basic:{leather:0.3,accessories:1,thread:6},medium:{leather:0.4,accessories:1,thread:7},premium:{leather:0.7,accessories:1,thread:13}};
 function calculate({opening={},receipts=[],targets={},molds={},dailyCapacity,efficiency=1,startDay=0,days=30}){
  if(!Number.isFinite(dailyCapacity)||dailyCapacity<0||!Number.isFinite(efficiency)||efficiency<0||!Number.isInteger(days)||days<1||!Number.isInteger(startDay)||startDay<0)throw new RangeError('Capacidad o calendario inválido');
  const stock=Object.fromEntries(['leather','accessories','thread'].map(k=>{const v=opening[k]??0;if(!Number.isFinite(v)||v<0)throw new RangeError('Inventario inválido');return [k,v];}));
  const pending=[...receipts].sort((a,b)=>a.day-b.day||String(a.id).localeCompare(String(b.id),'en'));
  const seen=new Set();for(const r of pending){if(!r.id||seen.has(r.id)||!Object.hasOwn(stock,r.material)||!Number.isInteger(r.day)||r.day<startDay||!Number.isFinite(r.quantity)||r.quantity<0)throw new RangeError('Recepción inválida');seen.add(r.id);}
  const remaining={},produced={},consumed={leather:0,accessories:0,thread:0},windows=[];for(const k of Object.keys(recipes)){if(!Number.isInteger(targets[k]??0)||(targets[k]??0)<0)throw new RangeError('Meta inválida');remaining[k]=targets[k]??0;produced[k]=0;}
  let usedCapacity=0;
  for(let d=0;d<days;d++){
   const day=startDay+d,arrivals=pending.filter(r=>r.day===day);for(const r of arrivals)stock[r.material]+=r.quantity;
   const capacity=Math.max(0,Math.floor((d+1)*dailyCapacity*efficiency+1e-9)-usedCapacity);let free=capacity;
   for(const [id,recipe] of Object.entries(recipes)){
    if(!molds[id])continue;
    const q=Math.max(0,Math.min(remaining[id],free,...Object.entries(recipe).map(([k,v])=>Math.floor((stock[k]+1e-9)/v))));
    remaining[id]-=q;produced[id]+=q;free-=q;
    for(const [k,v] of Object.entries(recipe)){const amount=q*v;stock[k]=Number((stock[k]-amount).toFixed(9));consumed[k]=Number((consumed[k]+amount).toFixed(9));}
   }
   // Unused capacity expires at the end of the day.
   usedCapacity=Math.floor((d+1)*dailyCapacity*efficiency+1e-9);
   windows.push({day,capacity,produced:capacity-free,receipts:arrivals.map(r=>r.id)});
  }
  return {produced,consumed,stock,windows,pending:pending.filter(r=>r.day>=startDay+days)};
 }
 // SKU-level physical accounting for the temporal preview. The configured
 // SKU order is deterministic and matches the existing family substitution order.
 function calculateBySku({opening={},receipts=[],skuFamilies={},targets={},molds={},dailyCapacity,efficiency=1,startDay=0,days=30}){
  if(!Number.isFinite(dailyCapacity)||dailyCapacity<0||!Number.isFinite(efficiency)||efficiency<0||!Number.isInteger(days)||days<1||!Number.isInteger(startDay)||startDay<0)throw new RangeError('Capacidad o calendario inválido');
  const skus=Object.keys(skuFamilies),stock={},consumedBySku=Object.fromEntries(skus.map(id=>[id,0]));
  for(const sku of Object.keys(opening))if(!Object.hasOwn(skuFamilies,sku))throw new RangeError('SKU de inventario desconocido');
  for(const sku of skus){const value=opening[sku]??0;if(!Number.isFinite(value)||value<0||!['leather','accessories','thread'].includes(skuFamilies[sku]))throw new RangeError('Inventario o familia inválida');stock[sku]=value;}
  const arrivals=[...receipts].sort((a,b)=>a.day-b.day||String(a.id).localeCompare(String(b.id),'en')),seen=new Set();
  for(const r of arrivals){if(!r.id||seen.has(r.id)||!Object.hasOwn(skuFamilies,r.sku)||!Number.isInteger(r.day)||r.day<startDay||!Number.isFinite(r.quantity)||r.quantity<0)throw new RangeError('Recepción inválida');seen.add(r.id);}
  const remaining={},produced={},consumed={leather:0,accessories:0,thread:0},windows=[],consumedByModelSku=Object.fromEntries(Object.keys(recipes).map(id=>[id,{}]));
  for(const id of Object.keys(recipes)){const q=targets[id]??0;if(!Number.isInteger(q)||q<0)throw new RangeError('Meta inválida');remaining[id]=q;produced[id]=0;}
  let priorCapacity=0;
  for(let d=0;d<days;d++){
   const day=startDay+d,received=arrivals.filter(r=>r.day===day);for(const r of received)stock[r.sku]+=r.quantity;
   const cumulative=Math.floor((d+1)*dailyCapacity*efficiency+1e-9),capacity=Math.max(0,cumulative-priorCapacity);priorCapacity=cumulative;let free=capacity;
   const dailyConsumption={};
   for(const [id,recipe] of Object.entries(recipes)){
    if(!molds[id])continue;
    const limits=Object.entries(recipe).map(([family,qty])=>Math.floor((skus.filter(sku=>skuFamilies[sku]===family).reduce((sum,sku)=>sum+stock[sku],0)+1e-9)/qty));
    const q=Math.max(0,Math.min(remaining[id],free,...limits));remaining[id]-=q;produced[id]+=q;free-=q;
    for(const [family,perUnit] of Object.entries(recipe)){
     let need=Number((q*perUnit).toFixed(9));consumed[family]=Number((consumed[family]+need).toFixed(9));
     for(const sku of skus.filter(sku=>skuFamilies[sku]===family)){
      const used=Math.min(stock[sku],need);stock[sku]=Number((stock[sku]-used).toFixed(9));need=Number((need-used).toFixed(9));
      consumedBySku[sku]=Number((consumedBySku[sku]+used).toFixed(9));if(used){dailyConsumption[sku]=Number(((dailyConsumption[sku]||0)+used).toFixed(9));consumedByModelSku[id][sku]=Number(((consumedByModelSku[id][sku]||0)+used).toFixed(9));}
     }
     if(need>1e-8)throw new RangeError('Consumo superior al inventario');
    }
   }
   windows.push({day,capacity,produced:capacity-free,receipts:received.map(r=>r.id),consumedBySku:dailyConsumption});
  }
  const familyStock=Object.fromEntries(['leather','accessories','thread'].map(family=>[family,skus.filter(sku=>skuFamilies[sku]===family).reduce((sum,sku)=>sum+stock[sku],0)]));
  return {produced,consumed,stock:familyStock,stockBySku:stock,consumedBySku,consumedByModelSku,windows,pending:arrivals.filter(r=>r.day>=startDay+days)};
 }
 return Object.freeze({calculate,calculateBySku,recipes});
});
