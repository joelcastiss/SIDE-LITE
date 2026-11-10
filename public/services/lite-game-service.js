/* SIDE Lite API bridge. Authentication and all game state remain server-owned. */
(function (global) {
  'use strict';
  let activeRole = 'student';
  const clients = () => global.SIDE?.SupabaseClient;
  const client = role => role === 'teacher' ? clients()?.get() : clients()?.getStudent();
  const apiRoot = 'https://hwwwoblfpsqqrkxvclag.supabase.co/functions/v1/side-lite-api/api';
  const apiKey = 'sb_publishable_52fukw__BaCel-Igx5e0vg_RgsvhxiN';

  async function request(path, method = 'GET', body, role = activeRole) {
    if (!/^\/(?!\/)[A-Za-z0-9/_-]*$/.test(path)) throw new Error('Ruta de API inválida.');
    const auth = client(role)?.auth;
    if (!auth) throw new Error('No se pudo iniciar la conexión.');
    const sessionResult = await auth.getSession();
    if (sessionResult.error) throw sessionResult.error;
    const session = sessionResult.data?.session;
    if (!session?.access_token) throw new Error('Tu sesión terminó. Vuelve a ingresar.');
    if (role === 'teacher' && typeof auth.mfa?.getAuthenticatorAssuranceLevel === 'function') {
      const result = await auth.mfa.getAuthenticatorAssuranceLevel();
      if (result.error) throw result.error;
      if (result.data?.nextLevel === 'aal2' && result.data?.currentLevel !== 'aal2') throw new Error('Completa la verificación multifactor.');
    }
    const response = await global.fetch(apiRoot + path, {
      method, headers: {Authorization: `Bearer ${session.access_token}`, apikey: apiKey,
        ...(body === undefined ? {} : {'Content-Type': 'application/json'})},
      ...(body === undefined ? {} : {body: JSON.stringify(body)}),
      cache: 'no-store', credentials: 'omit', redirect: 'error'
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw Object.assign(new Error(data.error || 'No se pudo completar la solicitud.'), {status: response.status});
    return data;
  }

  function recoverySecret(code) {
    const key = 'side-lite-guest-join-' + code;
    try {
      let secret = global.localStorage.getItem(key);
      if (!/^[A-Za-z0-9_-]{43}$/.test(secret || '')) {
        const bytes = global.crypto.getRandomValues(new Uint8Array(32));
        secret = global.btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
        global.localStorage.setItem(key, secret);
      }
      return secret;
    } catch { throw new Error('Habilita el almacenamiento del navegador para proteger el acceso a tu empresa.'); }
  }

  function rememberedCompany(code) {
    try {
      for (let i = 0; i < global.localStorage.length; i++) {
        const key = global.localStorage.key(i);
        if (!key?.startsWith('side-lite-guest-') || key.startsWith('side-lite-guest-join-')) continue;
        const value = JSON.parse(global.localStorage.getItem(key));
        if (value?.code === code && /^[A-Za-z0-9_-]{43}$/.test(value.secret || '')) return {key, ...value};
      }
    } catch { throw new Error('No se pudo leer la recuperación de tu empresa.'); }
    return null;
  }

  function freshSecret() {
    const bytes = global.crypto.getRandomValues(new Uint8Array(32));
    return global.btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  async function studentIdentity(name) {
    const auth = client('student')?.auth;
    if (!auth) throw new Error('No se pudo iniciar la conexión.');
    let result = await auth.getSession();
    if (result.error) throw result.error;
    let session = result.data?.session;
    if (!session) {
      const [{createTurnstileProvider}, {turnstileSiteKey}] = await Promise.all([
        import('../turnstile-provider.js'), import('../captcha-config.js')
      ]);
      const verify = createTurnstileProvider({siteKey: turnstileSiteKey});
      if (!verify) throw new Error('No está disponible la verificación de acceso.');
      result = await auth.signInAnonymously({options: {captchaToken: await verify()}});
      if (result.error) throw result.error;
      session = result.data?.session;
    }
    if (!session?.user?.is_anonymous) throw new Error('Cierra la sesión de estudiante anterior antes de continuar.');
    let identity;
    try { identity = await request('/me', 'GET', undefined, 'student'); }
    catch (error) {
      if (error.status !== 409) throw error;
      await request('/profile', 'POST', {display_name: name}, 'student');
      identity = await request('/me', 'GET', undefined, 'student');
    }
    if (identity.role !== 'student') throw new Error('La sesión no pertenece a un estudiante.');
  }

  async function joinGame({code, name, brand}) {
    code = String(code || '').trim().toUpperCase();
    name = String(name || '').trim();
    brand = String(brand || '').trim();
    if (!/^[0-9A-F]{8}$/.test(code)) throw new Error('El código debe tener ocho caracteres hexadecimales.');
    await studentIdentity(name);
    // An existing anonymous session must reopen its own company instead of
    // trying to insert a second one, including after the game has started.
    const games = await request('/games', 'GET', undefined, 'student');
    if (!Array.isArray(games)) throw new Error('No se pudieron consultar tus partidas.');
    const previous = games.find(game => game.code === code);
    if (previous) {
      const snapshot = await request('/games/' + previous.id, 'GET', undefined, 'student');
      if (!snapshot?.company?.id) throw new Error('No se pudo recuperar tu empresa.');
      activeRole = 'student';
      return {...snapshot.company, game_id: previous.id};
    }
    const saved = rememberedCompany(code);
    if (saved) {
      // A timeout can follow a committed rotation. Retain each possible secret
      // until a response confirms which one is current, including across reloads.
      const candidates = [...new Set([saved.secret, saved.pendingSecret, ...(Array.isArray(saved.candidates) ? saved.candidates : [])]
        .filter(value => /^[A-Za-z0-9_-]{43}$/.test(value || '')))];
      if (candidates.length > 8) throw new Error('No se pudo confirmar la recuperación. Contacta al docente.');
      for (const current of [...candidates]) {
        const next = freshSecret();
        global.localStorage.setItem(saved.key, JSON.stringify({code, secret: saved.secret, candidates: [...candidates, next]}));
        let company;
        try {
          company = await request('/guest/recover', 'POST', {code, recoverySecret: current, newRecoverySecret: next}, 'student');
        } catch (error) {
          if (error.status === 403) continue;
          throw error;
        }
        if (!company?.game_id) throw new Error('El servidor no confirmó la recuperación.');
        global.localStorage.setItem(saved.key, JSON.stringify({code, secret: next}));
        activeRole = 'student';
        return company;
      }
      throw new Error('No se pudo recuperar la empresa. Comprueba el código o contacta al docente.');
    }
    const secret = recoverySecret(code);
    const company = await request('/join', 'POST', {code, name, brand, recoverySecret: secret}, 'student');
    if (company.recoverySecret !== secret || !company.game_id) throw new Error('El servidor no confirmó el acceso.');
    try {
      global.localStorage.setItem('side-lite-guest-' + company.game_id, JSON.stringify({code, secret}));
      global.localStorage.removeItem('side-lite-guest-join-' + code);
    } catch { /* Pending secret remains available for safe retry. */ }
    activeRole = 'student';
    return company;
  }

  async function createGame(config) {
    const game = await request('/games', 'POST', config, 'teacher');
    if (!game?.id || !game?.code) throw new Error('El servidor no confirmó la partida.');
    activeRole = 'teacher';
    return game;
  }
  global.SIDLiteGame = {
    request, createGame, joinGame,
    getGame: id => request('/games/' + id),
    startGame: id => request('/games/' + id + '/start', 'POST', {}, 'teacher'),
    useRole: role => { if (!['teacher', 'student'].includes(role)) throw new Error('Perfil inválido.'); activeRole = role; }
  };
})(window);
