/** Version 3 economic effects. Multipliers are teaching parameters. */
export const DISTRICT_EVENTS = Object.freeze([
 {id:'trend_luxury',type:'preferences',label:'Tendencia de lujo',description:'Crece el interés por productos prémium.',quality:{premium:1.4}},
 {id:'trend_economy',type:'preferences',label:'Moda económica',description:'Aumenta el interés por productos básicos.',quality:{basic:1.4}},
 {id:'prefer_quality',type:'preferences',label:'Preferencia por calidad',description:'Los compradores valoran más la calidad.',quality:{standard:1.15,premium:1.3}},
 {id:'price_sensitive',type:'preferences',label:'Compradores sensibles al precio',description:'Los compradores comparan más los precios.',priceSensitivity:1.5},
 {id:'viral_campaign',type:'marketing',label:'Campaña viral',description:'La publicidad llega a más personas.',marketingStrength:1.7},
 {id:'ad_saturation',type:'marketing',label:'Saturación publicitaria',description:'La publicidad pierde eficacia.',marketingStrength:.5},
 {id:'recommendations',type:'marketing',label:'Recomendaciones positivas',description:'Las recomendaciones refuerzan la calidad.',quality:{standard:1.12,premium:1.2}},
 {id:'ad_distrust',type:'marketing',label:'Desconfianza publicitaria',description:'Los anuncios convencen menos.',marketingStrength:.3},
 {id:'purchasing_power_up',type:'economy',label:'Aumento del poder adquisitivo',description:'Más compradores consideran adquirir bolsos.',demand:1.15,quality:{premium:1.12}},
 {id:'purchasing_power_down',type:'economy',label:'Reducción del poder adquisitivo',description:'Menos compradores disponen de presupuesto.',demand:.88,quality:{basic:1.12}},
 {id:'price_competition',type:'economy',label:'Competencia de precios',description:'Los precios bajos atraen más compradores.',priceSensitivity:1.6},
 {id:'impulse_buying',type:'economy',label:'Compras impulsivas',description:'La publicidad impulsa más compras.',demand:1.1,marketingStrength:1.4},
 {id:'tourism',type:'markets',label:'Afluencia turística',description:'Más visitantes llegan al mercado.',demand:1.15},
 {id:'entrepreneur_fair',type:'markets',label:'Feria de emprendimientos',description:'Una feria atrae clientes a las empresas.',demand:1.18,marketingStrength:1.2},
 {id:'roadworks',type:'markets',label:'Obras y restricciones viales',description:'Las obras reducen la afluencia.',demand:.85},
 {id:'shopping_center',type:'markets',label:'Apertura de centro comercial',description:'Nuevos comercios compiten por los compradores.',demand:.9,quality:{premium:1.12}},
 {id:'supplier_clearance',type:'supply',label:'Liquidación de proveedores',description:'El costo de compra baja.',purchase:.85},
 {id:'raw_material_increase',type:'supply',label:'Aumento de materias primas',description:'El costo de compra sube.',purchase:1.18}
]);
