(function (global) {
  'use strict';
  const api = global.SIDLiteGame;
  if (!api || !document.getElementById('startGame')) return;
  api.useRole('teacher');
  const $ = id => document.getElementById(id);
  let gameId = null, loading = false, timer = null;
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
  for (const selector of ['.integration-note', '.native-choice-row:has(#cycleModeManual)', '#manualCycleDisclaimer', '#automaticCycleConfig', '.events-config-summary']) {
    document.querySelectorAll(selector).forEach(element => { element.hidden = true; element.style.display = 'none'; });
  }
  document.querySelector('.config-start-footer p').textContent = 'Crea la sala y comparte el código. Cada ciclo dura 120 segundos.';
  for (const id of ['cutRound', 'startCycle1Btn']) if ($(id)) { $(id).hidden = true; $(id).style.display = 'none'; }
  for (const id of ['viewPdf', 'downloadPdf', 'resultCompanySelect', 'refreshReports', 'openEventPicker', 'copyGameLink', 'copyGameCode', 'copyLobbyCode', 'cancelGame', 'clearEvents']) if ($(id)) { $(id).hidden = true; $(id).style.display = 'none'; }
  document.querySelectorAll('.nav-btn').forEach(button => {
    if (!['configuracion', 'rondas', 'empresas', 'resultados'].includes(button.dataset.tab)) { button.hidden = true; button.style.display = 'none'; }
  });

  function showTab(name) {
    document.querySelectorAll('.nav-btn').forEach(el => el.classList.toggle('active', el.dataset.tab === name));
    document.querySelectorAll('.tab-panel').forEach(el => { el.classList.toggle('active', el.id === 'tab-' + name); if (el.id === 'tab-' + name) el.classList.remove('hidden'); });
  }
  function render(snapshot) {
    const game = snapshot.game, cycle = snapshot.cycles?.at(-1);
    document.querySelector('.nav-btn[data-tab="rondas"]')?.classList.remove('hidden');
    if ($('gameCode')) $('gameCode').value = game.code;
    for (const id of ['gameCodeBadge', 'lobbyCode']) if ($(id)) $(id).textContent = game.code;
    $('teacherLobby')?.classList.remove('hidden');
    if ($('lobbyCompanies')) $('lobbyCompanies').textContent = snapshot.companies.length ? snapshot.companies.map(x => x.name).join(' · ') : 'Esperando empresas.';
    if ($('lobbyCountdown')) $('lobbyCountdown').textContent = cycle ? `Ciclo ${cycle.number} de ${game.cycle_count}` : 'La sala está abierta para estudiantes.';
    if ($('roundDisplay')) $('roundDisplay').textContent = `${cycle?.number || 0} / ${game.cycle_count}`;
    if ($('roundState')) $('roundState').textContent = cycle?.status === 'open' ? 'En curso' : cycle ? 'Cerrado' : 'Sala abierta';
    if ($('roundSummary')) $('roundSummary').textContent = cycle?.status === 'open' ? 'El ciclo está en curso.' : 'Inicia el siguiente ciclo cuando todos estén listos.';
    if ($('startTimer')) { $('startTimer').textContent = cycle ? 'Iniciar siguiente ciclo' : 'Iniciar ciclo'; $('startTimer').disabled = cycle?.status === 'open' || !!(cycle && cycle.number >= game.cycle_count); }
    if ($('advanceRound')) $('advanceRound').disabled = $('startTimer')?.disabled || false;
    if ($('companiesLiveStatus')) $('companiesLiveStatus').textContent = `${snapshot.companies.length} empresas registradas`;
    const grid = $('companiesGrid');
    if (grid) { grid.replaceChildren(); for (const company of snapshot.companies) { const card = document.createElement('article'); card.className = 'card'; const title = document.createElement('h3'); title.textContent = company.name; const detail = document.createElement('p'); detail.textContent = `${company.store || ''} · ${snapshot.decisions?.some(d => d.company_id === company.id && d.confirmed) ? 'Decisión confirmada' : 'Decisión pendiente'}`; card.append(title, detail); grid.append(card); } }
    const reports = $('detailReports');
    if (reports) { reports.replaceChildren(); for (const item of snapshot.ranking || []) { const line = document.createElement('p'); line.textContent = `${item.name}: ${Number(item.returnPercent).toFixed(1)} % de rentabilidad`; reports.append(line); } for (const item of snapshot.results || []) { const line = document.createElement('p'); const company = snapshot.companies.find(c => c.id === item.company_id); line.textContent = `${company?.name || 'Empresa'} · Ciclo ${item.number} · utilidad S/ ${Number(item.result?.profit || 0).toLocaleString('es-PE')}`; reports.append(line); } }
    clearInterval(timer);
    if (cycle?.status === 'open') {
      const remaining = Math.max(0, Date.parse(cycle.ends_at) - Date.parse(cycle.server_now || new Date().toISOString()));
      const deadline = performance.now() + remaining;
      const paint = () => { const s = Math.max(0, Math.ceil((deadline - performance.now()) / 1000)); if ($('roundTimer')) $('roundTimer').textContent = `00:${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; };
      paint(); timer = setInterval(paint, 1000);
    }
  }
  async function refresh() { if (gameId) render(await api.getGame(gameId)); }
  async function create() {
    if (loading) return;
    loading = true;
    try {
      const fixed = document.querySelector('input[name="capitalMode"]:checked')?.value !== 'random';
      const capitalMin = Number(fixed ? $('capital').value : $('capitalMin').value);
      const capitalMax = Number(fixed ? $('capital').value : $('capitalMax').value);
      const game = await api.createGame({name: $('gameName').value.trim(), cycleCount: Number($('cycles').value), duration: 120, capitalMin, capitalMax, costs: {basic: Number($('liteCostBasic').value), standard: Number($('liteCostStandard').value), premium: Number($('liteCostPremium').value)}, events: []});
      gameId = game.id;
      try { sessionStorage.setItem('side-lite-teacher-game', gameId); } catch { /* The room remains available in this tab. */ }
      await refresh(); showTab('rondas'); message('Sala creada. Código: ' + game.code);
    } catch (error) { message(error.message || 'No se pudo crear la partida.'); }
    finally { loading = false; }
  }
  async function start() { if (!gameId || loading) return; loading = true; try { await api.startGame(gameId); await refresh(); } catch (error) { message(error.message || 'No se pudo iniciar el ciclo.'); } finally { loading = false; } }
  for (const type of ['input', 'change']) document.addEventListener(type, event => {
    if (!event.target.closest('#tab-configuracion')) return;
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
    if (['startGame', 'retryCreate', 'startTimer', 'advanceRound', 'startCycle1Btn'].includes(button.id)) {
      event.preventDefault(); event.stopImmediatePropagation();
      if (button.id === 'startGame' || button.id === 'retryCreate') void create(); else void start();
    } else if (button.dataset.tab && ['configuracion', 'rondas', 'empresas', 'resultados'].includes(button.dataset.tab)) {
      event.preventDefault(); event.stopImmediatePropagation(); showTab(button.dataset.tab); void refresh().catch(e => message(e.message));
    }
  }, true);
  try { gameId = sessionStorage.getItem('side-lite-teacher-game'); } catch { /* Session storage is optional. */ }
  if (gameId) void refresh().catch(error => { gameId = null; message(error.message); });
  setInterval(() => { if (gameId && !document.hidden) void refresh().catch(error => message(error.message)); }, 5000);
})(window);
