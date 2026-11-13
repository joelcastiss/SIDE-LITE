(function (global) {
  'use strict';
  const api = global.SIDLiteGame;
  if (!api || !document.getElementById('startGame')) return;
  api.useRole('teacher');
  const $ = id => document.getElementById(id);
  let gameId = null, gameCode = '', loading = false, timer = null, refreshPromise = null, generation = 0, lastSnapshot = '';
  let authorized = false;
  const gradeDrafts = new Map();
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
  const markets = document.createElement('article');
  markets.className = 'card';
  markets.innerHTML = '<div class="card-title"><h3>Asignaci\u00f3n de mercados</h3></div><label>Modalidad<select id="liteMarketMode"><option value="random">Aleatorio</option><option value="manual">Manual</option></select></label><p>En modo manual, asigna un distrito a cada empresa en Empresas antes de iniciar el primer ciclo.</p><p id="liteMarketModeStatus" role="status"></p>';
  const assignments = document.createElement('article');
  assignments.className = 'card';
  assignments.innerHTML = '<h3>Asignaci\u00f3n de mercados por empresa</h3><div id="liteMarketAssignments">Crea la sala para administrar las asignaciones.</div><p id="liteMarketStatus" role="status"></p>';
  $('companiesGrid')?.before(assignments);
  costs.after(markets);
  if ($('roundHours')) { $('roundHours').value = '0'; $('roundHours').disabled = true; }
  if ($('roundMinutes')) { $('roundMinutes').value = '2'; $('roundMinutes').disabled = true; }
  if ($('cycles')) { $('cycles').min = '3'; $('cycles').max = '6'; $('cycles').step = '3'; }
  // Lite owns the cycle selector: the legacy SIDE controller keeps separate local state.
  function syncCycleCount(value) {
    const count = Number(value);
    if (![3, 6].includes(count)) return false;
    if ($('cycles')) $('cycles').value = String(count);
    if ($('configCycleCount')) $('configCycleCount').textContent = '1 / ' + count;
    if ($('configReadySummary') && !gameId) $('configReadySummary').textContent = count + ' ciclos de 2 minutos cada uno.';
    return true;
  }
  $('cycles')?.addEventListener('input', event => syncCycleCount(event.currentTarget.value));
  $('cycles')?.addEventListener('change', event => syncCycleCount(event.currentTarget.value));
  syncCycleCount($('cycles')?.value);
  // Official games assign each company a server-generated capital.
  $('capitalModeRandom').checked = true;
  $('capitalModeFixed').closest('label').hidden = true;
  $('fixedCapitalFields').classList.add('hidden');
  $('randomCapitalFields').classList.remove('hidden');
  for (const [id, value] of [['capitalMin', '20000'], ['capitalMax', '100000']]) { const input = $(id); input.value = value; input.min = '20000'; input.max = '100000'; input.step = '10000'; }
  const unsupported = ['demandLosOlivos', 'taxRegime', 'startDate'];
  for (const id of unsupported) { const card = $(id)?.closest('.card'); if (card) { card.hidden = true; card.style.display = 'none'; } }
  for (const selector of ['.integration-note', '.native-choice-row:has(#cycleModeManual)', '#manualCycleDisclaimer', '#automaticCycleConfig']) {
    document.querySelectorAll(selector).forEach(element => { element.hidden = true; element.style.display = 'none'; });
  }
  const eventSection = document.querySelector('.events-config-summary');
  const selectedEvents = new Set();
  let pendingEvents = new Set();
  let eventCatalog = [];
  let eventCatalogError = '';
  const eventStyle = document.createElement('style');
  eventStyle.textContent = `
    .lite-event-summary-head {display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap}
    .lite-event-summary-head h3{margin:0;color:#26c9f5;text-transform:uppercase;font-size:1rem}
    .lite-event-summary-head p{margin:10px 0 0;color:#aab8c9}
    .lite-event-summary-line{display:flex;align-items:center;gap:9px;flex-wrap:wrap;margin-top:20px}
    .lite-event-summary-chip{background:#143451;color:#f2f8ff;padding:10px 15px;border-radius:999px;font-size:.88rem}
    .lite-event-picker{border:1px solid #26c9f5;border-radius:18px;background:#091a30;color:#eef6ff;padding:24px;width:min(760px,calc(100vw - 24px));max-height:85vh}
    .lite-event-picker::backdrop{background:rgba(1,8,20,.78)}
    .lite-event-picker header{display:flex;justify-content:space-between;align-items:center;gap:12px}
    .lite-event-picker h3{margin:0}.lite-event-picker-controls{display:flex;gap:10px;flex-wrap:wrap;margin:16px 0}
    .lite-event-picker-controls input{flex:1;min-width:170px;padding:10px}
    .lite-event-picker-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;max-height:48vh;overflow:auto}
    .lite-event-picker-list label{display:flex;gap:9px;align-items:flex-start;padding:12px;border:1px solid #285170;border-radius:10px;cursor:pointer}
    .lite-event-picker-list input{margin-top:3px}
    .lite-event-picker footer{margin-top:18px;display:flex;justify-content:flex-end}
    @media(max-width:600px){.lite-event-picker-list{grid-template-columns:1fr}.lite-event-picker{padding:16px}}
  `;
  document.head.append(eventStyle);
  const eventDialog = document.createElement('dialog');
  eventDialog.className = 'lite-event-picker';
  eventDialog.setAttribute('aria-label', 'Seleccionar eventos');
  eventDialog.innerHTML = '<header><h3>Seleccionar eventos</h3><button type="button" class="secondary" id="liteCloseEventPicker" aria-label="Cerrar">Cerrar</button></header><p>Elige qué eventos podrán ocurrir durante la partida.</p><div class="lite-event-picker-controls"><input id="liteEventSearch" type="search" placeholder="Buscar evento" aria-label="Buscar evento"><button type="button" class="secondary" id="liteSelectAllEvents">Seleccionar todos</button><button type="button" class="secondary" id="liteClearEvents">Quitar todos</button></div><div id="liteEventPickerList" class="lite-event-picker-list"></div><footer><button type="button" class="primary" id="liteDoneEventPicker">Confirmar selección</button></footer>';
  document.body.append(eventDialog);
  const eventList = eventDialog.querySelector('#liteEventPickerList');
  const eventSearch = eventDialog.querySelector('#liteEventSearch');
  function renderEventSummary() {
    const summary = eventSection?.querySelector('#enabledEventsSummary');
    if (!summary) return;
    summary.replaceChildren();
    const count = document.createElement('strong');
    count.textContent = selectedEvents.size + ' habilitados';
    summary.append(count);
    const labels = eventCatalog.filter(x => selectedEvents.has(x.id)).slice(0,3);
    for (const item of labels) {
      const chip = document.createElement('span'); chip.className = 'lite-event-summary-chip'; chip.textContent = item.label; summary.append(chip);
    }
    if (selectedEvents.size > labels.length) {
      const more = document.createElement('span'); more.textContent = 'Y ' + (selectedEvents.size - labels.length) + ' más · consulta la selección'; summary.append(more);
    }
    if (eventCatalogError) { const error = document.createElement('p'); error.textContent = eventCatalogError; summary.append(error); }
  }
  function renderEventPicker() {
    eventList.replaceChildren();
    const search = eventSearch.value.trim().toLocaleLowerCase('es');
    const filtered = eventCatalog.filter(item => item.label.toLocaleLowerCase('es').includes(search));
    for (const item of filtered) {
      const label = document.createElement('label');
      const input = document.createElement('input');
      input.type = 'checkbox'; input.value = item.id; input.checked = pendingEvents.has(item.id); input.disabled = !!gameId;
      input.addEventListener('change', () => {
        if (input.checked) pendingEvents.add(item.id); else pendingEvents.delete(item.id);
      });
      label.append(input, document.createTextNode(item.label)); eventList.append(label);
    }
    if (!filtered.length) eventList.textContent = eventCatalogError || 'No se encontraron eventos.';
    eventDialog.querySelector('#liteSelectAllEvents').disabled = !!gameId || !eventCatalog.length;
    eventDialog.querySelector('#liteClearEvents').disabled = !!gameId || !eventCatalog.length;
  }
  if (eventSection) {
    eventSection.replaceChildren();
    const heading = document.createElement('div'); heading.className = 'lite-event-summary-head';
    const titleGroup = document.createElement('div');
    titleGroup.innerHTML = '<h3>Eventos habilitados</h3><p>Selecciona los eventos que podrán ocurrir desde el Ciclo 1.</p>';
    const open = document.createElement('button'); open.type = 'button'; open.className = 'secondary'; open.id = 'liteOpenEventPicker'; open.textContent = 'Seleccionar eventos';
    open.addEventListener('click', () => { pendingEvents = new Set(selectedEvents); eventSearch.value = ''; renderEventPicker(); eventDialog.showModal(); });
    heading.append(titleGroup,open);
    const summary = document.createElement('div'); summary.id = 'enabledEventsSummary'; summary.className = 'lite-event-summary-line'; summary.setAttribute('aria-live','polite');
    eventSection.append(heading,summary);
    renderEventSummary();
  }
  let catalogRequest = null;
  function loadCatalog() {
    if (!eventSection || catalogRequest) return catalogRequest;
    catalogRequest = api.request('/catalog', 'GET', undefined, 'teacher').then(catalog => {
      if (!Array.isArray(catalog)) throw new Error('Catálogo inválido.');
      eventCatalog = catalog; eventCatalogError = ''; renderEventSummary(); renderEventPicker();
    }).catch(error => { eventCatalogError = error.message || 'No se pudo cargar el catálogo.'; renderEventSummary(); })
      .finally(() => { catalogRequest = null; });
    return catalogRequest;
  }
  eventDialog.querySelector('#liteCloseEventPicker').addEventListener('click', () => eventDialog.close());
  eventDialog.querySelector('#liteDoneEventPicker').addEventListener('click', () => {
    if (!gameId) { selectedEvents.clear(); for (const id of pendingEvents) selectedEvents.add(id); renderEventSummary(); }
    eventDialog.close();
  });
  eventDialog.querySelector('#liteSelectAllEvents').addEventListener('click', () => {
    if (gameId) return;
    for (const item of eventCatalog) pendingEvents.add(item.id);
    renderEventPicker();
  });
  eventDialog.querySelector('#liteClearEvents').addEventListener('click', () => {
    if (gameId) return;
    pendingEvents.clear(); renderEventPicker();
  });
  eventSearch.addEventListener('input', renderEventPicker);
  const pauseButton = document.createElement('button'); pauseButton.type = 'button'; pauseButton.className = 'mini'; pauseButton.id = 'litePauseCycle'; pauseButton.hidden = true;
  $('startTimer')?.after(pauseButton);
  document.querySelector('.config-start-footer p').textContent = 'Piloto: cada ciclo dura 120 segundos. Al vencer, el docente debe cerrarlo para calcular los resultados.';
  for (const id of ['cutRound', 'startCycle1Btn']) if ($(id)) { $(id).hidden = true; $(id).style.display = 'none'; }
  const closeButton = $('cutRound');
  if (closeButton) { closeButton.textContent = 'Cerrar ciclo vencido'; closeButton.disabled = true; }
  for (const id of ['viewPdf', 'downloadPdf', 'resultCompanySelect', 'refreshReports', 'cancelGame', 'clearEvents', 'saveAll']) if ($(id)) { $(id).hidden = true; $(id).style.display = 'none'; }
  const legacyCompanyFilter = $('resultCompanySelect')?.closest('label');
  if (legacyCompanyFilter) { legacyCompanyFilter.hidden = true; legacyCompanyFilter.style.display = 'none'; }
  if ($('resultsPdfHint')) { $('resultsPdfHint').hidden = true; $('resultsPdfHint').style.display = 'none'; }
  if ($('resultStats')) { $('resultStats').hidden = true; $('resultStats').style.display = 'none'; }
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
    const modeSelect=$('liteMarketMode'); modeSelect.disabled=true; if(snapshot.marketMode) modeSelect.value=snapshot.marketMode;
    $('liteMarketModeStatus').textContent=snapshot.marketMode ? 'Modalidad: '+(snapshot.marketMode==='manual'?'Manual':'Aleatorio') : 'Esta partida anterior no utiliza distritos.';
    const marketRows = $('liteMarketAssignments');
    if (marketRows && !marketRows.contains(document.activeElement)) {
      marketRows.replaceChildren();
      if (!snapshot.districts?.length) marketRows.textContent = 'Esta partida anterior no utiliza distritos.';
      else if (!snapshot.companies.length) marketRows.textContent = 'Las asignaciones aparecerán cuando ingresen las empresas.';
      else for (const company of snapshot.companies) {
        const row=document.createElement('div'); row.className='value-row';
        const label=document.createElement('label'); label.textContent=company.name+' · ';
        const select=document.createElement('select'); select.setAttribute('aria-label','Mercado de '+company.name); select.disabled=!!cycle || !!game.ended_at;
        for (const district of snapshot.districts) {const option=document.createElement('option');option.value=district.id;option.textContent=district.name;select.append(option);}
        const placeholder=document.createElement('option'); placeholder.value=''; placeholder.textContent='Sin asignar'; select.prepend(placeholder); select.value=company.district_id || ''; label.append(select);
        const random=document.createElement('button'); random.type='button'; random.className='secondary'; random.textContent='Asignar aleatoriamente'; random.disabled=select.disabled;
        const save=async body=>{select.disabled=true;random.disabled=true;try{await api.request('/games/'+gameId+'/markets/'+company.id,'PUT',body,'teacher');$('liteMarketStatus').textContent='Asignación guardada.';document.activeElement?.blur();await refresh();}catch(error){$('liteMarketStatus').textContent=error.message;select.disabled=false;random.disabled=false;}};
        select.addEventListener('change',()=>void save({mode:'manual',districtId:select.value}));
        random.addEventListener('click',()=>void save({mode:'random'}));
        const mode=document.createElement('small'); mode.textContent=company.assignment_mode==='manual'?'Manual':company.assignment_mode==='random'?'Aleatoria':'Pendiente';
        row.append(label,random,mode); marketRows.append(row);
      }
    }
    gameCode = game.code;
    syncCycleCount(game.cycle_count);
    if ($('configCycleCount')) $('configCycleCount').textContent = `${cycle?.number || 1} / ${game.cycle_count}`;
    selectedEvents.clear();
    for (const id of game.enabled_events || []) selectedEvents.add(id);
    renderEventSummary(); renderEventPicker();
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
    if (grid) { grid.replaceChildren(); for (const company of snapshot.companies) { const card = document.createElement('article'); card.className = 'card'; const title = document.createElement('h3'); title.textContent = company.name; const detail = document.createElement('p'); detail.textContent = `${company.store || ''} · ${snapshot.decisions?.some(d => d.company_id === company.id && d.confirmed) ? 'Decisión confirmada' : 'Decisión pendiente'}`; const capital = document.createElement('p'); capital.textContent = `Capital inicial: S/ ${Number(company.initial_capital).toLocaleString('es-PE')} · Caja disponible: S/ ${Number(company.cash).toLocaleString('es-PE')}`; card.append(title, detail, capital); grid.append(card); } }
    if ($('cycleNews')) $('cycleNews').textContent = globalThis.SIDELiteEvents.text(cycle?.event_id);
    const reports = $('detailReports');
    if (reports) global.SIDELiteTeacherResults?.render(reports, snapshot);
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
  async function refresh() {
    if (!authorized || !gameId) return;
    while (refreshPromise) { try { await refreshPromise; } catch { /* A previous request must not block a new selection. */ } if (!gameId) return; }
    const id = gameId, version = generation;
    const task = (async () => {
      const snapshot = await api.getGame(id);
      if (version !== generation || id !== gameId) return;
      // server_now changes on every read; the local clock continues independently.
      const signature = JSON.stringify(snapshot, (key, value) => key === 'server_now' ? undefined : value);
      if (signature !== lastSnapshot) { lastSnapshot = signature; render(snapshot); }
    })();
    refreshPromise = task;
    try { await task; } catch (error) { if (version === generation) lastSnapshot = ''; throw error; }
    finally { if (refreshPromise === task) refreshPromise = null; }
  }
  async function renderPodium() {
    const preview = $('podiumPreview'), suggestion = $('sidePodium'), state = $('podiumState');
    if (!preview) return;
    const targetGame = gameId, targetGeneration = generation;
    if (preview.contains(document.activeElement)) return;
    if (!gameId) { preview.textContent = 'Crea o selecciona una partida para registrar las notas.'; return; }
    const [podium, snapshot] = await Promise.all([
      api.request('/games/' + gameId + '/podium', 'GET', undefined, 'teacher'), api.getGame(gameId)
    ]);
    if (targetGame !== gameId || targetGeneration !== generation || preview.contains(document.activeElement)) return;
    preview.replaceChildren();
    if (suggestion) {
      suggestion.replaceChildren();
      for (const item of snapshot.ranking || []) { const row = document.createElement('p'); row.textContent = item.name + ' · ' + new Intl.NumberFormat('es-PE', {minimumFractionDigits:1, maximumFractionDigits:1}).format(Number(item.returnPercent)) + ' % de rentabilidad'; suggestion.append(row); }
    }
    const companies = [...(podium.companies || [])].sort((a, b) =>
      (a.grade == null && b.grade == null ? 0 : a.grade == null ? 1 : b.grade == null ? -1 : Number(b.grade) - Number(a.grade)) || a.name.localeCompare(b.name, 'es'));
    for (const company of companies) {
      const row = document.createElement('div'); row.className = 'value-row';
      const label = document.createElement('label'); label.textContent = company.name;
      const draftKey = targetGame + ':' + company.id;
      const input = document.createElement('input'); input.type = 'number'; input.min = '0'; input.max = '20'; input.step = '0.01'; input.value = gradeDrafts.get(draftKey) ?? company.grade ?? ''; input.setAttribute('aria-label', 'Nota de ' + company.name);
      input.addEventListener('input', () => gradeDrafts.set(draftKey, input.value));
      const save = document.createElement('button'); save.type = 'button'; save.className = 'secondary'; save.textContent = 'Guardar nota';
      save.addEventListener('click', async () => {
        const submitted = input.value;
        const value = Number(input.value);
        if (!input.value.trim() || !Number.isFinite(value) || value < 0 || value > 20) { $('publishStatus').textContent = 'La nota debe estar entre 0 y 20.'; return; }
        save.disabled = true;
        try { await api.request('/games/' + targetGame + '/grades/' + company.id, 'PUT', {grade:value}, 'teacher'); if (gradeDrafts.get(draftKey) === submitted) gradeDrafts.delete(draftKey); $('publishStatus').textContent = 'Nota guardada.'; }
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
    if (url.protocol !== 'https:' || /^(localhost|127\.|\[::1\])/i.test(url.hostname)) throw new Error('El enlace de ingreso requiere una dirección pública HTTPS.');
    return url.href;
  }
  $('copyGameLink').disabled = true; $('showGameQr').disabled = true;
  async function copyLink() {
    if (!gameCode) return;
    try { await navigator.clipboard.writeText(invitationUrl()); $('copyGameLink').textContent = 'Enlace copiado'; setTimeout(() => { $('copyGameLink').textContent = 'Copiar enlace'; }, 2000); }
    catch (error) { message(error.message || 'No se pudo copiar el enlace.'); }
  }
  $('showGameQr').addEventListener('click', async () => {
    if (!gameCode) return;
    try {
      const svg = await global.SIDELiteQRCode.toString(invitationUrl(), {type: 'svg', margin: 4, errorCorrectionLevel: 'M', color: {dark: '#000000', light: '#ffffff'}});
      $('gameQrImage').innerHTML = svg;
      $('gameQrCode').textContent = gameCode; $('gameQrDialog').showModal();
    } catch (error) { message(error.message || 'No se pudo generar el código QR.'); }
  });
  $('closeGameQr').addEventListener('click', () => $('gameQrDialog').close());
  $('downloadGameQr').addEventListener('click', async () => {
    try {
      const dataUrl = await global.SIDELiteQRCode.toDataURL(invitationUrl(), {width: 768, margin: 4, errorCorrectionLevel: 'M', color: {dark: '#000000', light: '#ffffff'}});
      const link = document.createElement('a'); link.download = 'SIDE-' + gameCode + '-QR.png';
      link.href = dataUrl; link.click();
    } catch (error) { message(error.message || 'No se pudo descargar el código QR.'); }
  });
  async function create() {
    if (loading) return;
    loading = true;
    try {
      const capitalMin = Number($('capitalMin').value);
      const capitalMax = Number($('capitalMax').value);
      if (!Number.isInteger(capitalMin) || !Number.isInteger(capitalMax) || capitalMin < 20000 || capitalMax > 100000 || capitalMin > capitalMax || capitalMin % 10000 || capitalMax % 10000) throw new Error('Elige un rango entre S/ 20.000 y S/ 100.000, en múltiplos de S/ 10.000.');
      const cycleCount = Number($('cycles').value);
      if (![3, 6].includes(cycleCount)) throw new Error('Selecciona 3 o 6 ciclos.');
      const game = await api.createGame({name: $('gameName').value.trim(), cycleCount, duration: 120, capitalMin, capitalMax, costs: {basic: Number($('liteCostBasic').value), standard: Number($('liteCostStandard').value), premium: Number($('liteCostPremium').value)}, events: [...selectedEvents], marketMode: $('liteMarketMode').value});
      gameId = game.id; generation++; lastSnapshot = '';
      try { sessionStorage.setItem('side-lite-teacher-game', gameId); } catch { /* The room remains available in this tab. */ }
      await refresh(); showTab('rondas'); message('Sala creada. Código: ' + game.code);
    } catch (error) { message(error.message || 'No se pudo crear la partida.'); }
    finally { loading = false; }
  }
  async function start() { if (!gameId || loading) return; loading = true; try { await api.startGame(gameId); await refresh(); } catch (error) { message(error.message || 'No se pudo iniciar el ciclo.'); } finally { loading = false; } }
  for (const type of ['input', 'change']) document.addEventListener(type, event => {
    if (!event.target.closest('#tab-configuracion') || event.target.closest('.events-config-summary') || markets.contains(event.target)) return;
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
    if ([...gradeDrafts.keys()].some(key => key.startsWith(gameId + ':'))) { event.preventDefault(); event.stopImmediatePropagation(); $('podiumPublishError').textContent = 'Guarda todas las notas modificadas antes de publicar.'; return; }
    event.preventDefault(); event.stopImmediatePropagation();
    const delayMinutes = $('podiumPublishMode').value === 'schedule' ? Number($('podiumHours').value) * 60 + Number($('podiumMinutes').value) : 0;
    if (!Number.isSafeInteger(delayMinutes) || delayMinutes < 0 || delayMinutes > 4320 || ($('podiumPublishMode').value === 'schedule' && delayMinutes === 0)) { $('podiumPublishError').textContent = 'Elige entre 1 minuto y 72 horas.'; return; }
    const submit = $('confirmPodiumPublish'); submit.disabled = true;
    void api.request('/games/' + gameId + '/podium', 'POST', {reason:$('winnerReason').value, delayMinutes}, 'teacher')
      .then(() => { $('podiumDialog').close(); $('publishStatus').textContent = 'Podio publicado o programado.'; return renderPodium(); })
      .catch(error => { $('podiumPublishError').textContent = error.message; })
      .finally(() => { submit.disabled = false; });
  }, true);
  const chooser = document.createElement('article');
  chooser.className = 'card';
  chooser.innerHTML = '<h3>Mis partidas</h3><p>Abre una partida guardada en Supabase.</p><label>Partida<select id="liteSavedGames"><option value="">Selecciona una partida</option></select></label><button type="button" class="secondary" id="liteOpenSavedGame">Abrir partida</button> <button type="button" class="secondary" id="liteReloadSavedGames">Actualizar partidas</button><p id="liteSavedGamesStatus" role="status"></p>';
  $('startGame').closest('.config-start-footer')?.before(chooser);
  async function listGames() {
    const select = $('liteSavedGames'), status = $('liteSavedGamesStatus');
    try {
      const games = await api.request('/games', 'GET', undefined, 'teacher');
      const selected = select.value;
      select.replaceChildren(new Option('Selecciona una partida', ''));
      // The server also returns games joined as a student; only show owned games.
      for (const game of games.filter(item => item.teacher_id === global.SIDLiteTeacherIdentity.id)) {
        select.add(new Option(`${game.name} · ${game.code}${game.ended_at ? ' · Finalizada' : ''}`, game.id));
      }
      select.value = selected;
      status.textContent = select.options.length > 1 ? '' : 'Todavía no tienes partidas.';
      return games;
    } catch (error) { status.textContent = error.message || 'No se pudieron cargar las partidas. Inténtalo de nuevo.'; return null; }
  }
  $('liteReloadSavedGames').addEventListener('click', () => void listGames());
  $('liteMarketAssignments')?.addEventListener('focusout', () => {
    global.setTimeout(() => { if (!$('liteMarketAssignments')?.contains(document.activeElement)) { lastSnapshot = ''; void refresh().catch(error => message(error.message)); } }, 0);
  });
  $('liteOpenSavedGame').addEventListener('click', async () => {
    const id = $('liteSavedGames').value;
    if (!id) return;
    gameId = id; const version = ++generation; lastSnapshot = '';
    try {
      await refresh();
      if (version !== generation || gameId !== id) return;
      try { sessionStorage.setItem('side-lite-teacher-game', id); } catch {}
      showTab('rondas');
    } catch (error) { if (version === generation) message(error.message); }
  });
  async function initialize() {
    if (authorized) return;
    authorized = true;
    void loadCatalog();
    const games = await listGames();
    let saved; try { saved = sessionStorage.getItem('side-lite-teacher-game'); } catch {}
    if (saved && games?.some(game => game.id === saved && game.teacher_id === global.SIDLiteTeacherIdentity.id)) {
      gameId = saved; generation++; lastSnapshot = '';
      try { await refresh(); showTab('rondas'); } catch (error) { message(error.message); }
    }
  }
  document.addEventListener('side-lite-teacher-ready', initialize, {once:true});
  if (global.SIDLiteTeacherIdentity) void initialize();
  global.addEventListener('online', () => { if (!authorized) return; if (eventCatalogError) void loadCatalog(); if (gameId) void refresh().catch(error => message(error.message)); });
  const poll = setInterval(() => { if (authorized && gameId && !document.hidden) void refresh().catch(error => message(error.message)); }, 5000);
  global.addEventListener('pagehide', event => { if (!event.persisted) { clearInterval(poll); clearInterval(timer); } });
})(window);
