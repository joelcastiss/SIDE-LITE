// SIDE-LITE shows an alert only in explicit static preview or when the live game API cannot be reached.
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

// Check the API instead of showing a permanent outage notice on every visit.
if (location.hostname.toLowerCase() === 'joelcastiss.github.io' && new URLSearchParams(location.search).get('static') !== '1') {
 const showIntegrationNotice = async () => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
   const response = await fetch('https://hwwwoblfpsqqrkxvclag.supabase.co/functions/v1/side-lite-api/api/catalog', {
    headers: {apikey: 'sb_publishable_52fukw__BaCel-Igx5e0vg_RgsvhxiN'},
    cache: 'no-store', credentials: 'omit', signal: controller.signal
   });
   // The catalog requires a session, so an authorization rejection also
   // confirms that the API answered. A missing function or server error does not.
   if (response.ok || response.status === 401 || response.status === 403) return;
  } catch {
   // Network failures and timeouts cannot establish whether the API is reachable.
  } finally {
   clearTimeout(timeout);
  }
  const banner = document.createElement('div');
  banner.id = 'integration-preview-notice';
  banner.setAttribute('role', 'status');
  banner.style.cssText = 'padding:12px 18px;background:#fff4ce;color:#3c2900;text-align:center;font:600 14px Poppins,Arial,sans-serif';
  banner.textContent = 'No se pudo conectar con el servidor de partidas. Inténtalo más tarde.';
  document.body.prepend(banner);
 };
 if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', showIntegrationNotice, {once:true}); else showIntegrationNotice();
}
