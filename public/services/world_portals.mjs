// A directed threshold crossing needs no cooldown: arriving on either side,
// standing in the doorway, or walking away cannot trigger a second transfer.
export function crossedPortal(previous, next, portal) {
  if (!previous || !next || !portal) return false;
  const direction = portal.direction ?? -1;
  const axis = portal.axis || 'z';
  const across = axis === 'x' ? 'z' : 'x';
  const before = (previous[axis] - portal[axis]) * direction;
  const after = (next[axis] - portal[axis]) * direction;
  if (!(before < 0 && after >= 0)) return false;
  const t = -before / (after - before);
  const x = previous[across] + (next[across] - previous[across]) * t;
  return Math.abs(x - portal[across]) <= (portal.halfWidth ?? 1.05);
}

export function crossedEntrance(previous, next, entrances) {
  return entrances.find(entrance => crossedPortal(previous, next, entrance.portal)) || null;
}

export const INTERIOR_EXIT = Object.freeze({ x: 0, z: 8.1, halfWidth: 1.25, direction: 1 });

export function crossedInteriorExit(previous, next) {
  return crossedPortal(previous, next, INTERIOR_EXIT);
}
