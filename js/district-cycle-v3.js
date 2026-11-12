import {allocateDistrictDemand} from './market-engine-v3.js';
import {marketingFactor} from './engine.js';

const qualities=new Set(['basic','standard','premium']);
const integer=(x,name,min=0)=>{if(!Number.isSafeInteger(x)||x<min)throw Error(`${name} inválido`);return x};
const safe=(x)=>integer(x,'Importe');

/** Settle one district as a single market. Callers must lock and snapshot all
 * decisions before invoking it; this function does not write official results. */
export function closeDistrictCycle({district,companies,costs,event=null}) {
  if(!district || !Array.isArray(companies) || !costs)throw Error('Mercado inválido');
  const demandFactor=event?.demand ?? 1, purchaseFactor=event?.purchase ?? 1;
  if(!Number.isFinite(purchaseFactor)||purchaseFactor<=0)throw Error('Evento inválido');
  const prepared=companies.map(c=>{
    const cash=integer(c.cash,'Caja');
    const stock=(c.batches || []).map(b=>({quantity:integer(b.quantity,'Inventario'),unitCost:integer(b.unitCost,'Costo')}));
    if(!c.decision)return {...c,cash,stock,purchase:0,marketing:0};
    const {quality,quantity,price,marketingAmount}=c.decision;
    if(!qualities.has(quality))throw Error('Calidad inválida');
    integer(quantity,'Cantidad');integer(price,'Precio',1);marketingFactor(marketingAmount);
    const unitCost=safe(Math.round(integer(costs[quality],'Costo unitario')*purchaseFactor));
    const purchase=safe(quantity*unitCost);
    if(safe(purchase+marketingAmount)>cash)throw Error('Caja insuficiente');
    if(quantity)stock.push({quantity,unitCost});
    return {...c,cash,stock,purchase,unitCost,marketing:marketingAmount};
  });
  const allocation=allocateDistrictDemand({baseDemand:district.baseDemand,shares:district.shares,companies:prepared,demandFactor});
  return prepared.map(c=>{
    const demand=allocation[c.id],available=c.stock.reduce((sum,b)=>safe(sum+b.quantity),0);
    const sold=c.decision?Math.min(demand,available):0;let left=sold,costOfSales=0;
    for(const b of c.stock){const consumed=Math.min(left,b.quantity);costOfSales=safe(costOfSales+consumed*b.unitCost);b.quantity-=consumed;left-=consumed;}
    const revenue=safe(sold*(c.decision?.price || 0)),cashEnd=safe(c.cash-c.purchase-c.marketing+revenue);
    return {companyId:c.id,districtId:district.id,cashStart:c.cash,cashEnd,purchase:c.purchase,...(c.decision?{unitCost:c.unitCost}:{}),marketing:c.marketing,revenue,costOfSales,profit:revenue-costOfSales-c.marketing,sold,demand,inventory:c.stock.filter(b=>b.quantity),event,ruleVersion:3};
  });
}
