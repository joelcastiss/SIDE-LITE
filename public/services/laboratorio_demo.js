(function(g){'use strict';
// Datos de enseñanza deliberadamente ficticios, solo activados por elección local.
if(!['localhost','127.0.0.1','::1'].includes(g.location.hostname))return;
const company=(produced,sold,revenue,cost,op,tax,target)=>({receipt:{produced,sold,revenue,production:{target}},financial:{estadoResultados:{ingresos:revenue,costoVentas:cost,gastosOperacion:op,gastosFinancieros:0,ingresosFinancieros:0,impuestoRenta:tax,utilidadAntesImpuestos:revenue-cost-op,utilidadNeta:revenue-cost-op-tax},balanceCaja:{cajaFinal:null}}});
const closures={1:{resultadosPorEmpresa:{'demo-a':company(48,42,8400,4000,2500,300,60),'demo-b':company(40,38,7600,3500,2400,250,55)}},2:{resultadosPorEmpresa:{'demo-a':company(70,65,13000,6100,3500,500,90),'demo-b':company(60,58,11600,5200,3400,450,80)}}};
g.SIDE_LAB_DEMO={games:async()=>[{id:'demo',nombre:'Demostración local'}],companies:async()=>[{empresa_id:'demo-a',empresa:'Empresa demostración A'},{empresa_id:'demo-b',empresa:'Empresa demostración B'}],closure:async(game,cycle)=>game==='demo'?structuredClone(closures[cycle]||null):null};
})(window);
