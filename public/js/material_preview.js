(function(root){
 'use strict';
 const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function html(book,plan){
  if(!book||!plan?.temporal)return '<p role="status">Datos de recepción no verificados / proyección no disponible.</p>';
  const ev=Object.values(book.events||{}),orders=ev.filter(e=>e.type==='order');
  const rows=orders.map(o=>{const receipts=ev.filter(r=>r.type==='receipt'&&r.orderId===o.orderId),received=receipts.reduce((s,r)=>s+Number(r.quantity||0),0),days=receipts.map(r=>r.day).join(', ')||'—';
   return `<tr><td>${esc(o.sku)}</td><td>${esc(o.quantity)}</td><td>${esc(received)}</td><td>${esc(Math.max(0,o.quantity-received))}</td><td>${esc(o.orderedDay+o.leadTimeDays)}</td><td>${esc(days)}</td><td>${esc(o.paymentMode)}</td><td>${esc(o.unitCost)}</td></tr>`;}).join('');
  const materials=plan.materials.map(m=>`<li>${esc(m.label)}: recibido ${esc(m.purchasesAvailable)}, disponible ${esc(m.available)}, consumido ${esc(m.consumption)}, final ${esc(m.remaining)} ${esc(m.unit)}</li>`).join('');
  return `<section class="financial-section" aria-label="Recepciones verificadas"><h4>Proyección provisional de producción</h4><p>Revisión ${esc(book.revision)} · corte día ${esc(book.cutoffDay)} · meta ${esc(plan.target)} · capacidad nominal ${esc(plan.processCapacity)} · producción factible ${esc(plan.producibleUnits)}</p><div class="table-wrap"><table><thead><tr><th>SKU</th><th>Pedido</th><th>Recibido</th><th>Pendiente</th><th>Día previsto</th><th>Día efectivo</th><th>Pago</th><th>Costo unitario</th></tr></thead><tbody>${rows}</tbody></table></div><ul>${materials}</ul></section>`;
 }
 root.SIDE_MATERIAL_PREVIEW=Object.freeze({html});
})(typeof window==='undefined'?globalThis:window);
