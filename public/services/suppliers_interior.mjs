/** Supplier showroom presentation; the simulation remains the owner of orders. */
export function buildSuppliersInterior({ room, batch: b, m, collider, sign, hotspot, offsetX = 150 }) {
  const { x, z } = room.layout;
  const solid = (px, pz, w, d, h, mat, kind = 'furniture') => {
    b.box(px, h / 2, pz, w, h, d, mat);
    collider(px, pz, w, d, kind, room.id);
  };
  // The east door faces the city. Its approach and central aisle remain clear.
  solid(x - 2.4, z, 1.25, 5.4, 1.05, m.wood, 'supplier-counter');
  b.box(x - 2.4, 1.11, z, 1.45, .12, 5.55, m.white);
  b.box(x - 2.5, 1.48, z - 1.7, .16, .65, .82, m.dark);
  b.box(x - 2.39, 1.48, z - 1.7, .02, .5, .64, m.screen);
  b.box(x - 2.2, 1.2, z + 1.2, .65, .05, .85, m.white);
  b.box(x - 2.18, 1.24, z + 1.2, .55, .035, .74, m.mint);
  sign(room.detail, 'CATÁLOGO DE INSUMOS', 'CUERO · HILO · ACCESORIOS', x - 2.4, 2.65, z, 4.3, .65, Math.PI / 2);

  // Repeated shelves and samples share box/cylinder geometry and materials.
  for (const sz of [-1, 1]) {
    const rz = z + sz * 6.5;
    collider(x + .3, rz, 7.8, .9, 'sample-shelf', room.id);
    for (const px of [x - 3.6, x + 4.2]) b.box(px, 1.2, rz, .08, 2.4, .82, m.steel);
    for (const y of [.28, 1.02, 1.76]) {
      b.box(x + .3, y, rz, 7.8, .08, .86, m.wood);
      for (let i = 0; i < 6; i++) {
        const px = x - 2.85 + i * 1.26;
        if (sz < 0) {
          b.cyl(px, y + .22, rz, .18, .39, i % 2 ? m.tan : m.leather);
          b.cyl(px, y + .425, rz, .07, .025, m.white);
        } else {
          b.box(px, y + .08, rz, .76, .12, .5, [m.leather, m.tan, m.black][i % 3]);
          b.box(px, y + .18, rz, .65, .06, .46, m.carton);
        }
      }
    }
  }
  sign(room.detail, 'MUESTRAS', 'CUERO · HILO · ACCESORIOS', x + .3, 2.65, z - 6.5, 4.5, .55);
  // Packing bench is behind the counter, outside the public route.
  solid(x - 5.05, z - 4.7, 1.6, 1.5, .95, m.steel, 'packing-table');
  b.box(x - 5.05, 1.03, z - 4.7, 1.8, .12, 1.7, m.wood);
  for (const dz of [-.38, .38]) {
    b.box(x - 5.05, 1.3, z - 4.7 + dz, .65, .42, .53, m.carton);
    b.box(x - 5.05, 1.515, z - 4.7 + dz, .08, .018, .55, m.tape);
  }
  // Waiting stools stay south of the marked queue and do not block entry.
  for (const px of [x + 1.1, x + 2.6, x + 4.1]) {
    collider(px, z + 4.15, .65, .65, 'waiting-seat', room.id);
    b.box(px, .52, z + 4.15, .65, .14, .65, m.mint);
    for (const sx of [-.23, .23]) b.box(px + sx, .24, z + 4.15, .07, .48, .5, m.steel);
  }
  for (const px of [x - .7, x + .6, x + 1.9]) b.box(px, .05, z + 1.5, .6, .018, .08, m.yellow);
  hotspot(room, 'suppliers-purchases', 'decisionZone', 'Compras a proveedores', x - .55, z, 'F');
  room.queueSlots = [x - .7, x + .6, x + 1.9].map(px => ({ x: offsetX + px, z: z + 1.5 }));
  room.servicePoint = { x: offsetX + x - .65, z };
  room.routes.push(
    { zone: room.id, role: 'proveedor', stationary: true, points: [{ x: offsetX + x - 3.9, z }] },
    { zone: room.id, role: 'almacen', points: [[x - 5.1, z + 3.8], [x - 5.1, z], [x - 5.1, z - 2.8]].map(([px, pz]) => ({ x: offsetX + px, z: pz })) }
  );
  const board = sign(room.detail, 'PEDIDOS A PROVEEDORES', 'CONSULTA EL CICLO ACTUAL', x + 1, 2.5, z - 7.85, 5.3, .9);
  room.syncState = snapshot => {
    const source = snapshot?.cues || snapshot || {};
    const raw = source.pendingUnits ?? source.warehousePendingUnits;
    const pending = Number(raw);
    const text = raw == null || !Number.isFinite(pending) ? 'Pedidos: consulta administración' : `Unidades pendientes: ${Math.max(0, pending)}`;
    room.detail.userData.supplierState = { pendingUnits: raw == null || !Number.isFinite(pending) ? null : Math.max(0, pending) };
    if (!board?.material?.map || board.userData.stateText === text) return;
    board.userData.stateText = text;
    const canvas = board.material.map.image;
    const ctx = canvas?.getContext?.('2d');
    if (!ctx) return;
    ctx.fillStyle = '#23393e'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#f1edde';
    ctx.font = `600 ${canvas.height * .3}px Arial`;
    ctx.fillText('PEDIDOS A PROVEEDORES', canvas.width / 2, canvas.height * .32, canvas.width * .94);
    ctx.fillStyle = '#a3c5b6'; ctx.font = `500 ${canvas.height * .22}px Arial`;
    ctx.fillText(text, canvas.width / 2, canvas.height * .73, canvas.width * .94);
    board.material.map.needsUpdate = true;
  };
  b.finish();
  return room;
}
