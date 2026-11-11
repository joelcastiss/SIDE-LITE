(function (global) {
  'use strict';
  const api = global.SIDLiteGame;
  if (!api || !document.getElementById('startGame')) return;
  api.useRole('teacher');
  const $ = id => document.getElementById(id);
  let gameId = null, gameCode = '', loading = false, timer = null;
  const message = text => {
    $('creationFeedback')?.classList.remove('hidden');
    if ($('creationMessage')) $('creationMessage').textContent = text;
    // The creation notice lives in another tab once the game has started.
    if (gameId && $('roundSummary')) $('roundSummary').textContent = text;
  };
  const costs = document.createElement('article');
  costs.className = 'card';
  costs.innerHTML = '<div class="card-title"><h3>Costos por calidad</h3><span>S/ por unidad</span></div><label>Básica<input id="liteCostBasic" type="number" min="1" max="100000" value="50"></label><label>Estándar<input id="liteCostStandard" type="number" min="1" max="100000" value="80"></label><label>Prémium<input id="liteCostPremium" type="number" min="1" max="100000" value="120"></label>';
  $('fixedCapitalFields')?.closest('.card')?.after(costs);
  if ($('roundHours')) { $('roundHours').value = '0'; $('roundHours').disabled = true; }
  if ($('roundMinutes')) { $('roundMinutes').value = '2'; $('roundMinutes').disabled = true; }
  if ($('cycles')) { $('cycles').min = '3'; $('cycles').max = '6'; $('cycles').step = '3'; }
  const unsupported = ['demandLosOlivos', 'taxRegime', 'startDate'];
  for (const id of unsupported) { const card = $(id)?.closest('.card'); if (card) { card.hidden = true; card.style.display = 'none'; } }
  for (const selector of ['.integration-note', '.native-choice-row:has(#cycleModeManual)', '#manualCycleDisclaimer', '#automaticCycleConfig']) {
    document.querySelectorAll(selector).forEach(element => { element.hidden = true; element.style.display = 'none'; });
  }
  const eventSection = document.querySelector('.events-config-summary');
  const selectedEvents = new Set();
  if (eventSection) {
    eventSection.replaceChildren();
    const heading = document.createElement('h3'); heading.textContent = 'Eventos habilitados';
    const help = document.createElement('p'); help.textContent = 'Selecciona los eventos del catálogo SIDE Lite que pueden ocurrir durante la partida.';
    const list = document.createElement('div'); list.className = 'lite-event-list';
    eventSection.append(heading, help, list);
    void api.request('/catalog', 'GET', undefined, 'teacher').then(catalog => {
      if (!Array.isArray(catalog)) throw new Error('Catálogo inválido.');
      for (const item of catalog) {
        const label = document.createElement('label');
        const input = document.createElement('input'); input.type = 'checkbox'; input.value = item.id;
        input.disabled = !!gameId; input.checked = selectedEvents.has(item.id);
        input.addEventListener('change', () => input.checked ? selectedEvents.add(item.id) : selectedEvents.delete(item.id));
        label.append(input, document.createTextNode(' ' + item.label)); list.append(label);
      }
    }).catch(error => { help.textContent = error.message || 'No se pudo cargar el catálogo de eventos.'; });
  }
  const pauseButton = document.createElement('button'); pauseButton.type = 'button'; pauseButton.className = 'mini'; pauseButton.id = 'litePauseCycle'; pauseButton.hidden = true;
  $('startTimer')?.after(pauseButton);
  document.querySelector('.config-start-footer p').textContent = 'Piloto: cada ciclo dura 120 segundos. Al vencer, el docente debe cerrarlo para calcular los resultados.';
  for (const id of ['cutRound', 'startCycle1Btn']) if ($(id)) { $(id).hidden = true; $(id).style.display = 'none'; }
  const closeButton = $('cutRound');
  if (closeButton) { closeButton.textContent = 'Cerrar ciclo vencido'; closeButton.disabled = true; }
  for (const id of ['viewPdf', 'downloadPdf', 'resultCompanySelect', 'refreshReports', 'cancelGame', 'clearEvents', 'saveAll']) if ($(id)) { $(id).hidden = true; $(id).style.display = 'none'; }
  document.querySelectorAll('.nav-btn').forEach(button => {
    if (!['configuracion', 'rondas', 'empresas', 'resultados', 'podio', 'laboratorio', 'historial'].includes(button.dataset.tab)) { button.hidden = true; button.style.display = 'none'; }
  });

  document.querySelector('.nav-btn[data-tab="rondas"]')?.classList.remove('hidden');

  function showTab(name) {
    document.querySelectorAll('.nav-btn').forEach(el => el.classList.toggle('active', el.dataset.tab === name));
    document.querySelectorAll('.tab-panel').forEach(el => { el.classList.toggle('active', el.id === 'tab-' + name); if (el.id === 'tab-' + name) el.classList.remove('hidden'); });
    const titles = {configuracion:'Configuración de la simulación', rondas:'Ciclos y eventos', empresas:'Empresas participantes', resultados:'Resultados', podio:'Ganador y podio', laboratorio:'Laboratorio Estratégico', historial:'Historial'};
    if ($('pageTitle') && titles[name]) $('pageTitle').textContent = titles[name];
    if (name === 'laboratorio') document.dispatchEvent(new CustomEvent('side-lite-laboratory-open'));
    if (name === 'historial') void openHistory();
  }
  let historyMounted = false;
  async function openHistory() {
    if (historyMounted) return;
    historyMounted = true;
    try { const {renderTeacherHistory} = await import('../teacher-history.js'); renderTeacherHistory($('tab-historial'), {listGames:()=>api.request('/games','GET',undefined,'teacher'),loadGame:id=>api.getGame(id)}); }
    catch (error) { historyMounted=false; $('historyStatus').textContent='No se pudo consultar el historial. Revisa tu conexión.'; }
  }
  function render(snapshot) {
    const game = snapshot.game, cycle = snapshot.cycles?.at(-1);
    gameCode = game.code;
    selectedEvents.clear();
    for (const id of game.enabled_events || []) selectedEvents.add(id);
    eventSection?.querySelectorAll('input').forEach(input => { input.checked = selectedEvents.has(input.value); input.disabled = true; });
    const cancelButton = $('liteCancelGame');
    if (cancelButton) { cancelButton.hidden = !!game.ended_at || !!(cycle && cycle.number >= game.cycle_count && cycle.status === 'closed'); cancelButton.disabled = cycle?.status === 'open'; cancelButton.title = cancelButton.disabled ? 'Cierra el ciclo vencido antes de cancelar la partida.' : ''; }
    pauseButton.hidden = cycle?.status !== 'open' || !!cycle?.close_requested_at || !!game.ended_at;
    pauseButton.textContent = cycle?.paused_at ? 'Reanudar' : 'Pausar';
    pauseButton.dataset.action = cycle?.paused_at ? 'resume' : 'pause';
    for (const id of ['copyGameCode', 'copyLobbyCode', 'copyGameLink', 'showGameQr']) if ($(id)) { $(id).hidden = false; $(id).style.display = ''; $(id).disabled = !gameCode; }
    if ($('gameStatusBanner')) $('gameStatusBanner').textContent = cycle ? `Piloto con cierre asistido · Ciclo ${cycle.number} de ${game.cycle_count}.` : 'Piloto con cierre asistido: comparte el código con los estudiantes.';
    if ($('financeConfigHelp')) $('financeConfigHelp').textContent = 'La configuración se aplica al crear la sala.';
    for (const id of ['gameName', 'cycles', 'capital', 'capitalMin', 'capitalMax', 'capitalModeFixed', 'capitalModeRandom', 'liteCostBasic', 'liteCostStandard', 'liteCostPremium']) if ($(id)) $(id).disabled = true;
    if ($('startGame')) $('startGame').disabled = true;
    document.querySelector('.nav-btn[data-tab="rondas"]')?.classList.remove('hidden');
    if ($('gameCode')) $('gameCode').value = game.code;
    for (const id of ['gameCodeBadge', 'lobbyCode']) if ($(id)) $(id).textContent = game.code;
    $('teacherLobby')?.classList.remove('hidden');
    if ($('lobbyCompanies')) $('lobbyCompanies').textContent = snapshot.companies.length ? snapshot.companies.map(x => x.name).join(' · ') : 'Esperando empresas.';
    if ($('lobbyCountdown')) $('lobbyCountdown').textContent = cycle ? `Ciclo ${cycle.number} de ${game.cycle_count}` : 'La sala está abierta para estudiantes.';
    if ($('roundDisplay')) $('roundDisplay').textContent = `${cycle?.number || 0} / ${game.cycle_count}`;
    if ($('roundState')) $('roundState').textContent = cycle?.paused_at ? 'Pausado' : cycle?.status === 'open' ? 'En curso' : cycle ? 'Cerrado' : 'Sala abierta';
    if ($('roundSummary')) $('roundSummary').textContent = cycle?.status === 'open' ? 'Al vencer el tiempo, el docente debe cerrar el ciclo para calcular los resultados.' : 'Inicia el siguiente ciclo cuando todos estén listos.';
    if ($('startTimer')) { $('startTimer').textContent = cycle ? 'Iniciar siguiente ciclo' : 'Iniciar ciclo'; $('startTimer').disabled = cycle?.status === 'open' || !!(cycle && cycle.number >= game.cycle_count); }
    if ($('advanceRound')) $('advanceRound').disabled = $('startTimer')?.disabled || false;
    if ($('companiesLiveStatus')) $('companiesLiveStatus').textContent = `${snapshot.companies.length} empresas registradas`;
    const grid = $('companiesGrid');
    if (grid) { grid.replaceChildren(); for (const company of snapshot.companies) { const card = document.createElement('article'); card.className = 'card'; const title = document.createElement('h3'); title.textContent = company.name; const detail = document.createElement('p'); detail.textContent = `${company.store || ''} · ${snapshot.decisions?.some(d => d.company_id === company.id && d.confirmed) ? 'Decisión confirmada' : 'Decisión pendiente'}`; card.append(title, detail); grid.append(card); } }
    const reports = $('detailReports');
    if (reports) { reports.replaceChildren(); for (const item of snapshot.ranking || []) { const line = document.createElement('p'); line.textContent = `${item.name}: ${Number(item.returnPercent).toFixed(1)} % de rentabilidad`; reports.append(line); } for (const item of snapshot.results || []) { const line = document.createElement('p'); const company = snapshot.companies.find(c => c.id === item.company_id); line.textContent = `${company?.name || 'Empresa'} · Ciclo ${item.number} · Ventas ${Number(item.result?.sold || 0)} · Ingresos S/ ${Number(item.result?.revenue || 0).toLocaleString('es-PE')} · Costos S/ ${Number(item.result?.costOfSales || 0).toLocaleString('es-PE')} · Utilidad S/ ${Number(item.result?.profit || 0).toLocaleString('es-PE')} · Caja S/ ${Number(item.result?.cashEnd || 0).toLocaleString('es-PE')}`; reports.append(line); } }
    clearInterval(timer);
    if (closeButton) { closeButton.hidden = cycle?.status !== 'open' || !!game.ended_at; closeButton.style.display = closeButton.hidden ? 'none' : ''; closeButton.disabled = true; }
    if (cycle?.status === 'open') {
      const serverNow=Date.parse(cycle.server_now || '');
      const remaining = Math.max(0, Date.parse(cycle.ends_at) - Date.parse(cycle.paused_at || cycle.server_now || ''));
      const deadline = performance.now() + remaining;
      const paint = () => { const s = Math.max(0, Math.ceil((cycle.paused_at ? remaining : deadline - performance.now()) / 1000)); if ($('roundTimer')) $('roundTimer').textContent = Number.isFinite(s) ? `00:${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}` : '--:--:--'; if(closeButton) closeButton.disabled = loading || !!game.ended_at || !!cycle.paused_at || !Number.isFinite(serverNow) || !Number.isFinite(remaining) || s>0; };
      paint(); timer = setInterval(paint, 1000);
    }
  }
  async function refresh() { if (gameId) render(await api.getGame(gameId)); }
  async function renderPodium() {
    const preview = $('podiumPreview'), suggestion = $('sidePodium'), state = $('podiumState');
    if (!preview) return;
    preview.replaceChildren();
    if (!gameId) { preview.textContent = 'Crea o selecciona una partida para registrar las notas.'; return; }
    const [podium, snapshot] = await Promise.all([
      api.request('/games/' + gameId + '/podium', 'GET', undefined, 'teacher'), api.getGame(gameId)
    ]);
    if (suggestion) {
      suggestion.replaceChildren();
      for (const item of snapshot.ranking || []) { const row = document.createElement('p'); row.textContent = item.name + ' · ' + Number(item.returnPercent).toFixed(1) + ' % de rentabilidad'; suggestion.append(row); }
    }
    for (const company of podium.companies || []) {
      const row = document.createElement('div'); row.className = 'value-row';
      const label = document.createElement('label'); label.textContent = company.name;
      const input = document.createElement('input'); input.type = 'number'; input.min = '0'; input.max = '20'; input.step = '0.01'; input.value = company.grade ?? ''; input.setAttribute('aria-label', 'Nota de ' + company.name);
      const save = document.createElement('button'); save.type = 'button'; save.className = 'secondary'; save.textContent = 'Guardar nota';
      save.addEventListener('click', async () => {
        const value = Number(input.value);
        if (!input.value.trim() || !Number.isFinite(value) || value < 0 || value > 20) { $('publishStatus').textContent = 'La nota debe estar entre 0 y 20.'; return; }
        save.disabled = true;
        try { await api.request('/games/' + gameId + '/grades/' + company.id, 'PUT', {grade:value}, 'teacher'); $('publishStatus').textContent = 'Nota guardada.'; }
        catch (error) { $('publishStatus').textContent = error.message; }
        finally { save.disabled = false; }
      });
      label.append(input); row.append(label, save); preview.append(row);
    }
    if (!podium.companies?.length) preview.textContent = 'Todavía no hay empresas inscritas.';
    if (state) state.textContent = podium.podium ? 'Publicación programada o activa' : 'No publicado';
    if ($('publishPodium')) $('publishPodium').disabled = !podium.finished;
    if ($('podiumSchedule')) $('podiumSchedule').classList.toggle('hidden', !podium.podium || Date.parse(podium.podium.scheduledAt) <= Date.parse(podium.podium.serverNow));
    if ($('podiumScheduledAt') && podium.podium) $('podiumScheduledAt').textContent = 'Programado: ' + new Date(podium.podium.scheduledAt).toLocaleString('es-PE');
  }

  function invitationUrl() {
    const url = new URL('../', global.location.href);
    url.search = ''; url.hash = ''; url.searchParams.set('partida', gameCode);
    return url.href;
  }
  $('copyGameLink').disabled = true; $('showGameQr').disabled = true;
  async function copyLink() {
    if (!gameCode) return;
    try { await navigator.clipboard.writeText(invitationUrl()); $('copyGameLink').textContent = 'Enlace copiado'; setTimeout(() => { $('copyGameLink').textContent = 'Copiar enlace'; }, 2000); }
    catch { message('No se pudo copiar el enlace.'); }
  }
  $('showGameQr').addEventListener('click', async () => {
    if (!gameCode) return;
    try {
      await global.SIDELiteQRCode.toCanvas($('gameQrCanvas'), invitationUrl(), {width: 768, margin: 4, errorCorrectionLevel: 'M'});
      $('gameQrCode').textContent = gameCode; $('gameQrDialog').showModal();
    } catch { message('No se pudo generar el código QR.'); }
  });
  $('closeGameQr').addEventListener('click', () => $('gameQrDialog').close());
  $('downloadGameQr').addEventListener('click', () => {
    const link = document.createElement('a'); link.download = 'SIDE-' + gameCode + '-QR.png';
    link.href = $('gameQrCanvas').toDataURL('image/png'); link.click();
  });
  async function create() {
    if (loading) return;
    loading = true;
    try {
      const fixed = document.querySelector('input[name="capitalMode"]:checked')?.value !== 'random';
      const capitalMin = Number(fixed ? $('capital').value : $('capitalMin').value);
      const capitalMax = Number(fixed ? $('capital').value : $('capitalMax').value);
      const game = await api.createGame({name: $('gameName').value.trim(), cycleCount: Number($('cycles').value), duration: 120, capitalMin, capitalMax, costs: {basic: Number($('liteCostBasic').value), standard: Number($('liteCostStandard').value), premium: Number($('liteCostPremium').value)}, events: [...selectedEvents]});
      gameId = game.id;
      try { sessionStorage.setItem('side-lite-teacher-game', gameId); } catch { /* The room remains available in this tab. */ }
      await refresh(); showTab('rondas'); message('Sala creada. Código: ' + game.code);
    } catch (error) { message(error.message || 'No se pudo crear la partida.'); }
    finally { loading = false; }
  }
  async function start() { if (!gameId || loading) return; loading = true; try { await api.startGame(gameId); await refresh(); } catch (error) { message(error.message || 'No se pudo iniciar el ciclo.'); } finally { loading = false; } }
  for (const type of ['input', 'change']) document.addEventListener(type, event => {
    if (!event.target.closest('#tab-configuracion') || event.target.closest('.events-config-summary')) return;
    event.stopImmediatePropagation();
    if (event.target.name === 'capitalMode') {
      const fixed = event.target.value === 'fixed';
      $('fixedCapitalFields')?.classList.toggle('hidden', !fixed);
      $('randomCapitalFields')?.classList.toggle('hidden', fixed);
    }
  }, true);
  document.addEventListener('click', event => {
    const button = event.target.closest('button');
    if (!button) return;
    if (button.id === 'liteCancelGame') {
      event.preventDefault(); event.stopImmediatePropagation();
      if (gameId && !loading && !button.disabled) { $('liteCancelError').textContent = ''; $('cancelGameDialog').showModal(); }
    } else if (button.id === 'keepGame') {
      event.preventDefault(); event.stopImmediatePropagation(); $('cancelGameDialog').close();
    } else if (button.id === 'confirmCancelGame') {
      event.preventDefault(); event.stopImmediatePropagation();
      if (!gameId || loading) return;
      loading = true; button.disabled = true; $('liteCancelError').textContent = '';
      void api.request('/games/' + gameId + '/finish', 'POST', {}, 'teacher')
        .then(() => { try { sessionStorage.removeItem('side-lite-teacher-game'); } catch {} global.location.reload(); })
        .catch(error => { $('liteCancelError').textContent = error.message || 'No se pudo cancelar la partida.'; })
        .finally(() => { loading = false; button.disabled = false; });
    } else if (button.id === 'copyGameLink') {
      event.preventDefault(); event.stopImmediatePropagation(); void copyLink();
    } else if (button.id === 'publishPodium') {
      event.preventDefault(); event.stopImmediatePropagation(); $('podiumDialog')?.showModal();
    } else if (button.id === 'cancelPodiumPublish') {
      event.preventDefault(); event.stopImmediatePropagation(); $('podiumDialog')?.close();
    } else if (button.id === 'podiumCancelSchedule') {
      event.preventDefault(); event.stopImmediatePropagation();
      void api.request('/games/' + gameId + '/podium', 'DELETE', undefined, 'teacher').then(renderPodium).catch(error => { $('publishStatus').textContent = error.message; });
    } else if (button.id === 'podiumPublishNow' || button.id === 'podiumReschedule') {
      event.preventDefault(); event.stopImmediatePropagation(); $('podiumDialog')?.showModal();
    } else if (button.id === 'cutRound') {
      event.preventDefault(); event.stopImmediatePropagation();
      if (!gameId || loading || button.disabled) return;
      loading = true; button.disabled = true;
      void api.request('/games/' + gameId + '/close', 'POST', {}, 'teacher')
        .then(() => { loading = false; return refresh(); })
        .catch(error => { message(error.message || 'No se pudo cerrar el ciclo.'); })
        .finally(() => { loading = false; });
    } else if (button.id === 'litePauseCycle') {
      event.preventDefault(); event.stopImmediatePropagation();
      if (!gameId || loading) return;
      loading = true; button.disabled = true;
      void api.request('/games/' + gameId + '/' + button.dataset.action, 'POST', {}, 'teacher')
        .then(refresh).catch(error => message(error.message || 'No se pudo cambiar el estado del ciclo.'))
        .finally(() => { loading = false; button.disabled = false; });
    } else if (['copyGameCode', 'copyLobbyCode'].includes(button.id)) {
      event.preventDefault(); event.stopImmediatePropagation();
      if (!gameCode) return;
      if (!navigator.clipboard?.writeText) { message('Copia el código de partida: ' + gameCode); return; }
      void navigator.clipboard.writeText(gameCode).then(() => { button.textContent = 'Código copiado'; setTimeout(() => { button.textContent = 'Copiar código'; }, 2000); }).catch(() => message('Copia el código de partida: ' + gameCode));
    } else if (['startGame', 'retryCreate', 'startTimer', 'advanceRound', 'startCycle1Btn'].includes(button.id)) {
      event.preventDefault(); event.stopImmediatePropagation();
      if (button.id === 'startGame' || button.id === 'retryCreate') void create(); else void start();
    } else if (button.dataset.tab && ['configuracion', 'rondas', 'empresas', 'resultados', 'podio', 'laboratorio', 'historial'].includes(button.dataset.tab)) {
      event.preventDefault(); event.stopImmediatePropagation(); showTab(button.dataset.tab); void (button.dataset.tab === 'podio' ? renderPodium() : refresh()).catch(e => message(e.message));
    }
  }, true);
  $('podiumPublishMode')?.addEventListener('change', () => $('podiumDelayFields')?.classList.toggle('hidden', $('podiumPublishMode').value !== 'schedule'));
  document.addEventListener('submit', event => {
    if (event.target.id !== 'podiumPublishForm') return;
    event.preventDefault(); event.stopImmediatePropagation();
    const delayMinutes = $('podiumPublishMode').value === 'schedule' ? Number($('podiumHours').value) * 60 + Number($('podiumMinutes').value) : 0;
    if (!Number.isSafeInteger(delayMinutes) || delayMinutes < 0 || delayMinutes > 4320 || ($('podiumPublishMode').value === 'schedule' && delayMinutes === 0)) { $('podiumPublishError').textContent = 'Elige entre 1 minuto y 72 horas.'; return; }
    const submit = $('confirmPodiumPublish'); submit.disabled = true;
    void api.request('/games/' + gameId + '/podium', 'POST', {reason:$('winnerReason').value, delayMinutes}, 'teacher')
      .then(() => { $('podiumDialog').close(); $('publishStatus').textContent = 'Podio publicado o programado.'; return renderPodium(); })
      .catch(error => { $('podiumPublishError').textContent = error.message; })
      .finally(() => { submit.disabled = false; });
  }, true);
  try { gameId = sessionStorage.getItem('side-lite-teacher-game'); } catch { /* Session storage is optional. */ }
  // A temporary outage must not discard the room identifier: polling can
  // restore the view once the connection returns.
  if (gameId) void refresh().catch(error => { message(error.message); });
  setInterval(() => { if (gameId && !document.hidden) void refresh().catch(error => message(error.message)); }, 5000);
})(window);
