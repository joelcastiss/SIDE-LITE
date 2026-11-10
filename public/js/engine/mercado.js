(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./config_excel.js'):root.SIDE_EXCEL_CONFIG);if(typeof module==='object'&&module.exports)module.exports=api;else root.SIDE_EXCEL_MERCADO=api;})(typeof globalThis!=='undefined'?globalThis:this,function({CONFIG,excelRound,configurar}){

  function repartoMercado(empresas,segmento,overrides={},context={}){
    const c=configurar(overrides),m=c.MERCADOS[segmento];if(!m)throw new RangeError('Segmento desconocido');
    if(!empresas.length)return [];
    const precios=empresas.map(e=>Number(e.precio)||0),max=Math.max(...precios),min=Math.min(...precios);
    const sumaRep=empresas.reduce((a,e)=>a+Number(e.reputacionMercado||0),0),escala=c.ESCALA_MERCADO;
    // Costos!E118:E147 references the same absolute economic-market total D122.
    // A standalone call without the other markets uses its supplied population.
    const baseRep=context.sumaReputacionEconomico??sumaRep;
    const rows=empresas.map((e,i)=>{
      const reputacion=Number(e.reputacionMercado||0)*c.ESCALA_REPUTACION;
      const calidad=c.CALIDAD_MERCADO_MODO==='excel_literal'?excelRound(baseRep?Number(e.reputacionMercado||0)/baseRep*escala:0):excelRound(Math.min(escala,Number(e.calidadEmpresaMotor||0)*c.ESCALA_REPUTACION));
      const rawPrice=segmento==='SEG-01'?(max===min?c.PRECIO_EMPATE:escala*(max-precios[i])/(max-min)):escala-Math.abs(precios[i]-m.precioIdeal)/m.precioIdeal*escala;
      // Explicit v19 override preserves archived literal oracles unchanged.
      const puntajePrecio=overrides.VERSION==='excel-v19'?Math.max(0,Math.min(escala,rawPrice)):rawPrice;
      const puntajeTotal=m.pesos[0]*puntajePrecio+m.pesos[1]*reputacion+m.pesos[2]*calidad;
      return {...e,calidadMercado:calidad,reputacionEscalada:reputacion,puntajePrecio,puntajeTotal};
    });
    const suma=rows.reduce((a,e)=>a+e.puntajeTotal,0),mercadoReal=m.unidades*m.penetracion;
    return rows.map(e=>{const porcentaje=suma?e.puntajeTotal/suma:0,asignado=excelRound(porcentaje*mercadoReal);return {...e,porcentaje,asignado,mercadoReal};});
  }
  function repartoModelo1(empresas,mercadoReal,overrides={}){
    const c=configurar(overrides);if(!empresas.length)return [];
    const max=Math.max(...empresas.map(e=>Number(e.precio)||0));
    const rows=empresas.map(e=>{const puntajePrecio=(max*c.MODELO1_MAX_MULTIPLICADOR-Number(e.precio||0))/c.MODELO1_DIVISOR;return {...e,puntajePrecio,puntajeTotal:Number(e.reputacionMercado||0)+puntajePrecio};});
    const suma=rows.reduce((a,e)=>a+e.puntajeTotal,0);return rows.map(e=>({...e,asignado:excelRound(suma?e.puntajeTotal/suma*mercadoReal:0)}));
  }
  return {repartoMercado,repartoModelo1};
});

