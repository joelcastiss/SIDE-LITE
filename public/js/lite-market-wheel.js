/* SIDE-LITE · Ruleta de mercado (JS puro, sin dependencias).
   La ruleta es SOLO una animación: el mercado ya viene asignado (Supabase) y la ruleta se detiene exactamente ahí.
   Uso:  SideRuleta.play({ marketId: 'miraflores' }).then(function(){ ...mostrar menú de decisiones... }) */
(function (global) {
  'use strict';
  var MARKETS = [
    { id: 'comas',         name: 'Comas',                color: '#e11d74', text: '#fff' },
    { id: 'independencia', name: 'Independencia',        color: '#6d28d9', text: '#fff' },
    { id: 'los-olivos',    name: 'Los Olivos',           color: '#f97316', text: '#1a0f00' },
    { id: 'smp',           name: 'San Martín de Porres', color: '#0ea5e9', text: '#04202e' },
    { id: 'sjl',           name: 'San Juan de Lurigancho', color: '#15803d', text: '#fff' },
    { id: 'miraflores',    name: 'Miraflores',           color: '#dc2626', text: '#fff' },
    { id: 'san-isidro',    name: 'San Isidro',           color: '#facc15', text: '#1a1200' },
    { id: 'surco',         name: 'Santiago de Surco',    color: '#a21caf', text: '#fff' },
    { id: 'la-molina',     name: 'La Molina',            color: '#2563eb', text: '#fff' },
    { id: 'centro-lima',   name: 'Cercado de Lima (Centro de Lima)', color: '#0f766e', text: '#fff' }
  ];
  var SPIN_MS = 1800, HOLD_MS = 800;

  function el(tag, cls, parent) {
    var n = document.createElement(tag); if (cls) n.className = cls; if (parent) parent.appendChild(n); return n;
  }

  function play(opts) {
    opts = opts || {};
    var markets = opts.markets || MARKETS;
    var idx = -1, i;
    for (i = 0; i < markets.length; i++) {
      if (markets[i].id === opts.marketId || markets[i].name === opts.marketName) { idx = i; break; }
    }
    if (idx < 0) { console.warn('SideRuleta: mercado no encontrado', opts); return Promise.resolve(false); }
    var spinMs = opts.spinMs || SPIN_MS, holdMs = opts.holdMs || HOLD_MS;
    var reduce = global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var n = markets.length, seg = 360 / n;

    return new Promise(function (resolve) {
      var overlay = el('div', 'rm-overlay');
      overlay.setAttribute('role', 'status');
      overlay.setAttribute('aria-label', '¿Qué mercado te tocó?');
      el('div', 'rm-rays', overlay);
      var stage = el('div', 'rm-stage', overlay);
      var skip = el('button', 'rm-skip', stage); skip.type = 'button'; skip.textContent = 'Omitir';
      el('div', 'rm-kicker', stage).textContent = 'SIDE-LITE · DESCUBRE TU MERCADO';
      el('h1', 'rm-title', stage).textContent = '¿Qué mercado te tocó?';
      var wrap = el('div', 'rm-wrap', stage);
      el('div', 'rm-pointer', wrap);
      var ring = el('div', 'rm-ring', wrap);
      for (i = 0; i < 16; i++) {
        var d = el('div', 'rm-dot', ring);
        d.style.transform = 'rotate(' + (i * 22.5) + 'deg) translateY(calc(var(--sz) * -.4745))';
      }
      var disc = el('div', 'rm-disc', ring);
      var stops = [];
      for (i = 0; i < n; i++) stops.push(markets[i].color + ' ' + (i * seg) + 'deg ' + ((i + 1) * seg) + 'deg');
      disc.style.background = 'conic-gradient(from ' + (-seg / 2) + 'deg,' + stops.join(',') + ')';
      for (i = 0; i < n; i++) {
        var lb = el('div', 'rm-label', disc);
        lb.textContent = markets[i].name; lb.style.color = markets[i].text;
        lb.style.transform = 'rotate(' + (i * seg) + 'deg) translateY(calc(var(--sz) * -.37))';
      }
      var hub = el('div', 'rm-hub', ring);
      hub.innerHTML = '<svg viewBox="0 0 24 24" fill="#fff7d6" stroke="#b45309" stroke-width="1.2" stroke-linejoin="round" aria-hidden="true"><path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5L2.5 9.4l6.6-.9z"/></svg>';
      var res = el('div', 'rm-result', stage); res.setAttribute('aria-live', 'polite');
      var badge = el('div', 'rm-badge', res); badge.textContent = 'Tu mercado es: ' + markets[idx].name;
      var colors = ['#facc15', '#22d3ee', '#e11d74', '#fff'];
      for (i = 0; i < 16; i++) {
        var s = el('span', 'rm-spark', wrap), a = (i / 16) * 2 * Math.PI, r = 200 + Math.random() * 90;
        s.style.left = '50%'; s.style.top = '50%'; s.style.background = colors[i % 4];
        s.style.setProperty('--dx', Math.round(Math.cos(a) * r) + 'px'); s.style.setProperty('--dy', Math.round(Math.sin(a) * r) + 'px');
      }
      document.body.appendChild(overlay);

      var finished = false, timers = [];
      function finish() {
        if (finished) return; finished = true;
        timers.forEach(clearTimeout);
        overlay.classList.add('rm-out');
        setTimeout(function () { if (overlay.parentNode) overlay.parentNode.removeChild(overlay); resolve(true); if (opts.onDone) opts.onDone(markets[idx]); }, 260);
      }
      skip.addEventListener('click', finish);

      // Giro: 4 vueltas completas + ángulo que deja el segmento idx bajo el puntero (arriba), con variación dentro del segmento.
      var jitter = (Math.random() - 0.5) * seg * 0.6;
      var finalDeg = 360 * 4 + (360 - idx * seg) + jitter;
      requestAnimationFrame(function () {
        overlay.classList.add('rm-in');
        requestAnimationFrame(function () {
          if (reduce) { disc.style.transform = 'rotate(' + (360 - idx * seg) + 'deg)'; reveal(); return; }
          disc.style.transition = 'transform ' + spinMs + 'ms cubic-bezier(.12,.7,.1,1)';
          disc.style.transform = 'rotate(' + finalDeg + 'deg)';
          timers.push(setTimeout(reveal, spinMs));
        });
      });
      function reveal() { stage.classList.add('rm-win'); overlay.classList.add('rm-win'); timers.push(setTimeout(finish, holdMs)); }
    });
  }

  // Muestra la ruleta una sola vez por empresa y partida (no al recargar la página).
  function playOnce(opts) {
    var key = 'side_ruleta_' + (opts.partidaId || '') + '_' + (opts.companyId || '');
    try { if (global.localStorage.getItem(key)) return Promise.resolve(false); } catch (e) {}
    if (!MARKETS.some(function (market) { return market.id === opts.marketId; })) return Promise.resolve(false);
    try { global.localStorage.setItem(key, '1'); } catch (e) {}
    return play(opts);
  }

  global.SideRuleta = { play: play, playOnce: playOnce, MARKETS: MARKETS };
})(window);
