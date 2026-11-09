/* Estructura de la ventana de decisiones de SIDE, conectada al formulario real de Lite. */
const app = document.querySelector('#app');
const icons = 'assets/original/categories/';
function card(title, icon, id, node) {
  const section = document.createElement('section');
  section.className = 'decision-card';
  section.id = id;
  const head = document.createElement('div');
  head.className = 'decision-card-art';
  const image = document.createElement('img'); image.src = icons + icon; image.alt = '';
  const text = document.createElement('div');
  const heading = document.createElement('h3'); heading.textContent = title;
  text.append(heading); head.append(image, text); section.append(head, node);
  return section;
}
function enhanceStudent() {
  const form = app.querySelector('#decision');
  if (!form || form.dataset.sideOriginal) return;
  form.dataset.sideOriginal = 'true';
  const panel = form.closest('.panel'); panel.classList.add('lite-student-decisions', 'decision-window');
  const title = document.createElement('div'); title.className = 'decision-detail-head';
  title.innerHTML = '<div class="detail-heading"><img src="' + icons + 'canales_ventas.svg" alt=""><div><span>SECCIÓN DE DECISIÓN</span><h1>Decisiones de tu empresa</h1><p>Prepara y confirma tus decisiones para este ciclo.</p></div></div>';
  panel.insertBefore(title, form);
  const nav = document.createElement('nav'); nav.className = 'decision-tabs'; nav.setAttribute('aria-label', 'Decisiones');
  for (const [id, label, icon] of [['lite-quality','Calidad','insumos.svg'], ['lite-quantity','Cantidad','inversiones.svg'], ['lite-price','Precio','canales_ventas.svg'], ['lite-marketing','Marketing','finanzas.svg']]) {
    const link = document.createElement('a'); link.href = '#' + id;
    const img = document.createElement('img'); img.src = icons + icon; img.alt = '';
    const span = document.createElement('span'); span.textContent = label; link.append(img, span);
    link.addEventListener('click', event => { event.preventDefault(); document.getElementById(id)?.scrollIntoView({behavior: 'smooth', block:'start'}); });
    nav.append(link);
  }
  panel.insertBefore(nav, title);
  const quality = form.querySelector('select[name=quality]').closest('label');
  const row = form.querySelector('.row');
  const quantity = row.querySelector('input[name=quantity]').closest('label');
  const price = row.querySelector('input[name=price]').closest('label');
  const marketing = form.querySelector('.campaign-section');
  const cards = document.createElement('div'); cards.className = 'decision-cards';
  form.insertBefore(cards, quality);
  cards.append(card('Calidad', 'insumos.svg', 'lite-quality', quality), card('Cantidad', 'inversiones.svg', 'lite-quantity', quantity), card('Precio', 'canales_ventas.svg', 'lite-price', price), card('Marketing', 'finanzas.svg', 'lite-marketing', marketing));
  row.remove();
  const actions = form.querySelector('.inline'); if (actions) actions.classList.add('section-save-bar');
}
new MutationObserver(enhanceStudent).observe(app, {childList: true});
enhanceStudent();
