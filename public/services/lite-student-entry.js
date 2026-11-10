(function (global) {
  'use strict';
  const form = document.getElementById('studentForm');
  if (!form || !global.SIDLiteGame) return;
  const code = document.getElementById('gameCode');
  if (code) code.placeholder = 'Código de 8 caracteres';
  document.addEventListener('submit', async event => {
    if (event.target !== form) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const message = document.getElementById('studentMessage');
    const submit = form.querySelector('[type="submit"]');
    if (submit?.disabled) return;
    if (submit) submit.disabled = true;
    if (message) message.textContent = 'Validando ingreso…';
    try {
      const company = await global.SIDLiteGame.joinGame({
        code: code?.value,
        name: document.getElementById('companyLegalName')?.value,
        brand: document.getElementById('companyBrandName')?.value
      });
      if (!global.SIDELiteDecisions?.mount) throw new Error('No se pudo cargar la pantalla de la partida.');
      document.getElementById('modalRoot')?.classList.add('hidden');
      await global.SIDELiteDecisions.mount({gameId: company.game_id, showScreen(id) {
        document.querySelectorAll('#app > .screen').forEach(el => el.classList.toggle('hidden', el.id !== id));
        global.scrollTo(0, 0);
      }});
    } catch (error) {
      if (message) message.textContent = error.message || 'No se pudo ingresar. Intenta nuevamente.';
    } finally {
      if (submit) submit.disabled = false;
    }
  }, true);
})(window);
