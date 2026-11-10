/* Costos De Producción: fórmulas U5:AD71, F54:H61 y C65:G65.
   Entradas de MP expresadas en unidades de producción; no en rollos/carretes. */
(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./config_excel.js'):root.SIDE_EXCEL_CONFIG);if(typeof module==='object'&&module.exports)module.exports=api;else root.SIDE_EXCEL_COSTOS=api;})(typeof globalThis!=='undefined'?globalThis:this,function(configApi){
  'use strict';
  const n=value=>Number.isFinite(Number(value))?Number(value):0;
  const positivo=value=>Math.max(0,n(value));
  const sumar=values=>values.reduce((total,value)=>total+n(value),0);
  // Igual que producción: Excel conserva quince cifras significativas.
  // Normalizar la suma antes de compararla evita rechazar 0.1 + 0.7 = 0.8.
  const precisionStock=(value,c)=>Number(value.toPrecision(c.PRECISION_INVENTARIO));
  const cfg=overrides=>configApi.configurar(overrides);
  const regimenValido=regimen=>regimen==='NO_MYPE'?'NO_MYPE':'MYPE';
  function descuentoAnalista(ciclo=1,overrides={}){const a=cfg(overrides).ANALISTA_BASE;return Math.max(a.descuentoMinimoPct,a.descuentoInicialPct-(Math.max(1,n(ciclo))-1)*a.reduccionPorCicloPct);}
  // Costos!D32:K33 converts purchase presentations to productive units;
  // V76:W83 prices those units and applies the literal 8% discount.
  function precioCompraMateriaPrima(codigo,{analistaCompras=false,ciclo=1}={},overrides={}){
    const c=cfg(overrides);
    if(!Object.hasOwn(c.PRECIO_MP,codigo))throw new RangeError('Materia prima desconocida: '+codigo);
    return c.PRECIO_MP[codigo]*c.CONVERSION_COMPRA[codigo]*(1-c.DESCUENTO_CANTIDAD)*(1-(analistaCompras?descuentoAnalista(ciclo,c):0)/100);
  }

  function costoLaboral(rol,nivel=1,regimen='MYPE',overrides={}){
    if(typeof rol==='object'){const entrada=rol;return costoLaboral(entrada.rol,entrada.nivel,entrada.regimen,nivel&&typeof nivel==='object'?nivel:overrides);}
    const c=cfg(overrides),r=regimenValido(regimen),sueldos=c.SUELDOS[rol];
    if(sueldos===undefined)throw new RangeError('Rol laboral desconocido: '+rol);
    const base=Array.isArray(sueldos)?n(sueldos[Number(nivel)-1]):n(sueldos);
    if(rol==='local')return {rol,nivel,regimen:r,base,essalud:0,gratificacion:0,cts:0,vacaciones:0,sumaAnual:base*c.MESES_ANIO,pagoMensual:base};
    const essalud=base*c.ESSALUD*(c.ESSALUD_ANUAL_LITERAL?1:c.MESES_ANIO);
    const gratificacion=base*c.FACTOR_GRATIFICACION[r];
    const cts=rol==='corte'&&Number(nivel)===2?base*c.FACTOR_CTS_CORTE_N2[r]:c.CTS_LITERAL[r];
    const vacaciones=base*c.FACTOR_VACACIONES[r],sumaAnual=base*c.MESES_ANIO+essalud+gratificacion+cts+vacaciones;
    return {rol,nivel,regimen:r,base,essalud,gratificacion,cts,vacaciones,sumaAnual,pagoMensual:sumaAnual/c.DIVISOR_MO[r]};
  }

  function costoMaquinaria(codigo,regimen='MYPE',opciones={},overrides={}){
    if(typeof codigo==='object'){const entrada=codigo;return costoMaquinaria(entrada.codigo,entrada.regimen,entrada,regimen&&typeof regimen==='object'?regimen:overrides);}
    const c=cfg(overrides),r=regimenValido(regimen),equipo=c.MAQUINARIA[codigo];
    if(!equipo)throw new RangeError('Maquinaria desconocida: '+codigo);
    const tasas=c.TASAS_ACTIVOS[r],adquisicion=equipo.costo,instalacion=equipo.molde?0:adquisicion*tasas.instalacion;
    const capacitacion=adquisicion*(equipo.molde?tasas.capacitacionMolde:tasas.capacitacion);
    const mantenimientoAnual=adquisicion*tasas.mantenimiento,residual=adquisicion*tasas.residual,baseDepreciable=adquisicion-residual;
    const depreciacionAnualLiteral=-baseDepreciable/equipo.vida;
    let depreciacionCiclo=-depreciacionAnualLiteral/c.MESES_ANIO*c.CICLO_EQUIVALE_A_MESES;
    const metodo=opciones.metodo||'FIN-02A';
    if(metodo==='FIN-02B')depreciacionCiclo=baseDepreciable*positivo(opciones.unidadesCiclo)/c.UNIDADES_VIDA;
    if(metodo==='FIN-02C'){
      const anio=Math.min(equipo.vida,Math.max(1,Math.ceil((positivo(opciones.ciclo)||1)*c.CICLO_EQUIVALE_A_MESES/c.MESES_ANIO)));
      const sumaDigitos=equipo.vida*(equipo.vida+1)/2;
      depreciacionCiclo=baseDepreciable*(equipo.vida-anio+1)/sumaDigitos/c.MESES_ANIO*c.CICLO_EQUIVALE_A_MESES;
    }
    return {codigo,regimen:r,adquisicion,instalacion,capacitacion,mantenimientoAnual,residual,depreciacionAnual:depreciacionAnualLiteral,
      sumaAnual:adquisicion+instalacion+capacitacion+mantenimientoAnual+depreciacionAnualLiteral,
      salidaCompra:adquisicion+instalacion+capacitacion,mantenimientoCiclo:mantenimientoAnual/c.MESES_ANIO*c.CICLO_EQUIVALE_A_MESES,depreciacionCiclo,metodo};
  }

  function consumirAlmacen({inventarioInicial={},compras={},necesidad={}}={},overrides={}){
    const c=cfg(overrides),consumoMP={},inventarioFinal={},faltantes={};
    for(const [grupo,codigos] of Object.entries(c.INSUMOS_POR_FAMILIA)){
      let restante=positivo(necesidad[grupo]);
      for(const codigo of codigos){const disponible=precisionStock(positivo(inventarioInicial[codigo])+positivo(compras[codigo]),c);consumoMP[codigo]=Math.min(disponible,restante);restante=precisionStock(restante-consumoMP[codigo],c);inventarioFinal[codigo]=precisionStock(disponible-consumoMP[codigo],c);}
      faltantes[grupo]=restante;
    }
    return {consumoMP,inventarioFinal,faltantes};
  }

  function reputacionOperativa({produccion={},consumoMP={},publicidad=0,proporcionN3}={},overrides={}){
    const c=cfg(overrides),lotes=produccion.lotes||[],total=produccion.totalProducido??sumar(lotes.map(lote=>lote.producido));
    const premium=sumar(lotes.filter(lote=>lote.molde==='INF-10').map(lote=>lote.producido));
    const proporciones={};
    for(const [grupo,codigos] of Object.entries(c.INSUMOS_POR_FAMILIA)){
      const denominador=sumar((grupo==='hilo'&&c.REPUTACION_HILO_DENOMINADOR_LITERAL?codigos.slice(1):codigos).map(codigo=>consumoMP[codigo]));
      proporciones[grupo]=denominador?positivo(consumoMP[codigos.at(-1)])/denominador:0;
    }
    const factorProduccion=total?premium/total*c.ESCALA_REPUTACION:0;
    const factorMO=n(proporcionN3??produccion.proporcionN3)*c.ESCALA_REPUTACION;
    const factorMP=sumar(Object.values(proporciones))/c.REPUTACION_FACTORES_MP*c.ESCALA_REPUTACION;
    const factorPublicidad=positivo(publicidad)/c.REPUTACION_PUBLICIDAD_DIVISOR*c.ESCALA_REPUTACION;
    return {valor:factorProduccion+factorMO+factorMP+factorPublicidad,factorProduccion,factorMO,factorMP,factorPublicidad,proporciones};
  }

  function calcularCostos(entrada={},overrides={}){
    const c=cfg(overrides),regimen=regimenValido(entrada.regimen),seleccion=entrada.seleccion||[],personal=entrada.personal||{},detallesMO=[];
    let trabajadores=0,n3=0;
    for(const area of Object.keys(c.PRODUCTIVIDAD))for(let nivel=0;nivel<c.PRODUCTIVIDAD[area].length;nivel++){
      const fila=personal[area]?.[nivel],cantidad=Array.isArray(fila)?sumar(fila.map(positivo)):positivo(fila);
      trabajadores+=cantidad;if(nivel===c.PRODUCTIVIDAD[area].length-1)n3+=cantidad;
      const detalle=costoLaboral(area,nivel+1,regimen,c);detallesMO.push({...detalle,cantidad,costo:detalle.pagoMensual*cantidad*c.CICLO_EQUIVALE_A_MESES});
    }
    for(const [rol,cantidad] of [['jefatura',positivo(entrada.jefes??(seleccion.includes('RH-10A')?1:0))],['limpieza',entrada.limpieza===false?0:1],['local',entrada.local===false?0:1]]){
      const detalle=costoLaboral(rol,1,regimen,c);detallesMO.push({...detalle,cantidad,costo:detalle.pagoMensual*cantidad*c.CICLO_EQUIVALE_A_MESES});
    }
    const costoMOciclo=sumar(detallesMO.map(detalle=>detalle.costo));
    const metodo=(c.GRUPOS_MOTOR.includes('Método de depreciación')&&seleccion.find(codigo=>/^FIN-02[ABC]$/.test(codigo)))||'FIN-02A';
    const detallesMaquinaria=Object.entries(entrada.maquinaria||{}).filter(([,cantidad])=>positivo(cantidad)>0).map(([codigo,cantidad])=>({...costoMaquinaria(codigo,regimen,{metodo,unidadesCiclo:entrada.produccion?.totalProducido,ciclo:entrada.ciclo},c),cantidad:positivo(cantidad)}));
    const mantenimientoAnual=sumar(detallesMaquinaria.map(detalle=>detalle.mantenimientoAnual*detalle.cantidad));
    const costoPoliticaMantenimiento=Object.hasOwn(entrada,'mantenimientoPreventivo')?(entrada.mantenimientoPreventivo?c.COSTO_MANTENIMIENTO_BASE:0):c.GRUPOS_MOTOR.includes('Mantenimiento de maquinaria')?sumar(seleccion.filter(codigo=>Object.hasOwn(c.COSTO_POLITICA_MANTENIMIENTO,codigo)).map(codigo=>c.COSTO_POLITICA_MANTENIMIENTO[codigo])):0;
    const costoMantenimiento=sumar(detallesMaquinaria.map(detalle=>detalle.mantenimientoCiclo*detalle.cantidad))+costoPoliticaMantenimiento;
    const depreciacion=sumar(detallesMaquinaria.map(detalle=>detalle.depreciacionCiclo*detalle.cantidad));
    const compras=entrada.compras||{},inicial=entrada.inventarioInicial||{};
    const almacen=consumirAlmacen({inventarioInicial:inicial,compras,necesidad:entrada.necesidadMP||{}},c);
    const consumoMP=entrada.consumoMP||almacen.consumoMP,detallesMP=[];
    const descuentoAnalistaPct=entrada.analistaCompras?descuentoAnalista(entrada.ciclo,c):0;
    const factorDescuento=(1-c.DESCUENTO_CANTIDAD)*(seleccion.includes('INS-09A')?1-c.DESCUENTO_PROVEEDOR_UNICO:1)*(seleccion.includes('INS-10A')?1-c.DESCUENTO_CONTADO:1)*(1-descuentoAnalistaPct/100);
    for(const [codigo,precio] of Object.entries(c.PRECIO_MP)){
      const comprado=positivo(compras[codigo]),inventarioInicial=positivo(inicial[codigo]),consumido=positivo(consumoMP[codigo]);
      const disponible=precisionStock(comprado+inventarioInicial,c);
      if(consumido>disponible)throw new RangeError('Consumo superior al inventario disponible: '+codigo);
      const inventarioFinal=precisionStock(disponible-consumido,c);
      detallesMP.push({codigo,precio,comprado,inventarioInicial,consumido,inventarioFinal,valorComprado:comprado*precio,valorConsumido:consumido*precio,valorInventario:inventarioFinal*precio});
    }
    if(c.VALORIZACION_MP_MODO==='excel_literal'){
      if(!entrada.consumoValorizado)throw new TypeError('El modo excel_literal requiere consumoValorizado explícito.');
      for(const detalle of detallesMP){const usado=positivo(entrada.consumoValorizado[detalle.codigo]),disponible=precisionStock(detalle.comprado+detalle.inventarioInicial,c);if(usado>disponible)throw new RangeError('Valorización superior al stock: '+detalle.codigo);detalle.valorConsumido=usado*detalle.precio;detalle.valorInventario=precisionStock(disponible-usado,c)*detalle.precio;}
    }
    const valorComprado=sumar(detallesMP.map(detalle=>detalle.valorComprado)),valorConsumido=sumar(detallesMP.map(detalle=>detalle.valorConsumido)),valorInventario=sumar(detallesMP.map(detalle=>detalle.valorInventario));
    const valorCompradoNeto=valorComprado*factorDescuento,valorConsumidoNeto=valorConsumido*factorDescuento,valorInventarioNeto=valorInventario*factorDescuento;
    const reputacion=reputacionOperativa({produccion:entrada.produccion,consumoMP,publicidad:Object.hasOwn(entrada,'marketingNivel')?(c.MARKETING_BASE[entrada.marketingNivel]?.costo||0):entrada.publicidad,proporcionN3:entrada.produccion?.proporcionN3??(trabajadores?n3/trabajadores:0)},c);
    const costoMP=valorConsumidoNeto,costoPublicidad=Object.hasOwn(entrada,'marketingNivel')?(c.MARKETING_BASE[entrada.marketingNivel]?.costo||0):positivo(entrada.publicidad),costoAnalistaCompras=entrada.analistaCompras?c.ANALISTA_BASE.costo:0,costoAlmacenaje=positivo(entrada.unidadesSinVender)*c.COSTO_ALMACENAJE_UNIDAD,costoHorasExtra=positivo(entrada.costoHorasExtra);
    const costoLeadTime=seleccion.includes('INS-11A')?valorCompradoNeto*c.LEAD_TIME_SOBRECOSTO:0;
    return {costoMOciclo,costoMantenimiento,costoPoliticaMantenimiento,mantenimientoAnual,depreciacion,costoMP,valorComprado,valorConsumido,valorInventario,
      valorCompradoNeto,valorConsumidoNeto,valorInventarioNeto,factorDescuento,costoPublicidad,costoAnalistaCompras,descuentoAnalistaPct,costoAlmacenaje,costoHorasExtra,costoLeadTime,
      reputacionOperativa:reputacion.valor,reputacion,consumoMP,inventarioFinal:Object.fromEntries(detallesMP.map(detalle=>[detalle.codigo,detalle.inventarioFinal])),
      totalCostos:costoMOciclo+costoMantenimiento+depreciacion+costoMP+costoPublicidad+costoAnalistaCompras+costoAlmacenaje+costoHorasExtra+costoLeadTime,
      detalles:{manoObra:detallesMO,maquinaria:detallesMaquinaria,materiaPrima:detallesMP}};
  }
  return {calcularCostos,costoLaboral,costoMaquinaria,consumirAlmacen,reputacionOperativa,descuentoAnalista,precioCompraMateriaPrima};
});
