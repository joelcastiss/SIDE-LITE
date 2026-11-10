(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./config_excel.js'):root.SIDE_EXCEL_CONFIG);if(typeof module==='object'&&module.exports)module.exports=api;else root.SIDE_EXCEL_CONSECUENCIAS=api;})(typeof globalThis!=='undefined'?globalThis:this,function({configurar}){

  const TEXTOS={
  "CONS-01": "Posicionaste tu marca como premium, pero tus materiales e insumos no lo respaldan. Los clientes se sienten enganados y las devoluciones aumentan.",
  "CONS-02": "Tu producto cumple con los estandares premium. Los clientes perciben el valor y pagan sin problema el precio elevado.",
  "CONS-03": "Tu equipo no dio abasto con el volumen que planeaste. Hubo retrasos y entregaste menos de lo prometido.",
  "CONS-04": "Tu marca empieza a perder terreno. Los clientes prefieren a la competencia.",
  "CONS-05": "Tu situacion financiera es riesgosa. El banco te ofrece condiciones menos favorables la proxima vez.",
  "CONS-06": "Intentaste producir mas de lo que tu planta soporta. Hubo cuellos de botella y tuviste que pagar horas extra para cumplir.",
  "CONS-07": "Produjiste mas de lo que el mercado te pidio. Te quedaste con inventario sin vender.",
  "CONS-08": "Sin jefatura que coordine, tu equipo perdio tiempo resolviendo conflictos de tareas."
};
  function evaluarConsecuencias(estado,historial={},overrides={}){
    const c=configurar(overrides),r=c.CONSECUENCIAS,p=estado.puntajes||estado,mensajes=[],add=id=>mensajes.push({id,texto:TEXTOS[id]});
    let reputacionCambio=0;const activos=new Set();
    const precios=(estado.lotes||p.lotes||[]).map(l=>{let factor=1;if(l.segmento==='SEG-03'&&Number(l.cantidad)>0){if(l.calidad<r.CALIDAD_BAJA){factor=r.PRECIO_BAJO;activos.add('CONS-01');}else if(l.calidad>=r.CALIDAD_PREMIUM){factor=r.PRECIO_PREMIUM;activos.add('CONS-02');}}return factor;});
    if(activos.has('CONS-01')){add('CONS-01');reputacionCambio-=r.REPUTACION_CAMBIO;}if(activos.has('CONS-02')){add('CONS-02');reputacionCambio+=r.REPUTACION_CAMBIO;}
    let factorProduccion=1;if(p.puntajeEficiencia<r.EFICIENCIA_BAJA){add('CONS-03');factorProduccion*=r.PRODUCCION_BAJA;}
    if(!estado.jefes&&p.puntajeEficiencia<r.EFICIENCIA_SIN_JEFE){add('CONS-08');factorProduccion=c.CONS08_MODO==='multiplicativo'?factorProduccion*r.PRODUCCION_SIN_JEFE:factorProduccion-(1-r.PRODUCCION_SIN_JEFE);}
    const reputacionFinal=p.reputacionMatriz+reputacionCambio;
    const ciclosReputacionBaja=reputacionFinal<r.REPUTACION_BAJA?Number(historial.ciclosReputacionBaja||0)+1:0;
    const demandaBaja=ciclosReputacionBaja>=r.CICLOS_REPUTACION;if(demandaBaja)add('CONS-04');
    const tasaAdicionalPP=p.saludFinanciera<r.SALUD_BAJA?c.TEA_ADICIONAL_PP:0;if(tasaAdicionalPP)add('CONS-05');
    // Matriz_Consecuencias!C7 compara cantidad producida, no la meta deseada.
    // Una evaluación parcial (p. ej. solo demanda) no supone capacidad cero.
    const tieneProduccion=estado.producido!==null&&estado.producido!==undefined&&Number.isFinite(Number(estado.producido));
    const tieneCapacidad=estado.capacidad!==null&&estado.capacidad!==undefined&&Number.isFinite(Number(estado.capacidad));
    const exceso=tieneProduccion&&tieneCapacidad?Math.max(0,Number(estado.producido)-Number(estado.capacidad)):0;if(exceso)add('CONS-06');
    const sinVender=estado.demanda===undefined?0:Math.max(0,Number(estado.producido||0)-Number(estado.demanda||0));if(sinVender)add('CONS-07');
    return {efectos:{precios,reputacionCambio,reputacionFinal,factorProduccion,factorDemanda:demandaBaja?r.DEMANDA_BAJA:1,tasaAdicionalPP,ciclosReputacionBaja,costoHorasExtra:exceso?c.HORAS_EXTRA_PCT*Number(estado.costoMOciclo||0)*Math.min(1,estado.capacidad?exceso/estado.capacidad:1):0,costoAlmacenaje:sinVender*c.COSTO_ALMACENAJE_UNIDAD},mensajes};
  }
  return {TEXTOS,evaluarConsecuencias};
});


