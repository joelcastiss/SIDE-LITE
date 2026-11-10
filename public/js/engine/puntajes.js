(function(root,factory){const node=typeof module==='object'&&module.exports;const api=factory(node?require('./config_excel.js'):root.SIDE_EXCEL_CONFIG,node?require('./catalogo_excel.js'):root.SIDE_EXCEL_CATALOGO);if(node)module.exports=api;else root.SIDE_EXCEL_PUNTAJES=api;})(typeof globalThis!=='undefined'?globalThis:this,function({configurar},catalogo){

  const indice=Object.fromEntries(catalogo.map(o=>[o.codigo,o]));
  function nivel(v,overrides={}){const c=configurar(overrides);return v>=c.UMBRAL_ALTO?'Alto':v>=c.UMBRAL_MEDIO?'Medio':'Bajo';}
  function evaluarLote(lote,overrides={}){
    const c=configurar(overrides),codigos=[lote.cuero,lote.accesorios,lote.hilo,lote.molde];
    const calidad=codigos.reduce((a,k)=>a+(indice[k]?.calidad||0),0),costoUnitario=codigos.slice(0,-1).reduce((a,k)=>a+(indice[k]?.costo||0),0);
    const umbral=c.UMBRAL_SEGMENTO[lote.segmento]||0,resultado=!lote.segmento?'':calidad>=umbral?'Coherente':'No alcanza el segmento';
    const mensaje=!lote.segmento?'Elige un segmento y los insumos del lote':resultado==='Coherente'?'Este lote cumple con la calidad esperada para su segmento. Los clientes perciben el valor y el precio se sostiene.':'Este lote no alcanza la calidad que su segmento promete. Los clientes se sienten enganados: baja el precio efectivo y la reputacion.';
    return {...lote,calidad,costoUnitario,umbral,resultado,mensaje};
  }
  function calcularPuntajes({seleccion=[],codigosSeleccion=seleccion,lotes=[]},overrides={}){
    const c=configurar(overrides);if(lotes.length>c.MAX_LOTES)throw new RangeError('Máximo tres lotes por ciclo');
    const evaluados=lotes.map(l=>evaluarLote(l,overrides)),totalCantidades=evaluados.reduce((a,l)=>a+Number(l.cantidad||0),0);
    const calidadEmpresaMotor=totalCantidades?evaluados.reduce((a,l)=>a+Number(l.cantidad||0)*l.calidad,0)/totalCantidades:0;
    // El rango del Motor omite SEG, mesa, materiales, COM-05 y roles fijos.
    const permitidos=new Set(c.GRUPOS_MOTOR);
    const grupos=new Set(),p={puntajeEficiencia:0,reputacionMatriz:0,saludFinanciera:0};
    for(const codigo of codigosSeleccion){const row=indice[codigo];if(!row||!permitidos.has(row.grupo))continue;if(grupos.has(row.grupo))throw new RangeError('Elige una sola opción por grupo: '+row.grupo);grupos.add(row.grupo);p.puntajeEficiencia+=row.eficiencia;p.reputacionMatriz+=row.reputacion;p.saludFinanciera+=row.financiero;}
    return {...p,lotes:evaluados,calidadEmpresaMotor,totalCantidades,costoInsumos:evaluados.reduce((a,l)=>a+Number(l.cantidad||0)*l.costoUnitario,0),niveles:{calidad:nivel(calidadEmpresaMotor,overrides),eficiencia:nivel(p.puntajeEficiencia,overrides),reputacion:nivel(p.reputacionMatriz,overrides),salud:nivel(p.saludFinanciera,overrides)}};
  }
  return {catalogo,indice,nivel,evaluarLote,calcularPuntajes};
});


