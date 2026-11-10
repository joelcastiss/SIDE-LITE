(function(root,factory){const node=typeof module==='object'&&module.exports;const api=factory(node?require('./config_excel.js'):root.SIDE_EXCEL_CONFIG,node?require('./puntajes.js'):root.SIDE_EXCEL_PUNTAJES,node?require('./produccion.js'):root.SIDE_EXCEL_PRODUCCION,node?require('./costos.js'):root.SIDE_EXCEL_COSTOS,node?require('./consecuencias.js'):root.SIDE_EXCEL_CONSECUENCIAS,node?require('./mercado.js'):root.SIDE_EXCEL_MERCADO);if(node)module.exports=api;else root.SIDE_EXCEL_CICLO=api;})(typeof globalThis!=='undefined'?globalThis:this,function(C,P,PRO,COS,CON,MER){
  'use strict';
  const copia=v=>JSON.parse(JSON.stringify(v));
  const claveLote=l=>[l.segmento,l.molde,l.cuero||'',l.accesorios||'',l.hilo||'',Number(l.precio||0)].join('|');
  function prepararEmpresa(decisiones,historial={},overrides={}){
    const maquinaria={...historial.maquinariaActivos};
    for(const [codigo,cantidad] of Object.entries(decisiones.maquinaria||{}))maquinaria[codigo]=Math.max(Number(maquinaria[codigo]||0),Number(cantidad)||0);
    decisiones={...decisiones,maquinaria};
    const c=C.configurar(overrides),puntajes=P.calcularPuntajes(decisiones,overrides);
    const produccion=PRO.calcularProduccion({...decisiones,inventarioInicial:historial.inventarioMP||decisiones.inventarioInicial||{}},overrides);
    const pre=CON.evaluarConsecuencias({puntajes,lotes:puntajes.lotes,jefes:decisiones.jefes,planeado:produccion.totalPlaneado,producido:produccion.totalProducido,capacidad:produccion.produccionCapacidad},historial,overrides);
    // El factor reduce cada lote ya limitado por capacidad y MP; solo se consume lo que se fabrica.
    for(const l of produccion.lotes){const anterior=l.producido;l.producido=C.excelRoundDown(Number((anterior*pre.efectos.factorProduccion).toPrecision(c.PRECISION_INVENTARIO)));const ratio=anterior?l.producido/anterior:0;for(const [codigo,valor] of Object.entries(l.consumoPorInsumo)){const nuevo=valor*ratio;produccion.consumoPorInsumo[codigo]-=valor-nuevo;produccion.inventarioFinal[codigo]+=valor-nuevo;l.consumoPorInsumo[codigo]=nuevo;}for(const familia of Object.keys(l.consumo)){produccion.consumoTotal[familia]-=l.consumo[familia]*(1-ratio);l.consumo[familia]*=ratio;}}
    for(const mapa of [produccion.consumoTotal,produccion.consumoPorInsumo,produccion.inventarioFinal,...produccion.lotes.flatMap(l=>[l.consumo,l.consumoPorInsumo])])for(const k of Object.keys(mapa))mapa[k]=Number(mapa[k].toPrecision(c.PRECISION_INVENTARIO));
    produccion.totalProducido=produccion.lotes.reduce((a,l)=>a+l.producido,0);
    const costos=COS.calcularCostos({...decisiones,compras:produccion.compras,consumoMP:produccion.consumoPorInsumo,inventarioInicial:produccion.inventarioInicial,produccion},overrides);
    const consecuencias=CON.evaluarConsecuencias({puntajes,lotes:puntajes.lotes,jefes:decisiones.jefes,planeado:produccion.totalPlaneado,producido:produccion.totalProducido,capacidad:produccion.produccionCapacidad,costoMOciclo:costos.costoMOciclo},historial,overrides);
    let reputacionMercado=c.REPUTACION_FUENTE_MERCADO==='motor'?puntajes.reputacionMatriz:costos.reputacionOperativa;
    if(c.REPUTACION_FUENTE_MERCADO==='excel_literal')reputacionMercado=Number(decisiones.reputacionLiteral||0);
    reputacionMercado+=consecuencias.efectos.reputacionCambio;
    return {puntajes,produccion,costos,consecuencias,reputacionMercado,reputacionMatriz:consecuencias.efectos.reputacionFinal,lotes:produccion.lotes.map((l,i)=>({...l,...puntajes.lotes[i],producido:l.producido,precioEfectivo:Number(l.precio||0)*consecuencias.efectos.precios[i]}))};
  }
  function cerrarCiclo({ciclo=1,empresas=[],decisionesPorEmpresa={},historialPorEmpresa={}},overrides={}){
    const c=C.configurar(overrides),resultadosPorEmpresa={},historialNuevo=copia(historialPorEmpresa),eliminadas=[],replicadas=[];
    for(const empresa of empresas){const id=typeof empresa==='string'?empresa:empresa.id;if(typeof empresa==='object'&&empresa.eliminada)continue;const anterior=historialPorEmpresa[id]||{};let d=decisionesPorEmpresa[id];if(!d){if(ciclo===1||!anterior.decisiones){eliminadas.push(id);historialNuevo[id]={...anterior,eliminada:true};continue;}d=copia(anterior.decisiones);replicadas.push(id);}
      if(anterior.eliminada){eliminadas.push(id);continue;}
      const r=prepararEmpresa({...d,ciclo},anterior,overrides);r.id=id;r.decisiones=copia(d);r.ciclo=ciclo;r.ventas=[];r.inventarioProductos=copia(anterior.inventarioProductos||{});
      for(const l of r.lotes){const key=claveLote(l),stock=r.inventarioProductos[key]||{...l,cantidad:0};stock.cantidad+=l.producido;r.inventarioProductos[key]=stock;}
      resultadosPorEmpresa[id]=r;
    }
    const participantesPorSegmento=Object.fromEntries(Object.keys(c.MERCADOS).map(segmento=>{
      const participantes=Object.values(resultadosPorEmpresa).flatMap(r=>{
        const lotes=r.lotes.filter(l=>l.segmento===segmento&&l.cantidad>0);const stock=Object.values(r.inventarioProductos).filter(l=>l.segmento===segmento&&l.cantidad>0);if(!lotes.length&&!stock.length)return [];
        const usados=lotes.length?lotes:stock,total=usados.reduce((a,l)=>a+l.cantidad,0);
        return [{id:r.id,precio:usados.reduce((a,l)=>a+Number(l.precio||0)*l.cantidad,0)/total,reputacionMercado:r.reputacionMercado,calidadEmpresaMotor:r.puntajes.calidadEmpresaMotor}];
      });
      return [segmento,participantes];
    }));
    // All three source tables use the economic table's absolute denominator D122.
    const sumaReputacionEconomico=(participantesPorSegmento['SEG-01']||[]).reduce((sum,r)=>sum+r.reputacionMercado,0);
    for(const [segmento,participantes] of Object.entries(participantesPorSegmento)){
      const reparto=MER.repartoMercado(participantes,segmento,overrides,{sumaReputacionEconomico});
      for(const asignacion of reparto){const r=resultadosPorEmpresa[asignacion.id];let pendiente=Math.max(0,C.excelRoundDown(asignacion.asignado*r.consecuencias.efectos.factorDemanda*((r.decisiones.seleccion||[]).includes('INV-02B')?1+c.BONO_DEMANDA_MARKETING:1)));const asignado=pendiente;
        for(const [key,stock] of Object.entries(r.inventarioProductos)){if(stock.segmento!==segmento||stock.cantidad<=0)continue;const vendido=Math.min(stock.cantidad,pendiente),actual=r.lotes.find(l=>claveLote(l)===key),precioEfectivo=actual?.precioEfectivo??stock.precioEfectivo??Number(stock.precio||0);r.ventas.push({clave:key,segmento,vendido,precioEfectivo,ingreso:vendido*precioEfectivo});stock.cantidad-=vendido;pendiente-=vendido;}
        (r.mercado||=([])).push({...asignacion,demandaAjustada:asignado});
      }
    }
    for(const [id,r] of Object.entries(resultadosPorEmpresa)){
      r.unidadesVendidas=r.ventas.reduce((a,l)=>a+l.vendido,0);r.ingresos=r.ventas.reduce((a,l)=>a+l.ingreso,0);r.inventarioSinVender=Object.values(r.inventarioProductos).reduce((a,l)=>a+l.cantidad,0);
      const extra=CON.evaluarConsecuencias({puntajes:r.puntajes,lotes:r.puntajes.lotes,jefes:r.decisiones.jefes,producido:r.produccion.totalProducido,demanda:r.unidadesVendidas},historialPorEmpresa[id]||{},overrides);
      const almacenaje=r.inventarioSinVender*c.COSTO_ALMACENAJE_UNIDAD;r.consecuencias.mensajes.push(...extra.mensajes.filter(m=>m.id==='CONS-07'));r.costos.costoAlmacenaje=almacenaje;
      const garantia=c.GRUPOS_MOTOR.includes('Garantía del producto')&&(r.decisiones.seleccion||[]).map(k=>P.indice[k]).find(o=>o?.grupo==='Garantía del producto');r.costos.costoGarantia=Object.hasOwn(r.decisiones,'garantiaDias')?0:(garantia?.costo||0)*r.unidadesVendidas;
      r.costos.detallesRecurrentes=(r.decisiones.seleccion||[]).filter(codigo=>c.CODIGOS_COSTO_RECURRENTE.includes(codigo)&&c.GRUPOS_MOTOR.includes(P.indice[codigo]?.grupo)&&!(Object.hasOwn(r.decisiones,'marketingNivel')&&P.indice[codigo]?.grupo==='Inversion en marketing')).map(codigo=>({codigo,costo:Number(P.indice[codigo]?.costo||0)*c.CICLO_EQUIVALE_A_MESES}));
      r.costos.costoDecisionesRecurrentes=r.costos.detallesRecurrentes.reduce((total,detalle)=>total+detalle.costo,0);
      r.costosTotales=r.costos.totalCostos+almacenaje+r.consecuencias.efectos.costoHorasExtra+r.costos.costoGarantia+r.costos.costoDecisionesRecurrentes;r.utilidad=r.ingresos-r.costosTotales;
      // El Excel no define calendario de cuotas: la tasa se informa al préstamo siguiente.
      const montoPrestamo=(r.decisiones.seleccion||[]).includes('FIN-01A')?Math.max(0,Number(r.decisiones.montoPrestamo)||0):0;
      const penalizacionPendiente=montoPrestamo>0?r.consecuencias.efectos.tasaAdicionalPP:Math.max(Number(historialPorEmpresa[id]?.tasaAdicionalPP||0),r.consecuencias.efectos.tasaAdicionalPP);
      r.financiamiento={montoPrestamo,tasaTEA:Number(r.decisiones.teaBase??c.TEA_BASE)+Number(historialPorEmpresa[id]?.tasaAdicionalPP||0),tasaAdicionalProximoPrestamo:penalizacionPendiente,deudaPrincipal:Number(historialPorEmpresa[id]?.deudaPrincipal||0)+montoPrestamo};
      r.puntajes.niveles.reputacion=P.nivel(r.reputacionMatriz,overrides);
      historialNuevo[id]={decisiones:copia(r.decisiones),inventarioMP:copia(r.produccion.inventarioFinal),inventarioProductos:copia(r.inventarioProductos),ciclosReputacionBaja:r.consecuencias.efectos.ciclosReputacionBaja,tasaAdicionalPP:penalizacionPendiente,deudaPrincipal:r.financiamiento.deudaPrincipal,ultimoCiclo:ciclo};
    }
    return {ciclo,resultadosPorEmpresa,historialPorEmpresa:historialNuevo,eliminadas,replicadas};
  }
  return {prepararEmpresa,cerrarCiclo,claveLote};
});


