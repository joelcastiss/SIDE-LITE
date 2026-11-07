/** Adapter for the official Managed Neon Auth client. Tokens stay in memory. */
export function createNeonSession(client, fetcher = fetch) {
  const unwrap = result => {
    if (result?.error) throw new Error(result.error.message || 'No se pudo completar el acceso.');
    return result?.data;
  };
  return {
    async register({email,password,name}) { return unwrap(await client.signUp.email({email,password,name})); },
    async verifyEmail({email,otp}) { const result=unwrap(await client.emailOtp.verifyEmail({email,otp})); if(result?.status!==true)throw new Error('No se pudo verificar el código.'); return result; },
    async resendCode({email}) { return unwrap(await client.emailOtp.sendVerificationOtp({email,type:'email-verification'})); },
    async signIn({email,password}) { return unwrap(await client.signIn.email({email,password})); },
    async signOut() { unwrap(await client.signOut()); },
    async session() { return unwrap(await client.getSession()); },
    async request(path,method='GET',body) {
      const session=unwrap(await client.getSession());
      if (!session?.user) throw Object.assign(new Error('Tu sesión terminó. Vuelve a iniciar sesión.'),{status:401});
      if (session.user.emailVerified !== true) throw Object.assign(new Error('Verifica tu correo antes de continuar.'),{status:403});
      const token=unwrap(await client.token())?.token;
      if (!token) throw Object.assign(new Error('Tu sesión terminó. Vuelve a iniciar sesión.'),{status:401});
      const response=await fetcher('/api'+path,{method,headers:{Authorization:`Bearer ${token}`,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,cache:'no-store'});
      const data=await response.json();
      if(!response.ok) throw Object.assign(new Error(data.error || 'No se pudo completar la solicitud.'),{status:response.status});
      return data;
    }
  };
}
