// Read-only guidance. The simulation owns stock, transactions, missions and cycles.
const AREAS = ['store', 'production', 'warehouse'];
const NAMES = {store: 'la tienda', production: 'producción', warehouse: 'el almacén'};
const count = value => Math.max(0, Number(value) || 0);

export function deriveObjective(snapshot = {}) {
  const visited = AREAS.filter(id => snapshot.visited?.includes(id));
  const objective = (id, title, instruction, region, interaction = null) =>
    ({id, title, instruction, region, interaction});
  if (snapshot.shiftEnded) return objective('results', 'TURNO COMPLETADO', 'Revisa el resumen y los resultados del ciclo', null);
  if (count(snapshot.queue) > 0) return objective('checkout', 'CLIENTES EN CAJA', `Cobra a ${count(snapshot.queue)} cliente(s) · E junto a la caja`, 'store', 'register');
  if (snapshot.stockKnown && count(snapshot.display) === 0) {
    if (count(snapshot.reserve) > 0) return objective('restock', 'ABASTECE TU TIENDA', 'Lleva las reservas a exhibición · E junto al almacén', 'warehouse', 'restock');
    if (snapshot.deliveryPending) return objective('delivery', 'PEDIDO EN CAMINO', 'Consulta el pedido en administración', 'warehouse', 'admin');
    return objective('supply', 'SIN MERCANCÍA DISPONIBLE', 'Revisa inventario y proveedores en administración', 'warehouse', 'admin');
  }
  const next = AREAS.find(id => !visited.includes(id));
  if (next) return objective(`explore-${next}`, `CONOCE TU EMPRESA · ${visited.length}/3`, `Visita ${NAMES[next]}`, next);
  return objective('operate', 'OPERA TU EMPRESA', 'Atiende clientes, revisa precios y completa las misiones', 'store', 'register');
}
