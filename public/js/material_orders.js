/* Deterministic receipt ledger. All quantities are in the SKU's physical unit. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.SIDE_MATERIAL_ORDERS=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const clone=value=>JSON.parse(JSON.stringify(value));
 const validQuantity=value=>typeof value==='number'&&Number.isFinite(value)&&value>=0;
 function apply(state,event){
  const next=clone(state||{orders:{},events:{},stock:{}});
  next.orders=next.orders||{};next.events=next.events||{};next.stock=next.stock||{};
  if(!event||typeof event.id!=='string'||!event.id||typeof event.orderId!=='string'||!event.orderId)throw new TypeError('Evento u orden sin identificador');
  if(next.events[event.id]){
   if(JSON.stringify(next.events[event.id])!==JSON.stringify(event))throw new RangeError('Identificador de evento reutilizado con otro contenido');
   return next;
  }
  if(event.type==='order'){
   if(next.orders[event.orderId])throw new RangeError('Orden duplicada');
   if(typeof event.sku!=='string'||!event.sku||typeof event.companyId!=='string'||!event.companyId||!validQuantity(event.quantity)||event.quantity<=0||!validQuantity(event.unitCost)||!Number.isInteger(event.orderedDay)||event.orderedDay<0||!Number.isInteger(event.leadTimeDays)||event.leadTimeDays<0)throw new RangeError('Orden inválida');
   next.orders[event.orderId]={id:event.orderId,companyId:event.companyId,sku:event.sku,quantity:event.quantity,unit:event.unit,unitCost:event.unitCost,orderedDay:event.orderedDay,leadTimeDays:event.leadTimeDays,expectedDay:event.orderedDay+event.leadTimeDays,received:0,cancelled:0,receipts:[]};
  }else{
   const order=next.orders[event.orderId];if(!order)throw new RangeError('Orden inexistente');
   if(event.companyId!==order.companyId)throw new RangeError('Empresa distinta');
   if(!validQuantity(event.quantity)||event.quantity<=0||event.quantity>order.quantity-order.received-order.cancelled+1e-9)throw new RangeError('Cantidad fuera del saldo pendiente');
   if(event.type==='receipt'){
    if(!Number.isInteger(event.day)||event.day<order.orderedDay)throw new RangeError('Fecha de recepción inválida');
    order.received+=event.quantity;order.receipts.push({id:event.id,day:event.day,quantity:event.quantity});
    next.stock[order.sku]=(next.stock[order.sku]||0)+event.quantity;
   }else if(event.type==='cancel')order.cancelled+=event.quantity;
   else throw new RangeError('Tipo de evento inválido');
  }
  next.events[event.id]=clone(event);return next;
 }
 return Object.freeze({apply});
});
