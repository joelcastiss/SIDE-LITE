(function(root){
  function actualizarInventario(inicial={},compras={},consumo={}){const final={};for(const codigo of new Set([...Object.keys(inicial),...Object.keys(compras),...Object.keys(consumo)])){const disponible=Number((Number(inicial[codigo]||0)+Number(compras[codigo]||0)).toPrecision(15));final[codigo]=Number((disponible-Number(consumo[codigo]||0)).toPrecision(15));if(final[codigo]<0)throw new RangeError('Inventario negativo: '+codigo);}return final;}
  const api={actualizarInventario};if(typeof module==='object'&&module.exports)module.exports=api;else root.SIDE_EXCEL_INVENTARIO=api;
})(typeof globalThis!=='undefined'?globalThis:this);

