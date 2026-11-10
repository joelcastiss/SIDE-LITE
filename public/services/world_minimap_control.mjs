// DOM-only controls for the city map. Zone navigation stays with world_orientation.
export function createWorldMinimapControl({ root }) {
  if (!root) throw new TypeError('root is required');
  const panel = root.querySelector('#simMinimap');
  const toggle = root.querySelector('#simCityMapToggle');
  const map = root.querySelector('#simCityMapArea');
  const list = root.querySelector('#simCityZoneList');
  if (!panel || !toggle || !map || !list) throw new Error('Faltan controles del mapa de la ciudad');

  const zoneButtons = [...map.querySelectorAll('.sim-city-zone')];
  if (!zoneButtons.length) throw new Error('Primero se deben crear las zonas del mapa');
  let expanded = false;

  for (const source of zoneButtons) {
    const choice = document.createElement('button');
    choice.type = 'button';
    choice.className = 'sim-city-zone-choice';
    choice.dataset.zone = source.dataset.zone;
    choice.textContent = source.querySelector('span')?.textContent || source.getAttribute('aria-label') || source.dataset.zone;
    choice.addEventListener('click', () => source.click());
    list.append(choice);
  }

  function setExpanded(open, { restoreFocus = false } = {}) {
    expanded = Boolean(open);
    panel.classList.toggle('sim-city-map-open', expanded);
    panel.setAttribute('role', expanded ? 'dialog' : 'region');
    if (expanded) panel.setAttribute('aria-modal', 'true');
    else panel.removeAttribute('aria-modal');
    toggle.setAttribute('aria-expanded', String(expanded));
    toggle.setAttribute('aria-label', expanded ? 'Cerrar mapa' : 'Ampliar mapa');
    toggle.title = expanded ? 'Cerrar mapa' : 'Ampliar mapa';
    toggle.textContent = expanded ? '×' : '⛶';
    if (expanded || restoreFocus) toggle.focus();
  }

  function onToggle() { setExpanded(!expanded, { restoreFocus: expanded }); }
  function onMapClick(event) {
    const zone = event.target.closest('.sim-city-zone');
    if (zone && expanded) setExpanded(false, { restoreFocus: true });
    else if (!zone && !expanded) setExpanded(true);
  }
  function onKeydown(event) {
    if (!expanded) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      setExpanded(false, { restoreFocus: true });
      return;
    }
    if (event.key !== 'Tab') return;
    const controls = [toggle, ...map.querySelectorAll('.sim-city-zone'), ...list.querySelectorAll('button')];
    const first = controls[0], last = controls.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }

  toggle.addEventListener('click', onToggle);
  map.addEventListener('click', onMapClick);
  document.addEventListener('keydown', onKeydown);

  return {
    setExpanded,
    get expanded() { return expanded; },
    destroy() {
      toggle.removeEventListener('click', onToggle);
      map.removeEventListener('click', onMapClick);
      document.removeEventListener('keydown', onKeydown);
      setExpanded(false);
      list.replaceChildren();
    }
  };
}
