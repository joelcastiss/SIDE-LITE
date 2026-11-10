/** Banco: procedural furniture shares the interior instance batches. */
export function buildBankInterior({ room, batch: b, m, collider, sign, hotspot, offsetX = 150 }) {
  const { x, z, width, depth } = room.layout;
  const back = z - depth / 2;
  const counterZ = back + 3.1;
  const tellerX = x - 1.6;
  const solid = (px, py, pz, w, h, d, mat, kind) => {
    b.box(px, py, pz, w, h, d, mat);
    collider(px, pz, w, d, kind, room.id);
  };
  const route = (role, points, stationary = false) => room.routes.push({
    zone: room.id, role, stationary,
    points: points.map(([px, pz]) => ({ x: offsetX + px, z: pz }))
  });

  // The counter ends before the east service aisle. Neither the queue nor
  // the advisor has to cross its collision box to reach a service position.
  solid(x - 1.1, .52, counterZ, width - 4.4, 1.04, .9, m.wood, 'bank-counter');
  b.box(x - 1.1, 1.075, counterZ, width - 4.2, .09, 1.02, m.white);
  b.box(tellerX, 1.18, counterZ - .15, .6, .17, .42, m.dark);
  b.box(tellerX, 1.48, counterZ - .25, .64, .4, .08, m.screen);
  b.box(tellerX + 1.2, 1.16, counterZ, .48, .09, .36, m.white);
  // Low glass wings suggest teller privacy without obstructing camera view.
  for (const px of [tellerX - 1.15, tellerX + 1.15]) {
    b.box(px, 1.58, counterZ, .05, .95, .65, m.glass);
    b.box(px, 1.1, counterZ, .07, .07, .68, m.steel);
  }
  sign(room.detail, 'PRÉSTAMOS', 'Consulta y decide en ventanilla', tellerX, 2.35, back + .18, 5.2, .78);
  hotspot(room, 'bank-loans', 'decisionZone', 'Préstamos · Banco', tellerX, counterZ + 1.3, 'E');

  // Waiting seats occupy the southwest corner; the west door at z stays clear.
  const waitingX = x - width / 2 + 1.2;
  for (const seatZ of [z + 3.3, z + 4.75, z + 6.2]) {
    solid(waitingX, .43, seatZ, .85, .16, .78, m.mint, 'bank-waiting-seat');
    b.box(waitingX - .36, .8, seatZ, .12, .65, .8, m.mint);
    for (const side of [-1, 1]) {
      b.box(waitingX + side * .29, .2, seatZ - .25, .07, .4, .07, m.steel);
      b.box(waitingX + side * .29, .2, seatZ + .25, .07, .4, .07, m.steel);
    }
  }
  sign(room.detail, 'SALA DE ESPERA', 'Mantén libre el acceso', waitingX + .55, 2.3, z + 2.4, 2.5, .45);
  // Queue marks are flush to the floor and impose no invisible barriers.
  const queue = [counterZ + 1.3, counterZ + 2.65, counterZ + 4];
  queue.forEach((pz, index) => {
    b.box(tellerX, .03, pz, .68, .012, .08, m.yellow);
    if (index < queue.length - 1) b.box(tellerX, .03, pz + .45, .08, .012, .18, m.mint);
  });
  room.queueSlots = queue.map(pz => ({ x: offsetX + tellerX, z: pz }));

  const atmX = x + width / 2 - 1.15;
  const atmZ = z + depth / 2 - 2.4;
  solid(atmX, .95, atmZ, .85, 1.9, .7, m.steel, 'bank-atm');
  b.box(atmX, 1.35, atmZ + .36, .6, .45, .035, m.screen);
  b.box(atmX, .93, atmZ + .4, .57, .06, .16, m.dark);
  b.box(atmX, .58, atmZ + .36, .4, .08, .025, m.black);
  sign(room.detail, 'CAJERO', 'Información de tu caja', atmX, 2.25, atmZ + .39, 1.5, .42);

  const advisorX = x + width / 2 - 1.55;
  const advisorZ = back + 1.6;
  solid(advisorX, .76, advisorZ, 1.7, .08, 1.05, m.white, 'bank-advisor-desk');
  for (const side of [-1, 1]) b.box(advisorX + side * .65, .36, advisorZ, .08, .72, .8, m.steel);
  b.box(advisorX, .99, advisorZ - .2, .5, .35, .07, m.screen);
  sign(room.detail, 'ASESORÍA', 'Condiciones del préstamo', advisorX, 2.05, back + .18, 2.6, .5);
  route('cajero', [[tellerX, counterZ - 1.1]], true);
  // This aisle is beyond the counter's east edge and south of the desk.
  route('banco', [[advisorX, counterZ + .3], [advisorX, z - .2], [advisorX, counterZ + .3]]);
  route('cliente', [[tellerX, queue[2]], [tellerX, queue[1]], [tellerX, queue[0]]]);
  room.detail.userData.bankPresentation = { source: 'world-decision-state', category: 'E', queueSlots: room.queueSlots };
  b.finish();
}
