/** Allow only this page's HTTPS origin (or loopback HTTP during development). */
export function recoveryRedirect(location) {
  const page = new URL(location.href);
  if (page.username || page.password || !(page.protocol === 'https:' || (page.protocol === 'http:' && ['localhost','127.0.0.1','[::1]'].includes(page.hostname)))) throw new Error('La recuperación requiere un sitio HTTPS seguro.');
  return page.origin + page.pathname;
}

/** Supabase Auth adapter. Authorization is performed by the server, never by user metadata. */
export function createSupabaseSession(client, fetcher = fetch) {
  if (!client?.auth) throw new TypeError('Cliente de Supabase Auth no disponible.');
  let projectUrl;
  try { projectUrl = new URL(client.supabaseUrl); } catch { throw new TypeError('URL de Supabase no válida.'); }
  if (projectUrl.protocol !== 'https:' || projectUrl.hostname !== 'hwwwoblfpsqqrkxvclag.supabase.co' || projectUrl.port || projectUrl.username || projectUrl.password || projectUrl.pathname !== '/' || projectUrl.search || projectUrl.hash) throw new TypeError('El cliente no corresponde al proyecto SIDE-LITE confirmado.');
  const unwrap = result => {
    if (result?.error) throw new Error(result.error.message || 'No se pudo completar el acceso.');
    return result?.data;
  };
  return {
    async register({email, password, name}) {
      return unwrap(await client.auth.signUp({email, password, options: {data: {display_name: name}}}));
    },
    async verifyEmail({email, otp}) {
      return unwrap(await client.auth.verifyOtp({email, token: otp, type: 'signup'}));
    },
    async resendCode({email}) { return unwrap(await client.auth.resend({type: 'signup', email})); },
    async signIn({email, password}) { return unwrap(await client.auth.signInWithPassword({email, password})); },
    async signOut() { unwrap(await client.auth.signOut({scope: 'local'})); },
    async session() { return unwrap(await client.auth.getSession()); },
    async resetPassword({email, redirectTo}) {
      return unwrap(await client.auth.resetPasswordForEmail(email, redirectTo ? {redirectTo} : undefined));
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
      if (!session.user?.email_confirmed_at) throw Object.assign(new Error('Verifica tu correo antes de continuar.'), {status: 403});
      const response = await fetcher('/api' + path, {method, headers: {Authorization: `Bearer ${session.access_token}`, ...(body !== undefined ? {'Content-Type': 'application/json'} : {})}, body: body !== undefined ? JSON.stringify(body) : undefined, cache: 'no-store', credentials: 'same-origin', redirect: 'error'});
      const data = await response.json();
      if (!response.ok) throw Object.assign(new Error(data.error || 'No se pudo completar la solicitud.'), {status: response.status});
      return data;
    }
  };
}
