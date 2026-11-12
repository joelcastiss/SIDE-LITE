(function (global) {
  'use strict';
  const form = document.getElementById('studentForm');
  if (!form || !global.SIDLiteGame) return;
  let mounted = false;
  let admissionVersion = 0;
  let studentSelected = new URLSearchParams(global.location.search).has('partida');
  document.querySelectorAll('.profile-card').forEach(card => card.addEventListener('click', () => {
    admissionVersion++;
    studentSelected = card.dataset.profile === 'student';
  }, true));
  const code = document.getElementById('gameCode');
  if (code) code.placeholder = 'Ej. A7K2M';
  async function openCompany(company) {
    if (!global.SIDELiteDecisions?.mount) throw new Error('No se pudo cargar la pantalla de la partida.');
    const saved = JSON.parse(global.localStorage.getItem('side-lite-guest-' + company.game_id) || 'null');
    if (saved?.code) global.localStorage.setItem('side-lite-guest-last', JSON.stringify({gameId: company.game_id, code: saved.code}));
    document.getElementById('modalRoot')?.classList.add('hidden');
    await global.SIDELiteDecisions.mount({gameId: company.game_id, showScreen(id) {
      document.querySelectorAll('#app > .screen').forEach(el => el.classList.toggle('hidden', el.id !== id));
      global.scrollTo(0, 0);
    }});
    mounted = true;
    let details = document.getElementById('liteRecoveryDetails');
    if (!details) {
      details = document.createElement('details'); details.id = 'liteRecoveryDetails';
      const summary = document.createElement('summary'); summary.textContent = 'Clave privada de recuperación';
      const help = document.createElement('p'); help.textContent = 'Guarda esta clave en un lugar seguro para recuperar tu empresa en otro dispositivo. No la compartas.';
      const value = document.createElement('code'); value.style.overflowWrap = 'anywhere';
      details.append(summary, help, value); document.getElementById('studentLobby')?.append(details);
    }
    details.querySelector('code').textContent = saved?.secret || 'No disponible en este navegador.';
  }
  document.addEventListener('submit', async event => {
    if (event.target !== form) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const message = document.getElementById('studentMessage');
    const submit = form.querySelector('[type="submit"]');
    if (submit?.disabled) return;
    if (submit) submit.disabled = true;
    if (message) message.textContent = 'Validando ingreso…';
    const version = admissionVersion;
    try {
      const company = await global.SIDLiteGame.joinGame({
        code: code?.value,
        name: document.getElementById('companyLegalName')?.value,
        brand: document.getElementById('companyBrandName')?.value
      });
      if (studentSelected && version === admissionVersion) await openCompany(company);
    } catch (error) {
      if (message) message.textContent = error.message || 'No se pudo ingresar. Intenta nuevamente.';
    } finally {
      if (submit) submit.disabled = false;
    }
  }, true);
  document.getElementById('liteRecoveryForm')?.addEventListener('submit', async event => {
    event.preventDefault();
    const button = event.currentTarget.querySelector('button'), message = document.getElementById('studentMessage');
    button.disabled = true;
    const version = admissionVersion;
    try {
      const fields = new FormData(event.currentTarget);
      const company = await global.SIDLiteGame.recoverGame(fields.get('code'), fields.get('secret'));
      if (studentSelected && version === admissionVersion) await openCompany(company);
    } catch (error) { if (message) message.textContent = error.message || 'No se pudo recuperar la empresa.'; }
    finally { button.disabled = false; }
  });
  document.getElementById('backToProfiles')?.addEventListener('click', () => { mounted = false; global.localStorage.removeItem('side-lite-guest-last'); });
  // Recovery is initiated explicitly with the code or recovery form.
})(window);
