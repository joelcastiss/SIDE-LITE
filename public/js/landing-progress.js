/* El porcentaje es una animación estimada de dos segundos. El 100 % y el
   acceso esperan también a que terminen de cargar los recursos necesarios. */
(() => {
  const progress = document.getElementById('landingProgress');
  const text = document.getElementById('landingProgressText');
  const button = document.getElementById('startBtn');
  if (!progress || !text || !button) return;

  let percent = 0;
  let ready = false;
  let failed = false;
  const render = () => {
    progress.style.setProperty('--landing-progress', `${percent}%`);
    progress.setAttribute('aria-valuenow', String(percent));
    progress.setAttribute('aria-valuetext', percent === 100 ? 'Página cargada' : `Preparando página: ${percent} % estimado`);
    text.textContent = `${percent}%`;
  };
  render();
  const timer = setInterval(() => {
    if (failed) return;
    if (percent < 99) percent += 1;
    else if (ready) {
      percent = 100;
      clearInterval(timer);
      progress.classList.add('is-complete');
      button.disabled = false;
    }
    render();
  }, 20);

  const finish = async () => {
    try {
      await Promise.all([
        document.fonts.ready,
        ...Array.from(document.querySelectorAll('#landing img'), image => image.decode())
      ]);
      if (typeof showScreen !== 'function') throw new Error('No se pudo preparar la navegación');
      ready = true;
    } catch (error) {
      failed = true;
      clearInterval(timer);
      progress.classList.add('has-error');
      progress.removeAttribute('aria-valuenow');
      progress.setAttribute('aria-valuetext', 'No se pudo completar la carga');
      text.textContent = 'No se pudo cargar';
      console.error('SIDE: error al preparar la portada', error);
    }
  };
  if (document.readyState === 'complete') finish();
  else window.addEventListener('load', finish, { once: true });
})();
