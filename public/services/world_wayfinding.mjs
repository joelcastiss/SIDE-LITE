// DOM-only mobile guide. Geometry is pure so narrow viewports can be tested
// without starting the Three.js scene.
const GUIDE_WIDTH = 130;
const GUIDE_HEIGHT = 44;

function intersects(a, b, gap = 8) {
  return a.left < b.right + gap && a.right > b.left - gap
    && a.top < b.bottom + gap && a.bottom > b.top - gap;
}

export function computeEdgeArrow({ width, height, dx, dy, safe = {}, obstacles = [] }) {
  if (!(width > GUIDE_WIDTH + 28 && height > GUIDE_HEIGHT + 28)) return null;
  const inset = {
    left: Math.max(12, Number(safe.left) || 0) + 12,
    right: Math.max(12, Number(safe.right) || 0) + 12,
    top: Math.max(12, Number(safe.top) || 0) + 12,
    bottom: Math.max(12, Number(safe.bottom) || 0) + 12
  };
  const halfW = GUIDE_WIDTH / 2, halfH = GUIDE_HEIGHT / 2;
  const limits = { left: inset.left + halfW, right: width - inset.right - halfW,
    top: inset.top + halfH, bottom: height - inset.bottom - halfH };
  if (limits.left > limits.right || limits.top > limits.bottom) return null;
  const vx = Number.isFinite(dx) ? dx : 0;
  const vy = Number.isFinite(dy) ? dy : 0;
  const dirX = Math.abs(vx) + Math.abs(vy) < 1e-5 ? 0 : vx;
  const dirY = Math.abs(vx) + Math.abs(vy) < 1e-5 ? 1 : vy;
  const cx = width / 2, cy = height / 2;
  const tx = dirX > 0 ? (limits.right - cx) / dirX : dirX < 0 ? (limits.left - cx) / dirX : Infinity;
  const ty = dirY > 0 ? (limits.bottom - cy) / dirY : dirY < 0 ? (limits.top - cy) / dirY : Infinity;
  const scale = Math.min(tx, ty);
  const preferredX = Math.max(limits.left, Math.min(limits.right, cx + dirX * scale));
  const preferredY = Math.max(limits.top, Math.min(limits.bottom, cy + dirY * scale));
  const primary = tx < ty ? 'vertical' : 'horizontal';
  const sides = primary === 'vertical'
    ? [dirX >= 0 ? 'right' : 'left', dirY >= 0 ? 'bottom' : 'top', dirY >= 0 ? 'top' : 'bottom', dirX >= 0 ? 'left' : 'right']
    : [dirY >= 0 ? 'bottom' : 'top', dirX >= 0 ? 'right' : 'left', dirX >= 0 ? 'left' : 'right', dirY >= 0 ? 'top' : 'bottom'];
  const candidates = [];
  for (const side of sides) {
    const horizontal = side === 'top' || side === 'bottom';
    const start = horizontal ? preferredX : preferredY;
    const min = horizontal ? limits.left : limits.top;
    const max = horizontal ? limits.right : limits.bottom;
    for (let shift = 0; shift <= Math.max(width, height); shift += 14) {
      for (const sign of shift ? [1, -1] : [1]) {
        const coordinate = Math.max(min, Math.min(max, start + sign * shift));
        const x = horizontal ? coordinate : limits[side];
        const y = horizontal ? limits[side] : coordinate;
        const box = { left: x - halfW, right: x + halfW, top: y - halfH, bottom: y + halfH };
        if (obstacles.some(obstacle => intersects(box, obstacle))) continue;
        candidates.push({ x, y, side, box, score: (sides.indexOf(side) * 200) + Math.abs(coordinate - start) });
      }
      if (candidates.length) break;
    }
    if (candidates.length) break;
  }
  if (!candidates.length) return null;
  candidates.sort((a, b) => a.score - b.score);
  const { x, y, side, box } = candidates[0];
  return { x, y, side, box, angle: Math.atan2(dirY, dirX) * 180 / Math.PI };
}

export function computeBannerPosition({ width, height, bannerWidth, bannerHeight, obstacles = [], safe = {} }) {
  const half = bannerWidth / 2;
  const left = (Number(safe.left) || 0) + 10;
  const right = width - (Number(safe.right) || 0) - 10;
  const top = (Number(safe.top) || 0) + 10;
  const bottom = height - (Number(safe.bottom) || 0) - 10;
  const xs = [width / 2, left + half, right - half];
  const ys = [Math.max(top + 72, height * .27), height * .4, height * .55, top + bannerHeight / 2];
  for (const y of ys) for (const x of xs) {
    const box = { left: x - half, right: x + half, top: y - bannerHeight / 2, bottom: y + bannerHeight / 2 };
    if (box.left < left || box.right > right || box.top < top || box.bottom > bottom) continue;
    if (obstacles.some(obstacle => intersects(box, obstacle, 6))) continue;
    return { x, y, box };
  }
  return null;
}

function localRect(element, rootRect) {
  const rect = element.getBoundingClientRect();
  return { left: rect.left - rootRect.left, right: rect.right - rootRect.left,
    top: rect.top - rootRect.top, bottom: rect.bottom - rootRect.top };
}

/** Keep transient zone notices clear of touch controls; guidance stays on the map. */
export function createWorldWayfinding({ THREE, root }) {
  if (!THREE || !root) throw new TypeError('THREE and root are required');
  const safeProbe = document.createElement('div');
  safeProbe.className = 'sim-safe-probe';
  root.append(safeProbe);
  const banner = root.querySelector('#simZoneBanner');
  let lastRender = -Infinity;

  function environment(rect) {
    const safeStyle = getComputedStyle(safeProbe);
    const safe = { top: parseFloat(safeStyle.paddingTop) || 0, right: parseFloat(safeStyle.paddingRight) || 0,
      bottom: parseFloat(safeStyle.paddingBottom) || 0, left: parseFloat(safeStyle.paddingLeft) || 0 };
    const obstacles = ['.sim3d-touch-controls', '.sim3d-actionbar', '.sim-city-map', '.sim-world-location',
      '.sim3d-metrics-drawer', '.sim3d-missions', '.sim3d-stats']
      .flatMap(selector => [...root.querySelectorAll(selector)])
      .filter(node => getComputedStyle(node).display !== 'none' && node.getBoundingClientRect().width > 0)
      .map(node => localRect(node, rect));
    return { safe, obstacles };
  }

  function update({ now = performance.now() } = {}) {
    if (now - lastRender < 120) return;
    lastRender = now;
    const rect = root.getBoundingClientRect();
    const coarse = matchMedia('(pointer: coarse)').matches;
    const mobile = coarse || rect.width <= 560;
    if (mobile && banner && !banner.hidden && !root.querySelector('.sim-city-map-open')) {
      const { safe, obstacles } = environment(rect);
      const size = banner.getBoundingClientRect();
      const position = computeBannerPosition({ width: rect.width, height: rect.height,
        bannerWidth: size.width, bannerHeight: size.height, safe, obstacles });
      if (position) { banner.style.left = `${position.x}px`; banner.style.top = `${position.y - size.height / 2}px`; }
    } else if (banner) { banner.style.removeProperty('left'); banner.style.removeProperty('top'); }
  }

  function destroy() {
    safeProbe.remove();
    banner?.style.removeProperty('left'); banner?.style.removeProperty('top');
  }
  return { update, destroy };
}
