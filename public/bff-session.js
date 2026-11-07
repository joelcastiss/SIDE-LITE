// SIDE Lite same-origin browser adapter: no Neon JWT or preview key in browser.
export function createBffSession(fetcher=fetch){
 async function send(path,method='GET',body){
  const r=await fetcher(path,{method,credentials:'same-origin',cache:'no-store',
   headers:body===undefined?{}:{'content-type':'application/json'},
   body:body===undefined?undefined:JSON.stringify(body)});
  let data;try{data=await r.json()}catch{throw Object.assign(Error('Respuesta inválida'),{status:r.status})}
  if(!r.ok)throw Object.assign(Error(data.error||'Error de conexión'),{status:r.status});
  return data;
 }
 return {
  register:data=>send('/auth/register','POST',data),
  signIn:data=>send('/auth/login','POST',data),
  signOut:()=>send('/auth/logout','POST',{}),
  session:()=>send('/auth/session'),
  verifyEmail:data=>send('/auth/verify','POST',data),
  resendCode:data=>send('/auth/resend','POST',data),
  request:(path,method='GET',body)=>send('/api'+path,method,body)
 };
}
