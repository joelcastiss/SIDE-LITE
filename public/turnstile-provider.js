/** One fresh, single-use challenge per Auth request. Supabase verifies the token. */
export function createTurnstileProvider({siteKey,document:doc=globalThis.document,window:win=globalThis.window,timeoutMs=15000,scriptTimeoutMs=10000}={}) {
 if (!siteKey) return null;
 if(typeof siteKey!=='string'||!/^[A-Za-z0-9_-]{10,100}$/.test(siteKey))throw new Error('Configuración de protección automática inválida.');
 let scriptPromise;
 function load(){
  if(win.turnstile?.render)return Promise.resolve(win.turnstile);
  if(scriptPromise)return scriptPromise;
  scriptPromise=new Promise((resolve,reject)=>{
   const script=doc.createElement('script');script.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';script.async=true;script.defer=true;
   const timer=setTimeout(()=>{script.remove();reject(Error('No se pudo cargar la verificación. Inténtalo de nuevo.'))},scriptTimeoutMs);
   script.onload=()=>{clearTimeout(timer);if(win.turnstile?.render)resolve(win.turnstile);else reject(Error('No se pudo cargar la verificación.'))};
   script.onerror=()=>{clearTimeout(timer);script.remove();reject(Error('No se pudo cargar la verificación. Inténtalo de nuevo.'))};
   doc.head.append(script);
  }).catch(err=>{scriptPromise=null;throw err});
  return scriptPromise;
 }
 const verify=async function verify(){
  const api=await load(),host=doc.querySelector('#modalRoot:not(.hidden) .modal:not(.hidden)')||doc.body,container=doc.createElement('div');host.append(container);
  return new Promise((resolve,reject)=>{
   let widget,finished=false;const finish=(err,token)=>{if(finished)return;finished=true;clearTimeout(timer);try{if(widget!==undefined)api.remove(widget)}finally{container.remove()}if(err)reject(err);else resolve(token)};
   const timer=setTimeout(()=>finish(Error('La verificación tardó demasiado. Inténtalo de nuevo.')),timeoutMs);
   try{widget=api.render(container,{sitekey:siteKey,execution:'execute',appearance:'interaction-only',callback:token=>typeof token==='string'&&token?finish(null,token):finish(Error('No se pudo verificar el acceso.')),'error-callback':()=>finish(Error('No se pudo verificar el acceso.')),'expired-callback':()=>finish(Error('La verificación venció. Inténtalo de nuevo.'))});api.execute(widget)}catch{finish(Error('No se pudo iniciar la verificación.'))}
  });
 } verify.preload=load;
 return verify;
}
