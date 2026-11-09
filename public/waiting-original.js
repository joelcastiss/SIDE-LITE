/* Sala de espera basada en studentWaiting de SIDE; el inicio sigue a cargo del servidor Lite. */
const app = document.querySelector('#app');
function renderWaiting() {
  const intro = app.querySelector('.student-waiting .waiting-intro');
  if (!intro || intro.dataset.originalWaiting) return;
  intro.dataset.originalWaiting = 'true';
  const [eyebrow, heading, description] = intro.children;
  const header = document.createElement('header'); header.className = 'waiting-header';
  const title = document.createElement('div'); title.className = 'waiting-heading';
  eyebrow.className = 'eyebrow'; title.append(eyebrow, heading, description);
  const status = document.createElement('div'); status.className = 'waiting-status';
  const clock = document.createElement('div'); clock.className = 'waiting-clock'; clock.setAttribute('role', 'status');
  const label = document.createElement('span'); label.textContent = 'TIEMPO DE SALA DE ESPERA';
  const value = document.createElement('strong'); value.textContent = '--:--';
  const note = document.createElement('small'); note.textContent = 'Esperando inicio del docente';
  clock.append(label, value, note); status.append(clock); header.append(title, status); intro.append(header);
}
new MutationObserver(renderWaiting).observe(app, {childList:true, subtree:true});
renderWaiting();
