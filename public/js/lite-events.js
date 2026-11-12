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
    opportunity_visit:['Visita de compradores','Un grupo de compradores visita el mercado.','favorable','demand',6],
    "trend_luxury":["Tendencia de lujo","Crece el interés por productos prémium.","variable","custom","Cambia la preferencia por algunas calidades; la competencia influye en las ventas."],
    "trend_economy":["Moda económica","Aumenta el interés por productos básicos.","variable","custom","Cambia la preferencia por algunas calidades; la competencia influye en las ventas."],
    "prefer_quality":["Preferencia por calidad","Los compradores valoran más la calidad.","variable","custom","Cambia la preferencia por algunas calidades; la competencia influye en las ventas."],
    "price_sensitive":["Compradores sensibles al precio","Los compradores comparan más los precios.","variable","custom","Cambia la sensibilidad al precio; el resultado depende de las decisiones."],
    "viral_campaign":["Campaña viral","La publicidad llega a más personas.","variable","custom","Cambia la eficacia de la publicidad; depende de la inversión."],
    "ad_saturation":["Saturación publicitaria","La publicidad pierde eficacia.","variable","custom","Cambia la eficacia de la publicidad; depende de la inversión."],
    "recommendations":["Recomendaciones positivas","Las recomendaciones refuerzan la calidad.","variable","custom","Cambia la preferencia por algunas calidades; la competencia influye en las ventas."],
    "ad_distrust":["Desconfianza publicitaria","Los anuncios convencen menos.","variable","custom","Cambia la eficacia de la publicidad; depende de la inversión."],
    "purchasing_power_up":["Aumento del poder adquisitivo","Más compradores consideran adquirir bolsos.","variable","custom","El mercado cambia 15 %; el resultado depende de la competencia."],
    "purchasing_power_down":["Reducción del poder adquisitivo","Menos compradores disponen de presupuesto.","variable","custom","El mercado cambia -12 %; el resultado depende de la competencia."],
    "price_competition":["Competencia de precios","Los precios bajos atraen más compradores.","variable","custom","Cambia la sensibilidad al precio; el resultado depende de las decisiones."],
    "impulse_buying":["Compras impulsivas","La publicidad impulsa más compras.","variable","custom","El mercado cambia 10 %; el resultado depende de la competencia."],
    "tourism":["Afluencia turística","Más visitantes llegan al mercado.","variable","custom","El mercado cambia 15 %; el resultado depende de la competencia."],
    "entrepreneur_fair":["Feria de emprendimientos","Una feria atrae clientes a las empresas.","variable","custom","El mercado cambia 18 %; el resultado depende de la competencia."],
    "roadworks":["Obras y restricciones viales","Las obras reducen la afluencia.","variable","custom","El mercado cambia -15 %; el resultado depende de la competencia."],
    "shopping_center":["Apertura de centro comercial","Nuevos comercios compiten por los compradores.","variable","custom","El mercado cambia -10 %; el resultado depende de la competencia."],
    "supplier_clearance":["Liquidación de proveedores","El costo de compra baja.","variable","custom","El costo de compra cambia -15 %."],
    "raw_material_increase":["Aumento de materias primas","El costo de compra sube.","variable","custom","El costo de compra cambia 18 %."]
  };
  function describe(value, result){
    const id=typeof value==='string'?value:value?.id;
    if(!id && value && typeof value==='object' && (Number.isFinite(value.purchase)||Number.isFinite(value.demand))){const purchase=Number.isFinite(value.purchase), factor=purchase?value.purchase:value.demand, pct=Math.round(Math.abs(factor-1)*100);return {name:typeof value.label==='string' && value.label.trim()?value.label:'Evento del ciclo',classification:factor===1?'Neutro':((purchase?factor<1:factor>1)?'Favorable':'Desfavorable'),description:'Se registró un ajuste de mercado.',effect:purchase?`Comprar bolsos cuesta ${pct} % ${factor<1?'menos':'más'} antes del redondeo a soles.`:`La demanda potencial cambia ${pct} %; las ventas dependen del inventario.`};}
    if(!id)return {name:'Sin evento especial',classification:'Neutro',description:'No se registró un evento especial.',effect:'No hubo un ajuste por evento.'};
    const item=entries[id];
    if(!item)return {name:'Noticia del mercado',classification:'No disponible',description:'No hay información suficiente para identificar este evento.',effect:'No se puede determinar su efecto con los datos disponibles.'};
    const [name,description,classification,kind,pct]=item;
    let effect=kind==='custom'?pct:kind==='demand'?`La demanda potencial ${pct>0?'aumenta':'disminuye'} ${Math.abs(pct)} %. Las ventas efectivas también dependen del inventario disponible.`:`El costo unitario de compra ${pct>0?'aumenta':'disminuye'} ${Math.abs(pct)} % antes del redondeo a soles; afecta únicamente las compras de este ciclo.`;
    if(result && result.demand===0 && result.sold===0 && result.purchase===0 && result.marketing===0 && result.cashStart===result.cashEnd) effect+=' Si no se confirmó una decisión, no hubo compras ni ventas.';
    return {name,description,classification:classification[0].toUpperCase()+classification.slice(1),effect};
  }
  function text(value,result){const e=describe(value,result);return `${e.name} · ${e.classification}. ${e.description} ${e.effect}`;}
  root.SIDELiteEvents=Object.freeze({describe,text,ids:Object.freeze(Object.keys(entries))});
})(globalThis);
