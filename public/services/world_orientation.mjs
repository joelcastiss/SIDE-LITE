// SIDE city orientation lives on the minimap, without labels over the playfield.
export const CITY_ZONE_ICONS = Object.freeze({
  store: 'assets/icons/categories/canales_ventas.svg',
  warehouse: 'assets/icons/categories/insumos.svg',
  production: 'assets/icons/categories/infraestructura.svg',
  office: 'assets/icons/categories/recursos_humanos.svg',
  bank: 'assets/icons/categories/finanzas.svg',
  suppliers: 'assets/icons/categories/insumos.svg',
  news: 'assets/icons/teacher/rondas.svg'
});

export const DEFAULT_CITY_BOUNDS = Object.freeze({ minX: -88, maxX: 88, minZ: -88, maxZ: 88 });

export function mapPoint(x, z, bounds = DEFAULT_CITY_BOUNDS) {
  const width = bounds.maxX - bounds.minX || 1;
  const depth = bounds.maxZ - bounds.minZ || 1;
  return {
    x: Math.max(0, Math.min(100, (x - bounds.minX) / width * 100)),
    y: Math.max(0, Math.min(100, (z - bounds.minZ) / depth * 100))
  };
}

export function closestCityZone(x, z, zones, radius = 11) {
  let nearest = null, best = radius * radius;
  for (const zone of zones || []) {
    const d = (zone.x - x) ** 2 + (zone.z - z) ** 2;
    if (d < best) { best = d; nearest = zone.id; }
  }
  return nearest;
}

const SHORT_ZONE_NAMES = Object.freeze({ suppliers: 'Proveed.', news: 'Noticias' });
const intersects = (a, b, gap = 5) => a.left < b.right + gap && a.right > b.left - gap && a.top < b.bottom + gap && a.bottom > b.top - gap;

/** Select label positions without touching the DOM, so mobile layouts can be tested. */
export function layoutZoneLabels({ candidates, width, height, obstacles = [], targetZone = null, currentZone = null, maxLabels = width <= 560 ? 3 : width <= 800 ? 5 : 7 }) {
  const margin = 12;
  const cap = Math.max(1, maxLabels);
  const occupied = [];
  const placements = [];
  const ordered = [...candidates].filter(item => item.point || item.zone.id === targetZone)
    .sort((a, b) => (b.zone.id === targetZone) - (a.zone.id === targetZone)
      || (b.zone.id === currentZone) - (a.zone.id === currentZone)
      || (a.point?.distance ?? Infinity) - (b.point?.distance ?? Infinity));
  const makeBox = (x, y, w, h) => ({ left: x - w / 2, right: x + w / 2, top: y - h / 2, bottom: y + h / 2 });
  const fits = box => box.left >= margin && box.right <= width - margin && box.top >= margin && box.bottom <= height - margin
    && ![...obstacles, ...occupied].some(other => intersects(box, other));
  for (const { zone, point } of ordered) {
    if (placements.length >= cap) break;
    const full = zone.name;
    const short = SHORT_ZONE_NAMES[zone.id] || full;
    const names = full === short ? [full] : [full, short];
    const anchorX = point?.x ?? width / 2;
    const anchorY = point?.y ?? height * .32;
    const shifts = [[0, 0], [0, -36], [0, 36], [-64, 0], [64, 0], [-64, -36], [64, -36], [-64, 36], [64, 36]];
    let chosen = null;
    for (const name of names) {
      const boxWidth = Math.max(width <= 560 ? 88 : 98, 39 + name.length * (width <= 560 ? 7.4 : 7.8));
      const boxHeight = width <= 560 ? 34 : 30;
      const centers = shifts.map(([dx, dy]) => [Math.max(margin + boxWidth / 2, Math.min(width - margin - boxWidth / 2, anchorX + dx)), Math.max(margin + boxHeight / 2, Math.min(height - margin - boxHeight / 2, anchorY + dy))]);
      if (zone.id === targetZone) {
        for (let y = 110; y < height - 24; y += 38) for (let x = margin + boxWidth / 2; x <= width - margin - boxWidth / 2; x += 34) centers.push([x, y]);
      }
      for (const [x, y] of centers) {
        const box = makeBox(x, y, boxWidth, boxHeight);
        if (!fits(box)) continue;
        chosen = { id: zone.id, x, y, text: name, abbreviated: name !== full, box, distance: point?.distance ?? Infinity };
        break;
      }
      if (chosen) break;
    }
    if (chosen) { occupied.push(chosen.box); placements.push(chosen); }
  }
  return placements;
}

/**
 * Coordinates in `zones` and `bounds` are local to the city; player/camera
 * coordinates are absolute world coordinates. `onNavigate(id, zone)` is called
 * by a map click. The caller chooses whether to mark a walking destination or
 * focus the camera. No teleport or game state mutation happens in this module.
 */
export function createWorldOrientation({ THREE, root, zones, bounds = DEFAULT_CITY_BOUNDS, offsetX = 150, onNavigate = () => {} }) {
  if (!THREE || !root) throw new TypeError('THREE and root are required');
  const zoneList = [...(zones || [])];
  const byId = new Map(zoneList.map(zone => [zone.id, zone]));
  const map = root.querySelector('#simCityMapArea');
  const dot = root.querySelector('#miniPlayer');
  const labelsRoot = root.querySelector('#simZoneLabels');
  const banner = root.querySelector('#simZoneBanner');
  const routeMarker = root.querySelector('#simRouteMarker');
  if (!map || !dot || !banner) throw new Error('Faltan elementos de orientación del mundo');
  // Remove legacy overlay containers as well as their children. Destination
  // guidance belongs to the existing objective button and the map icons.
  labelsRoot?.remove();
  routeMarker?.remove();

  const buttons = new Map();
  let currentZone = null, targetZone = null, bannerTimer = 0, lastRender = -Infinity;
  let latestPlayer = null;

  for (const zone of zoneList) {
    const point = mapPoint(zone.x, zone.z, bounds);
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'sim-city-zone';
    button.dataset.zone = zone.id;
    button.style.left = `${7 + point.x * .86}%`; button.style.top = `${7 + point.y * .86}%`;
    button.title = `Ir a ${zone.name}`;
    button.setAttribute('aria-label', `Ir a ${zone.name}`);
    const icon = document.createElement('img');
    icon.src = CITY_ZONE_ICONS[zone.id] || CITY_ZONE_ICONS.store;
    icon.alt = '';
    const name = document.createElement('span'); name.textContent = zone.name;
    button.append(icon, name);
    button.addEventListener('click', () => { setTarget(zone.id); onNavigate(zone.id, zone); });
    map.append(button); buttons.set(zone.id, button);

  }

  function setTarget(id) {
    targetZone = byId.has(id) ? id : null;
    buttons.forEach((button, key) => button.classList.toggle('is-target', key === targetZone));
  }

  function setActiveZone(id, announce = true) {
    const next = byId.has(id) ? id : null;
    if (next === currentZone) return;
    currentZone = next;
    buttons.forEach((button, key) => button.classList.toggle('is-current', key === currentZone));
    if (!next || !announce) return;
    banner.textContent = byId.get(next).name;
    banner.hidden = false;
    clearTimeout(bannerTimer);
    bannerTimer = setTimeout(() => { banner.hidden = true; }, 2600);
  }

  function update({ player, activeZone, targetZone: target, yaw = 0, now = performance.now() } = {}) {
    if (target !== undefined && target !== targetZone) setTarget(target);
    if (activeZone !== undefined) setActiveZone(activeZone);
    if (player) latestPlayer = player;
    if (!latestPlayer || now - lastRender < 100) return;
    lastRender = now;
    const point = mapPoint(latestPlayer.x - offsetX, latestPlayer.z, bounds);
    // These coordinates match js/simulator3d.js's existing 7–93% mapping.
    dot.style.left = `${7 + point.x * .86}%`;
    dot.style.top = `${7 + point.y * .86}%`;
    dot.style.rotate = `${-yaw * 180 / Math.PI}deg`;
  }

  function destroy() {
    clearTimeout(bannerTimer);
    buttons.forEach(button => button.remove()); banner.hidden = true;
  }

  return { update, setTarget, setActiveZone, destroy, get activeZone() { return currentZone; }, get targetZone() { return targetZone; } };
}
