/** Allow only this page's HTTPS origin (or loopback HTTP during development). */
export function recoveryRedirect(location) {
  const page = new URL(location.href);
  if (page.username || page.password || !(page.protocol === 'https:' || (page.protocol === 'http:' && ['localhost','127.0.0.1','[::1]'].includes(page.hostname)))) throw new Error('La recuperación requiere un sitio HTTPS seguro.');
  const local = page.protocol === 'http:' && ['localhost','127.0.0.1','[::1]'].includes(page.hostname);
  return page.origin + page.pathname + (local && page.searchParams.get('auth') === 'supabase' ? '?auth=supabase' : '');
}

/** Supabase Auth adapter. Authorization is performed by the server, never by user metadata. */
export function createSupabaseSession(client, fetcher = fetch, {captchaTokenProvider = null, loginCaptchaTokenProvider = captchaTokenProvider, registerCaptchaTokenProvider = captchaTokenProvider} = {}) {
  if (!client?.auth) throw new TypeError('Cliente de Supabase Auth no disponible.');
  let projectUrl;
  try { projectUrl = new URL(client.supabaseUrl); } catch { throw new TypeError('URL de Supabase no válida.'); }
  if (projectUrl.protocol !== 'https:' || projectUrl.hostname !== 'hwwwoblfpsqqrkxvclag.supabase.co' || projectUrl.port || projectUrl.username || projectUrl.password || projectUrl.pathname !== '/' || projectUrl.search || projectUrl.hash) throw new TypeError('El cliente no corresponde al proyecto SIDE-LITE confirmado.');
  const unwrap = result => {
    if (result?.error) throw new Error(result.error.message || 'No se pudo completar el acceso.');
    return result?.data;
  };
  async function captcha(provider=captchaTokenProvider) { if(!provider)return {}; const token=await provider(); if(typeof token!=='string'||!token)throw new Error('No se pudo verificar el acceso.'); return {captchaToken:token}; }
  async function requireCompletedMfa() {
    // Supabase supplies AAL2 only after the enrolled factor is verified. Never
    // treat a password-only AAL1 session as sufficient when AAL2 is required.
    if (typeof client.auth.mfa?.getAuthenticatorAssuranceLevel !== 'function') return;
    const assurance = unwrap(await client.auth.mfa.getAuthenticatorAssuranceLevel());
    if (assurance?.nextLevel === 'aal2' && assurance?.currentLevel !== 'aal2')
      throw Object.assign(new Error('Esta cuenta requiere verificación multifactor. Completa el segundo factor antes de continuar.'), {status:403,code:'MFA_REQUIRED'});
  }
  return {
    async register({email, password, name, firstName, lastName, course, redirectTo}) {
      const data = {display_name: name, ...(firstName ? {nombre:firstName} : {}), ...(lastName ? {apellido:lastName} : {}), ...(course ? {curso:course} : {})};
      return unwrap(await client.auth.signUp({email, password, options: {data, ...(redirectTo ? {emailRedirectTo: redirectTo} : {}), ...await captcha(registerCaptchaTokenProvider)}}));
    },
    async verifyEmail({email, otp}) {
      return unwrap(await client.auth.verifyOtp({email, token: otp, type: 'signup', ...((captchaTokenProvider) ? {options:await captcha()} : {})}));
    },
    async resendCode({email, redirectTo}) {
      return unwrap(await client.auth.resend({type: 'signup', email, ...((redirectTo||captchaTokenProvider) ? {options: {...(redirectTo ? {emailRedirectTo: redirectTo} : {}), ...await captcha()}} : {})}));
    },
    async signIn({email, password}) { return unwrap(await client.auth.signInWithPassword({email, password, ...(loginCaptchaTokenProvider ? {options:await captcha(loginCaptchaTokenProvider)} : {})})); },
    async signInGuest() { const existing=unwrap(await client.auth.getSession())?.session; if(existing?.user?.is_anonymous === true)return existing; if(existing)throw new Error('Cierra tu sesión actual antes de entrar como invitado.'); const data=unwrap(await client.auth.signInAnonymously(captchaTokenProvider ? {options:await captcha()} : undefined)); if(data?.user?.is_anonymous!==true || !data?.session?.access_token)throw new Error('No se pudo crear la sesión de invitado.'); return data.session; },
    async identity() {
      // request() already enforces session, confirmed email, MFA and the
      // server-authoritative role. Do not repeat the same Auth checks.
      return this.request('/me');
    },
    async mfaFactors() {
      const data=unwrap(await client.auth.mfa.listFactors());
      return (data?.totp || []).filter(f=>f.status==='verified').map(f=>({id:f.id,name:f.friendly_name || 'Aplicación autenticadora'}));
    },
    async verifyMfa({factorId,code}) {
      if(typeof factorId!=='string'||!factorId||typeof code!=='string'||!/^\d{6}$/.test(code))throw new Error('Ingresa el código de seis dígitos de tu aplicación.');
      const challenge=unwrap(await client.auth.mfa.challenge({factorId}));
      unwrap(await client.auth.mfa.verify({factorId,challengeId:challenge.id,code}));
      await requireCompletedMfa();
    },
    async signOut() { unwrap(await client.auth.signOut({scope: 'local'})); },
    async session() { return unwrap(await client.auth.getSession()); },
    async resetPassword({email, redirectTo}) {
      return unwrap(await client.auth.resetPasswordForEmail(email, (redirectTo||captchaTokenProvider) ? {...(redirectTo ? {redirectTo} : {}), ...await captcha()} : undefined));
    },
    onPasswordRecovery(handler) {
      if (typeof handler !== 'function' || typeof client.auth.onAuthStateChange !== 'function') return null;
      return client.auth.onAuthStateChange((event) => { if (event === 'PASSWORD_RECOVERY') setTimeout(handler, 0); });
    },
    async updatePassword(password) { return unwrap(await client.auth.updateUser({password})); },
    async request(path, method = 'GET', body) {
      if (typeof path !== 'string' || !/^\/(?!\/)[A-Za-z0-9/_-]*$/.test(path)) throw new Error('Ruta de API inválida.');
      const session = unwrap(await client.auth.getSession())?.session;
      if (!session?.access_token) throw Object.assign(new Error('Tu sesión terminó. Vuelve a iniciar sesión.'), {status: 401});
      // This is only a UX check; the API must validate the JWT and authorization independently.
      if (!session.user?.email_confirmed_at && session.user?.is_anonymous !== true) throw Object.assign(new Error('Verifica tu correo antes de continuar.'), {status: 403});
      await requireCompletedMfa();
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12000);
      let response, data;
      try { response = await fetcher('https://hwwwoblfpsqqrkxvclag.supabase.co/functions/v1/side-lite-api/api' + path, {signal:controller.signal, method, headers: {Authorization: `Bearer ${session.access_token}`, apikey: 'sb_publishable_52fukw__BaCel-Igx5e0vg_RgsvhxiN', ...(body !== undefined ? {'Content-Type': 'application/json'} : {})}, body: body !== undefined ? JSON.stringify(body) : undefined, cache: 'no-store', credentials: 'omit', redirect: 'error'}); data = await response.json().catch(error => { if(controller.signal.aborted) throw error; return {}; }); }
      catch(error) { if(controller.signal.aborted) throw new Error('La conexión tardó demasiado. Inténtalo de nuevo.'); throw error; }
      finally { clearTimeout(timeout); }
      if (!response.ok) throw Object.assign(new Error(data.error || 'No se pudo completar la solicitud.'), {status: response.status});
      return data;
    }
  };
}
