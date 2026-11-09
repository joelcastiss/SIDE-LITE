/** SIDE Lite economic rules v1. All amounts are integer soles. */
export const RULES = Object.freeze({ version: 2, baseDemand: 300, referencePrice: 100, quality: { basic: 0.85, standard: 1, premium: 1.18 } });
export const EVENTS = Object.freeze([
  { id:'demand_fair', type:'demand', label:'Feria local', demand:1.15 },
  { id:'demand_rain', type:'demand', label:'Semana lluviosa', demand:0.88 },
  { id:'demand_holiday', type:'demand', label:'Temporada festiva', demand:1.20 },
  { id:'demand_slow', type:'demand', label:'Consumo moderado', demand:0.90 },
  { id:'cost_discount', type:'cost', label:'Descuento del proveedor', purchase:0.90 },
  { id:'cost_freight', type:'cost', label:'Flete más caro', purchase:1.10 },
  { id:'cost_offer', type:'cost', label:'Oferta de temporada', purchase:0.95 },
  { id:'cost_shortage', type:'cost', label:'Escasez de producto', purchase:1.15 },
  { id:'opportunity_social', type:'opportunity', label:'Difusión comunitaria', demand:1.10 },
  { id:'opportunity_market', type:'opportunity', label:'Mercado temporal', demand:1.12 },
  { id:'opportunity_alliance', type:'opportunity', label:'Alianza comercial', demand:1.08 },
  { id:'opportunity_visit', type:'opportunity', label:'Visita de compradores', demand:1.06 }
]);
const integer = (n, name, min=0) => { if (!Number.isSafeInteger(n) || n < min) throw new Error(`${name} inválido`); return n; };
const money = n => { if (!Number.isSafeInteger(n) || n < 0) throw new Error('Importe fuera de rango'); return n; };
/** Stable deterministic variation in [0.95,1.05], based on persisted seed and company id. */
export function variation(seed, companyId) { let h=2166136261; for (const c of `${seed}:${companyId}`) { h ^= c.charCodeAt(0); h=Math.imul(h,16777619); } return 0.95 + ((h>>>0)%101)/1000; }
export function marketingFactor(amount) {
  integer(amount, 'Marketing');
  if (amount !== 0 && (amount < 200 || amount > 10000)) throw new Error('Marketing debe ser 0 o entre 200 y 10000 soles');
  return 1 + 0.3 * Math.log1p(amount / 1000) / Math.log1p(10);
}
export function closeCycle({cash, batches=[], decision=null, costs, event=null, seed, companyId}) {
  integer(cash,'Caja'); if (!seed || !companyId) throw new Error('Semilla y empresa requeridas');
  const stock=batches.map(b=>({quantity:integer(b.quantity,'Inventario'), unitCost:integer(b.unitCost,'Costo')}));
  const applied=event ? EVENTS.find(e=>e.id===event) : null;
  if (event && !applied) throw new Error('Evento desconocido');
  // Missing confirmation carries inventory forward, with no purchase, marketing, or sales.
  if (!decision) return {cashStart:cash,cashEnd:cash,purchase:0,marketing:0,revenue:0,costOfSales:0,profit:0,sold:0,demand:0,inventory:stock,event:applied,ruleVersion:RULES.version};
  const {quality,quantity,price,marketingAmount}=decision;
  if (!Object.hasOwn(RULES.quality, quality)) throw new Error('Opción inválida');
  const marketingMultiplier=marketingFactor(marketingAmount);
  integer(quantity,'Cantidad'); integer(price,'Precio',1);
  const unitCost=money(Math.round(integer(costs[quality],'Costo unitario')*(applied?.purchase ?? 1)));
  const purchase=money(quantity*unitCost), marketingCost=marketingAmount;
  if (money(purchase+marketingCost)>cash) throw new Error('Caja insuficiente');
  if (quantity) stock.push({quantity,unitCost});
  const priceFactor=Math.max(0.1,Math.min(2, RULES.referencePrice/price));
  const demand=Math.max(0,Math.floor(RULES.baseDemand*priceFactor*RULES.quality[quality]*marketingMultiplier*(applied?.demand ?? 1)*variation(seed,companyId)));
  const sold=Math.min(demand,stock.reduce((s,b)=>s+b.quantity,0));
  let remaining=sold,costOfSales=0;
  for (const b of stock) { const n=Math.min(remaining,b.quantity); costOfSales=money(costOfSales+n*b.unitCost); b.quantity-=n; remaining-=n; }
  const revenue=money(sold*price), cashEnd=money(cash-purchase-marketingCost+revenue);
  return {cashStart:cash,cashEnd,purchase,unitCost,marketing:marketingCost,revenue,costOfSales,profit:revenue-costOfSales-marketingCost,sold,demand,inventory:stock.filter(b=>b.quantity),event:applied,ruleVersion:RULES.version};
}
export function rank(companies) { return [...companies].map(c=>({...c,returnPercent:100*(c.cash+c.inventoryValue-c.initialCapital)/c.initialCapital})).sort((a,b)=>b.returnPercent-a.returnPercent || b.cash-a.cash || a.name.localeCompare(b.name,'es')); }
