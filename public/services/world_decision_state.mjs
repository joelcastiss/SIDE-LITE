// Read-only projection for the 3D city. The decision engine and inventory remain authoritative.
export const WORLD_ZONES = Object.freeze([
  {id:'warehouse', label:'Almacén', category:'F', x:-20.5, z:-19},
  {id:'production', label:'Producción', category:'C', x:20, z:-19},
  {id:'store', label:'Tienda', category:'D', x:-19, z:19},
  {id:'office', label:'Oficina', category:'B', x:19, z:76},
  {id:'bank', label:'Banco', category:'E', x:76, z:19},
  {id:'suppliers', label:'Proveedores', category:'F', x:-76, z:-19},
  {id:'news', label:'Buzón de noticias', category:null, x:19, z:29}
]);

const finite = value => Number.isFinite(Number(value)) ? Number(value) : 0;
const positive = value => Math.max(0, finite(value));
const unit = value => Math.max(0, Math.min(1, finite(value)));
const ids = entry => Array.isArray(entry?.optionIds) ? entry.optionIds : [];
const selected = (decisions, key, id) => ids(decisions?.[key]).includes(id);
const current = (decisions, key, round) => Number(decisions?.[key]?.round) === round;
const quantity = entry => Object.values(entry?.quantities || {}).reduce((sum, n) => sum + positive(n), 0);

function eventVisuals(events) {
  const seen = new Set();
  return (Array.isArray(events) ? events : []).filter(event => {
    const id = String(event?.id || '');
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  }).map(event => {
    const title = String(event.title || 'Noticia del ciclo');
    const category = String(event.category || '');
    const copy = `${title} ${event.description || ''}`.toLowerCase();
    const kind = /festividad|comercial/i.test(category) ? 'festival'
      : /lluvia|clima|ola de calor|temperatura|inundaci[oó]n/i.test(copy) ? 'weather'
      : /transport|tr[aá]fico|bloqueo|entrega|puerto/i.test(copy) ? 'logistics' : 'news';
    return {id:String(event.id), title, kind, implication:String(event.implication || ''),
      revenuePct:finite(event.effect?.revenuePct), costPct:finite(event.effect?.costPct),
      cashDelta:finite(event.effect?.cashDelta)};
  });
}

function consequence(label, before, after, zoneId, format = value => String(value)) {
  if (before == null || after == null || !Number.isFinite(Number(before)) || !Number.isFinite(Number(after)) || Number(before) === Number(after)) return null;
  const delta = Number(after) - Number(before);
  return {zoneId, label, before:Number(before), after:Number(after), delta,
    text:`${label}: ${delta > 0 ? '+' : ''}${format(delta)}`};
}

export function deriveWorldDecisionState(input = {}) {
  const round = Math.max(1, Math.floor(positive(input.round) || 1));
  const decisions = input.decisions || {};
  const visual = input.visual || {};
  const events = eventVisuals(input.events);
  const marketing = ids(decisions.INV_MARKETING)[0] || null;
  const marketingLevel = {mkt_baja:1, mkt_media:2, mkt_alta:3}[marketing] || 0;
  const eventDemand = events.reduce((sum, event) => sum + event.revenuePct, 0);
  const clientLevel = Math.max(0.4, Math.min(2, 1 + marketingLevel * .12 + eventDemand / 100));
  const pendingUnits = positive(visual.pendingUnits);
  const plannedUnits = positive(visual.plannedUnits);
  const producedUnits = visual.producedUnits == null ? null : positive(visual.producedUnits);
  const physicalStore = ids(decisions.CANALES).some(id => ['los_olivos','miraflores','sjl'].includes(id));
  const stockKnown = visual.displayStock != null && visual.reserveStock != null;
  const zones = WORLD_ZONES.map(zone => {
    const relevant = zone.id === 'warehouse' ? ['CUERO','ACCESORIOS','HILO']
      : zone.id === 'production' ? ['PRODUCCION_META','PERS_CORTE','PERS_ENSAMBLE','PERS_ACABADO']
      : zone.id === 'store' ? ['CANALES','GARANTIA_PT']
      : zone.id === 'office' ? ['MESA_CORTE','ENSAMBLE','ACABADOS','MOLDE','LOCAL_PROD','MANTENIMIENTO']
      : zone.id === 'bank' ? ['INV_RRHH','INV_MARKETING','PRESTAMO']
      : zone.id === 'suppliers' ? ['ANALISTA_COMPRAS','GARANTIA_PROV'] : [];
    return {...zone, decided:relevant.some(key => current(decisions,key,round)),
      available:zone.id !== 'store' || physicalStore || !decisions.CANALES};
  });
  const cues = {
    storeFill:unit(visual.storeFill), warehouseFill:unit(visual.warehouseFill),
    displayStock:positive(visual.displayStock), reserveStock:positive(visual.reserveStock),
    pendingUnits, deliveryVisible:pendingUnits > 0,
    productionActive:Boolean(visual.productionActive), plannedUnits, producedUnits,
    machines:{cutting:positive(visual.machines?.cutting), assembly:positive(visual.machines?.assembly), finishing:positive(visual.machines?.finishing)},
    workers:{cutting:positive(visual.workers?.cutting), assembly:positive(visual.workers?.assembly), finishing:positive(visual.workers?.finishing)},
    physicalStore, marketingLevel, clientLevel, cash:visual.cash == null ? null : finite(visual.cash)
  };
  let objective;
  if (input.cycleClosed) objective = {id:'cycle-summary', zoneId:'office', title:'Revisa el cierre del ciclo'};
  else if (stockKnown && cues.displayStock === 0 && cues.reserveStock > 0) objective = {id:'restock', zoneId:'warehouse', title:'Abastece tu tienda'};
  else if (!current(decisions,'CUERO',round) && plannedUnits > 0) objective = {id:'inventory', zoneId:'warehouse', title:'Revisa tu inventario'};
  else if (!current(decisions,'PRODUCCION_META',round)) objective = {id:'production', zoneId:'production', title:'Decide tu producción'};
  else if (!current(decisions,'CANALES',round)) objective = {id:'sales', zoneId:'store', title:'Revisa tus canales de venta'};
  else if (!current(decisions,'INV_MARKETING',round)) objective = {id:'finance', zoneId:'bank', title:'Revisa tus finanzas'};
  else objective = {id:'news', zoneId:'news', title:'Consulta las noticias del ciclo'};
  const previous = input.previous?.round === round - 1 ? input.previous : null;
  const consequences = previous ? [
    consequence('Recursos de juego',previous.cash,cues.cash,'office',n=>`★ ${Math.round(n)}`),
    consequence('Productos en tienda',previous.displayStock,cues.displayStock,'store'),
    consequence('Productos en almacén',previous.reserveStock,cues.reserveStock,'warehouse'),
    consequence('Producción realizada',previous.producedUnits,cues.producedUnits,'production')
  ].filter(Boolean) : [];
  return {round, zones, cues, events, objective, consequences,
    decisionProgress:unit(positive(input.decisionProgress) / 100)};
}
