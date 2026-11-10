// SIDE authored procedural furniture: shared box/cylinder batches, no assets.
// Coordinates are map-local; collider/hotspot helpers apply the hub offset.
export function buildOfficeInterior({ room, batch, m, collider, sign, hotspot, offsetX = 150 }) {
  const b = typeof batch === 'function' ? batch(room.detail) : batch;
  const { x, z, width, depth } = room.layout;
  const back = z + depth / 2 - 1.15;
  const deskX = x - width / 2 + 2.1;
  const meetingX = x + width / 2 - 2.5;
  const solid = (px, pz, w, d, kind = 'furniture') => collider(px, pz, w, d, kind, 'office');
  function chair(px, pz, facing = 1) {
    b.box(px, .45, pz, .58, .12, .58, m.dark);
    b.box(px, .83, pz - facing * .26, .58, .65, .08, m.mint);
    for (const dx of [-.22, .22]) for (const dz of [-.22, .22]) b.box(px + dx, .22, pz + dz, .055, .43, .055, m.steel);
    solid(px, pz, .64, .64, 'chair');
  }
  function desk(px, pz) {
    b.box(px, .79, pz, 2.35, .12, 1.02, m.wood);
    for (const dx of [-1, 1]) b.box(px + dx, .38, pz, .1, .74, .82, m.steel);
    b.box(px - .77, .37, pz, .55, .68, .79, m.white);
    b.box(px, .89, pz, .46, .06, .3, m.dark);
    b.box(px, 1.07, pz, .055, .33, .055, m.steel);
    b.box(px, 1.32, pz, .83, .5, .075, m.dark);
    b.box(px, 1.32, pz - .043, .75, .41, .015, m.screen);
    b.box(px, .87, pz - .35, .62, .025, .19, m.black);
    b.box(px + .86, .89, pz - .25, .32, .045, .39, m.white);
    solid(px, pz, 2.4, 1.06, 'desk');
    chair(px, pz + 1.15);
  }
  // Entry-to-indicators spine remains clear; desks and meeting seating occupy
  // side bays with explicit chair colliders rather than a traversable prop shell.
  desk(deskX, z - 1.65);
  desk(deskX, z + 2.3);
  b.box(meetingX, .8, z + 1.9, 2.45, .14, 3.0, m.wood);
  for (const dx of [-.93, .93]) for (const dz of [-1.2, 1.2]) b.box(meetingX + dx, .39, z + 1.9 + dz, .12, .74, .12, m.steel);
  solid(meetingX, z + 1.9, 2.5, 3.05, 'meeting-table');
  for (const dz of [-.9, .9]) {
    chair(meetingX - 1.78, z + 1.9 + dz);
    chair(meetingX + 1.78, z + 1.9 + dz);
  }
  b.box(meetingX, .89, z + 1.7, .8, .025, .55, m.white);
  b.box(meetingX, .96, z + 2.45, .55, .16, .37, m.dark);
  // Low archive storage and folders make the finance work area legible.
  b.box(deskX, .65, back, 2.9, 1.3, .55, m.white);
  solid(deskX, back, 2.95, .6, 'archive');
  for (let i = 0; i < 7; i++) b.box(deskX - 1.05 + i * .32, 1.53, back, .22, .42, .36, i % 2 ? m.mint : m.orange);
  const boardZ = z + depth / 2 - .18;
  b.box(x, 2.02, boardZ, 3.8, 1.64, .07, m.dark);
  b.box(x, 2.02, boardZ - .043, 3.6, 1.43, .018, m.white);
  // Boards face the doorway (negative Z), without changing exterior signs.
  const title = sign(room.detail, 'FINANZAS Y CICLO', 'CAJA · DEUDA · RESUMEN', x, 2.26, boardZ - .065, 3.35, .57, Math.PI);
  const indicator = sign(room.detail, 'Estado de la empresa', 'Datos del ciclo actual', x, 1.6, boardZ - .07, 3.35, .85, Math.PI);
  room.stateSigns ||= [];
  room.stateSigns.push({ key: 'finance', mesh: indicator, title, fields: ['cash', 'debt', 'round'], zone: 'office' });
  // The decision terminal is against the rear wall, reachable from the spine.
  b.box(x, .52, back, 1.12, 1.04, .59, m.dark);
  b.box(x, 1.27, back, .88, .46, .06, m.screen);
  solid(x, back, 1.16, .65, 'terminal');
  hotspot(room, 'office-decisions', 'decisionZone', 'Finanzas y resumen del ciclo', x, back - 1.1, 'empresa', { category: 'B' });
  room.officeStations = {
    finance: { x: offsetX + deskX + 1.85, z: z - 1.65 },
    manager: { x: offsetX + meetingX, z: z - .35 },
    patrol: [{ x: offsetX + x, z: z - 2 }, { x: offsetX + x, z: back - 1.25 }]
  };
  room.detail.userData.officeInterior = true;
  b.finish();
  return room;
}
