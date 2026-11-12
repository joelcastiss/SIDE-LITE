(function (global) {
  'use strict';
  const queue = [], seen = new Set();
  let showing = false;
  const duration = value => Math.max(4000, Math.min(6000, Number(value) || 5000));
  function next() {
    if (showing || !queue.length) return;
    showing = true;
    const item = queue.shift();
    const host = typeof item.host === 'function' ? item.host() : item.host;
    if (!host) { showing = false; next(); return; }
    const banner = document.createElement('div');
    const tone = ['favorable', 'desfavorable', 'neutro'].includes(item.tono) ? item.tono : 'neutro';
    banner.className = 'side-event-flash side-event-flash--' + tone;
    banner.setAttribute('role', 'status'); banner.setAttribute('aria-live', 'polite');
    const tag = document.createElement('span'); tag.className = 'side-event-flash__tag';
    tag.textContent = {favorable:'Noticia favorable', desfavorable:'Noticia desfavorable', neutro:'Noticia del mercado'}[tone];
    const title = document.createElement('strong'); title.textContent = item.titulo;
    const text = document.createElement('span'); text.textContent = item.texto || '';
    banner.append(tag, title, text); host.prepend(banner);
    requestAnimationFrame(() => banner.classList.add('is-in'));
    setTimeout(() => { banner.remove(); showing = false; next(); }, duration(item.duracion));
  }
  global.SideEventFlash = {
    show(item) {
      if (!item?.id || !item?.ciclo || !item?.titulo) return false;
      const key = 'side-event-flash:' + JSON.stringify([item.partida || '', item.ciclo, item.id]);
      if (seen.has(key)) return false;
      try { if (global.localStorage.getItem(key)) return false; global.localStorage.setItem(key, '1'); } catch (_) { /* Memory still prevents repeats during this session. */ }
      seen.add(key); queue.push(item); next(); return true;
    }
  };
})(window);
