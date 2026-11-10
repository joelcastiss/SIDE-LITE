(function(root,factory){const node=typeof module==='object'&&module.exports;const api=factory(node?require('./config_excel.js'):root.SIDE_EXCEL_CONFIG);if(node)module.exports=api;else root.SIDE_EXCEL_CAJA=api;})(typeof globalThis!=='undefined'?globalThis:this,function(C){
  'use strict';
  const numero=v=>Number.isFinite(Number(v))?Number(v):0;
  const copiar=v=>JSON.parse(JSON.stringify(v));
  function sembrarTransicion(historial,empresas){
    const out=copiar(historial||{});
    for(const empresa of empresas){const id=String(empresa.id),t=empresa.envelope?.transicion;if(!out[id]&&t)out[id]=copiar(t);}
    return out;
  }
  /** Único registro monetario del cierre. El ledger anterior queda fuera del
   * modelo una vez activado; baseCaja permite una transición explícita. */
  function adjuntarCaja(cierre,{capitalPorEmpresa={},baseCajaPorEmpresa={},historialAnterior={},ajustesCapitalPorEmpresa={},overrides={}}={}){
    const cfg=C.configurar(overrides);
    const out=copiar(cierre);
    for(const [id,r] of Object.entries(out.resultadosPorEmpresa)){
      const h=historialAnterior[id]||{},capital=numero(capitalPorEmpresa[id]);
      const cajaInicial=numero(h.cajaFinal??baseCajaPorEmpresa[id]??capital),c=r.costos;
      const ajusteAcumulado=numero(ajustesCapitalPorEmpresa[id]??h.financialAdjustment),aporteCapital=ajusteAcumulado-numero(h.financialAdjustment);
      const maquinaria=r.decisiones.maquinaria||{},prev=h.maquinariaActivos||{},conservada={...prev};
      for(const [codigo,cantidad] of Object.entries(maquinaria))conservada[codigo]=Math.max(numero(prev[codigo]),numero(cantidad));
      const comprasActivos=(c.detalles?.maquinaria||[]).reduce((sum,d)=>sum+d.salidaCompra*Math.max(0,numero(conservada[d.codigo])-numero(prev[d.codigo])),0);
      const adquisicionNeta=(c.detalles?.maquinaria||[]).reduce((sum,d)=>sum+d.adquisicion*Math.max(0,numero(conservada[d.codigo])-numero(prev[d.codigo])),0);
      const prestamos=numero(r.financiamiento?.montoPrestamo),depreciacion=numero(c.depreciacion);
      const tasaNuevoPrestamo=Math.pow(1+numero(r.financiamiento?.tasaTEA??cfg.TEA_BASE)/100,1/cfg.MESES_ANIO)-1;
      const tasaPrevia=numero(h.tasaMensualVigente??(Math.pow(1+numero(h.teaVigente??cfg.TEA_BASE)/100,1/cfg.MESES_ANIO)-1));
      const deudaPrevia=numero(h.deudaPrincipal),interesMensual=deudaPrevia*tasaPrevia+prestamos*tasaNuevoPrestamo;
      const tasaMensual=deudaPrevia+prestamos?interesMensual/(deudaPrevia+prestamos):0;
      const intereses=cfg.PRESTAMO_COBRAR_INTERES_CICLO?interesMensual*cfg.CICLO_EQUIVALE_A_MESES:0;
      const pagosOperacion=numero(r.costosTotales)-depreciacion-numero(c.valorConsumidoNeto)+numero(c.valorCompradoNeto)+intereses;
      const cajaFinal=cajaInicial+numero(r.ingresos)+prestamos+aporteCapital-pagosOperacion-comprasActivos;
      const depAcumulada=numero(h.depreciacionAcumulada)+depreciacion,activosCosto=numero(h.activosCosto)+adquisicionNeta;
      const activosFijos=activosCosto-depAcumulada,deuda=numero(r.financiamiento?.deudaPrincipal??h.deudaPrincipal),inventarioMP=numero(c.valorInventarioNeto);
      const estadoResultados={ingresos:r.ingresos,ventasNetas:r.ingresos,costos:r.costosTotales+intereses,utilidad:r.utilidad-intereses,depreciacion,intereses,costosProduccion:r.costosTotales};
      const flujoCaja={cajaInicial,cobrosVentas:r.ingresos,pagosOperacion,compraActivos:comprasActivos,aporteCapital,financiamiento:prestamos+aporteCapital,operacion:r.ingresos-pagosOperacion,inversion:-comprasActivos,flujoNeto:cajaFinal-cajaInicial,cajaFinal};
      const balanceGeneral={efectivo:cajaFinal,activosFijos,inventarioMP,activos:cajaFinal+activosFijos+inventarioMP,deuda,patrimonio:cajaFinal+activosFijos+inventarioMP-deuda,pasivoPatrimonio:cajaFinal+activosFijos+inventarioMP};
      r.financial={estadoResultados,balanceCaja:{cajaInicial,aporteCapital,entradas:r.ingresos+prestamos+Math.max(0,aporteCapital),salidas:pagosOperacion+comprasActivos+Math.max(0,-aporteCapital),cajaFinal},flujoCaja,balanceGeneral,financiamiento:{...r.financiamiento,tasaMensual,intereses}};
      r.financial.round=out.ciclo;
      const history=[...(h.financialHistory||[]).filter(row=>Number(row.round)!==Number(out.ciclo)),copiar(r.financial)].sort((a,b)=>a.round-b.round);
      r.financial.history=history;
      Object.assign(out.historialPorEmpresa[id],{financialAdjustment:ajusteAcumulado,financialHistory:history,cajaFinal,activosCosto,depreciacionAcumulada:depAcumulada,maquinariaActivos:conservada,tasaMensualVigente:tasaMensual,teaVigente:(Math.pow(1+tasaMensual,cfg.MESES_ANIO)-1)*100});
    }
    return out;
  }
  function aplicarReporte(reporte,r){
    if(!r?.financial)return reporte;
    const f=r.financial;
    Object.assign(reporte,{ingresos:f.estadoResultados.ingresos,costos:f.estadoResultados.costos,utilidad:f.estadoResultados.utilidad,caja:f.balanceCaja.cajaFinal,balanceCaja:f.balanceCaja,flujoCaja:f.flujoCaja,balanceGeneral:f.balanceGeneral,estadoResultados:{...f.estadoResultados,excel:r}});
    return reporte;
  }
  return {adjuntarCaja,aplicarReporte,sembrarTransicion};
});
