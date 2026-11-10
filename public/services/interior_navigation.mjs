import { buildNpcGridNavmesh } from './npc_navmesh_grid.mjs';
import { loadOptionalNpcNavigator } from './npc_optional_navigation.mjs';
import { planPath, advance as safeAdvance } from './npc_navigation.mjs';

/** Optional per-room navigation. Low quality never builds or imports a navmesh. */
export function createInteriorNavigation({ THREE, rooms = [], colliders = [], offsetX = 150, loadNavigator = loadOptionalNpcNavigator } = {}) {
  const entries = new Map();
  let disposed = false;
  const findRoom = room => typeof room === 'string' ? rooms.find(item => item.id === room) : room;
  const obstaclesFor = room => colliders.filter(box => box.zone === room?.id);
  const enabled = mode => mode !== 'low';
  function initialize(room, mode) {
    room = findRoom(room);
    if (disposed || !enabled(mode) || !room?.layout) return null;
    if (entries.has(room.id)) return entries.get(room.id);
    const entry = { id: room.id, navigator: null, geometry: null, grid: null, failed: false };
    entries.set(room.id, entry);
    // Defer geometry and library initialization until this room is requested.
    entry.promise = Promise.resolve().then(async () => {
      if (disposed) return false;
      try {
        const { x, z, width, depth } = room.layout;
        const built = buildNpcGridNavmesh({ THREE, bounds: {
          minX: x - width / 2 + .3, maxX: x + width / 2 - .3,
          minZ: z - depth / 2 + .3, maxZ: z + depth / 2 - .3
        }, obstacles: obstaclesFor(room), offsetX, cellSize: .5, agentRadius: .4 });
        entry.geometry = built.geometry;
        entry.grid = built.stats;
        const navigator = await loadNavigator({ THREE, geometry: built.geometry, obstacles: obstaclesFor(room) });
        if (disposed) return false;
        entry.navigator = navigator;
        return navigator.ready;
      } catch {
        entry.failed = true;
        return false;
      }
    });
    return entry;
  }
  function plan(room, start, end, mode = 'medium') {
    room = findRoom(room);
    const entry = initialize(room, mode);
    return entry?.navigator?.ready ? entry.navigator.plan(start, end) : planPath(start, end, obstaclesFor(room));
  }
  function advance(room, motion, target, dt, neighbors = [], speed = 1.1, mode = 'medium', final = true) {
    room = findRoom(room);
    const entry = !disposed && enabled(mode) ? entries.get(room?.id) : null;
    return entry?.navigator?.ready
      ? entry.navigator.advance(motion, target, dt, neighbors, speed, final)
      : safeAdvance(motion, target, dt, obstaclesFor(room), neighbors, speed, final);
  }
  function stats() {
    return { initialized: entries.size, ready: [...entries.values()].filter(entry => entry.navigator?.ready).length,
      rooms: [...entries.values()].map(entry => ({ id: entry.id, ready: Boolean(entry.navigator?.ready), failed: entry.failed, ...entry.grid })) };
  }
  function dispose() {
    disposed = true;
    for (const entry of entries.values()) entry.geometry?.dispose();
    entries.clear();
  }
  return { plan, advance, stats, dispose,
    async waitReady(room, mode = 'medium') { return await initialize(room, mode)?.promise || false; } };
}
