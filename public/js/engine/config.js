/* Mercados del documento Costos De Producción (27/10/2026).
 * Se conservan tarifas de canales, crédito y garantía de las funciones existentes. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else{
  root.SIDE_ECONOMIC_CONFIG=api;
  // The existing menu reads these costs; keep assumptions editable here.
  for(const item of (root.SIDE_DECISION_CATALOG||[]).flatMap(category=>category.items||[]))for(const option of item.options||[])if(Object.hasOwn(api.optionCosts,option.id))option.cost=api.optionCosts[option.id];
}})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  return Object.freeze({version:'md-20261027',
    // SUNAT tasas RMT: https://orientacion.sunat.gob.pe/7037-03-tasa-del-impuesto
    // UIT 2026, MEF: https://www.gob.pe/institucion/mef/noticias/1314665-mef-establece-en-s-5500-el-valor-de-la-uit-para-el-ano-2026 (consulta 2026-10-28).
    tax:{uit:5500,mypeLimitUit:15,mypeRate:.10,generalRate:.295},
    reputation:{smoothWithPrevious:false},
    // Empresas sintéticas derivan precio y reputación del promedio de empresas reales.
    simulatedCompetitors:{enabled:false,target:4},
    // Nueva regla comercial SIDE, no procedente del Excel.
    commercialAffinity:{esencial:{alta:.6,media:1,baja:1.4,web:1},urbano:{alta:.9,media:1.3,baja:.8,web:1},premium:{alta:1.5,media:1,baja:.5,web:1}},
    storeZones:{miraflores:'alta',los_olivos:'media',sjl:'baja'},
    // Cantidades de compra se expresan en m², unidades y metros.
    materials:{quantityDiscountRate:.08,quantityDiscountThreshold:100},
    products:['esencial','urbano','premium'],
    segments:{esencial:{code:'SEG-01',min:0,defaultPrice:42.5,totalMarket:7000,penetration:.5,weights:[.7,.2,.1],quality:0},urbano:{code:'SEG-02',min:0,defaultPrice:100,totalMarket:5000,penetration:.7,ideal:100,weights:[.4,.35,.25],quality:4},premium:{code:'SEG-03',min:0,defaultPrice:250,totalMarket:2000,penetration:.4,ideal:250,weights:[.1,.5,.4],quality:7}},
    consequences:{lowQualityPrice:.65,premiumPrice:1.4,reputationChange:2,lowEfficiency:4,lowProduction:.7,noLeaderEfficiency:5,noLeaderProduction:.95,lowReputation:3,lowReputationCycles:2,lowDemand:.8,lowHealth:3},
    // SUPUESTO: capacitación baja/alta 0%/12%; media +8% figura en Excel.
    training:{cap_no:0,cap_baja:0,cap_media:.08,cap_alta:.12},
    // SUPUESTO: solo marketing medio tiene +12% explícito; extremos 0/20%.
    marketing:{mkt_baja:0,mkt_media:.12,mkt_alta:.2},
    // SUPUESTO: cobertura base neutral; cada tienda adicional +5%, tope +25%.
    channels:{web:1,physical:1,mixed:1,extraStore:.05,maxExtra:.25},
    // SUPUESTOS heredados del menú, sin tarifa equivalente en el libro.
    optionCosts:{los_olivos:1800,miraflores:3500,sjl:2200,si_analista:5000},
    // No hay cargos ni penalizaciones de estos tipos en el documento base.
    storagePerUnit:0,overtimeRate:0,nextLoanRatePP:0,
    credit:{initial:.2,step:.05,analystBonus:.05,max:.7},commission:.01,
    warranty:{pt_30:5,pt_90:10,pt_180:10},
    // SUPUESTO: vida productiva100000u, acelerada doble línea recta; solo devengo.
    depreciation:{productiveLife:100000,acceleratedFactor:2},
    // SUPUESTO: mantenimiento evita penalidad; inventarios no crean stock gratuito.
    maintenanceCapacity:0,inventoryCapacity:0,unservedDemand:'lost'
  });
});
