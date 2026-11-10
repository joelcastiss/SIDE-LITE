// The static Pages entry has no server. Never present local-only authentication as working.
if (new URLSearchParams(location.search).get('static') === '1') {
 const showNotice = () => {
  const badge = document.querySelector('.badge');
  if (badge) badge.textContent = 'Vista previa';
  const banner = document.createElement('div');
  banner.id = 'static-preview-notice';
  banner.setAttribute('role', 'status');
  banner.style.cssText = 'padding:12px 18px;background:#fff4ce;color:#3c2900;text-align:center;font:600 14px Poppins,Arial,sans-serif';
  banner.textContent = 'Vista previa de la interfaz. El acceso y las partidas aún no están conectados en este enlace.';
  document.body.prepend(banner);
 };
 if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', showNotice, {once:true}); else showNotice();
 document.addEventListener('submit', event => {
  if (event.target?.id === 'lab-lite-form') return;
  event.preventDefault();
  event.stopImmediatePropagation();
  const message = document.querySelector('#modalRoot:not(.hidden) #access-message') || document.querySelector('#error');
  if (message) message.textContent = 'El acceso y las partidas aún no están conectados en este enlace.';
 }, true);
}

// Keep the integration warning visible until end-to-end production verification.
if (location.hostname.toLowerCase() === 'joelcastiss.github.io' && new URLSearchParams(location.search).get('static') !== '1') {
 const showIntegrationNotice = () => {
  const banner = document.createElement('div');
  banner.id = 'integration-preview-notice';
  banner.setAttribute('role', 'status');
  banner.style.cssText = 'padding:12px 18px;background:#fff4ce;color:#3c2900;text-align:center;font:600 14px Poppins,Arial,sans-serif';
  banner.textContent = 'Vista previa: el servidor de partidas todavía no está conectado. Usa ?static=1 para explorar con datos ficticios.';
  document.body.prepend(banner);
 };
 if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', showIntegrationNotice, {once:true}); else showIntegrationNotice();
}
