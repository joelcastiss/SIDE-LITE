(function(root){
  'use strict';
  const entries={
    demand_fair:['Feria local','Una feria atrae más compradores al mercado.','favorable', 'demand',15],
    demand_rain:['Semana lluviosa','La lluvia reduce la afluencia de compradores.','desfavorable','demand',-12],
    demand_holiday:['Temporada festiva','Las celebraciones impulsan las compras.','favorable','demand',20],
    demand_slow:['Consumo moderado','Los compradores reducen sus compras.','desfavorable','demand',-10],
    cost_discount:['Descuento del proveedor','El proveedor ofrece un descuento en los bolsos.','favorable','purchase',-10],
    cost_freight:['Flete más caro','El transporte encarece la compra de bolsos.','desfavorable','purchase',10],
    cost_offer:['Oferta de temporada','Una oferta reduce el precio de compra de los bolsos.','favorable','purchase',-5],
    cost_shortage:['Escasez de producto','La escasez encarece la compra de bolsos.','desfavorable','purchase',15],
    opportunity_social:['Difusión comunitaria','La comunidad da a conocer los productos.','favorable','demand',10],
    opportunity_market:['Mercado temporal','Un mercado temporal atrae a más compradores.','favorable','demand',12],
    opportunity_alliance:['Alianza comercial','Una alianza acerca los productos a más compradores.','favorable','demand',8],
    opportunity_visit:['Visita de compradores','Un grupo de compradores visita el mercado.','favorable','demand',6]
  };
  function describe(value, result){
    const id=typeof value==='string'?value:value?.id;
    if(!id && value && typeof value==='object' && (Number.isFinite(value.purchase)||Number.isFinite(value.demand))){const purchase=Number.isFinite(value.purchase), factor=purchase?value.purchase:value.demand, pct=Math.round(Math.abs(factor-1)*100);return {name:typeof value.label==='string' && value.label.trim()?value.label:'Evento del ciclo',classification:factor===1?'Neutro':((purchase?factor<1:factor>1)?'Favorable':'Desfavorable'),description:'Se registró un ajuste de mercado.',effect:purchase?`Comprar bolsos cuesta ${pct} % ${factor<1?'menos':'más'} antes del redondeo a soles.`:`La demanda potencial cambia ${pct} %; las ventas dependen del inventario.`};}
    if(!id)return {name:'Sin evento especial',classification:'Neutro',description:'No se registró un evento especial.',effect:'No hubo un ajuste por evento.'};
    const item=entries[id];
    if(!item)return {name:'Noticia del mercado',classification:'No disponible',description:'No hay información suficiente para identificar este evento.',effect:'No se puede determinar su efecto con los datos disponibles.'};
    const [name,description,classification,kind,pct]=item;
    let effect=kind==='demand'?`La demanda potencial ${pct>0?'aumenta':'disminuye'} ${Math.abs(pct)} %. Las ventas efectivas también dependen del inventario disponible.`:`El costo unitario de compra ${pct>0?'aumenta':'disminuye'} ${Math.abs(pct)} % antes del redondeo a soles; afecta únicamente las compras de este ciclo.`;
    if(result && result.demand===0 && result.sold===0 && result.purchase===0 && result.marketing===0 && result.cashStart===result.cashEnd) effect+=' Si no se confirmó una decisión, no hubo compras ni ventas.';
    return {name,description,classification:classification[0].toUpperCase()+classification.slice(1),effect};
  }
  function text(value,result){const e=describe(value,result);return `${e.name} · ${e.classification}. ${e.description} ${e.effect}`;}
  root.SIDELiteEvents=Object.freeze({describe,text,ids:Object.freeze(Object.keys(entries))});
})(globalThis);
