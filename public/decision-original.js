/* Ventana de decisiones basada en decisionMenu de SIDE Original. Los campos y
   manejadores pertenecen a SIDE-Lite: moverlos no altera su lógica ni su envío. */
const app = document.querySelector('#app');
const icons = 'assets/original/categories/';
const sections = [
  ['lite-quality', 'Calidad', 'insumos.svg', 'Selecciona el nivel de calidad de tus productos.'],
  ['lite-quantity', 'Cantidad', 'inversiones.svg', 'Decide cuántas unidades comprar para vender en este ciclo.'],
  ['lite-price', 'Precio', 'canales_ventas.svg', 'Establece el precio de venta de cada producto.'],
  ['lite-marketing', 'Marketing', 'finanzas.svg', 'Elige cuánto invertir en publicidad.']
];
function card(title, icon, id, node) {
  const section = document.createElement('section');
  section.className = 'decision-card'; section.id = id;
  const head = document.createElement('div'); head.className = 'decision-card-art';
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
  const nav = document.createElement('nav'); nav.className = 'decision-tabs'; nav.setAttribute('aria-label', 'Secciones de decisión');
  panel.insertBefore(nav, form);
  const detail = document.createElement('div'); detail.className = 'decision-detail';
  const title = document.createElement('div'); title.className = 'decision-detail-head sticky-section-head';
  title.innerHTML = '<div class="detail-heading"><img alt=""><div><span>SECCIÓN DE DECISIÓN</span><h1></h1><p></p></div></div>';
  panel.insertBefore(detail, form); detail.append(title, form);
  const quality = form.querySelector('select[name=quality]').closest('label');
  const row = form.querySelector('.row');
  const quantity = row.querySelector('input[name=quantity]').closest('label');
  const price = row.querySelector('input[name=price]').closest('label');
  const marketing = form.querySelector('.campaign-section');
  const scroll = document.createElement('div'); scroll.className = 'decision-form-scroll'; scroll.setAttribute('role','region'); scroll.setAttribute('aria-label','Contenido de la sección de decisión');
  const cards = document.createElement('div'); cards.className = 'decision-cards decision-list';
  form.insertBefore(scroll, quality); scroll.append(cards);
  const nodes = [quality, quantity, price, marketing];
  sections.forEach(([id, label, icon], i) => cards.append(card(label, icon, id, nodes[i])));
  row.remove();
  const actions = form.querySelector('.inline'); if (actions) actions.classList.add('section-save-bar');
  const buttons = [];
  function select(index, focus = false) {
    const [id, label, icon, description] = sections[index];
    cards.querySelectorAll('.decision-card').forEach((item, i) => { item.hidden = i !== index; });
    buttons.forEach((button, i) => { button.classList.toggle('active', i === index); button.setAttribute('aria-pressed', String(i === index)); });
    title.querySelector('img').src = icons + icon;
    title.querySelector('h1').textContent = label;
    title.querySelector('p').textContent = description;
    if (focus) cards.querySelector('#' + id).querySelector('input:not([type=range]), select')?.focus();
  }
  sections.forEach(([id, label, icon], i) => {
    const button = document.createElement('button'); button.type = 'button'; button.className = 'decision-tab'; button.setAttribute('aria-controls', id);
    const img = document.createElement('img'); img.src = icons + icon; img.alt = '';
    const span = document.createElement('span'); span.textContent = label; button.append(img, span);
    button.addEventListener('click', () => select(i)); buttons.push(button); nav.append(button);
  });
  // Los campos invisibles conservan la validación nativa; mostrar su sección
  // antes de que el navegador intente enfocar un campo inválido.
  let handlingInvalid = false;
  form.addEventListener('invalid', event => {
    if (handlingInvalid) return;
    const index = sections.findIndex(([id]) => event.target.closest('#' + id));
    if (index >= 0) {
      handlingInvalid = true;
      select(index);
      queueMicrotask(() => { handlingInvalid = false; });
    }
  }, true);
  select(0);
}
new MutationObserver(enhanceStudent).observe(app, {childList: true});
enhanceStudent();
