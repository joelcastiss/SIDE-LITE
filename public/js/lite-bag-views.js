/* Administra los contextos WebGL únicamente mientras Calidad está visible. */
(function (global) {
  'use strict';
  function create(screen, cards) {
    const stages = [...cards.querySelectorAll('.bag-stage')];
    const views = new Map();
    const visible = new Map();
    let mounted = false, closed = false;
    const motion = global.matchMedia?.('(max-width: 800px)');
    function activity(stage) {
      const view = views.get(stage);
      if (view) view.setActive(!document.hidden && visible.get(stage) !== false);
    }
    const intersection = global.IntersectionObserver ? new IntersectionObserver(entries => {
      entries.forEach(entry => { visible.set(entry.target, entry.isIntersecting); activity(entry.target); });
    }, {threshold: 0.01}) : null;
    const resize = global.ResizeObserver ? new ResizeObserver(entries => {
      entries.forEach(entry => {
        const view = views.get(entry.target);
        if (!view) return;
        const width = Math.max(1, Math.round(entry.contentRect.width));
        const height = Math.max(1, Math.round(entry.contentRect.height));
        view.resize(width, height);
      });
    }) : null;
    function unmount() {
      if (!mounted) return;
      intersection?.disconnect(); resize?.disconnect();
      stages.forEach(stage => {
        const view = views.get(stage);
        if (view) {
          try { view.dispose(); } catch (_) { /* no bloquear decisiones */ }
          const canvas = stage.querySelector('canvas');
          canvas.replaceWith(canvas.cloneNode(false));
        }
        stage.classList.add('no-webgl');
      });
      views.clear(); visible.clear(); mounted = false;
    }
    function mount() {
      mounted = true;
      let supported = false;
      try { supported = !!global.SideBags?.supported(); } catch (_) { /* respaldo */ }
      if (!supported) return;
      stages.forEach(stage => {
        try {
          const rect = stage.getBoundingClientRect();
          const modest = motion?.matches || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4) || (navigator.deviceMemory && navigator.deviceMemory <= 4);
          const view = global.SideBags.mount(stage.querySelector('canvas'), stage.dataset.bag, {
            width: Math.max(1, Math.round(rect.width)), height: Math.max(1, Math.round(rect.height)),
            quality: modest ? 'baja' : 'media', sparkles: !modest
          });
          views.set(stage, view); stage.classList.remove('no-webgl');
          visible.set(stage, !intersection); activity(stage);
          intersection?.observe(stage); resize?.observe(stage);
        } catch (_) { stage.classList.add('no-webgl'); }
      });
    }
    function sync() {
      if (closed) return;
      const panel = cards.querySelector('[data-panel="quality"]');
      const shouldMount = screen.isConnected && !screen.classList.contains('hidden') && panel && !panel.hidden;
      if (shouldMount && !mounted) mount();
      else if (!shouldMount) unmount();
    }
    const mutation = new MutationObserver(sync);
    mutation.observe(screen, {attributes: true, attributeFilter: ['class']});
    document.addEventListener('visibilitychange', onVisibility);
    function onVisibility() { stages.forEach(activity); }
    return {
      sync,
      spin(value) {
        const stage = stages.find(el => el.parentElement.dataset.value === value);
        try { views.get(stage)?.spin(); } catch (_) { /* presentación opcional */ }
      },
      dispose() { closed = true; mutation.disconnect(); document.removeEventListener('visibilitychange', onVisibility); unmount(); }
    };
  }
  global.SIDELiteBagViews = {create};
})(window);
